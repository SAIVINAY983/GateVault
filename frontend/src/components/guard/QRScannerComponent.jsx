import React, { useState, useEffect, useRef } from 'react';

export default function QRScannerComponent({ onScan, loading = false, disabled = false }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [manualToken, setManualToken] = useState('');
    const [facingMode, setFacingMode] = useState('environment'); // back camera preferred
    const [hasBarcodeDetector, setHasBarcodeDetector] = useState(false);
    const [scanMethod, setScanMethod] = useState('camera'); // 'camera' or 'manual'

    useEffect(() => {
        if ('BarcodeDetector' in window) {
            setHasBarcodeDetector(true);
        }
    }, []);

    const startCamera = async () => {
        setCameraError('');
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraActive(true);
            }
        } catch (err) {
            console.error("Camera access error:", err);
            setCameraActive(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setCameraError('Camera permission denied. Please allow camera access in your browser settings, or use manual token entry below.');
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setCameraError('No camera found on this device. You can type or paste the QR token manually.');
            } else {
                setCameraError(`Camera error: ${err.message || 'Unable to access video stream'}. Use manual token entry.`);
            }
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const toggleCameraFacing = () => {
        const nextMode = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(nextMode);
    };

    useEffect(() => {
        if (cameraActive) {
            startCamera();
        }
    }, [facingMode]);

    // Active detection loop using BarcodeDetector
    useEffect(() => {
        let active = true;
        let detectionInterval = null;

        if (cameraActive && hasBarcodeDetector && videoRef.current) {
            const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });

            detectionInterval = setInterval(async () => {
                if (!active || disabled || loading || !videoRef.current || videoRef.current.readyState < 2) return;

                try {
                    const barcodes = await barcodeDetector.detect(videoRef.current);
                    if (barcodes && barcodes.length > 0) {
                        const rawVal = barcodes[0].rawValue;
                        if (rawVal) {
                            stopCamera();
                            onScan(rawVal);
                        }
                    }
                } catch (e) {
                    // Frame detection error, continue to next frame
                }
            }, 300);
        }

        return () => {
            active = false;
            if (detectionInterval) clearInterval(detectionInterval);
        };
    }, [cameraActive, hasBarcodeDetector, disabled, loading]);

    // Clean up camera on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // File input image scanner fallback
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (hasBarcodeDetector) {
            try {
                const img = new Image();
                img.onload = async () => {
                    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                    const results = await detector.detect(img);
                    if (results && results.length > 0) {
                        onScan(results[0].rawValue);
                    } else {
                        setCameraError('No readable QR code found in the selected image. Please try another image or paste token manually.');
                    }
                };
                img.src = URL.createObjectURL(file);
            } catch (err) {
                setCameraError('Could not process image file: ' + err.message);
            }
        } else {
            setCameraError('Direct image decoding requires manual token entry on this browser.');
        }
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualToken.trim()) return;
        onScan(manualToken.trim());
    };

    return (
        <div className="qr-scanner-card">
            {/* Mode Selector */}
            <div className="d-flex justify-content-center mb-3">
                <div className="btn-group btn-group-sm p-1 bg-light rounded-pill border">
                    <button
                        type="button"
                        className={`btn rounded-pill px-3 py-1 ${scanMethod === 'camera' ? 'btn-primary shadow-xs' : 'btn-light text-muted'}`}
                        onClick={() => { setScanMethod('camera'); setCameraError(''); }}
                    >
                        <i className="bi bi-camera me-1"></i> Live Camera
                    </button>
                    <button
                        type="button"
                        className={`btn rounded-pill px-3 py-1 ${scanMethod === 'manual' ? 'btn-primary shadow-xs' : 'btn-light text-muted'}`}
                        onClick={() => { setScanMethod('manual'); stopCamera(); setCameraError(''); }}
                    >
                        <i className="bi bi-keyboard me-1"></i> Manual Token / Image
                    </button>
                </div>
            </div>

            {cameraError && (
                <div className="alert alert-warning py-2 px-3 small d-flex align-items-center mb-3">
                    <i className="bi bi-exclamation-triangle-fill fs-5 me-2 flex-shrink-0"></i>
                    <div>{cameraError}</div>
                </div>
            )}

            {scanMethod === 'camera' ? (
                <div>
                    {!cameraActive ? (
                        <div className="p-4 bg-light rounded-4 text-center border-2 border-dashed border">
                            <div className="d-inline-flex align-items-center justify-content-center bg-white text-primary rounded-circle p-3 shadow-xs mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-qr-code-scan fs-3"></i>
                            </div>
                            <h6 className="fw-bold mb-1">Gatehouse Camera Scanner</h6>
                            <p className="text-muted small mb-3">Scan the resident or flatmate's pickup pass directly from their phone screen.</p>
                            <button
                                type="button"
                                className="btn btn-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2"
                                onClick={startCamera}
                                disabled={loading}
                            >
                                <i className="bi bi-camera-fill"></i> Launch Scanner Camera
                            </button>
                        </div>
                    ) : (
                        <div className="position-relative bg-dark rounded-4 overflow-hidden shadow" style={{ minHeight: '320px' }}>
                            <video
                                ref={videoRef}
                                className="w-100 h-100"
                                style={{ maxHeight: '380px', objectFit: 'cover', display: 'block' }}
                                playsInline
                                muted
                                autoPlay
                            />
                            {/* Scanning Viewfinder Target Reticle */}
                            <div className="position-absolute top-50 start-50 translate-middle d-flex flex-column align-items-center justify-content-center" style={{ width: '220px', height: '220px', border: '3px solid rgba(13, 110, 253, 0.9)', borderRadius: '16px', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' }}>
                                <div className="scanner-laser" style={{ width: '100%', height: '3px', background: '#0d6efd', boxShadow: '0 0 8px #0d6efd', animation: 'scanMove 2s infinite ease-in-out' }}></div>
                                <span className="position-absolute bottom-0 text-white small px-2 py-1 bg-dark bg-opacity-75 rounded mb-2" style={{ fontSize: '0.7rem' }}>
                                    Align QR Code Inside Box
                                </span>
                            </div>

                            {/* Camera Controls Overlay */}
                            <div className="position-absolute bottom-0 start-0 w-100 p-2 d-flex justify-content-between align-items-center bg-gradient-dark">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light rounded-pill px-3"
                                    onClick={toggleCameraFacing}
                                >
                                    <i className="bi bi-arrow-repeat me-1"></i> Flip Camera
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-sm btn-danger rounded-pill px-3"
                                    onClick={stopCamera}
                                >
                                    <i className="bi bi-stop-circle me-1"></i> Close Camera
                                </button>
                            </div>
                        </div>
                    )}

                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                </div>
            ) : (
                <div className="p-4 bg-light rounded-4 border">
                    <h6 className="fw-bold mb-2 text-dark">
                        <i className="bi bi-keyboard me-2 text-primary"></i>Enter QR Pass Token
                    </h6>
                    <p className="text-muted small mb-3">
                        If camera is unavailable or scanner is obstructed, paste the secure pass token or upload an image of the QR pass.
                    </p>

                    <form onSubmit={handleManualSubmit}>
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-uppercase text-muted">Pass Token String</label>
                            <input
                                type="text"
                                className="form-control font-monospace"
                                placeholder="GVQR_..."
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                                required
                            />
                        </div>

                        <div className="d-flex gap-2">
                            <button
                                type="submit"
                                className="btn btn-primary fw-semibold flex-grow-1 py-2"
                                disabled={!manualToken.trim() || loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Verifying Token...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-circle me-1"></i> Verify Token
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="hr-text text-muted my-3 text-center small position-relative">
                        <span className="bg-light px-2 position-relative" style={{ zIndex: 1 }}>OR UPLOAD QR IMAGE</span>
                        <hr className="my-0 position-absolute w-100 top-50" />
                    </div>

                    <div>
                        <label className="btn btn-outline-secondary w-100 py-2 small fw-semibold cursor-pointer">
                            <i className="bi bi-image me-2"></i> Choose QR Code Screenshot / Photo
                            <input
                                type="file"
                                accept="image/*"
                                className="d-none"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

