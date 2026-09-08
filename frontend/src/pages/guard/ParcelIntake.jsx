import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const ParcelIntake = () => {
    const navigate = useNavigate();
    const [towers, setTowers] = useState([]);
    const [flats, setFlats] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [shelves, setShelves] = useState([]);
    
    // Workflow state
    const [step, setStep] = useState('LOOKUP'); // 'LOOKUP' | 'VERIFY' | 'MANUAL'
    const [lookupTracking, setLookupTracking] = useState('');
    const [lookupMessage, setLookupMessage] = useState('');
    const [expectedMatch, setExpectedMatch] = useState(null);

    // Form data for manual intake and final submission
    const [formData, setFormData] = useState({
        tower: '',
        flat: '',
        carrier: '',
        tracking_number: '',
        shelf: '',
        delivery_type: 'NORMAL',
        expected_delivery_id: '',
        payment_status: 'NOT_APPLICABLE',
        payment_method: 'NOT_APPLICABLE',
        status: 'AWAITING_PICKUP'
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);
    const [codVerified, setCodVerified] = useState(false);

    const trackingInputRef = useRef(null);

    useEffect(() => {
        if (step === 'LOOKUP' && trackingInputRef.current) {
            trackingInputRef.current.focus();
        }
    }, [step]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [towerRes, carrierRes, shelfRes] = await Promise.all([
                    axiosInstance.get('towers/'),
                    axiosInstance.get('carriers/'),
                    axiosInstance.get('shelves/')
                ]);
                setTowers(towerRes.data);
                setCarriers(carrierRes.data);
                setShelves(shelfRes.data.filter(s => !s.is_full));
            } catch (err) {
                console.error("Failed to load form data", err);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (formData.tower) {
            axiosInstance.get(`flats/?tower=${formData.tower}`)
                .then(res => setFlats(res.data))
                .catch(err => console.error("Failed to fetch flats", err));
        } else {
            setFlats([]);
        }
    }, [formData.tower]);

    const handleLookup = async (e) => {
        e?.preventDefault();
        if (!lookupTracking.trim()) return;
        
        setLoading(true);
        setLookupMessage('');
        
        try {
            const res = await axiosInstance.get(`expected-deliveries/lookup/?tracking=${lookupTracking.trim()}`);
            const match = res.data;
            setExpectedMatch(match);
            
            // Map courier name to carrier ID
            let mappedCarrierId = '';
            const matchingCarrier = carriers.find(c => c.name.toLowerCase() === match.courier_name.toLowerCase());
            if (matchingCarrier) {
                mappedCarrierId = matchingCarrier.id;
            } else if (carriers.length > 0) {
                // Fallback to first carrier if exact name doesn't match
                mappedCarrierId = carriers[0].id;
            }

            setFormData({
                ...formData,
                tracking_number: match.tracking_id,
                delivery_type: match.delivery_type,
                tower: match.tower_id || '',
                flat: match.flat_id || '',
                carrier: mappedCarrierId,
                expected_delivery_id: match.id,
                payment_status: match.payment_type === 'COD' ? 'PENDING' : 'NOT_APPLICABLE',
                payment_method: match.payment_type === 'COD' ? '' : 'NOT_APPLICABLE'
            });
            
            setCodVerified(false);
            setStep('VERIFY');
            
        } catch (err) {
            if (err.response?.data?.error) {
                setLookupMessage(err.response.data.error);
            } else {
                setLookupMessage("No expected delivery found. You can receive this parcel manually.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLookupKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLookup();
        }
    };

    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e, action = 'RECEIVE') => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const dataToSubmit = { ...formData, courier_payment_confirmed: codVerified };
            if (action === 'ATTEMPTED') {
                dataToSubmit.status = 'DELIVERY_ATTEMPTED';
                dataToSubmit.payment_status = 'FAILED';
                dataToSubmit.shelf = null;
            } else if (expectedMatch && expectedMatch.payment_type === 'COD') {
                dataToSubmit.payment_status = 'PAID';
            }

            const res = await axiosInstance.post('parcels/intake/', dataToSubmit);
            
            // Re-fetch shelves in background to update capacity
            axiosInstance.get('shelves/').then(shelfRes => {
                setShelves(shelfRes.data.filter(s => !s.is_full));
            });

            if (action === 'ATTEMPTED') {
                setSuccessData({ attempted: true });
                return;
            } else if (action === 'OPEN_BOX_RETURNED') {
                setSuccessData({ openBoxReturned: true });
                return;
            } else if (action === 'OPEN_BOX_COMPLETED') {
                setSuccessData({ openBoxCompleted: true });
                return;
            }

            // Find flat and shelf names for success screen
            let selectedFlat = flats.find(f => f.id.toString() === formData.flat.toString());
            // If using expected match and flats array isn't populated for that tower yet, use expectedMatch display
            const flatDisplay = selectedFlat ? selectedFlat.number : (expectedMatch ? expectedMatch.flat_display : '');
            
            const selectedShelf = shelves.find(s => s.id.toString() === formData.shelf.toString());
            
            setSuccessData({
                parcel_id: res.data.parcel_id,
                pickup_pin: res.data.pickup_pin,
                resident_name: res.data.resident_name || (expectedMatch ? expectedMatch.resident_name : 'Resident'),
                flat_number: flatDisplay,
                shelf_name: selectedShelf?.name || 'Assigned Shelf'
            });
            
        } catch (err) {
            setError(err.response?.data?.shelf || err.response?.data?.expected_delivery_id || 'Failed to register parcel. Please check all fields.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterAnother = () => {
        setSuccessData(null);
        setStep('LOOKUP');
        setLookupTracking('');
        setLookupMessage('');
        setExpectedMatch(null);
        setCodVerified(false);
        setFormData({
            tower: '',
            flat: '',
            carrier: '',
            tracking_number: '',
            shelf: '',
            delivery_type: 'NORMAL',
            expected_delivery_id: '',
            payment_status: 'NOT_APPLICABLE',
            payment_method: 'NOT_APPLICABLE',
            status: 'AWAITING_PICKUP'
        });
    };

    if (successData) {
        if (successData.attempted) {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                        <div className="bg-warning text-dark text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-warning mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-arrow-return-left fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-0">Delivery Attempted</h3>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-muted mb-4">The delivery was marked as attempted (returned to courier). No shelf was assigned.</p>
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Return to Intake
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        if (successData.openBoxReturned) {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                        <div className="bg-danger text-white text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-danger mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-x-circle fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-0">Delivery Returned</h3>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-muted mb-4">Open-box delivery was rescheduled and returned with the courier because the resident was unavailable.</p>
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Return to Intake
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        if (successData.openBoxCompleted) {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                        <div className="bg-success text-white text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-check-circle-fill fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-0">Open-Box Completed</h3>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-muted mb-4">The delivery was successfully handed over to the resident at the gate. No shelf was occupied.</p>
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Return to Intake
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="container-fluid px-0 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                    <div className="bg-success text-white text-center p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                            <i className="bi bi-check-lg fs-1"></i>
                        </div>
                        <h3 className="fw-bold mb-0">Parcel Received & Stored</h3>
                    </div>
                    
                    <div className="p-4">
                        <div className="bg-light rounded p-3 mb-4 text-center border">
                            <div className="text-uppercase text-muted fw-bold mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Pickup PIN Generated</div>
                            <div className="display-4 fw-bold text-dark pin-display">{successData.pickup_pin}</div>
                        </div>

                        <div className="row g-3 mb-4">
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Parcel ID</small>
                                <div className="fw-medium text-dark">{successData.parcel_id}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident</small>
                                <div className="fw-medium text-dark">{successData.resident_name}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Destination</small>
                                <div className="fw-medium text-dark">{successData.flat_number}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Storage</small>
                                <div className="fw-medium text-dark">{successData.shelf_name}</div>
                            </div>
                        </div>

                        <div className="d-flex flex-column gap-2">
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Receive Another Parcel
                            </button>
                            <button onClick={() => navigate('/guard/verify')} className="btn btn-light py-2 w-100 fw-medium border">
                                Go to Pickup Verification
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid px-0">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Receive New Parcel</h2>
                <p className="text-muted">Register an incoming delivery and assign it to a storage shelf.</p>
            </div>
            
            <div className="gv-card" style={{ maxWidth: '700px' }}>
                <div className="card-body p-4 p-md-5">
                    {error && (
                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm rounded-3">
                            <i className="bi bi-exclamation-circle-fill fs-5 me-3"></i>
                            {error}
                        </div>
                    )}
                    
                    {step === 'LOOKUP' && (
                        <div>
                            <h6 className="text-uppercase fw-bold text-primary mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Search Expected Delivery</h6>
                            
                            <div className="mb-4">
                                <label className="form-label text-dark small fw-semibold">Enter or Scan Tracking ID</label>
                                <input 
                                    type="text" 
                                    ref={trackingInputRef}
                                    className="form-control form-control-lg bg-light fw-bold" 
                                    value={lookupTracking}
                                    onChange={(e) => setLookupTracking(e.target.value)}
                                    onKeyDown={handleLookupKeyDown}
                                    placeholder="e.g. AMZ123456789" 
                                />
                                {lookupMessage && (
                                    <div className="alert alert-warning mt-3 py-2 px-3 small border-0 d-flex align-items-center">
                                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                        {lookupMessage}
                                    </div>
                                )}
                            </div>
                            
                            <div className="d-flex flex-column gap-3">
                                <button onClick={handleLookup} disabled={loading || !lookupTracking.trim()} className="gv-btn-primary py-3 fs-6 fw-bold">
                                    {loading ? <span className="spinner-border spinner-border-sm"></span> : 'Search Delivery'}
                                </button>
                                
                                <div className="position-relative text-center my-2">
                                    <hr className="text-muted" />
                                    <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small fw-medium">OR</span>
                                </div>
                                
                                <button onClick={() => setStep('MANUAL')} className="btn btn-outline-secondary py-2 fw-medium">
                                    Receive Parcel Manually (No Expected Record)
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'VERIFY' && expectedMatch && (
                        <form onSubmit={handleSubmit}>
                            <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                                <h5 className="fw-bold text-success mb-0">
                                    <i className="bi bi-check-circle-fill me-2"></i> Expected Delivery Found
                                </h5>
                                <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-sm btn-light">Change</button>
                            </div>

                            <div className="row g-3 mb-4 bg-light p-3 rounded-3 border">
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Resident</small>
                                    <div className="fw-medium text-dark">{expectedMatch.resident_name}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Destination</small>
                                    <div className="fw-medium text-dark">{expectedMatch.flat_display}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Tracking ID</small>
                                    <div className="fw-bold text-dark">{expectedMatch.tracking_id}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Courier</small>
                                    <div className="fw-medium text-dark">{expectedMatch.courier_name}</div>
                                </div>
                                {expectedMatch.order_id && (
                                    <div className="col-sm-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Order ID</small>
                                        <div className="fw-medium text-dark">{expectedMatch.order_id}</div>
                                    </div>
                                )}
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Payment</small>
                                    <div className={`fw-bold ${expectedMatch.payment_type === 'COD' ? 'text-danger' : 'text-success'}`}>
                                        {expectedMatch.payment_type === 'COD' ? `COD (₹${expectedMatch.cod_amount})` : 'Prepaid'}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Delivery Type</small>
                                    <div className="fw-medium text-dark">{expectedMatch.delivery_type === 'FOOD' ? 'Food Delivery' : 'Parcel'}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Expected Date</small>
                                    <div className="fw-medium text-dark">{new Date(expectedMatch.expected_delivery_date).toLocaleDateString('en-GB')}</div>
                                </div>
                            </div>
                            
                            {expectedMatch.note && (
                                <div className="mb-4">
                                    <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident Note</small>
                                    <div className="p-3 bg-white border border-warning rounded-3 border-opacity-50 text-dark">
                                        <i className="bi bi-chat-left-text text-warning me-2"></i>"{expectedMatch.note}"
                                    </div>
                                </div>
                            )}

                            {expectedMatch.delivery_photo && (
                                <div className="mb-4">
                                    <a href={expectedMatch.delivery_photo} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary w-100 py-2">
                                        <i className="bi bi-image me-2"></i> View Delivery Photo/Screenshot
                                    </a>
                                </div>
                            )}

                            {expectedMatch.payment_type === 'COD' && (
                                <div className="mb-4">
                                    <div className="alert alert-warning border-0 shadow-sm rounded-3 p-4 mb-3">
                                        <div className="d-flex align-items-center mb-2">
                                            <i className="bi bi-exclamation-triangle-fill fs-4 text-warning me-2"></i>
                                            <h5 className="fw-bold text-dark mb-0">COD Parcel - Amount Due to Courier: ₹{expectedMatch.cod_amount}</h5>
                                        </div>
                                        <p className="text-dark small mb-0 ms-4">
                                            This is a Cash on Delivery parcel. Ensure the resident has paid the courier directly before receiving the parcel.
                                        </p>
                                    </div>
                                    <div className="bg-white border rounded-3 p-3 ms-0 mb-3 shadow-sm">
                                        <div className="fw-bold text-dark small mb-2 text-uppercase">Courier Payment Method <span className="text-danger">*</span></div>
                                        <div className="d-flex flex-column gap-2">
                                            <div className="form-check">
                                                <input className="form-check-input" type="radio" name="payment_method" id="pay_cash" value="CASH" checked={formData.payment_method === 'CASH'} onChange={handleChange} />
                                                <label className="form-check-label" htmlFor="pay_cash">
                                                    <i className="bi bi-cash-stack me-1 text-success"></i> Cash (Paid in person to courier)
                                                </label>
                                            </div>
                                            <div className="form-check">
                                                <input className="form-check-input" type="radio" name="payment_method" id="pay_upi" value="UPI" checked={formData.payment_method === 'UPI'} onChange={handleChange} />
                                                <label className="form-check-label" htmlFor="pay_upi">
                                                    <i className="bi bi-phone me-1 text-primary"></i> UPI / Remote Payment Link (Paid by resident from office)
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-check bg-white border rounded-3 p-3 ms-0 d-flex align-items-center shadow-sm">
                                        <input 
                                            className="form-check-input ms-2 me-3" 
                                            type="checkbox" 
                                            id="codConfirmCheck" 
                                            style={{ width: '1.5em', height: '1.5em' }}
                                            checked={codVerified}
                                            onChange={(e) => setCodVerified(e.target.checked)}
                                        />
                                        <label className="form-check-label fw-bold text-dark" htmlFor="codConfirmCheck">
                                            Courier confirms direct payment received from resident (Cash/UPI)
                                        </label>
                                    </div>
                                </div>
                            )}

                            {expectedMatch.is_open_box ? (
                                <div className="mb-4">
                                    <div className="alert alert-danger border-0 shadow-sm rounded-3 p-4 mb-4">
                                        <div className="d-flex align-items-center mb-2">
                                            <i className="bi bi-shield-exclamation fs-3 text-danger me-2"></i>
                                            <h5 className="fw-bold text-dark mb-0">OPEN-BOX DELIVERY DETECTED</h5>
                                        </div>
                                        <p className="text-dark fw-medium mb-0 ms-5">
                                            Guards are not permitted to unbox or store unsealed items on shelves.<br/>
                                            Resident must physically inspect the parcel at the gate.
                                        </p>
                                    </div>
                                    
                                    <div className="d-flex flex-column gap-3">
                                        <button 
                                            type="button" 
                                            onClick={(e) => handleSubmit(e, 'OPEN_BOX_COMPLETED')}
                                            className="btn btn-success w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2 fw-bold shadow-sm" 
                                            disabled={loading}
                                        >
                                            {loading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : <><i className="bi bi-check-circle-fill"></i> Resident Present - Completed at Gate</>}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={(e) => handleSubmit(e, 'OPEN_BOX_RETURNED')}
                                            className="btn btn-outline-danger w-100 py-3 fw-medium"
                                            disabled={loading}
                                        >
                                            {loading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : 'Resident Unavailable - Return with Courier'}
                                        </button>
                                        <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-light py-2 fw-medium border mt-2">
                                            Cancel Lookup
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Verify Incoming Delivery</h6>
                                    <p className="text-muted small mb-3">Confirm that the physical parcel matches the expected delivery details above. Assign a storage shelf to complete the receiving process.</p>
                                    
                                    <div className="mb-5">
                                        <label className="form-label text-dark small fw-semibold">Gatehouse Shelf Assignment <span className="text-danger">*</span></label>
                                        <select className="form-select bg-light form-select-lg fs-6" name="shelf" value={formData.shelf} onChange={handleChange} required={!loading}>
                                            <option value="">Select Available Shelf...</option>
                                            {shelves.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.available} / {s.capacity} available)
                                                </option>
                                            ))}
                                        </select>
                                        {shelves.length === 0 && <div className="text-danger small mt-2 fw-medium"><i className="bi bi-x-circle me-1"></i> No available shelves! Please process pending pickups.</div>}
                                    </div>

                                    <div className="d-flex flex-column gap-3">
                                        <div className="d-flex gap-3">
                                            <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-light py-3 px-4 fw-medium border">
                                                Cancel
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => handleSubmit(e, 'RECEIVE')}
                                                className="gv-btn-primary w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2" 
                                                disabled={loading || !formData.shelf || (expectedMatch.payment_type === 'COD' && (!codVerified || !['CASH', 'UPI'].includes(formData.payment_method)))}
                                            >
                                                {loading ? (
                                                    <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...</>
                                                ) : (
                                                    <><i className="bi bi-box-seam"></i> Confirm & Receive Parcel</>
                                                )}
                                            </button>
                                        </div>
                                        
                                        {expectedMatch.payment_type === 'COD' && (
                                            <button 
                                                type="button" 
                                                onClick={(e) => handleSubmit(e, 'ATTEMPTED')}
                                                className="btn btn-outline-danger w-100 py-2 fw-medium"
                                                disabled={loading}
                                            >
                                                Mark Delivery Attempted (Resident Unreachable / Unpaid)
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </form>
                    )}

                    {step === 'MANUAL' && (
                        <form onSubmit={handleSubmit}>
                            <div className="d-flex align-items-center justify-content-between mb-4">
                                <h6 className="text-uppercase fw-bold text-secondary mb-0" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Manual Parcel Intake</h6>
                                <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-sm btn-outline-secondary">Back to Search</button>
                            </div>

                            <div className="row g-3 mb-3">
                                <div className="col-md-12">
                                    <label className="form-label text-muted small fw-semibold">Tracking Number</label>
                                    <input 
                                        type="text" 
                                        className="form-control bg-light" 
                                        name="tracking_number" 
                                        value={formData.tracking_number} 
                                        onChange={handleChange} 
                                        placeholder="Optional" 
                                    />
                                </div>
                                <div className="col-md-12">
                                    <label className="form-label text-muted small fw-semibold mt-2">Carrier / Courier <span className="text-danger">*</span></label>
                                    <select className="form-select bg-light" name="carrier" value={formData.carrier} onChange={handleChange} required>
                                        <option value="">Select Carrier...</option>
                                        {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-12">
                                    <div className="btn-group w-100" role="group">
                                        <input type="radio" className="btn-check" name="delivery_type" id="type_normal" value="NORMAL" checked={formData.delivery_type === 'NORMAL'} onChange={handleChange} />
                                        <label className="btn btn-outline-primary py-2 fw-medium" htmlFor="type_normal">
                                            <i className="bi bi-box me-2"></i>Normal
                                        </label>
                                        
                                        <input type="radio" className="btn-check" name="delivery_type" id="type_food" value="FOOD" checked={formData.delivery_type === 'FOOD'} onChange={handleChange} />
                                        <label className="btn btn-outline-primary py-2 fw-medium" htmlFor="type_food">
                                            <i className="bi bi-cup-straw me-2"></i>Food
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Destination Details</h6>
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-semibold">Tower <span className="text-danger">*</span></label>
                                    <select className="form-select bg-light" name="tower" value={formData.tower} onChange={handleChange} required>
                                        <option value="">Select Tower...</option>
                                        {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-semibold">Flat Number <span className="text-danger">*</span></label>
                                    <select className="form-select bg-light" name="flat" value={formData.flat} onChange={handleChange} required disabled={!formData.tower}>
                                        <option value="">Select Flat...</option>
                                        {flats.map(f => <option key={f.id} value={f.id}>{f.number} {f.residents && f.residents.length > 0 ? `(${f.residents[0].user.first_name || f.residents[0].user.username})` : ''}</option>)}
                                    </select>
                                </div>
                            </div>

                            <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Storage Assignment</h6>
                            <div className="mb-5">
                                <label className="form-label text-muted small fw-semibold">Gatehouse Shelf <span className="text-danger">*</span></label>
                                <select className="form-select bg-light form-select-lg fs-6" name="shelf" value={formData.shelf} onChange={handleChange} required>
                                    <option value="">Select Available Shelf...</option>
                                    {shelves.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.available} / {s.capacity} available)
                                        </option>
                                    ))}
                                </select>
                                {shelves.length === 0 && <div className="text-danger small mt-2 fw-medium"><i className="bi bi-x-circle me-1"></i> No available shelves! Please process pending pickups.</div>}
                            </div>

                            <button type="submit" className="gv-btn-primary w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2" disabled={loading || shelves.length === 0}>
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...</>
                                ) : (
                                    <><i className="bi bi-box-seam"></i> Register Parcel Manually</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParcelIntake;
