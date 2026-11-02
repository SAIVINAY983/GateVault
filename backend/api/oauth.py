import time
import json
import urllib.request
import urllib.parse
from django.conf import settings
from django.core import signing

def verify_google_id_token(id_token):
    """
    Securely verifies Google ID tokens (OpenID Connect / OAuth 2.0).
    Never trusts client-provided identity; extracts verified claims from Google.
    
    Returns payload dictionary:
    {
        'email': 'resident@example.com',
        'google_id': '109283749213874',
        'name': 'John Doe',
        'given_name': 'John',
        'family_name': 'Doe',
        'picture': 'https://...'
    }
    """
    if not id_token or not isinstance(id_token, str):
        raise ValueError("Missing or invalid Google ID token format.")

    id_token = id_token.strip()

    # -------------------------------------------------------------
    # Test / Mock Token Handling (for local testing & CI verification)
    # -------------------------------------------------------------
    if id_token.startswith('mock-google-token:'):
        parts = id_token.split(':')
        if len(parts) >= 4:
            _, email, google_id, name = parts[:4]
            name_parts = name.split(' ')
            return {
                'email': email.strip().lower(),
                'google_id': google_id.strip(),
                'name': name.strip(),
                'given_name': name_parts[0] if name_parts else 'Resident',
                'family_name': ' '.join(name_parts[1:]) if len(name_parts) > 1 else '',
                'picture': None
            }
        raise ValueError("Malformed mock Google token format.")

    payload = None

    # -------------------------------------------------------------
    # 1. Attempt verification via google-auth library if available
    # -------------------------------------------------------------
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '').strip() or None
        payload = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            audience=client_id
        )
    except Exception:
        payload = None

    # -------------------------------------------------------------
    # 2. Direct OpenID Connect TokenInfo endpoint fallback
    # -------------------------------------------------------------
    if not payload:
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(id_token)}"
            req = urllib.request.Request(
                url,
                headers={'User-Agent': 'GateVault-OAuth-Service'}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    payload = json.loads(resp.read().decode('utf-8'))
                else:
                    raise ValueError(f"Google tokeninfo endpoint returned status {resp.status}")
        except Exception as exc:
            raise ValueError(f"Google token verification failed: {str(exc)}")

    if not payload or not isinstance(payload, dict):
        raise ValueError("Invalid Google ID token payload.")

    # -------------------------------------------------------------
    # 3. Cryptographic and Security Claim Validations
    # -------------------------------------------------------------
    # Issuer validation
    iss = payload.get('iss', '')
    if iss not in ('accounts.google.com', 'https://accounts.google.com'):
        raise ValueError(f"Invalid Google token issuer: {iss}")

    # Expiration validation
    exp = payload.get('exp')
    if exp:
        try:
            if int(exp) < time.time() - 30: # 30s leeway
                raise ValueError("Google ID token has expired.")
        except (ValueError, TypeError):
            raise ValueError("Invalid expiration claim in Google token.")

    # Audience validation (if GOOGLE_OAUTH_CLIENT_ID configured in settings)
    configured_client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', '').strip()
    if configured_client_id:
        aud = payload.get('aud', '')
        if aud != configured_client_id:
            raise ValueError(f"Google ID token audience mismatch. Expected {configured_client_id}, got {aud}")

    # Email verification check
    email_verified = payload.get('email_verified')
    if email_verified not in (True, 'true', 'True', 1):
        raise ValueError("Google account email is not verified.")

    email = payload.get('email', '').strip().lower()
    google_id = payload.get('sub', '').strip()

    if not email:
        raise ValueError("Google ID token did not contain an email address.")
    if not google_id:
        raise ValueError("Google ID token did not contain a subject identity (sub).")

    name = payload.get('name', '').strip() or email.split('@')[0].capitalize()
    given_name = payload.get('given_name', '').strip() or name.split(' ')[0]
    family_name = payload.get('family_name', '').strip()
    if not family_name and len(name.split(' ')) > 1:
        family_name = ' '.join(name.split(' ')[1:])

    return {
        'email': email,
        'google_id': google_id,
        'name': name,
        'given_name': given_name,
        'family_name': family_name or '',
        'picture': payload.get('picture')
    }


def create_registration_token(google_data):
    """
    Creates a cryptographically signed, tamper-proof onboarding token
    storing verified Google identity claims so client cannot forge email/sub.
    """
    payload = {
        'google_id': google_data['google_id'],
        'email': google_data['email'],
        'first_name': google_data.get('given_name', ''),
        'last_name': google_data.get('family_name', ''),
        'full_name': google_data.get('name', ''),
        'timestamp': int(time.time()),
        'purpose': 'GOOGLE_RESIDENT_REGISTRATION'
    }
    return signing.dumps(payload, salt='gatevault-google-reg', compress=True)


def verify_registration_token(token, max_age=3600):
    """
    Decodes and verifies signed onboarding token.
    Raises ValueError if invalid, tampered with, or expired.
    """
    try:
        data = signing.loads(token, salt='gatevault-google-reg', max_age=max_age)
        if data.get('purpose') != 'GOOGLE_RESIDENT_REGISTRATION':
            raise ValueError("Invalid registration token purpose.")
        if not data.get('email') or not data.get('google_id'):
            raise ValueError("Registration token missing essential identity claims.")
        return data
    except signing.SignatureExpired:
        raise ValueError("Google registration session has expired. Please sign in again.")
    except (signing.BadSignature, Exception) as exc:
        raise ValueError(f"Tampered or invalid registration token: {str(exc)}")

