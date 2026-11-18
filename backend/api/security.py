"""
GateVault Security Module
Centralized utilities for authentication security, rate-limiting, lockout management,
password complexity enforcement, token revocation, and security audit logging.
"""

import os
import re
import time
import secrets
import logging
from datetime import datetime, timezone, timedelta
from django.core.cache import cache
from django.db import IntegrityError, OperationalError
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from rest_framework import serializers, exceptions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.exceptions import (
    Throttled, AuthenticationFailed, NotAuthenticated,
    PermissionDenied as DRFPermissionDenied, ValidationError
)
from rest_framework_simplejwt.authentication import JWTAuthentication

# Dedicated Security Audit Logger
security_logger = logging.getLogger('gatevault.security')

# Security Thresholds
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION = 900   # 15 minutes in seconds
FAILURE_WINDOW = 900     # 15 minutes window for failure counting
MIN_PASSWORD_LENGTH = 12

def get_client_ip(request):
    """
    Extracts the sanitized client IP address from the request.
    Handles reverse-proxies (Nginx, Docker, Cloudflare) via X-Forwarded-For.
    """
    if not request:
        return '127.0.0.1'
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
    return ip


def log_security_event(event_type, details):
    """
    Standardized, privacy-compliant audit logger.
    CRITICAL: Never logs passwords, secrets, or JWT token payloads.
    """
    sanitized = {
        k: v for k, v in details.items()
        if k.lower() not in ('password', 'token', 'refresh', 'access', 'secret', 'key')
    }
    iso_time = datetime.now(timezone.utc).isoformat()
    msg = f"[{event_type}] timestamp={iso_time} " + " ".join(f"{k}={v}" for k, v in sanitized.items())
    
    if any(keyword in event_type for keyword in ('LOCKOUT', 'FAILURE', 'DEACTIVATED', 'UNAUTHORIZED', 'ATTACK')):
        security_logger.warning(msg)
    else:
        security_logger.info(msg)


def get_lockout_status(username, ip_address):
    """
    Checks if a username or IP is temporarily locked out due to repeated failures.
    Returns: (is_locked: bool, remaining_seconds: int)
    """
    now = time.time()
    
    # Check username-specific lockout
    if username:
        user_key = f"lockout:user:{username.lower().strip()}"
        locked_until = cache.get(user_key)
        if locked_until and locked_until > now:
            return True, int(locked_until - now)

    # Check IP-specific lockout
    if ip_address:
        ip_key = f"lockout:ip:{ip_address}"
        locked_until = cache.get(ip_key)
        if locked_until and locked_until > now:
            return True, int(locked_until - now)

    return False, 0


def record_failed_login(username, ip_address):
    """
    Tracks failed login attempts for a username and IP within the failure window.
    Applies temporary lockout if failures meet or exceed MAX_FAILED_ATTEMPTS.
    Returns: (is_locked_now: bool, lockout_duration: int)
    """
    now = time.time()

    if username:
        user_key = f"fails:user:{username.lower().strip()}"
        attempts = cache.get(user_key, [])
        # Keep only attempts within the sliding window
        attempts = [t for t in attempts if now - t < FAILURE_WINDOW]
        attempts.append(now)
        cache.set(user_key, attempts, FAILURE_WINDOW)

        if len(attempts) >= MAX_FAILED_ATTEMPTS:
            lockout_key = f"lockout:user:{username.lower().strip()}"
            cache.set(lockout_key, now + LOCKOUT_DURATION, LOCKOUT_DURATION)
            log_security_event('AUTH_LOCKOUT_TRIGGERED', {
                'username': username,
                'ip': ip_address,
                'attempts': len(attempts),
                'lockout_seconds': LOCKOUT_DURATION
            })
            return True, LOCKOUT_DURATION

    if ip_address:
        ip_key = f"fails:ip:{ip_address}"
        attempts = cache.get(ip_key, [])
        attempts = [t for t in attempts if now - t < FAILURE_WINDOW]
        attempts.append(now)
        cache.set(ip_key, attempts, FAILURE_WINDOW)

        # Allow double attempts per IP to avoid locking out shared networks / NATs prematurely
        if len(attempts) >= (MAX_FAILED_ATTEMPTS * 3):
            ip_lockout_key = f"lockout:ip:{ip_address}"
            cache.set(ip_lockout_key, now + LOCKOUT_DURATION, LOCKOUT_DURATION)
            log_security_event('AUTH_LOCKOUT_IP_TRIGGERED', {
                'ip': ip_address,
                'attempts': len(attempts),
                'lockout_seconds': LOCKOUT_DURATION
            })
            return True, LOCKOUT_DURATION

    return False, 0


def record_successful_login(username, ip_address):
    """
    Clears failed login attempt counters and locks upon verified login.
    """
    if username:
        clean_user = username.lower().strip()
        cache.delete(f"fails:user:{clean_user}")
        cache.delete(f"lockout:user:{clean_user}")


def validate_password_complexity(password):
    """
    Enforces GateVault enterprise password security policy:
    1. Minimum 12 characters
    2. At least one uppercase letter (A-Z)
    3. At least one lowercase letter (a-z)
    4. At least one numeric digit (0-9)
    5. At least one special character (!@#$%^&*...)
    6. Rejection of predictable or common dictionary patterns
    """
    if not password:
        raise serializers.ValidationError("Password is required and cannot be blank.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise serializers.ValidationError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters long."
        )

    if not re.search(r'[A-Z]', password):
        raise serializers.ValidationError("Password must contain at least one uppercase letter (A-Z).")

    if not re.search(r'[a-z]', password):
        raise serializers.ValidationError("Password must contain at least one lowercase letter (a-z).")

    if not re.search(r'\d', password):
        raise serializers.ValidationError("Password must contain at least one numeric digit (0-9).")

    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]', password):
        raise serializers.ValidationError(
            "Password must contain at least one special character (e.g. !@#$%^&*)."
        )

    # Check for trivially guessable sequences and dictionary roots
    forbidden_patterns = [
        'password', 'gatevault', '12345678', 'qwerty', 'admin123',
        'resident123', 'guardpass', 'welcome123', 'abcdef'
    ]
    lower_pw = password.lower()
    for pat in forbidden_patterns:
        if pat in lower_pw:
            raise serializers.ValidationError(
                "Password contains a predictable word or common pattern. Please choose a more complex password."
            )

    return True


def blacklist_token(token_string):
    """
    Revokes/blacklists a refresh token string using SimpleJWT and cache.
    """
    if not token_string:
        return False
    try:
        from rest_framework_simplejwt.tokens import RefreshToken
        token = RefreshToken(token_string)
        try:
            token.blacklist()
        except Exception:
            # Fallback: track revoked JTI in cache for its lifetime
            jti = token.get('jti')
            exp = token.get('exp')
            if jti and exp:
                remaining = max(0, int(exp - time.time()))
                cache.set(f"revoked_token:{jti}", True, timeout=remaining)
        return True
    except Exception:
        return False


# ==============================================================================
# CONFIGURABLE RATE LIMITING THROTTLES
# ==============================================================================

class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'
    rate = '15/minute'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'
    rate = '10/hour'


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = 'password_reset'
    rate = '5/hour'


class OtpVerifyRateThrottle(AnonRateThrottle):
    scope = 'otp_verify'
    rate = '10/minute'


class PinVerifyRateThrottle(UserRateThrottle):
    scope = 'pin_verify'
    rate = '30/minute'


class QrVerifyRateThrottle(UserRateThrottle):
    scope = 'qr_verify'
    rate = '30/minute'


class ParcelIntakeRateThrottle(UserRateThrottle):
    scope = 'parcel_intake'
    rate = '60/minute'


class SensitiveAdminRateThrottle(UserRateThrottle):
    scope = 'sensitive_admin'
    rate = '30/minute'


# ==============================================================================
# AUTHENTICATION & REVOCATION SECURITY
# ==============================================================================

def is_token_blacklisted(jti):
    """Checks whether a token JTI has been revoked/blacklisted in cache."""
    if not jti:
        return False
    return bool(cache.get(f"revoked_token:{jti}"))


class GateVaultJWTAuthentication(JWTAuthentication):
    """
    Enhanced JWT Authentication for GateVault:
    - Validates signature, expiration, and token claims
    - Checks JTI against token revocation blacklist in cache
    - Enforces active status check: immediately denies access if user account has been deactivated
    - Records security audit events on token reuse / revoked token usage
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception as e:
            log_security_event('AUTH_INVALID_TOKEN', {
                'ip': get_client_ip(request),
                'error': str(e)
            })
            raise exceptions.AuthenticationFailed("Invalid or expired authentication token.")

        # Check token revocation in cache
        jti = validated_token.get('jti')
        if jti and (is_token_blacklisted(jti) or cache.get(f"revoked_token:{jti}")):
            record_audit_event(
                event_type='TOKEN_REUSE_ATTEMPT',
                action_description=f"Attempt to access API with revoked token JTI '{jti}'.",
                actor_role='ANONYMOUS',
                status='BLOCKED',
                severity='HIGH',
                ip_address=get_client_ip(request),
                metadata={'jti': jti}
            )
            raise exceptions.AuthenticationFailed("This token has been revoked or session invalidated. Please log in again.")

        user = self.get_user(validated_token)
        if not user:
            raise exceptions.AuthenticationFailed("User not found.")

        if not user.is_active:
            record_audit_event(
                event_type='INACTIVE_ACCOUNT_ACCESS_BLOCKED',
                action_description=f"Deactivated user '{user.username}' attempted API access with valid token.",
                actor=user,
                target_entity_type='User',
                target_entity_id=user.id,
                status='BLOCKED',
                severity='HIGH',
                ip_address=get_client_ip(request)
            )
            trigger_or_update_security_alert(
                alert_type='INACTIVE_ACCOUNT_ACTIVITY',
                title=f"Deactivated Account Access: {user.username}",
                severity='HIGH',
                affected_user=user,
                affected_username=user.username,
                source_ip=get_client_ip(request),
                details=f"Deactivated or disabled user {user.username} attempted API access.",
                threshold_limit=1
            )
            raise exceptions.AuthenticationFailed("Account is deactivated or disabled. Please contact administrator.")

        return user, validated_token


# ==============================================================================
# CENTRALIZED SAFE EXCEPTION HANDLER
# ==============================================================================

def gatevault_exception_handler(exc, context):
    """
    Centralized, production-safe API exception handler.
    - Sanitizes errors so stack traces, database schema, or internal credentials are never exposed
    - Returns standardized JSON error structures
    - Handles HTTP 429 throttling with Retry-After header and audit tracking
    - Maps database integrity errors to safe messages
    - Integrates with security audit logging
    """
    from rest_framework.views import exception_handler as drf_exception_handler
    response = drf_exception_handler(exc, context)
    request = context.get('request')
    ip = get_client_ip(request) if request else '127.0.0.1'
    user = getattr(request, 'user', None)
    username = user.username if user and getattr(user, 'is_authenticated', False) else 'anonymous'

    # 1. Throttling Rate-Limit Exceeded (HTTP 429)
    if isinstance(exc, (Throttled, exceptions.Throttled)):
        wait = getattr(exc, 'wait', 60)
        data = {
            'error': 'Request rate limit exceeded. Please wait before retrying.',
            'detail': str(exc.detail),
            'retry_after_seconds': wait
        }
        response = Response(data, status=status.HTTP_429_TOO_MANY_REQUESTS)
        response['Retry-After'] = str(int(wait))
        record_audit_event(
            event_type='RATE_LIMIT_VIOLATION',
            action_description=f"Rate limit exceeded on path '{request.path if request else 'unknown'}'. Wait: {wait}s.",
            actor=user if user and user.is_authenticated else None,
            actor_username=username,
            status='BLOCKED',
            severity='MEDIUM',
            ip_address=ip,
            metadata={'path': request.path if request else '', 'wait_seconds': wait}
        )
        return response

    # 2. Authentication Failures (HTTP 401)
    if isinstance(exc, (AuthenticationFailed, NotAuthenticated, exceptions.AuthenticationFailed, exceptions.NotAuthenticated)):
        if response is not None:
            response.data = {
                'error': 'Authentication required or token invalid.',
                'detail': str(exc.detail) if isinstance(exc.detail, str) else 'Invalid credentials or expired token.'
            }
        return response

    # 3. Forbidden / Authorization Failures (HTTP 403)
    if isinstance(exc, (DRFPermissionDenied, DjangoPermissionDenied, exceptions.PermissionDenied)):
        if response is not None:
            response.data = {
                'error': 'Access denied: You do not have permission to access this resource or perform this action.',
                'detail': str(exc.detail) if hasattr(exc, 'detail') and isinstance(exc.detail, str) else 'Permission denied.'
            }
        record_audit_event(
            event_type='UNAUTHORIZED_ACCESS_ATTEMPT',
            action_description=f"Forbidden access attempt on '{request.path if request else 'unknown'}'.",
            actor=user if user and user.is_authenticated else None,
            actor_username=username,
            status='BLOCKED',
            severity='HIGH',
            ip_address=ip,
            metadata={'path': request.path if request else ''}
        )
        return response

    # 4. Database Integrity / Operational Errors (Catch DB exceptions safely)
    if isinstance(exc, IntegrityError):
        security_logger.error(f"Database IntegrityError on {request.path if request else ''}: {str(exc)}")
        return Response({
            'error': 'A database integrity conflict occurred (e.g. duplicate key or invalid foreign relation).',
            'status': 409
        }, status=status.HTTP_409_CONFLICT)

    if isinstance(exc, OperationalError):
        security_logger.error(f"Database OperationalError on {request.path if request else ''}: {str(exc)}")
        return Response({
            'error': 'Database operation could not be completed safely. Please try again later.',
            'status': 500
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 5. Default handler response check: sanitize 500 responses
    if response is None:
        security_logger.error(f"Unhandled 500 error on {request.path if request else ''}: {str(exc)}", exc_info=True)
        return Response({
            'error': 'An internal server error occurred. The incident has been logged for security review.',
            'status': 500
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response


# ==============================================================================
# INPUT VALIDATION: FILE UPLOADS
# ==============================================================================

def validate_uploaded_image(file_obj, max_size_mb=10):
    """
    Validates uploaded image files:
    1. Size within limit (default 10MB)
    2. Allowed extensions (.jpg, .jpeg, .png, .webp)
    3. Content type begins with image/
    """
    if not file_obj:
        return True

    max_bytes = max_size_mb * 1024 * 1024
    if getattr(file_obj, 'size', 0) > max_bytes:
        raise serializers.ValidationError(f"File size exceeds maximum allowed limit of {max_size_mb}MB.")

    name = getattr(file_obj, 'name', '')
    ext = os.path.splitext(name)[1].lower()
    allowed_exts = ['.jpg', '.jpeg', '.png', '.webp']
    if ext not in allowed_exts:
        raise serializers.ValidationError(f"Invalid file extension '{ext}'. Allowed types: {', '.join(allowed_exts)}")

    content_type = getattr(file_obj, 'content_type', '')
    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    if content_type and (content_type not in allowed_types and not content_type.startswith('image/')):
        raise serializers.ValidationError(f"File is not a valid image format. Allowed: {', '.join(allowed_types)}.")

    return True


# ==============================================================================
# SECURE PARCEL PICKUP PIN & QR VERIFICATION SECURITY UTILITIES
# ==============================================================================

MAX_PIN_ATTEMPTS = 5
PIN_LOCKOUT_DURATION = 900  # 15 minutes in seconds
PIN_FAILURE_WINDOW = 900    # 15 minutes window

def secure_compare_pin(expected_pin, submitted_pin):
    """
    Performs constant-time comparison of pickup PINs to eliminate timing side-channel attacks.
    """
    if not expected_pin or not submitted_pin:
        return False
    return secrets.compare_digest(str(expected_pin).strip(), str(submitted_pin).strip())


def get_pin_lockout_status(parcel_id):
    """
    Checks if a parcel is temporarily locked out from PIN verification attempts.
    Returns: (is_locked: bool, remaining_seconds: int, remaining_attempts: int)
    """
    now = time.time()
    lockout_key = f"lockout:parcel_pin:{parcel_id}"
    locked_until = cache.get(lockout_key)

    if locked_until and locked_until > now:
        remaining_secs = int(locked_until - now)
        return True, remaining_secs, 0

    fails_key = f"fails:parcel_pin:{parcel_id}"
    attempts = cache.get(fails_key, [])
    attempts = [t for t in attempts if now - t < PIN_FAILURE_WINDOW]
    remaining_attempts = max(0, MAX_PIN_ATTEMPTS - len(attempts))

    return False, 0, remaining_attempts


def record_failed_pin_attempt(parcel_id, guard_id=None, ip_address=None):
    """
    Records an incorrect PIN attempt for a parcel.
    Applies temporary 15-minute lockout when failed attempts reach MAX_PIN_ATTEMPTS (5).
    Logs security audit events with guard and parcel metadata (never logs PIN value).
    Returns: (is_locked: bool, remaining_attempts: int, lockout_seconds: int)
    """
    now = time.time()
    fails_key = f"fails:parcel_pin:{parcel_id}"
    attempts = cache.get(fails_key, [])
    attempts = [t for t in attempts if now - t < PIN_FAILURE_WINDOW]
    attempts.append(now)
    cache.set(fails_key, attempts, PIN_FAILURE_WINDOW)

    remaining_attempts = max(0, MAX_PIN_ATTEMPTS - len(attempts))

    if len(attempts) >= MAX_PIN_ATTEMPTS:
        lockout_key = f"lockout:parcel_pin:{parcel_id}"
        cache.set(lockout_key, now + PIN_LOCKOUT_DURATION, PIN_LOCKOUT_DURATION)
        log_security_event('PICKUP_PIN_LOCKOUT_TRIGGERED', {
            'parcel_id': parcel_id,
            'guard_id': guard_id or 'unknown',
            'ip': ip_address or '127.0.0.1',
            'attempts': len(attempts),
            'lockout_seconds': PIN_LOCKOUT_DURATION
        })
        return True, 0, PIN_LOCKOUT_DURATION

    log_security_event('PICKUP_PIN_FAILURE', {
        'parcel_id': parcel_id,
        'guard_id': guard_id or 'unknown',
        'ip': ip_address or '127.0.0.1',
        'attempts': len(attempts),
        'remaining_attempts': remaining_attempts
    })
    return False, remaining_attempts, 0


def record_successful_pin_verification(parcel_id, guard_id=None):
    """
    Clears failure counters and lockout upon successful PIN verification.
    """
    cache.delete(f"fails:parcel_pin:{parcel_id}")
    cache.delete(f"lockout:parcel_pin:{parcel_id}")
    log_security_event('PICKUP_PIN_VERIFIED', {
        'parcel_id': parcel_id,
        'guard_id': guard_id or 'unknown'
    })


# ==============================================================================
# AUDIT LOGGING & SUSPICIOUS ACTIVITY DETECTION ENGINE
# ==============================================================================

SUSPICIOUS_LOGIN_FAILURES_THRESHOLD = 5
SUSPICIOUS_PIN_FAILURES_THRESHOLD = 3
SUSPICIOUS_QR_FAILURES_THRESHOLD = 3
SUSPICIOUS_CROSS_RESIDENT_THRESHOLD = 1
SUSPICIOUS_ROLE_MUTATION_THRESHOLD = 1
SUSPICIOUS_FORBIDDEN_THRESHOLD = 5
DETECTION_WINDOW_SECONDS = 900  # 15 minutes


def sanitize_metadata(data):
    """
    Strips passwords, secrets, tokens, keys, and authorization headers from audit metadata.
    Guarantees privacy-compliant audit records.
    """
    if not isinstance(data, dict):
        return {}
    sanitized = {}
    forbidden_keys = (
        'password', 'token', 'refresh', 'access', 'secret',
        'key', 'pin', 'pickup_pin', 'code', 'auth', 'pass_code'
    )
    for k, v in data.items():
        if any(fk in str(k).lower() for fk in forbidden_keys):
            continue
        if isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        elif isinstance(v, (list, tuple)):
            sanitized[k] = [str(x) for x in v if not any(fk in str(x).lower() for fk in forbidden_keys)]
        else:
            sanitized[k] = str(v)
    return sanitized


def trigger_or_update_security_alert(
    alert_type,
    title,
    severity,
    details,
    affected_user=None,
    affected_username=None,
    source_ip=None,
    threshold=1,
    metadata=None
):
    """
    Creates a new SecurityAlert or aggregates into an existing active alert
    if the same pattern was detected from the same user/IP in the detection window.
    """
    from .models import SecurityAlert
    try:
        from django.utils import timezone
        cutoff = timezone.now() - timedelta(hours=2)
        qs = SecurityAlert.objects.filter(
            alert_type=alert_type,
            status__in=['OPEN', 'REVIEWED'],
            last_detected_at__gte=cutoff
        )
        if affected_username:
            qs = qs.filter(affected_username=affected_username)
        elif source_ip:
            qs = qs.filter(source_ip=source_ip)
        existing = qs.first()

        if existing:
            existing.event_count += 1
            existing.last_detected_at = timezone.now()
            severity_ranks = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
            if severity_ranks.get(severity, 1) > severity_ranks.get(existing.severity, 1):
                existing.severity = severity
            existing.details = f"{existing.details}\n[{timezone.now().strftime('%H:%M:%S')}] {details}"
            if metadata:
                existing.metadata.update(sanitize_metadata(metadata))
            existing.save()
            return existing
        else:
            new_alert = SecurityAlert.objects.create(
                title=title,
                alert_type=alert_type,
                severity=severity,
                status='OPEN',
                affected_user=affected_user,
                affected_username=affected_username or (affected_user.username if affected_user else None),
                source_ip=source_ip,
                details=details,
                event_count=1,
                threshold_limit=threshold,
                metadata=sanitize_metadata(metadata) if metadata else {}
            )
            security_logger.warning(f"[SECURITY_ALERT] {severity} - {title} - {details}")
            return new_alert
    except Exception as e:
        security_logger.error(f"Failed to create security alert: {str(e)}")
        return None


def _evaluate_suspicious_activity(event_type, username, role, ip_address, target_type, target_id, status, severity, metadata):
    """
    Evaluates real-time event against heuristic thresholds to detect brute force,
    privilege escalation, unauthorized cross-resident access, and scanner attacks.
    """
    now = time.time()
    
    # 1. Repeated Failed Logins
    if event_type == 'LOGIN_FAILED':
        fails_key = f"audit_fails:login:{username or ip_address}"
        attempts = cache.get(fails_key, [])
        attempts = [t for t in attempts if now - t < DETECTION_WINDOW_SECONDS]
        attempts.append(now)
        cache.set(fails_key, attempts, DETECTION_WINDOW_SECONDS)
        if len(attempts) >= SUSPICIOUS_LOGIN_FAILURES_THRESHOLD:
            trigger_or_update_security_alert(
                alert_type='REPEATED_LOGIN_FAILURES',
                title=f"Multiple Failed Login Attempts ({len(attempts)})",
                severity='MEDIUM',
                details=f"Account or IP {username or ip_address} experienced {len(attempts)} failed login attempts within 15 minutes.",
                affected_username=username,
                source_ip=ip_address,
                threshold=SUSPICIOUS_LOGIN_FAILURES_THRESHOLD,
                metadata={'attempts': len(attempts), 'ip': ip_address}
            )

    # 2. Repeated Incorrect Parcel PIN Attempts
    elif event_type == 'PIN_VERIFICATION_FAILED':
        fails_key = f"audit_fails:pin:{target_id or 'unknown'}"
        attempts = cache.get(fails_key, [])
        attempts = [t for t in attempts if now - t < DETECTION_WINDOW_SECONDS]
        attempts.append(now)
        cache.set(fails_key, attempts, DETECTION_WINDOW_SECONDS)
        if len(attempts) >= 5:
            trigger_or_update_security_alert(
                alert_type='PICKUP_PIN_ATTACK',
                title=f"Pickup PIN Brute-force Lockout ({target_id})",
                severity='HIGH',
                details=f"Parcel {target_id} triggered maximum failed PIN verification attempts ({len(attempts)}) and was locked out.",
                affected_username=username,
                source_ip=ip_address,
                threshold=5,
                metadata={'parcel_id': target_id, 'attempts': len(attempts)}
            )
        elif len(attempts) >= SUSPICIOUS_PIN_FAILURES_THRESHOLD:
            trigger_or_update_security_alert(
                alert_type='PICKUP_PIN_ATTACK',
                title=f"Multiple Failed Pickup PIN Attempts ({target_id})",
                severity='MEDIUM',
                details=f"Parcel {target_id} had {len(attempts)} incorrect PIN attempts within 15 minutes.",
                affected_username=username,
                source_ip=ip_address,
                threshold=SUSPICIOUS_PIN_FAILURES_THRESHOLD,
                metadata={'parcel_id': target_id, 'attempts': len(attempts)}
            )

    # 3. Repeated Invalid QR Passes
    elif event_type in ['QR_VERIFICATION_FAILED', 'PICKUP_QR_FAILURE', 'PICKUP_QR_REUSED', 'PICKUP_QR_EXPIRED']:
        fails_key = f"audit_fails:qr:{ip_address or username}"
        attempts = cache.get(fails_key, [])
        attempts = [t for t in attempts if now - t < DETECTION_WINDOW_SECONDS]
        attempts.append(now)
        cache.set(fails_key, attempts, DETECTION_WINDOW_SECONDS)
        if len(attempts) >= SUSPICIOUS_QR_FAILURES_THRESHOLD:
            trigger_or_update_security_alert(
                alert_type='REPEATED_QR_FAILURES',
                title=f"Repeated QR Verification Failures ({len(attempts)})",
                severity='HIGH',
                details=f"Endpoint/Guard {username or ip_address} failed QR verification {len(attempts)} times (invalid, expired, or revoked tokens).",
                affected_username=username,
                source_ip=ip_address,
                threshold=SUSPICIOUS_QR_FAILURES_THRESHOLD,
                metadata={'attempts': len(attempts), 'last_target': target_id}
            )

    # 4. Cross-Resident Data Access Attempt (IDOR)
    elif event_type == 'UNAUTHORIZED_ACCESS_ATTEMPT' and metadata.get('violation') == 'CROSS_RESIDENT_ACCESS':
        fails_key = f"audit_fails:cross_resident:{username}"
        attempts = cache.get(fails_key, [])
        attempts = [t for t in attempts if now - t < DETECTION_WINDOW_SECONDS]
        attempts.append(now)
        cache.set(fails_key, attempts, DETECTION_WINDOW_SECONDS)
        sev = 'CRITICAL' if len(attempts) >= 3 else 'HIGH'
        trigger_or_update_security_alert(
            alert_type='CROSS_RESIDENT_ACCESS_ATTEMPT',
            title=f"Unauthorized Cross-Resident Data Access Attempt by {username}",
            severity=sev,
            details=f"Resident user {username} attempted unauthorized access to parcel/data belonging to another resident/flat ({target_id}).",
            affected_username=username,
            source_ip=ip_address,
            threshold=1,
            metadata=metadata
        )

    # 5. Unauthorized Role Modification Attempt
    elif event_type == 'UNAUTHORIZED_ROLE_MUTATION':
        trigger_or_update_security_alert(
            alert_type='UNAUTHORIZED_ROLE_MUTATION',
            title=f"Privilege Escalation Attempt: {username or ip_address}",
            severity='CRITICAL',
            details=f"Request attempted unauthorized role escalation or staff privilege injection in registration/profile payload.",
            affected_username=username,
            source_ip=ip_address,
            threshold=1,
            metadata=metadata
        )

    # 6. Inactive Account Activity
    elif event_type == 'INACTIVE_ACCOUNT_ACTIVITY':
        trigger_or_update_security_alert(
            alert_type='INACTIVE_ACCOUNT_ACTIVITY',
            title=f"Suspicious Activity on Inactive/Deactivated Account: {username}",
            severity='HIGH',
            details=f"Deactivated, rejected, or unapproved user {username} attempted to perform authenticated operations.",
            affected_username=username,
            source_ip=ip_address,
            threshold=1,
            metadata=metadata
        )

    # 7. Token Reuse / Revoked Token Attempt
    elif event_type == 'TOKEN_REUSE_ATTEMPT':
        trigger_or_update_security_alert(
            alert_type='TOKEN_REUSE_ATTEMPT',
            title=f"Revoked Token Reuse Attempt: {username or ip_address}",
            severity='HIGH',
            details=f"A revoked or blacklisted authentication token was presented from IP {ip_address}.",
            affected_username=username,
            source_ip=ip_address,
            threshold=1,
            metadata=metadata
        )

    # 8. Repeated Forbidden API Requests
    elif status == 'BLOCKED' or severity in ['HIGH', 'CRITICAL']:
        fails_key = f"audit_fails:forbidden:{ip_address or username}"
        attempts = cache.get(fails_key, [])
        attempts = [t for t in attempts if now - t < 600]
        attempts.append(now)
        cache.set(fails_key, attempts, 600)
        if len(attempts) >= SUSPICIOUS_FORBIDDEN_THRESHOLD:
            trigger_or_update_security_alert(
                alert_type='REPEATED_FORBIDDEN_REQUESTS',
                title=f"Repeated Forbidden Requests Detected ({len(attempts)})",
                severity='HIGH',
                details=f"IP or user {ip_address or username} triggered {len(attempts)} blocked/forbidden requests within 10 minutes.",
                affected_username=username,
                source_ip=ip_address,
                threshold=SUSPICIOUS_FORBIDDEN_THRESHOLD,
                metadata={'attempts': len(attempts)}
            )


def record_audit_event(
    event_type,
    action_description,
    actor=None,
    actor_username=None,
    actor_role=None,
    target_entity_type=None,
    target_entity_id=None,
    status='SUCCESS',
    severity='LOW',
    ip_address=None,
    metadata=None
):
    """
    Centralized, tamper-resistant audit logger for all GateVault operations.
    Persists audit records directly to the database, mirrors to standard logs,
    and runs heuristic suspicious activity detectors.
    """
    from .models import AuditLog
    try:
        clean_meta = sanitize_metadata(metadata or {})
        
        # Resolve actor info
        if actor and getattr(actor, 'is_authenticated', False):
            actor_user = actor
            act_user = actor.username
            act_role = getattr(actor, 'role', 'SYSTEM')
        else:
            actor_user = None
            act_user = actor_username or 'SYSTEM'
            act_role = actor_role or 'SYSTEM'

        audit_entry = AuditLog.objects.create(
            event_type=event_type,
            actor=actor_user,
            actor_username=act_user,
            actor_role=act_role,
            target_entity_type=target_entity_type,
            target_entity_id=str(target_entity_id) if target_entity_id is not None else None,
            action_description=action_description,
            status=status,
            severity=severity,
            ip_address=ip_address,
            metadata=clean_meta
        )

        # Mirror to python logger
        log_security_event(event_type, {
            'actor': act_user,
            'role': act_role,
            'target': f"{target_entity_type}:{target_entity_id}",
            'status': status,
            'severity': severity,
            'ip': ip_address or 'unknown',
            'desc': action_description
        })

        # Evaluate against suspicious activity rules
        _evaluate_suspicious_activity(
            event_type, act_user, act_role, ip_address,
            target_entity_type, target_entity_id, status, severity, clean_meta
        )

        return audit_entry
    except Exception as e:
        security_logger.error(f"Failed to record audit event: {str(e)}")
        return None


def log_pickup_audit(event_type, details=None):
    """
    Dedicated audit logging for parcel handovers and QR verifications.
    Stores to database via record_audit_event and writes to security logger.
    """
    if details is None:
        details = {}

    severity = 'LOW'
    status = 'SUCCESS'
    if any(k in event_type for k in ('FAILURE', 'INVALID', 'NOT_FOUND', 'EXPIRED')):
        severity = 'MEDIUM'
        status = 'FAILED'
    elif any(k in event_type for k in ('LOCKOUT', 'REUSED', 'REVOKED')):
        severity = 'HIGH'
        status = 'BLOCKED'

    method = details.get('method', 'PIN' if 'PIN' in event_type else 'QR' if 'QR' in event_type else 'HANDOVER')
    action_desc = f"Parcel pickup action: {event_type} via {method}."

    return record_audit_event(
        event_type=event_type,
        action_description=action_desc,
        actor_username=str(details.get('guard_id', details.get('collector', 'guard'))),
        actor_role='GUARD',
        target_entity_type='Parcel',
        target_entity_id=details.get('parcel_id'),
        status=status,
        severity=severity,
        ip_address=details.get('ip'),
        metadata=details
    )


