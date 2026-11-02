import React, { useState, useEffect } from 'react';
import axios from 'axios';

const publicAxios = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/',
    headers: { 'Content-Type': 'application/json' }
});

const ResidentGoogleOnboardingModal = ({
    show,
    googleUser,
    registrationToken,
    onClose,
    onComplete
}) => {
    const [towers, setTowers] = useState([]);
    const [floors, setFloors] = useState([]);
    const [flats, setFlats] = useState([]);
    const [selectedTower, setSelectedTower] = useState('');
    const [selectedFloor, setSelectedFloor] = useState('');
    const [selectedFlat, setSelectedFlat] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingFloors, setLoadingFloors] = useState(false);
    const [loadingFlats, setLoadingFlats] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!show) return;

        // Fetch available towers
        publicAxios.get('towers/')
            .then(res => setTowers(res.data))
            .catch(err => {
                console.error("Failed to load towers:", err);
                setError("Unable to load community towers. Please try again.");
            });
    }, [show]);

    // Load available floors dynamically when selectedTower changes
    useEffect(() => {
        if (selectedTower) {
            setLoadingFloors(true);
            setSelectedFloor('');
            setSelectedFlat('');
            setFlats([]);
            publicAxios.get(`flats/floors/?tower=${selectedTower}`)
                .then(res => setFloors(res.data))
                .catch(err => {
                    console.error("Failed to load floors:", err);
                    setFloors([]);
                })
                .finally(() => setLoadingFloors(false));
        } else {
            setFloors([]);
            setSelectedFloor('');
            setSelectedFlat('');
            setFlats([]);
        }
    }, [selectedTower]);

    // Load available flats dynamically when selectedTower and selectedFloor change
    useEffect(() => {
        if (selectedTower && selectedFloor !== '') {
            setLoadingFlats(true);
            setSelectedFlat('');
            publicAxios.get(`flats/?tower=${selectedTower}&floor=${selectedFloor}`)
                .then(res => setFlats(res.data))
                .catch(err => {
                    console.error("Failed to load flats:", err);
                    setFlats([]);
                })
                .finally(() => setLoadingFlats(false));
        } else {
            setFlats([]);
            setSelectedFlat('');
        }
    }, [selectedTower, selectedFloor]);

    if (!show) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!selectedTower) {
            return setError("Please select your Tower.");
        }
        if (selectedFloor === '') {
            return setError("Please select your Floor.");
        }
        if (!selectedFlat) {
            return setError("Please select your Flat Number.");
        }

        setLoading(true);
        try {
            const response = await publicAxios.post('auth/google/register/', {
                registration_token: registrationToken,
                tower_id: parseInt(selectedTower),
                floor: parseInt(selectedFloor),
                flat_id: parseInt(selectedFlat),
                phone_number: phoneNumber
            });

            onComplete && onComplete(response.data);
        } catch (err) {
            console.error("Google resident registration failed:", err);
            const msg = err.response?.data?.error || err.response?.data?.detail || "Registration failed. Please check the details.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
                <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div className="modal-header bg-light border-bottom p-4">
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-primary text-white rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                                <i className="bi bi-person-badge fs-4"></i>
                            </div>
                            <div>
                                <h5 className="modal-title fw-bold text-dark mb-0">Complete Resident Registration</h5>
                                <small className="text-muted">Link your Google identity with your apartment flat</small>
                            </div>
                        </div>
                        <button type="button" className="btn-close" onClick={onClose} disabled={loading}></button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="modal-body p-4">
                            {error && (
                                <div className="alert alert-danger d-flex align-items-center gap-2 border-0 bg-danger bg-opacity-10 text-danger mb-4 rounded-3 p-3">
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                    <span className="small fw-medium">{error}</span>
                                </div>
                            )}

                            {/* Verified Identity Banner */}
                            <div className="bg-light p-3 rounded-3 mb-4 border d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-success text-white rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
                                        <i className="bi bi-shield-check fs-5"></i>
                                    </div>
                                    <div>
                                        <div className="fw-semibold text-dark">{googleUser?.name || 'Resident'}</div>
                                        <div className="text-muted small">{googleUser?.email}</div>
                                    </div>
                                </div>
                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                                    <i className="bi bi-check2-circle me-1"></i> Verified by Google
                                </span>
                            </div>

                            <div className="row g-3">
                                {/* Read-only Full Name */}
                                <div className="col-md-6">
                                    <label className="form-label small fw-semibold text-muted">Full Name</label>
                                    <input 
                                        type="text" 
                                        className="form-control bg-light" 
                                        value={googleUser?.name || ''} 
                                        readOnly 
                                        disabled 
                                    />
                                </div>

                                {/* Read-only Email */}
                                <div className="col-md-6">
                                    <label className="form-label small fw-semibold text-muted">Verified Email</label>
                                    <input 
                                        type="email" 
                                        className="form-control bg-light" 
                                        value={googleUser?.email || ''} 
                                        readOnly 
                                        disabled 
                                    />
                                </div>

                                {/* Residential Address: Tower -> Floor -> Flat */}
                                <div className="col-12">
                                    <div className="p-3 bg-light rounded-3 border">
                                        <div className="fw-semibold small text-dark mb-2 d-flex align-items-center gap-2">
                                            <i className="bi bi-buildings text-primary"></i> Residential Community Allocation
                                        </div>
                                        <div className="row g-2">
                                            {/* Field 1: Tower */}
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold text-dark mb-1">
                                                    1. Select Tower <span className="text-danger">*</span>
                                                </label>
                                                <select
                                                    className="form-select bg-white"
                                                    value={selectedTower}
                                                    onChange={(e) => setSelectedTower(e.target.value)}
                                                    required
                                                >
                                                    <option value="">-- Choose Tower --</option>
                                                    {towers.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Field 2: Floor */}
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold text-dark mb-1">
                                                    2. Select Floor <span className="text-danger">*</span>
                                                </label>
                                                <select
                                                    className="form-select bg-white"
                                                    value={selectedFloor}
                                                    onChange={(e) => setSelectedFloor(e.target.value)}
                                                    disabled={!selectedTower || loadingFloors}
                                                    required
                                                >
                                                    <option value="">
                                                        {loadingFloors ? 'Loading floors...' : (!selectedTower ? '-- Select Tower first --' : '-- Choose Floor --')}
                                                    </option>
                                                    {floors.map(fl => (
                                                        <option key={fl.floor_number} value={fl.floor_number}>{fl.floor_name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Field 3: Flat Number */}
                                            <div className="col-md-4">
                                                <label className="form-label small fw-semibold text-dark mb-1">
                                                    3. Select Flat <span className="text-danger">*</span>
                                                </label>
                                                <select
                                                    className="form-select bg-white"
                                                    value={selectedFlat}
                                                    onChange={(e) => setSelectedFlat(e.target.value)}
                                                    disabled={selectedFloor === '' || loadingFlats}
                                                    required
                                                >
                                                    <option value="">
                                                        {loadingFlats 
                                                            ? 'Loading flats...' 
                                                            : (selectedFloor === '' ? '-- Select Floor first --' : '-- Choose Flat --')}
                                                    </option>
                                                    {flats.map(f => (
                                                        <option key={f.id} value={f.id}>Flat {f.number}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <small className="text-muted d-block mt-2" style={{ fontSize: '0.75rem' }}>
                                            GateVault assigns residents by Tower, Floor, and Flat Number (No individual rooms).
                                        </small>
                                    </div>
                                </div>

                                {/* Optional Phone Number */}
                                <div className="col-12">
                                    <label className="form-label small fw-semibold text-dark">Phone Number (Optional)</label>
                                    <input
                                        type="tel"
                                        className="form-control"
                                        placeholder="e.g. +91 98765 43210"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Informational Notice */}
                            <div className="alert alert-info border-0 bg-info bg-opacity-10 text-info-emphasis mt-4 mb-0 rounded-3 p-3">
                                <div className="d-flex gap-2">
                                    <i className="bi bi-info-circle-fill fs-5"></i>
                                    <div className="small">
                                        <strong>Admin Verification Notice:</strong> For community security, all new resident profiles are set to <em>Pending Approval</em>. The Community Admin will verify your flat occupancy before granting access to deliveries and parcels.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer bg-light border-top p-3 d-flex justify-content-between">
                            <button
                                type="button"
                                className="btn btn-outline-secondary rounded-pill px-4"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary rounded-pill px-4 fw-semibold"
                                disabled={loading || !selectedTower || !selectedFlat}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-lg me-1"></i> Submit for Approval
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResidentGoogleOnboardingModal;

