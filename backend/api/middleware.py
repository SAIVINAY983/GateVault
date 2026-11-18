"""
GateVault HTTP Security Middleware
Injects enterprise-grade Content-Security-Policy and Permissions-Policy headers.
"""

class SecurityHeadersMiddleware:
    """
    Middleware that attaches modern HTTP security headers to all responses.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Content-Security-Policy (CSP)
        # Protects against XSS, clickjacking, and unauthorized resource injection
        csp = (
            "default-src 'self'; "
            "img-src 'self' data: https: blob:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://accounts.google.com; "
            "font-src 'self' https://cdn.jsdelivr.net data:; "
            "connect-src 'self' http: https: ws: wss:; "
            "frame-src 'self' https://accounts.google.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        response['Content-Security-Policy'] = csp

        # Permissions-Policy
        # Allows camera for QR scanning on self origin, disables unused capabilities
        response['Permissions-Policy'] = "camera=(self), microphone=(), geolocation=(), payment=()"

        # Extra defense-in-depth headers
        if 'X-Content-Type-Options' not in response:
            response['X-Content-Type-Options'] = 'nosniff'
        if 'X-Frame-Options' not in response:
            response['X-Frame-Options'] = 'DENY'
        if 'Referrer-Policy' not in response:
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response
