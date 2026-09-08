import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate, useLocation } from 'react-router-dom';

const PickupVerification = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [credentials, setCredentials] = useState({
        parcel_id: location.state?.parcel_id || '',
        pickup_pin: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [verifiedParcel, setVerifiedParcel] = useState(null);
    const [handoverSuccess, setHandoverSuccess] = useState(false);
    
    const pinInputRef = useRef(null);

    useEffect(() => {
        if (pinInputRef.current) {
            pinInputRef.current.focus();
        }
    }, [credentials.parcel_id]);

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setVerifiedParcel(null);

        try {
            const res = await axiosInstance.post(`parcels/${credentials.parcel_id.trim()}/verify/`, {
                pickup_pin: credentials.pickup_pin.trim()
            });
            setVerifiedParcel(res.data.parcel);
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed. Incorrect ID or PIN.');
        } finally {
            setLoading(false);
        }
    };

    const handleHandover = async () => {
        setLoading(true);
        try {
            await axiosInstance.post(`parcels/${credentials.parcel_id.trim()}/handover/`);
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
        setError('');
    };

    if (handoverSuccess) {
        return (
            <div className="container-fluid px-0 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden text-center" style={{ maxWidth: '500px' }}>
                    <div className="bg-success text-white p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '80px', height: '80px' }}>
                            <i className="bi bi-box2-heart-fill" style={{ fontSize: '2.5rem' }}></i>
                        </div>
                        <h2 className="fw-bold mb-1">Handover Complete</h2>
                        <div className="opacity-75 small text-uppercase tracking-wide">Secure Transaction Verified</div>
                    </div>
                    
                    <div className="p-4 p-md-5 bg-white">
                        <div className="text-muted mb-4">
                            The parcel has been successfully handed over to the resident. The inventory has been updated.
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <button onClick={resetForm} className="gv-btn-primary py-3 fw-bold fs-6 w-100">
                                Verify Another Pickup
                            </button>
                            <button onClick={() => navigate('/guard')} className="btn btn-light py-2 w-100 fw-medium">
                                Return to Dashboard
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
                <h2 className="fw-bold text-dark mb-1">Verify Resident Pickup</h2>
                <p className="text-muted">Enter the details from the resident's pickup pass.</p>
            </div>
            
            <div className="row justify-content-center justify-content-md-start">
                <div className="col-12 col-md-8 col-lg-6 col-xl-5">
                    
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
                                        <><i className="bi bi-shield-check"></i> VERIFY PICKUP</>
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
                                
                                <div className="row g-2 mb-5 justify-content-center bg-light rounded p-3 text-start mx-1 border">
                                    <div className="col-12 col-sm-6">
                                        <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident</small>
                                        <div className="fw-bold text-dark">{verifiedParcel.resident_name || 'Resident'}</div>
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Flat</small>
                                        <div className="fw-bold text-dark">{verifiedParcel.flat_details?.number}</div>
                                    </div>
                                </div>
                                
                                <button onClick={handleHandover} className="gv-btn-primary w-100 py-4 fs-5 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm" disabled={loading}>
                                    {loading ? (
                                        <><span className="spinner-border spinner-border-sm"></span> Processing...</>
                                    ) : (
                                        <><i className="bi bi-check2-all fs-4"></i> DONE / NEXT HANDOVER</>
                                    )}
                                </button>
                                <button onClick={() => setVerifiedParcel(null)} className="btn btn-link text-muted text-decoration-none w-100 mt-2" disabled={loading}>
                                    Cancel & Return
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PickupVerification;
