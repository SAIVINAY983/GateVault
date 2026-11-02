import React, { useEffect, useState } from 'react';

/**
 * GoogleLoginButton
 * 
 * Provides official Google OAuth 2.0 / OpenID Connect login button for Residents.
 * Supports Google Identity Services (GIS) client library when VITE_GOOGLE_CLIENT_ID is configured,
 * and provides an interactive quick-test mode for local development and CI testing.
 */
const GoogleLoginButton = ({ 
    onSuccess, 
    onError, 
    text = "Continue with Google", 
    disabled = false,
    className = ""
}) => {
    const [loading, setLoading] = useState(false);
    const [showDevModal, setShowDevModal] = useState(false);
    const [devEmail, setDevEmail] = useState('resident.new@example.com');
    const [devName, setDevName] = useState('Alex Resident');

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    useEffect(() => {
        // Load official Google Identity Services script if not already present
        if (!clientId) return;

        if (!document.getElementById('google-gsi-client')) {
            const script = document.createElement('script');
            script.id = 'google-gsi-client';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = initializeGsi;
            document.body.appendChild(script);
        } else if (window.google?.accounts?.id) {
            initializeGsi();
        }
    }, [clientId]);

    const initializeGsi = () => {
        if (!window.google?.accounts?.id || !clientId) return;

        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGsiResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
        });

        const targetDiv = document.getElementById('google-official-btn');
        if (targetDiv) {
            window.google.accounts.id.renderButton(targetDiv, {
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                width: 380,
                logo_alignment: 'left'
            });
        }
    };

    const handleGsiResponse = async (response) => {
        if (!response?.credential) {
            onError && onError('Failed to retrieve credential from Google.');
            return;
        }
        setLoading(true);
        try {
            await onSuccess(response.credential);
        } catch (err) {
            onError && onError(err.message || 'Google authentication failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleButtonClick = () => {
        if (loading || disabled) return;

        if (clientId && window.google?.accounts?.id) {
            // Trigger GIS prompt if official button isn't directly clicked
            try {
                window.google.accounts.id.prompt();
            } catch (e) {
                setShowDevModal(true);
            }
        } else {
            // Open quick test / mock Google sign-in modal
            setShowDevModal(true);
        }
    };

    const handleDevLogin = async (e) => {
        e?.preventDefault();
        if (!devEmail || !devName) return;

        setLoading(true);
        setShowDevModal(false);

        // Generate verified mock token payload accepted by backend/api/oauth.py
        const mockUid = 'goog-' + Math.abs(devEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));
        const mockToken = `mock-google-token:${devEmail.trim()}:${mockUid}:${devName.trim()}`;

        try {
            await onSuccess(mockToken);
        } catch (err) {
            onError && onError(err.message || 'Authentication error.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`w-100 ${className}`}>
            {/* If Client ID is present and GIS has initialized, render the container */}
            <div id="google-official-btn" className="d-flex justify-content-center mb-2" style={{ minHeight: clientId ? '44px' : '0' }}></div>

            {/* Default or Fallback Styled Google Button */}
            <button
                type="button"
                className="btn btn-outline-secondary w-100 py-2 px-3 rounded-3 d-flex align-items-center justify-content-center gap-2 bg-white text-dark shadow-sm fw-medium border"
                style={{ borderColor: '#dadce0', fontSize: '0.95rem' }}
                onClick={handleButtonClick}
                disabled={loading || disabled}
            >
                {loading ? (
                    <>
                        <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                        <span>Verifying with Google...</span>
                    </>
                ) : (
                    <>
                        <svg width="20" height="20" viewBox="0 0 48 48" className="me-1">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        </svg>
                        <span>{text}</span>
                    </>
                )}
            </button>

            {/* Quick Demo Selector for Dev & Environments without OAuth Client ID */}
            {!clientId && (
                <div className="d-flex justify-content-center mt-2">
                    <button
                        type="button"
                        className="btn btn-link btn-sm text-muted text-decoration-none p-0"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => setShowDevModal(true)}
                    >
                        <i className="bi bi-gear-fill me-1"></i> Google Test Account Options
                    </button>
                </div>
            )}

            {/* Dev / Mock Google Sign-In Modal */}
            {showDevModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-bottom pb-3">
                                <div className="d-flex align-items-center gap-2">
                                    <div className="bg-primary bg-opacity-10 rounded-circle p-2 text-primary">
                                        <i className="bi bi-google fs-5"></i>
                                    </div>
                                    <h5 className="modal-title fw-bold">Google Identity Authentication</h5>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowDevModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <p className="text-muted small mb-3">
                                    Select or enter a Google account to authenticate. Server-side token verification will process this verified identity.
                                </p>

                                <div className="mb-3">
                                    <label className="form-label small fw-semibold text-muted">Quick Presets:</label>
                                    <div className="d-flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary rounded-pill"
                                            onClick={() => {
                                                setDevEmail('alex.resident@example.com');
                                                setDevName('Alex Resident');
                                            }}
                                        >
                                            Alex Resident (New)
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-success rounded-pill"
                                            onClick={() => {
                                                setDevEmail('maya.resident@example.com');
                                                setDevName('Maya Patel');
                                            }}
                                        >
                                            Maya Patel (New)
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger rounded-pill"
                                            onClick={() => {
                                                setDevEmail('guard@gatevault.local');
                                                setDevName('Guard User');
                                            }}
                                        >
                                            Guard Account (Verify Role Block)
                                        </button>
                                    </div>
                                </div>

                                <form onSubmit={handleDevLogin}>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Google Account Name</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={devName}
                                            onChange={(e) => setDevName(e.target.value)}
                                            required
                                            placeholder="e.g. Alex Resident"
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Google Verified Email</label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            value={devEmail}
                                            onChange={(e) => setDevEmail(e.target.value)}
                                            required
                                            placeholder="e.g. resident@example.com"
                                        />
                                    </div>

                                    <div className="d-flex justify-content-end gap-2 mt-4">
                                        <button
                                            type="button"
                                            className="btn btn-light rounded-pill px-3"
                                            onClick={() => setShowDevModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary rounded-pill px-4 fw-semibold"
                                        >
                                            Sign in with Google
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleLoginButton;

