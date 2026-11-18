"""
GateVault Security Module
Centralized utilities for authentication security, rate-limiting, lockout management,
password complexity enforcement, token revocation, and security audit logging.
"""

import re
import time
import logging
from datetime import datetime, timezone
from django.core.cache import cache
from rest_framework import serializers, exceptions
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

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


# DRF Scoped Throttles
class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'
    rate = '15/minute'


class RegisterRateThrottle(AnonRateThrottle):
    scope = 'register'
    rate = '10/hour'

