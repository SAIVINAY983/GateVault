import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate, useLocation } from 'react-router-dom';
import QRScannerComponent from '../../components/guard/QRScannerComponent';

const PickupVerification = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Mode: 'QR', 'PIN', or 'GUEST'
    const [verificationMode, setVerificationMode] = useState(location.state?.mode || 'QR');

    // PIN Mode Credentials
    const [credentials, setCredentials] = useState({
        parcel_id: location.state?.parcel_id || '',
        pickup_pin: ''
    });
    
    // QR Verification State
    const [verifiedQrData, setVerifiedQrData] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState('');

    // Guest Pass Verification State
    const [guestPassCode, setGuestPassCode] = useState('');
    const [verifiedGuestData, setVerifiedGuestData] = useState(null);
    const [guestLoading, setGuestLoading] = useState(false);
    const [guestError, setGuestError] = useState('');
    const [actualCollectorName, setActualCollectorName] = useState('');

    // Common states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [verifiedParcel, setVerifiedParcel] = useState(null);
    const [handoverSuccess, setHandoverSuccess] = useState(false);
    const [handoverMethod, setHandoverMethod] = useState('');
    const [collectorType, setCollectorType] = useState('PRIMARY_RESIDENT');
    const [householdMembers, setHouseholdMembers] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    
    const pinInputRef = useRef(null);

    useEffect(() => {
        if (verificationMode === 'PIN' && pinInputRef.current) {
            pinInputRef.current.focus();
        }
    }, [credentials.parcel_id, verificationMode]);

    // ==========================================
    // QR SCAN & HANDOVER HANDLERS
    // ==========================================

    const handleQrScan = async (token) => {
        setQrLoading(true);
        setQrError('');
        setVerifiedQrData(null);

        try {
            const res = await axiosInstance.post('guard/verify-qr/', { token });
            setVerifiedQrData(res.data);
        } catch (err) {
            setQrError(err.response?.data?.error || 'QR pass validation failed. Invalid, expired, or revoked pass.');
        } finally {
            setQrLoading(false);
        }
    };

    const handleConfirmQrHandover = async () => {
        if (!verifiedQrData) return;
        setQrLoading(true);
        setQrError('');

        try {
            await axiosInstance.post('guard/confirm-qr-handover/', {
                token: verifiedQrData.token,
                qr_pass_id: verifiedQrData.qr_pass_id
            });
            setHandoverMethod('QR');
            setHandoverSuccess(true);
            setVerifiedQrData(null);
        } catch (err) {
            setQrError(err.response?.data?.error || 'Failed to confirm QR handover.');
        } finally {
            setQrLoading(false);
        }
    };

    // ==========================================
    // TEMPORARY GUEST PASS HANDLERS
    // ==========================================

    const handleVerifyGuestPass = async (e) => {
        if (e) e.preventDefault();
        if (!guestPassCode.trim()) {
            setGuestError('Please enter the guest pass code or token.');
            return;
        }

        setGuestLoading(true);
        setGuestError('');
        setVerifiedGuestData(null);

        try {
            const res = await axiosInstance.post('guard/verify-guest-pass/', {
                pass_code: guestPassCode.trim()
            });
            setVerifiedGuestData(res.data);
            setActualCollectorName(res.data.guest_name || '');
        } catch (err) {
            setGuestError(err.response?.data?.error || 'Guest pass verification failed. Invalid, expired, or revoked pass.');
        } finally {
            setGuestLoading(false);
        }
    };

    const handleConfirmGuestHandover = async () => {
        if (!verifiedGuestData) return;
        setGuestLoading(true);
        setGuestError('');

        try {
            await axiosInstance.post('guard/confirm-guest-handover/', {
                authorization_id: verifiedGuestData.authorization_id,
                actual_collector_name: actualCollectorName.trim() || verifiedGuestData.guest_name
            });
            setHandoverMethod('GUEST');
            setHandoverSuccess(true);
            setVerifiedGuestData(null);
        } catch (err) {
            setGuestError(err.response?.data?.error || 'Failed to complete guest handover.');
        } finally {
            setGuestLoading(false);
        }
    };

    // ==========================================
    // PIN VERIFY & HANDOVER HANDLERS
    // ==========================================

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setVerifiedParcel(null);

        try {
            const res = await axiosInstance.post(`parcels/${credentials.parcel_id.trim()}/verify/`, {
                pickup_pin: credentials.pickup_pin.trim()
            });
            const parcelData = res.data.parcel;
            setVerifiedParcel(parcelData);
            if (parcelData.is_delegated) {
                setCollectorType('DELEGATED_FLATMATE');
            } else {
                setCollectorType('PRIMARY_RESIDENT');
            }

            const flatId = parcelData.flat_details?.id || parcelData.flat;
            if (flatId) {
                try {
                    const rRes = await axiosInstance.get(`resident/household/authorized-receivers/?flat_id=${flatId}&delivery_type=NORMAL`);
                    const eligible = (Array.isArray(rRes.data) ? rRes.data : []).filter(m => !m.is_primary && m.can_collect_gatehouse_parcels);
                    setHouseholdMembers(eligible);
                } catch {
                    setHouseholdMembers([]);
                }
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed. Incorrect ID or PIN.');
        } finally {
            setLoading(false);
        }
    };

    const handleHandover = async () => {
        setLoading(true);
        try {
            const payload = {
                collected_by_role_type: collectorType
            };
            if (collectorType === 'HOUSEHOLD_MEMBER') {
                if (!selectedMemberId) {
                    setError('Please select which household member is collecting.');
                    setLoading(false);
                    return;
                }
                payload.household_member_id = selectedMemberId;
            }

            await axiosInstance.post(`parcels/${credentials.parcel_id.trim()}/handover/`, payload);
            setHandoverMethod('PIN');
            setHandoverSuccess(true);
            setVerifiedParcel(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Handover failed.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCredentials({ parcel_id: '', pickup_pin: '' });
        setHandoverSuccess(false);
        setVerifiedParcel(null);
        setVerifiedQrData(null);
        setVerifiedGuestData(null);
        setGuestPassCode('');
        setActualCollectorName('');
        setCollectorType('PRIMARY_RESIDENT');
        setHouseholdMembers([]);
        setSelectedMemberId('');
        setError('');
        setQrError('');
        setGuestError('');
    };

    if (handoverSuccess) {
        return (
            <div className="container-fluid px-0 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden text-center shadow" style={{ maxWidth: '520px' }}>
                    <div className="bg-success text-white p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3 shadow-sm" style={{ width: '84px', height: '84px' }}>
                            <i className="bi bi-check2-circle" style={{ fontSize: '3rem' }}></i>
                        </div>
                        <h2 className="fw-bold mb-1">Handover Complete</h2>
                        <div className="opacity-75 small text-uppercase tracking-wide">
                            {handoverMethod === 'QR' ? 'Verified via Secure QR Pass' : handoverMethod === 'GUEST' ? 'Verified via Temporary Guest Pass' : 'Verified via 4-Digit PIN'}
                        </div>
                    </div>
                    
                    <div className="p-4 p-md-5 bg-white">
                        <div className="text-muted mb-4">
                            The parcel has been securely handed over to the authorized collector. Storage slot occupancy and resident notifications have been updated.
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <button onClick={resetForm} className="gv-btn-primary py-3 fw-bold fs-6 w-100">
                                <i className="bi bi-box-seam me-2"></i> Verify Another Pickup
                            </button>
                            <button onClick={() => navigate('/guard')} className="btn btn-light py-2 w-100 fw-medium">
                                Return to Gatehouse Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid px-0">
            <div className="mb-4 text-center text-md-start">
                <h2 className="fw-bold text-dark mb-1">Gatehouse Parcel Handover</h2>
                <p className="text-muted">Verify resident identity and complete parcel pickup securely.</p>
            </div>

            {/* TAB SELECTOR: QR VS PIN VS GUEST */}
            <div className="d-flex justify-content-center justify-content-md-start mb-4">
                <div className="nav nav-pills bg-light p-1 rounded-3 border">
                    <button
                        className={`nav-link px-4 py-2 fw-semibold d-flex align-items-center gap-2 ${verificationMode === 'QR' ? 'active shadow-xs' : 'text-muted'}`}
                        onClick={() => { setVerificationMode('QR'); setError(''); setQrError(''); setGuestError(''); }}
                    >
                        <i className="bi bi-qr-code-scan"></i>
                        <span>Scan QR Pickup</span>
                        <span className="badge bg-primary bg-opacity-25 text-primary ms-1">Fast</span>
                    </button>
                    <button
                        className={`nav-link px-4 py-2 fw-semibold d-flex align-items-center gap-2 ${verificationMode === 'PIN' ? 'active shadow-xs' : 'text-muted'}`}
                        onClick={() => { setVerificationMode('PIN'); setError(''); setQrError(''); setGuestError(''); }}
                    >
                        <i className="bi bi-key-fill"></i>
                        <span>4-Digit PIN</span>
                    </button>
                    <button
                        className={`nav-link px-4 py-2 fw-semibold d-flex align-items-center gap-2 ${verificationMode === 'GUEST' ? 'active shadow-xs' : 'text-muted'}`}
                        onClick={() => { setVerificationMode('GUEST'); setError(''); setQrError(''); setGuestError(''); }}
                    >
                        <i className="bi bi-person-badge"></i>
                        <span>Guest Pass</span>
                    </button>
                </div>
            </div>
            
            <div className="row justify-content-center justify-content-md-start">
                <div className="col-12 col-md-9 col-lg-7 col-xl-6">

                    {/* ======================================================== */}
                    {/* MODE 1: QR CODE VERIFICATION                            */}
                    {/* ======================================================== */}
                    {verificationMode === 'QR' && (
                        <div>
                            {!verifiedQrData ? (
                                <div className="gv-card p-4 p-md-5">
                                    {qrError && (
                                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm py-3">
                                            <i className="bi bi-exclamation-triangle-fill fs-4 me-3 flex-shrink-0"></i>
                                            <div className="fw-medium">{qrError}</div>
                                        </div>
                                    )}

                                    <QRScannerComponent
                                        onScan={handleQrScan}
                                        loading={qrLoading}
                                    />
                                </div>
                            ) : (
                                <div className="gv-card overflow-hidden text-center border-2 border-primary border shadow">
                                    <div className="bg-primary text-white p-4">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="badge bg-white text-primary text-uppercase px-2 py-1">QR Pass Verified</span>
                                            <span className="small opacity-75">
                                                <i className="bi bi-shield-check me-1"></i>Token Valid
                                            </span>
                                        </div>
                                        <h3 className="fw-bold mb-0 text-white">
                                            Parcel {verifiedQrData.parcel_id}
                                        </h3>
                                        <small className="opacity-75">{verifiedQrData.carrier_name} • Flat {verifiedQrData.flat_number} ({verifiedQrData.tower_name})</small>
                                    </div>

                                    <div className="p-4 p-md-5">
                                        {/* Storage Shelf Slot to Retrieve */}
                                        <div className="mb-4">
                                            <div className="text-muted text-uppercase fw-bold mb-2" style={{ letterSpacing: '0.1em' }}>
                                                Retrieve From Storage Shelf
                                            </div>
                                            <div className="display-4 fw-bold text-dark bg-light rounded-3 p-3 border border-2 border-primary border-opacity-50">
                                                {verifiedQrData.shelf_name || 'Unassigned'}
                                            </div>
                                        </div>

                                        {/* Authorized Collector Box */}
                                        <div className="alert alert-info border-info text-start p-3 mb-4 rounded-3">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <i className="bi bi-person-badge-fill fs-4 text-primary"></i>
                                                <div>
                                                    <span className="small text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.7rem' }}>Authorized Collector</span>
                                                    <h6 className="fw-bold text-dark mb-0">{verifiedQrData.authorized_collector_name}</h6>
                                                </div>
                                                <span className="badge bg-primary ms-auto">
                                                    {verifiedQrData.collector_role_display}
                                                </span>
                                            </div>
                                            <div className="small text-muted border-top pt-2 mt-2">
                                                Resident Owner: <strong>{verifiedQrData.resident_name}</strong> • Flat {verifiedQrData.flat_number}
                                            </div>
                                        </div>

                                        {/* Parcel Condition & Payment Highlights */}
                                        <div className="row g-2 mb-4 text-start bg-light rounded-3 p-3 border mx-0">
                                            <div className="col-6">
                                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Payment</small>
                                                <div className="fw-bold text-dark">
                                                    {verifiedQrData.payment_type === 'COD' ? `COD (₹${verifiedQrData.cod_amount}) - ${verifiedQrData.payment_status}` : 'Prepaid'}
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Condition</small>
                                                <div className="fw-bold text-dark">
                                                    <span className={`badge ${verifiedQrData.condition === 'INTACT' ? 'bg-success' : 'bg-danger'}`}>
                                                        {verifiedQrData.condition || 'INTACT'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {qrError && (
                                            <div className="alert alert-danger py-2 small mb-3">
                                                {qrError}
                                            </div>
                                        )}

                                        {/* Notice: Do not complete handover merely because a QR code was scanned */}
                                        <div className="alert alert-warning py-2 px-3 small text-muted text-start mb-4">
                                            <i className="bi bi-shield-exclamation text-warning me-2"></i>
                                            <strong>Verification Check:</strong> Please visually verify the collector's presence and package condition before completing handover.
                                        </div>

                                        {/* Handover Action Buttons */}
                                        <button 
                                            onClick={handleConfirmQrHandover} 
                                            className="gv-btn-primary w-100 py-3 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm mb-2" 
                                            disabled={qrLoading}
                                        >
                                            {qrLoading ? (
                                                <><span className="spinner-border spinner-border-sm"></span> Completing Handover...</>
                                            ) : (
                                                <><i className="bi bi-check2-all fs-4"></i> CONFIRM QR HANDOVER</>
                                            )}
                                        </button>

                                        <button 
                                            onClick={() => setVerifiedQrData(null)} 
                                            className="btn btn-link text-muted text-decoration-none w-100" 
                                            disabled={qrLoading}
                                        >
                                            Cancel & Scan Another Pass
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* MODE 2: 4-DIGIT PIN VERIFICATION (PRESERVED)             */}
                    {/* ======================================================== */}
                    {verificationMode === 'PIN' && (
                        <div>
                            {!verifiedParcel ? (
                                <div className="gv-card p-4 p-md-5">
                                    {error && (
                                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm py-3">
                                            <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                                            <div className="fw-medium">{error}</div>
                                        </div>
                                    )}
                                    
                                    <form onSubmit={handleVerify}>
                                        <div className="mb-4">
                                            <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Parcel ID</label>
                                            <input 
                                                type="text" 
                                                className="form-control form-control-lg bg-light text-uppercase fw-bold text-center fs-4 py-3" 
                                                placeholder="e.g. GV-12345"
                                                value={credentials.parcel_id}
                                                onChange={(e) => setCredentials({...credentials, parcel_id: e.target.value.toUpperCase()})}
                                                required
                                            />
                                        </div>
                                        <div className="mb-5">
                                            <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Secure PIN</label>
                                            <input 
                                                type="text" 
                                                ref={pinInputRef}
                                                className="form-control form-control-lg bg-light text-center fw-bold pin-display py-3" 
                                                style={{ fontSize: '2rem' }}
                                                placeholder="----"
                                                maxLength="4"
                                                value={credentials.pickup_pin}
                                                onChange={(e) => setCredentials({...credentials, pickup_pin: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <button type="submit" className="gv-btn-accent w-100 py-3 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2" disabled={loading}>
                                            {loading ? (
                                                <><span className="spinner-border spinner-border-sm"></span> Verifying...</>
                                            ) : (
                                                <><i className="bi bi-shield-check"></i> VERIFY PICKUP PIN</>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="gv-card overflow-hidden text-center border-2 border-success border">
                                    <div className="bg-success text-white p-4">
                                        <h4 className="fw-bold mb-0 text-uppercase tracking-wide"><i className="bi bi-shield-check me-2"></i> PIN Verified</h4>
                                    </div>
                                    <div className="p-4 p-md-5">
                                        <div className="mb-4">
                                            <div className="text-muted text-uppercase fw-bold mb-2" style={{ letterSpacing: '0.1em' }}>Retrieve From Shelf</div>
                                            <div className="display-3 fw-bold text-dark bg-light rounded p-4 border border-2 border-dark">
                                                {verifiedParcel.shelf_name}
                                            </div>
                                        </div>
                                        
                                        <div className="row g-2 mb-4 justify-content-center bg-light rounded p-3 text-start mx-1 border">
                                            <div className="col-12 col-sm-6">
                                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident</small>
                                                <div className="fw-bold text-dark">{verifiedParcel.resident_name || 'Resident'}</div>
                                            </div>
                                            <div className="col-12 col-sm-6">
                                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Flat</small>
                                                <div className="fw-bold text-dark">{verifiedParcel.flat_details?.number}</div>
                                            </div>
                                        </div>
                                        
                                        {verifiedParcel.is_delegated && (
                                            <div className="mb-4 px-3 py-2 bg-info bg-opacity-10 text-info rounded border border-info border-opacity-25 d-flex align-items-center justify-content-center gap-2">
                                                <i className="bi bi-info-circle-fill"></i>
                                                <span className="small fw-medium">Delegated Pickup Authorized: {verifiedParcel.delegated_to_name} (Flatmate)</span>
                                            </div>
                                        )}
                                        
                                        <div className="mb-4 text-start px-2">
                                            <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Actual Collector</label>
                                            <div className="d-flex flex-column gap-2 mt-1">
                                                <div className="form-check p-3 border rounded shadow-sm">
                                                    <input 
                                                        className="form-check-input ms-0 me-2" 
                                                        type="radio" 
                                                        name="collectorType" 
                                                        id="collectorPrimary" 
                                                        value="PRIMARY_RESIDENT"
                                                        checked={collectorType === 'PRIMARY_RESIDENT'}
                                                        onChange={() => { setCollectorType('PRIMARY_RESIDENT'); setSelectedMemberId(''); }}
                                                    />
                                                    <label className="form-check-label text-dark fw-medium" htmlFor="collectorPrimary">
                                                        Primary Resident ({verifiedParcel.resident_name || 'Owner'})
                                                    </label>
                                                </div>
                                                {verifiedParcel.is_delegated && (
                                                    <div className="form-check p-3 border rounded shadow-sm border-info bg-info bg-opacity-10">
                                                        <input 
                                                            className="form-check-input ms-0 me-2" 
                                                            type="radio" 
                                                            name="collectorType" 
                                                            id="collectorDelegate" 
                                                            value="DELEGATED_FLATMATE"
                                                            checked={collectorType === 'DELEGATED_FLATMATE'}
                                                            onChange={() => { setCollectorType('DELEGATED_FLATMATE'); setSelectedMemberId(''); }}
                                                        />
                                                        <label className="form-check-label text-dark fw-medium" htmlFor="collectorDelegate">
                                                            Delegated Flatmate ({verifiedParcel.delegated_to_name})
                                                        </label>
                                                    </div>
                                                )}
                                                {householdMembers.map(m => (
                                                    <div key={m.id} className="form-check p-3 border rounded shadow-sm border-primary bg-primary bg-opacity-10">
                                                        <input 
                                                            className="form-check-input ms-0 me-2" 
                                                            type="radio" 
                                                            name="collectorType" 
                                                            id={`collectorMember_${m.id}`} 
                                                            value={m.id}
                                                            checked={collectorType === 'HOUSEHOLD_MEMBER' && selectedMemberId === m.id}
                                                            onChange={() => { setCollectorType('HOUSEHOLD_MEMBER'); setSelectedMemberId(m.id); }}
                                                        />
                                                        <label className="form-check-label text-dark fw-medium" htmlFor={`collectorMember_${m.id}`}>
                                                            <i className="bi bi-person-fill text-primary me-1"></i> Authorized Household Member: <strong>{m.name}</strong> ({m.relationship_display})
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <button onClick={handleHandover} className="gv-btn-primary w-100 py-4 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm" disabled={loading}>
                                            {loading ? (
                                                <><span className="spinner-border spinner-border-sm"></span> Processing...</>
                                            ) : (
                                                <><i className="bi bi-check2-all fs-4"></i> CONFIRM PIN HANDOVER</>
                                            )}
                                        </button>
                                        <button onClick={() => setVerifiedParcel(null)} className="btn btn-link text-muted text-decoration-none w-100 mt-2" disabled={loading}>
                                            Cancel & Return
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ======================================================== */}
                    {/* MODE 3: TEMPORARY GUEST PASS VERIFICATION                */}
                    {/* ======================================================== */}
                    {verificationMode === 'GUEST' && (
                        <div>
                            {!verifiedGuestData ? (
                                <div className="gv-card p-4 p-md-5">
                                    {guestError && (
                                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm py-3">
                                            <i className="bi bi-exclamation-triangle-fill fs-4 me-3 flex-shrink-0"></i>
                                            <div className="fw-medium">{guestError}</div>
                                        </div>
                                    )}

                                    <form onSubmit={handleVerifyGuestPass}>
                                        <div className="text-center mb-4">
                                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary mb-2" style={{ width: '64px', height: '64px' }}>
                                                <i className="bi bi-person-badge fs-2"></i>
                                            </div>
                                            <h4 className="fw-bold text-dark mb-1">Temporary Guest Pass</h4>
                                            <p className="text-muted small">Enter the 6-digit pass code or scan/paste the secure guest pickup token presented by the visitor.</p>
                                        </div>

                                        <div className="mb-4">
                                            <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Guest Pass Code or Token</label>
                                            <input 
                                                type="text" 
                                                className="form-control form-control-lg bg-light text-uppercase fw-bold text-center fs-4 py-3" 
                                                placeholder="e.g. GV-GUEST-123456"
                                                value={guestPassCode}
                                                onChange={(e) => setGuestPassCode(e.target.value)}
                                                autoFocus
                                                required
                                            />
                                            <small className="text-muted d-block mt-2 text-center">Accepts Pass Code (e.g. GV-GUEST-123456) or Raw Token string.</small>
                                        </div>

                                        <button 
                                            type="submit" 
                                            className="gv-btn-primary w-100 py-3 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2" 
                                            disabled={guestLoading}
                                        >
                                            {guestLoading ? (
                                                <><span className="spinner-border spinner-border-sm"></span> Verifying Guest Pass...</>
                                            ) : (
                                                <><i className="bi bi-shield-check"></i> VERIFY GUEST PASS</>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            ) : (
                                <div className="gv-card overflow-hidden text-center border-2 border-primary border shadow">
                                    <div className="bg-primary text-white p-4">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="badge bg-white text-primary text-uppercase px-2 py-1">Guest Pass Verified</span>
                                            <span className="small opacity-75">
                                                <i className="bi bi-shield-check me-1"></i>One-Time Pass Valid
                                            </span>
                                        </div>
                                        <h3 className="fw-bold mb-0 text-white">
                                            Parcel {verifiedGuestData.parcel_id}
                                        </h3>
                                        <small className="opacity-75">{verifiedGuestData.carrier} • Flat {verifiedGuestData.flat_number} ({verifiedGuestData.tower_name})</small>
                                    </div>

                                    <div className="p-4 p-md-5">
                                        {/* Authorized Guest Details Card */}
                                        <div className="alert alert-info border-info text-start p-3 mb-4 rounded-3">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <i className="bi bi-person-badge-fill fs-3 text-primary"></i>
                                                <div>
                                                    <span className="small text-muted text-uppercase fw-bold d-block" style={{ fontSize: '0.7rem' }}>Authorized Guest Collector</span>
                                                    <h5 className="fw-bold text-dark mb-0">{verifiedGuestData.guest_name}</h5>
                                                </div>
                                                <span className="badge bg-primary ms-auto">
                                                    {verifiedGuestData.relationship_display}
                                                </span>
                                            </div>
                                            <div className="row g-2 small text-muted border-top pt-2 mt-2">
                                                <div className="col-6">
                                                    <span className="d-block text-muted" style={{ fontSize: '0.7rem' }}>GUEST MOBILE</span>
                                                    <strong className="text-dark">{verifiedGuestData.guest_mobile}</strong>
                                                </div>
                                                <div className="col-6">
                                                    <span className="d-block text-muted" style={{ fontSize: '0.7rem' }}>PASS CODE</span>
                                                    <strong className="text-dark font-monospace">{verifiedGuestData.pass_code}</strong>
                                                </div>
                                            </div>
                                            <div className="small text-muted border-top pt-2 mt-2">
                                                Resident Owner: <strong>{verifiedGuestData.resident_name}</strong> • Flat {verifiedGuestData.flat_number} ({verifiedGuestData.tower_name})
                                                {verifiedGuestData.resident_mobile && ` • Ph: ${verifiedGuestData.resident_mobile}`}
                                            </div>
                                            {verifiedGuestData.instructions && (
                                                <div className="small text-dark bg-white rounded p-2 mt-2 border">
                                                    <i className="bi bi-info-circle me-1 text-primary"></i>
                                                    <strong>Instructions:</strong> {verifiedGuestData.instructions}
                                                </div>
                                            )}
                                        </div>

                                        {/* Expiry & Status Highlight */}
                                        <div className="row g-2 mb-4 text-start bg-light rounded-3 p-3 border mx-0">
                                            <div className="col-6">
                                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Status</small>
                                                <span className="badge bg-success">
                                                    <i className="bi bi-check-circle-fill me-1"></i>Active Authorization
                                                </span>
                                            </div>
                                            <div className="col-6">
                                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Valid Until</small>
                                                <div className="fw-bold text-dark small">
                                                    {new Date(verifiedGuestData.expires_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>

                                        {guestError && (
                                            <div className="alert alert-danger py-2 small mb-3">
                                                {guestError}
                                            </div>
                                        )}

                                        {/* Collector Confirmation Input */}
                                        <div className="mb-4 text-start">
                                            <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Confirmed Collector Name</label>
                                            <input 
                                                type="text" 
                                                className="form-control"
                                                value={actualCollectorName}
                                                onChange={(e) => setActualCollectorName(e.target.value)}
                                                placeholder="Enter collector's name"
                                            />
                                            <small className="text-muted">Defaults to authorized guest name ({verifiedGuestData.guest_name}).</small>
                                        </div>

                                        {/* Visual verification warning */}
                                        <div className="alert alert-warning py-2 px-3 small text-muted text-start mb-4">
                                            <i className="bi bi-shield-exclamation text-warning me-2"></i>
                                            <strong>Verification Check:</strong> Please visually verify the guest's physical ID and match it with the authorized name ({verifiedGuestData.guest_name}) before completing handover.
                                        </div>

                                        {/* Handover Action Buttons */}
                                        <button 
                                            onClick={handleConfirmGuestHandover} 
                                            className="gv-btn-primary w-100 py-3 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm mb-2" 
                                            disabled={guestLoading}
                                        >
                                            {guestLoading ? (
                                                <><span className="spinner-border spinner-border-sm"></span> Completing Handover...</>
                                            ) : (
                                                <><i className="bi bi-check2-all fs-4"></i> CONFIRM GUEST HANDOVER</>
                                            )}
                                        </button>

                                        <button 
                                            onClick={() => setVerifiedGuestData(null)} 
                                            className="btn btn-link text-muted text-decoration-none w-100" 
                                            disabled={guestLoading}
                                        >
                                            Cancel & Verify Another Pass
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PickupVerification;
