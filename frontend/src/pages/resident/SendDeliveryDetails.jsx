import React, { useState, useContext } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const SendDeliveryDetails = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Since user object might not have full tower/flat populated via JWT directly,
    // we would ideally fetch the profile. But according to the instructions, we'll
    // try to get what we can from user state or wait for a fetch. For simplicity,
    // assuming backend user object has name, and we might have flat info in a context or fetch it.
    // However, the instructions say: "Resident information should appear automatically... 
    // Do NOT duplicate resident name, tower, or flat unnecessarily if these already exist through relationships."
    // In our backend, ExpectedDelivery doesn't require sending tower/flat from frontend because it gets it from request.user!
    // So we just show the name.

    const [formData, setFormData] = useState({
        tracking_id: '',
        order_id: '',
        courier_name: '',
        custom_courier: '',
        delivery_type: 'PARCEL',
        payment_type: 'PREPAID',
        cod_amount: '',
        expected_delivery_date: '',
        note: '',
        is_open_box: false
    });
    
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);

    const couriers = ['Amazon', 'Flipkart', 'Delhivery', 'Blue Dart', 'FedEx', 'Ecom Express', 'DTDC', 'Swiggy', 'Zomato', 'Other'];

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            setError('Please upload a valid JPG, JPEG, or PNG image.');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB.');
            return;
        }

        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setError('');
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.tracking_id.trim()) {
            setError('Tracking ID is required.');
            return;
        }
        if (!formData.courier_name) {
            setError('Courier is required.');
            return;
        }
        
        const finalCourier = formData.courier_name === 'Other' ? formData.custom_courier : formData.courier_name;
        if (formData.courier_name === 'Other' && !finalCourier.trim()) {
            setError('Please enter a delivery partner name.');
            return;
        }

        if (formData.payment_type === 'COD') {
            if (!formData.cod_amount || parseFloat(formData.cod_amount) <= 0) {
                setError('COD amount must be greater than 0 for COD deliveries.');
                return;
            }
        }

        setLoading(true);

        try {
            const data = new FormData();
            data.append('tracking_id', formData.tracking_id.trim());
            data.append('order_id', formData.order_id.trim());
            data.append('courier_name', finalCourier);
            data.append('delivery_type', formData.delivery_type);
            data.append('payment_type', formData.payment_type);
            data.append('expected_delivery_date', formData.expected_delivery_date);
            data.append('note', formData.note);
            data.append('is_open_box', formData.is_open_box);

            if (formData.payment_type === 'COD') {
                data.append('cod_amount', formData.cod_amount);
            }

            if (imageFile) {
                data.append('delivery_photo', imageFile);
            }

            const res = await axiosInstance.post('expected-deliveries/', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setSuccessData(res.data);
            window.scrollTo(0, 0);

        } catch (err) {
            console.error(err);
            if (err.response?.data?.non_field_errors) {
                setError(err.response.data.non_field_errors[0]);
            } else if (err.response?.data?.tracking_id) {
                setError(err.response.data.tracking_id[0]);
            } else if (err.response?.data?.cod_amount) {
                setError(err.response.data.cod_amount[0]);
            } else {
                setError('Failed to send delivery details. Please check your inputs.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (successData) {
        return (
            <div className="container-fluid px-0 py-4 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '600px' }}>
                    <div className="bg-success text-white text-center p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                            <i className="bi bi-check-lg fs-1"></i>
                        </div>
                        <h3 className="fw-bold mb-1">Delivery details sent successfully.</h3>
                        <p className="mb-0 text-white-50">✓ Delivery details sent to the community gate.</p>
                    </div>
                    <div className="p-4 p-md-5 bg-white">
                        <div className="row g-4 mb-4">
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Tracking ID</small>
                                <div className="fw-bold fs-5 text-dark">{successData.tracking_id}</div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Courier</small>
                                <div className="fw-bold fs-5 text-dark">{successData.courier_name}</div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Expected Date</small>
                                <div className="fw-medium text-dark">
                                    {new Date(successData.expected_delivery_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Payment</small>
                                <div className="fw-medium text-dark">{successData.payment_type === 'COD' ? `COD (₹${successData.cod_amount})` : 'Prepaid'}</div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</small>
                                <div><span className="badge bg-primary px-3 py-2">{successData.status}</span></div>
                            </div>
                        </div>
                        <button onClick={() => navigate('/resident')} className="gv-btn-primary w-100 py-3">
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid px-0 py-3">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Send Delivery Details</h2>
                <p className="text-muted">Share your expected delivery information with the community gate so your parcel can be securely verified when it arrives.</p>
            </div>

            <div className="gv-card overflow-hidden" style={{ maxWidth: '800px' }}>
                <div className="p-4 p-md-5 bg-white">
                    {error && (
                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm rounded-3">
                            <i className="bi bi-exclamation-triangle-fill fs-5 me-3"></i>
                            <div>{error}</div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* RESIDENT INFO (Read Only) */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Resident Information</h6>
                        <div className="row g-3 mb-4 bg-light p-3 rounded-3 border">
                            <div className="col-md-12">
                                <label className="form-label text-muted small fw-semibold">Resident Name</label>
                                <input type="text" className="form-control bg-white" value={user?.name || user?.username || ''} readOnly disabled />
                            </div>
                            <div className="col-12">
                                <small className="text-muted"><i className="bi bi-info-circle me-1"></i> Your Flat and Tower details are automatically linked via your profile.</small>
                            </div>
                        </div>

                        {/* DELIVERY INFO */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Delivery Information</h6>
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-dark small fw-semibold">Tracking ID <span className="text-danger">*</span></label>
                                <input type="text" name="tracking_id" className="form-control" placeholder="e.g. AMZ123456789" value={formData.tracking_id} onChange={handleChange} required />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-dark small fw-semibold">Order ID <span className="text-muted fw-normal">(Optional)</span></label>
                                <input type="text" name="order_id" className="form-control" placeholder="e.g. OD123456789" value={formData.order_id} onChange={handleChange} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-dark small fw-semibold">Courier / Delivery Partner <span className="text-danger">*</span></label>
                                <select name="courier_name" className="form-select" value={formData.courier_name} onChange={handleChange} required>
                                    <option value="">Select Courier...</option>
                                    {couriers.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            {formData.courier_name === 'Other' && (
                                <div className="col-md-6">
                                    <label className="form-label text-dark small fw-semibold">Enter Delivery Partner Name <span className="text-danger">*</span></label>
                                    <input type="text" name="custom_courier" className="form-control" placeholder="e.g. Local Shop" value={formData.custom_courier} onChange={handleChange} required />
                                </div>
                            )}

                            <div className="mb-4">
                                <div className="form-check form-switch p-3 bg-light rounded border d-flex align-items-center shadow-sm">
                                    <input 
                                        className="form-check-input ms-0 me-3" 
                                        type="checkbox" 
                                        role="switch" 
                                        id="isOpenBox" 
                                        name="is_open_box"
                                        checked={formData.is_open_box}
                                        onChange={handleChange}
                                        style={{ width: '2.5rem', height: '1.25rem' }}
                                    />
                                    <div>
                                        <label className="form-check-label fw-bold text-dark d-block" htmlFor="isOpenBox">
                                            Open-Box Delivery (Requires physical inspection/unboxing at gate)
                                        </label>
                                        <div className="text-muted small mt-1">
                                            Note: Guards cannot unbox parcels on your behalf. You must meet the courier at the gate to inspect and accept open-box deliveries.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label text-dark small fw-semibold">Expected Delivery Date <span className="text-danger">*</span></label>
                                <input type="date" name="expected_delivery_date" className="form-control" value={formData.expected_delivery_date} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div className="col-md-12">
                                <label className="form-label text-dark small fw-semibold mb-2">Delivery Type <span className="text-danger">*</span></label>
                                <div className="d-flex gap-3">
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="delivery_type" id="dt_parcel" value="PARCEL" checked={formData.delivery_type === 'PARCEL'} onChange={handleChange} />
                                        <label className="form-check-label fw-medium" htmlFor="dt_parcel">Parcel</label>
                                    </div>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="delivery_type" id="dt_food" value="FOOD" checked={formData.delivery_type === 'FOOD'} onChange={handleChange} />
                                        <label className="form-check-label fw-medium" htmlFor="dt_food">Food Delivery</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PAYMENT INFO */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3 pt-3 border-top mt-4" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Payment Information</h6>
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-dark small fw-semibold mb-2">Payment Type <span className="text-danger">*</span></label>
                                <div className="d-flex gap-3 mb-2">
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="payment_type" id="pt_prepaid" value="PREPAID" checked={formData.payment_type === 'PREPAID'} onChange={handleChange} />
                                        <label className="form-check-label fw-medium text-success" htmlFor="pt_prepaid"><i className="bi bi-check-circle me-1"></i> Prepaid</label>
                                    </div>
                                    <div className="form-check">
                                        <input className="form-check-input" type="radio" name="payment_type" id="pt_cod" value="COD" checked={formData.payment_type === 'COD'} onChange={handleChange} />
                                        <label className="form-check-label fw-medium text-warning" htmlFor="pt_cod"><i className="bi bi-cash me-1"></i> COD</label>
                                    </div>
                                </div>
                                <small className="text-muted" style={{fontSize: '0.75rem'}}>Payment Type is only for information. Actual payment must be handled directly with the courier.</small>
                            </div>
                            {formData.payment_type === 'COD' && (
                                <div className="col-md-6">
                                    <label className="form-label text-dark small fw-semibold">COD Amount (₹) <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-light fw-bold text-muted">₹</span>
                                        <input type="number" name="cod_amount" className="form-control" placeholder="4999" value={formData.cod_amount} onChange={handleChange} min="1" step="0.01" required />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* VERIFICATION INFO */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3 pt-3 border-top mt-4" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Verification Information</h6>
                        <div className="row g-3 mb-5">
                            <div className="col-md-12">
                                <label className="form-label text-dark small fw-semibold">Order / Tracking Screenshot <span className="text-muted fw-normal">(Optional)</span></label>
                                
                                {!imagePreview ? (
                                    <div className="border border-2 border-dashed rounded-3 p-4 text-center bg-light" style={{ borderColor: '#ccc', borderStyle: 'dashed' }}>
                                        <input type="file" id="photo_upload" className="d-none" accept="image/jpeg,image/png,image/jpg" onChange={handleImageChange} />
                                        <label htmlFor="photo_upload" className="btn btn-outline-primary mb-2 rounded-pill px-4">
                                            <i className="bi bi-upload me-2"></i>Choose Image
                                        </label>
                                        <div className="small text-muted">Accepted: JPG, JPEG, PNG. Max size: 5MB</div>
                                    </div>
                                ) : (
                                    <div className="position-relative d-inline-block rounded-3 overflow-hidden border shadow-sm">
                                        <img src={imagePreview} alt="Preview" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }} className="d-block" />
                                        <button type="button" onClick={removeImage} className="btn btn-danger btn-sm position-absolute top-0 end-0 m-2 rounded-circle" style={{ width: '30px', height: '30px', padding: 0 }}>
                                            <i className="bi bi-x"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="col-md-12">
                                <label className="form-label text-dark small fw-semibold">Additional Note <span className="text-muted fw-normal">(Optional)</span></label>
                                <textarea name="note" className="form-control" rows="3" placeholder="e.g. Please inform me when the delivery partner arrives." value={formData.note} onChange={handleChange}></textarea>
                            </div>
                        </div>

                        <div className="d-flex gap-3 pt-3 border-top">
                            <button type="button" onClick={() => navigate('/resident')} className="btn btn-light py-2 px-4 fw-medium text-dark border">
                                Cancel
                            </button>
                            <button type="submit" className="gv-btn-primary py-2 px-5 fw-bold d-flex align-items-center gap-2" disabled={loading}>
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm"></span> Sending...</>
                                ) : (
                                    <><i className="bi bi-send"></i> Send to Guard</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SendDeliveryDetails;
