import React, { useState, useEffect } from 'react';
import { generateQrDataUrl } from '../../utils/qrGenerator';

export default function QRCodeDisplay({
    qrData,
    onRefresh,
    onRevoke,
    loading = false,
    refreshing = false,
    revoking = false
}) {
    const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);

    useEffect(() => {
        if (!qrData?.expires_at) return;

        const updateTimer = () => {
            const expTime = new Date(qrData.expires_at).getTime();
            const now = Date.now();
            const diffSec = Math.max(0, Math.floor((expTime - now) / 1000));
            setTimeLeftSeconds(diffSec);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [qrData?.expires_at]);

    if (!qrData) return null;

    const minutes = Math.floor(timeLeftSeconds / 60);
    const seconds = timeLeftSeconds % 60;
    const isExpired = timeLeftSeconds <= 0;
    const isUrgent = timeLeftSeconds > 0 && timeLeftSeconds <= 120; // under 2 mins

    const qrImageSrc = qrData.token ? generateQrDataUrl(qrData.token, { size: 240, margin: 2 }) : null;

    return (
        <div className="text-center py-2">
            {/* Collector Authorization Badge */}
            <div className="mb-3 d-flex justify-content-center">
                <span className="badge bg-light text-dark border px-3 py-2 rounded-pill shadow-xs">
                    <i className="bi bi-person-check text-primary me-2"></i>
                    Authorized Collector: <strong className="ms-1">{qrData.authorized_collector || 'Resident'}</strong>
                    <span className="badge bg-primary ms-2">
                        {qrData.collector_role === 'DELEGATED_FLATMATE' ? 'Delegated Flatmate' : 'Primary Resident'}
                    </span>
                </span>
            </div>

            {/* QR Code Container */}
            <div className="position-relative d-inline-block p-3 bg-white rounded-4 border shadow-sm mb-3">
                {qrImageSrc ? (
                    <div style={{ position: 'relative' }}>
                        <img
                            src={qrImageSrc}
                            alt={`QR Pass for ${qrData.parcel_id}`}
                            className={`img-fluid rounded ${isExpired ? 'opacity-25 filter-grayscale' : ''}`}
                            style={{ width: '220px', height: '220px', display: 'block' }}
                        />
                        {isExpired && (
                            <div className="position-absolute top-50 start-50 translate-middle text-center w-100">
                                <span className="badge bg-danger fs-6 px-3 py-2 shadow">
                                    <i className="bi bi-clock-history me-1"></i> Pass Expired
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ width: '220px', height: '220px' }} className="d-flex align-items-center justify-content-center text-muted">
                        <i className="bi bi-qr-code fs-1"></i>
                    </div>
                )}
            </div>

            {/* Live Expiration Countdown */}
            <div className="mb-4">
                {isExpired ? (
                    <div className="text-danger fw-bold small">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        This pickup pass has expired. Please refresh to generate a new pass.
                    </div>
                ) : (
                    <div className={`fw-semibold ${isUrgent ? 'text-danger' : 'text-success'} small`}>
                        <i className={`bi ${isUrgent ? 'bi-hourglass-bottom' : 'bi-shield-check'} me-1`}></i>
                        Valid for: <span className="font-monospace fs-6 fw-bold">
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </span>
                        <div className="text-muted small fw-normal mt-1">
                            Expires at {new Date(qrData.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                )}
            </div>

            {/* Security Notice */}
            <div className="alert alert-light border text-start small mb-4 py-2 px-3 text-muted">
                <i className="bi bi-info-circle text-primary me-2"></i>
                Show this QR pass to the security guard at the gatehouse. Handover will be verified and authorized collector credentials checked.
            </div>

            {/* Action Buttons */}
            <div className="d-flex gap-2 justify-content-center">
                <button
                    type="button"
                    className="btn btn-primary btn-sm px-3"
                    onClick={onRefresh}
                    disabled={refreshing || revoking || loading}
                >
                    {refreshing ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <i className="bi bi-arrow-repeat me-1"></i> Refresh Pass
                        </>
                    )}
                </button>

                <button
                    type="button"
                    className="btn btn-outline-danger btn-sm px-3"
                    onClick={onRevoke}
                    disabled={refreshing || revoking || loading || isExpired}
                >
                    {revoking ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Revoking...
                        </>
                    ) : (
                        <>
                            <i className="bi bi-x-circle me-1"></i> Revoke Pass
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

