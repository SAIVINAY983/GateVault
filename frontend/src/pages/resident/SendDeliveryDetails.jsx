import React, { useState, useEffect, useContext } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const PRESET_WINDOWS = [
    { id: '9-12', label: '9 AM – 12 PM', start: '09:00', end: '12:00', icon: 'bi-sunrise' },
    { id: '12-15', label: '12 PM – 3 PM', start: '12:00', end: '15:00', icon: 'bi-sun' },
    { id: '15-18', label: '3 PM – 6 PM', start: '15:00', end: '18:00', icon: 'bi-sunset' },
    { id: '18-21', label: '6 PM – 9 PM', start: '18:00', end: '21:00', icon: 'bi-moon-stars' },
    { id: 'custom', label: 'Custom Time Window', start: '', end: '', icon: 'bi-clock' },
];

const SendDeliveryDetails = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('SCHEDULE'); // 'SCHEDULE' | 'MY_DELIVERIES'

    // Form data for creating a delivery
    const [formData, setFormData] = useState({
        tracking_id: '',
        order_id: '',
        courier_name: '',
        custom_courier: '',
        delivery_category: 'NORMAL', // NORMAL | FOOD | COD
        cod_amount: '',
        expected_delivery_date: '',
        time_window_preset: '9-12',
        expected_start_time: '09:00',
        expected_end_time: '12:00',
        time_window_label: '9 AM – 12 PM',
        note: '',
        is_open_box: false
    });
    
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);

    // List of existing expected deliveries
    const [myDeliveries, setMyDeliveries] = useState([]);
    const [deliveriesLoading, setDeliveriesLoading] = useState(false);

    // Reschedule modal state
    const [rescheduleItem, setRescheduleItem] = useState(null);
    const [rescheduleData, setRescheduleData] = useState({
        expected_delivery_date: '',
        time_window_preset: '9-12',
        expected_start_time: '09:00',
        expected_end_time: '12:00',
        time_window_label: '9 AM – 12 PM',
        note: ''
    });
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [rescheduleError, setRescheduleError] = useState('');

    // Cancel modal state
    const [cancelItem, setCancelItem] = useState(null);
    const [cancelLoading, setCancelLoading] = useState(false);

    const couriers = ['Amazon', 'Flipkart', 'Delhivery', 'Blue Dart', 'FedEx', 'Ecom Express', 'DTDC', 'Swiggy', 'Zomato', 'Blinkit', 'Other'];

    const todayStr = new Date().toISOString().split('T')[0];

    const fetchMyDeliveries = async () => {
        setDeliveriesLoading(true);
        try {
            const res = await axiosInstance.get('expected-deliveries/');
            setMyDeliveries(Array.isArray(res.data) ? res.data : (res.data?.results || []));
        } catch (err) {
            console.error("Failed to load expected deliveries:", err);
        } finally {
            setDeliveriesLoading(false);
        }
    };

    useEffect(() => {
        fetchMyDeliveries();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleWindowPresetChange = (presetId) => {
        const preset = PRESET_WINDOWS.find(p => p.id === presetId);
        if (!preset) return;

        if (presetId === 'custom') {
            setFormData(prev => ({
                ...prev,
                time_window_preset: 'custom',
                time_window_label: 'Custom Window'
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                time_window_preset: preset.id,
                expected_start_time: preset.start,
                expected_end_time: preset.end,
                time_window_label: preset.label
            }));
        }
    };

    const handleCategoryChange = (category) => {
        setFormData(prev => ({
            ...prev,
            delivery_category: category,
            cod_amount: category === 'COD' ? prev.cod_amount : ''
        }));
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
            setError('Courier / Delivery Partner is required.');
            return;
        }
        
        const finalCourier = formData.courier_name === 'Other' ? formData.custom_courier : formData.courier_name;
        if (formData.courier_name === 'Other' && !finalCourier.trim()) {
            setError('Please enter a delivery partner name.');
            return;
        }

        if (!formData.expected_delivery_date) {
            setError('Expected delivery date is required.');
            return;
        }

        if (formData.expected_delivery_date < todayStr) {
            setError('Expected delivery date cannot be in the past.');
            return;
        }

        if (formData.expected_start_time && formData.expected_end_time) {
            if (formData.expected_start_time >= formData.expected_end_time) {
                setError('Estimated start time must be earlier than end time.');
                return;
            }
        }

        if (formData.delivery_category === 'COD') {
            if (!formData.cod_amount || parseFloat(formData.cod_amount) <= 0) {
                setError('COD amount must be greater than ₹0 for Cash on Delivery.');
                return;
            }
        }

        setLoading(true);

        try {
            const data = new FormData();
            data.append('tracking_id', formData.tracking_id.trim());
            if (formData.order_id.trim()) {
                data.append('order_id', formData.order_id.trim());
            }
            data.append('courier_name', finalCourier);

            // Map delivery category
            if (formData.delivery_category === 'FOOD') {
                data.append('delivery_type', 'FOOD');
                data.append('payment_type', 'PREPAID');
            } else if (formData.delivery_category === 'COD') {
                data.append('delivery_type', 'PARCEL');
                data.append('payment_type', 'COD');
                data.append('cod_amount', formData.cod_amount);
            } else {
                data.append('delivery_type', 'PARCEL');
                data.append('payment_type', 'PREPAID');
            }

            data.append('expected_delivery_date', formData.expected_delivery_date);
            if (formData.expected_start_time) data.append('expected_start_time', formData.expected_start_time);
            if (formData.expected_end_time) data.append('expected_end_time', formData.expected_end_time);
            data.append('time_window_label', formData.time_window_label);
            data.append('note', formData.note);
            data.append('is_open_box', formData.is_open_box);

            if (imageFile) {
                data.append('delivery_photo', imageFile);
            }

            const res = await axiosInstance.post('expected-deliveries/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSuccessData(res.data);
            fetchMyDeliveries();
            window.scrollTo(0, 0);

        } catch (err) {
            console.error(err);
            if (err.response?.data?.non_field_errors) {
                setError(err.response.data.non_field_errors[0]);
            } else if (err.response?.data?.tracking_id) {
                setError(err.response.data.tracking_id[0]);
            } else if (err.response?.data?.expected_end_time) {
                setError(err.response.data.expected_end_time);
            } else if (err.response?.data?.expected_delivery_date) {
                setError(err.response.data.expected_delivery_date[0]);
            } else if (err.response?.data?.cod_amount) {
                setError(err.response.data.cod_amount[0]);
            } else {
                setError('Failed to schedule delivery. Please check your inputs.');
            }
        } finally {
            setLoading(false);
        }
    };

    const openRescheduleModal = (item) => {
        setRescheduleItem(item);
        setRescheduleError('');
        const matchingPreset = PRESET_WINDOWS.find(p => p.start === item.expected_start_time?.substring(0, 5) && p.end === item.expected_end_time?.substring(0, 5));
        setRescheduleData({
            expected_delivery_date: item.expected_delivery_date || todayStr,
            time_window_preset: matchingPreset ? matchingPreset.id : 'custom',
            expected_start_time: item.expected_start_time ? item.expected_start_time.substring(0, 5) : '09:00',
            expected_end_time: item.expected_end_time ? item.expected_end_time.substring(0, 5) : '12:00',
            time_window_label: item.time_window_label || '9 AM – 12 PM',
            note: item.note || ''
        });
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        setRescheduleError('');

        if (!rescheduleData.expected_delivery_date) {
            setRescheduleError('Please select a valid date.');
            return;
        }
        if (rescheduleData.expected_delivery_date < todayStr) {
            setRescheduleError('Expected date cannot be in the past.');
            return;
        }
        if (rescheduleData.expected_start_time && rescheduleData.expected_end_time) {
            if (rescheduleData.expected_start_time >= rescheduleData.expected_end_time) {
                setRescheduleError('Estimated start time must be earlier than end time.');
                return;
            }
        }

        setRescheduleLoading(true);
        try {
            await axiosInstance.post(`expected-deliveries/${rescheduleItem.id}/schedule/`, {
                expected_delivery_date: rescheduleData.expected_delivery_date,
                expected_start_time: rescheduleData.expected_start_time,
                expected_end_time: rescheduleData.expected_end_time,
                time_window_label: rescheduleData.time_window_label,
                note: rescheduleData.note
            });
            setRescheduleItem(null);
            fetchMyDeliveries();
        } catch (err) {
            console.error(err);
            setRescheduleError(err.response?.data?.error || 'Failed to reschedule delivery.');
        } finally {
            setRescheduleLoading(false);
        }
    };

    const handleCancelSubmit = async () => {
        if (!cancelItem) return;
        setCancelLoading(true);
        try {
            await axiosInstance.post(`expected-deliveries/${cancelItem.id}/cancel/`);
            setCancelItem(null);
            fetchMyDeliveries();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Failed to cancel delivery.');
        } finally {
            setCancelLoading(false);
        }
    };

    const getStatusBadge = (item) => {
        const s = item.status || item.scheduling_status;
        if (s === 'RECEIVED') return <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i> Received</span>;
        if (s === 'CANCELLED') return <span className="badge bg-secondary"><i className="bi bi-x-circle me-1"></i> Cancelled</span>;
        if (s === 'RESCHEDULED') return <span className="badge bg-info text-dark"><i className="bi bi-arrow-repeat me-1"></i> Rescheduled</span>;
        if (item.is_missed_or_delayed) return <span className="badge bg-warning text-dark"><i className="bi bi-clock-history me-1"></i> Window Passed</span>;
        return <span className="badge bg-primary"><i className="bi bi-calendar-check me-1"></i> Scheduled</span>;
    };

    const activeDeliveriesCount = myDeliveries.filter(d => ['SCHEDULED', 'EXPECTED', 'RESCHEDULED'].includes(d.status)).length;

    if (successData) {
        return (
            <div className="container-fluid px-0 py-4 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden shadow-sm" style={{ maxWidth: '640px' }}>
                    <div className="bg-success text-white text-center p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3 shadow-sm" style={{ width: '64px', height: '64px' }}>
                            <i className="bi bi-check-lg fs-1"></i>
                        </div>
                        <h3 className="fw-bold mb-1">Delivery Scheduled Successfully!</h3>
                        <p className="mb-0 text-white-50">✓ Expected delivery details have been recorded for gatehouse security verification.</p>
                    </div>
                    <div className="p-4 p-md-5 bg-white">
                        <div className="alert alert-warning border-0 small mb-4 py-2 px-3 rounded-3 d-flex align-items-center gap-2">
                            <i className="bi bi-info-circle-fill text-warning fs-5"></i>
                            <div>
                                <strong>Resident Estimate Notice:</strong> This schedule is saved as an estimate to assist guards. It is not an automated live courier tracking ETA.
                            </div>
                        </div>

                        <div className="row g-4 mb-4">
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Tracking ID</small>
                                <div className="fw-bold fs-5 text-dark font-monospace">{successData.tracking_id}</div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Courier Partner</small>
                                <div className="fw-bold fs-5 text-dark">{successData.courier_name}</div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Expected Date</small>
                                <div className="fw-medium text-dark">
                                    <i className="bi bi-calendar-event me-1 text-primary"></i>
                                    {new Date(successData.expected_delivery_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Time Window</small>
                                <div className="fw-medium text-dark">
                                    <i className="bi bi-clock me-1 text-primary"></i>
                                    {successData.time_window_label || 'Daytime Window'}
                                </div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Category</small>
                                <div>
                                    {successData.payment_type === 'COD' ? (
                                        <span className="badge bg-danger">COD (₹{successData.cod_amount})</span>
                                    ) : successData.delivery_type === 'FOOD' ? (
                                        <span className="badge bg-warning text-dark">Food Delivery</span>
                                    ) : (
                                        <span className="badge bg-primary">Normal Parcel</span>
                                    )}
                                </div>
                            </div>
                            <div className="col-sm-6">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</small>
                                <div>{getStatusBadge(successData)}</div>
                            </div>
                        </div>

                        <div className="d-flex gap-3">
                            <button onClick={() => { setSuccessData(null); setActiveTab('MY_DELIVERIES'); }} className="btn btn-outline-primary w-50 py-2 fw-semibold">
                                View Scheduled List
                            </button>
                            <button onClick={() => navigate('/resident')} className="gv-btn-primary w-50 py-2">
                                Resident Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid px-0 py-3">
            {/* HEADER */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Expected Delivery Scheduling</h2>
                    <p className="text-muted mb-0">Pre-register upcoming parcel & food deliveries so gatehouse guards can verify and secure packages smoothly.</p>
                </div>
                <div className="d-flex gap-2">
                    <button 
                        className={`btn px-3 py-2 fw-semibold ${activeTab === 'SCHEDULE' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('SCHEDULE')}
                    >
                        <i className="bi bi-calendar-plus me-1"></i> Schedule Delivery
                    </button>
                    <button 
                        className={`btn px-3 py-2 fw-semibold position-relative ${activeTab === 'MY_DELIVERIES' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveTab('MY_DELIVERIES')}
                    >
                        <i className="bi bi-calendar-week me-1"></i> My Schedules
                        {activeDeliveriesCount > 0 && (
                            <span className="badge rounded-pill bg-danger ms-2">{activeDeliveriesCount}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: MY SCHEDULED DELIVERIES */}
            {activeTab === 'MY_DELIVERIES' && (
                <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold text-dark mb-0">Upcoming & Recent Delivery Schedules</h5>
                        <button className="btn btn-sm btn-outline-primary" onClick={fetchMyDeliveries}>
                            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                        </button>
                    </div>

                    {deliveriesLoading ? (
                        <div className="p-5 text-center text-muted">
                            <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                            <div>Loading delivery schedules...</div>
                        </div>
                    ) : myDeliveries.length === 0 ? (
                        <div className="gv-card text-center p-5 bg-white shadow-sm">
                            <i className="bi bi-calendar-x display-4 text-muted mb-3 d-block"></i>
                            <h5 className="fw-bold text-dark">No Scheduled Deliveries Yet</h5>
                            <p className="text-muted mb-4">Register your upcoming courier packages so guards can instantly verify them at the gate.</p>
                            <button className="gv-btn-primary px-4 py-2" onClick={() => setActiveTab('SCHEDULE')}>
                                Schedule a Delivery Now
                            </button>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {myDeliveries.map(item => {
                                const isModifiable = ['SCHEDULED', 'EXPECTED', 'RESCHEDULED'].includes(item.status);
                                return (
                                    <div className="col-md-6 col-lg-4" key={item.id}>
                                        <div className="gv-card h-100 p-4 bg-white shadow-sm border d-flex flex-column justify-content-between">
                                            <div>
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <h5 className="fw-bold text-dark mb-0">{item.courier_name}</h5>
                                                        <span className="text-muted small font-monospace">{item.tracking_id}</span>
                                                    </div>
                                                    <div>{getStatusBadge(item)}</div>
                                                </div>

                                                <div className="py-2 border-top border-bottom my-3">
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="text-muted small"><i className="bi bi-calendar3 me-1"></i> Date:</span>
                                                        <span className="fw-semibold text-dark">
                                                            {new Date(item.expected_delivery_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="text-muted small"><i className="bi bi-clock me-1"></i> Window:</span>
                                                        <span className="badge bg-light text-dark border">
                                                            {item.time_window_label || 'Daytime Window'}
                                                        </span>
                                                    </div>
                                                    <div className="d-flex align-items-center justify-content-between">
                                                        <span className="text-muted small"><i className="bi bi-tag me-1"></i> Category:</span>
                                                        <span>
                                                            {item.payment_type === 'COD' ? (
                                                                <span className="badge bg-warning text-dark">COD (₹{item.cod_amount})</span>
                                                            ) : item.delivery_type === 'FOOD' ? (
                                                                <span className="badge bg-info text-dark">Food Delivery</span>
                                                            ) : (
                                                                <span className="badge bg-secondary">Normal Parcel</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                {item.order_id && (
                                                    <div className="small text-muted mb-2">
                                                        <strong>Order ID:</strong> {item.order_id}
                                                    </div>
                                                )}

                                                {item.note && (
                                                    <div className="small bg-light p-2 rounded mb-3 text-muted">
                                                        <i className="bi bi-chat-left-text me-1"></i> {item.note}
                                                    </div>
                                                )}

                                                {item.is_missed_or_delayed && (
                                                    <div className="alert alert-warning py-2 px-3 small border-0 mb-3">
                                                        <i className="bi bi-exclamation-circle me-1"></i> Estimated window elapsed. Reschedule if courier delivery was delayed.
                                                    </div>
                                                )}
                                            </div>

                                            {isModifiable && (
                                                <div className="d-flex gap-2 pt-2 border-top">
                                                    <button 
                                                        className="btn btn-sm btn-outline-primary w-50 fw-semibold"
                                                        onClick={() => openRescheduleModal(item)}
                                                    >
                                                        <i className="bi bi-calendar-event me-1"></i> Reschedule
                                                    </button>
                                                    <button 
                                                        className="btn btn-sm btn-outline-danger w-50 fw-semibold"
                                                        onClick={() => setCancelItem(item)}
                                                    >
                                                        <i className="bi bi-x-circle me-1"></i> Cancel
                                                    </button>
                                                </div>
                                            )}

                                            {item.status === 'RECEIVED' && (
                                                <div className="text-success small fw-semibold pt-2 border-top text-center">
                                                    <i className="bi bi-check-circle-fill me-1"></i> Received at gatehouse {item.actual_received_at ? `on ${new Date(item.actual_received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: SCHEDULE DELIVERY FORM */}
            {activeTab === 'SCHEDULE' && (
                <div className="gv-card overflow-hidden shadow-sm" style={{ maxWidth: '840px' }}>
                    <div className="p-4 p-md-5 bg-white">
                        {/* NOTICE BANNER */}
                        <div className="alert alert-primary border-0 rounded-3 p-3 mb-4 d-flex align-items-center gap-3">
                            <i className="bi bi-info-circle-fill fs-3 text-primary"></i>
                            <div>
                                <h6 className="fw-bold mb-1">Resident-Provided Estimates</h6>
                                <p className="small mb-0 text-dark">
                                    Delivery dates and time windows are resident estimates to prepare gate security for parcel intake. They are not confirmed live courier ETAs.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm rounded-3">
                                <i className="bi bi-exclamation-triangle-fill fs-5 me-3"></i>
                                <div>{error}</div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {/* RESIDENT AUTO-LINKED INFO */}
                            <h6 className="text-uppercase fw-bold text-primary mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                                Resident Profile Information
                            </h6>
                            <div className="row g-3 mb-4 bg-light p-3 rounded-3 border">
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-semibold mb-1">Resident Name</label>
                                    <input type="text" className="form-control bg-white" value={user?.name || user?.username || ''} readOnly disabled />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-semibold mb-1">Tower & Flat Details</label>
                                    <input type="text" className="form-control bg-white" value="Automatically linked to your flat" readOnly disabled />
                                </div>
                            </div>

                            {/* DELIVERY INFORMATION */}
                            <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                                Delivery Details
                            </h6>
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label text-dark small fw-semibold">Tracking ID / Number <span className="text-danger">*</span></label>
                                    <input 
                                        type="text" 
                                        name="tracking_id" 
                                        className="form-control font-monospace" 
                                        placeholder="e.g. AMZ-9876543210" 
                                        value={formData.tracking_id} 
                                        onChange={handleChange} 
                                        required 
                                    />
                                    <small className="text-muted">Guards will scan or match this tracking ID during intake.</small>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-dark small fw-semibold">Order ID <span className="text-muted fw-normal">(Optional)</span></label>
                                    <input 
                                        type="text" 
                                        name="order_id" 
                                        className="form-control" 
                                        placeholder="e.g. ORD-10293847" 
                                        value={formData.order_id} 
                                        onChange={handleChange} 
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label text-dark small fw-semibold">Courier / Delivery Partner <span className="text-danger">*</span></label>
                                    <select name="courier_name" className="form-select" value={formData.courier_name} onChange={handleChange} required>
                                        <option value="">Select Delivery Partner...</option>
                                        {couriers.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {formData.courier_name === 'Other' && (
                                    <div className="col-md-6">
                                        <label className="form-label text-dark small fw-semibold">Custom Partner Name <span className="text-danger">*</span></label>
                                        <input 
                                            type="text" 
                                            name="custom_courier" 
                                            className="form-control" 
                                            placeholder="e.g. Local Pharmacy, Store Courier" 
                                            value={formData.custom_courier} 
                                            onChange={handleChange} 
                                            required 
                                        />
                                    </div>
                                )}

                                {/* DELIVERY CATEGORY SELECTOR */}
                                <div className="col-12">
                                    <label className="form-label text-dark small fw-semibold mb-2">Delivery Category <span className="text-danger">*</span></label>
                                    <div className="row g-2">
                                        <div className="col-md-4">
                                            <div 
                                                className={`p-3 border rounded-3 text-center cursor-pointer ${formData.delivery_category === 'NORMAL' ? 'border-primary bg-primary bg-opacity-10 shadow-sm' : 'bg-light'}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleCategoryChange('NORMAL')}
                                            >
                                                <i className="bi bi-box-seam fs-4 text-primary d-block mb-1"></i>
                                                <strong className="d-block text-dark small">Normal Courier Parcel</strong>
                                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Prepaid standard parcel</span>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div 
                                                className={`p-3 border rounded-3 text-center cursor-pointer ${formData.delivery_category === 'FOOD' ? 'border-warning bg-warning bg-opacity-10 shadow-sm' : 'bg-light'}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleCategoryChange('FOOD')}
                                            >
                                                <i className="bi bi-cup-straw fs-4 text-warning d-block mb-1"></i>
                                                <strong className="d-block text-dark small">Food Delivery</strong>
                                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Perishable / Instant delivery</span>
                                            </div>
                                        </div>
                                        <div className="col-md-4">
                                            <div 
                                                className={`p-3 border rounded-3 text-center cursor-pointer ${formData.delivery_category === 'COD' ? 'border-danger bg-danger bg-opacity-10 shadow-sm' : 'bg-light'}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleCategoryChange('COD')}
                                            >
                                                <i className="bi bi-cash-stack fs-4 text-danger d-block mb-1"></i>
                                                <strong className="d-block text-dark small">Cash on Delivery (COD)</strong>
                                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Requires courier payment</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {formData.delivery_category === 'COD' && (
                                    <div className="col-md-6 mt-3">
                                        <label className="form-label text-dark small fw-semibold">COD Amount Due (₹) <span className="text-danger">*</span></label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-light fw-bold text-muted">₹</span>
                                            <input 
                                                type="number" 
                                                name="cod_amount" 
                                                className="form-control" 
                                                placeholder="e.g. 1500" 
                                                value={formData.cod_amount} 
                                                onChange={handleChange} 
                                                min="1" 
                                                step="0.01" 
                                                required 
                                            />
                                        </div>
                                        <small className="text-muted">Will be confirmed by guard with the courier upon arrival.</small>
                                    </div>
                                )}
                            </div>

                            {/* ESTIMATED DATE & TIME WINDOW */}
                            <h6 className="text-uppercase fw-bold text-primary mb-3 pt-3 border-top mt-4" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                                Estimated Delivery Date & Time Window
                            </h6>
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label text-dark small fw-semibold">Expected Delivery Date <span className="text-danger">*</span></label>
                                    <input 
                                        type="date" 
                                        name="expected_delivery_date" 
                                        className="form-control" 
                                        value={formData.expected_delivery_date} 
                                        onChange={handleChange} 
                                        required 
                                        min={todayStr} 
                                    />
                                    <small className="text-muted">Select today or an upcoming delivery date.</small>
                                </div>

                                <div className="col-12">
                                    <label className="form-label text-dark small fw-semibold mb-2">Estimated Time Window <span className="text-danger">*</span></label>
                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        {PRESET_WINDOWS.map(preset => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                className={`btn btn-sm px-3 py-2 fw-medium rounded-pill d-flex align-items-center gap-2 ${formData.time_window_preset === preset.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                onClick={() => handleWindowPresetChange(preset.id)}
                                            >
                                                <i className={`bi ${preset.icon}`}></i>
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    {formData.time_window_preset === 'custom' && (
                                        <div className="row g-3 bg-light p-3 rounded-3 border">
                                            <div className="col-sm-6">
                                                <label className="form-label small fw-semibold">Estimated Start Time</label>
                                                <input 
                                                    type="time" 
                                                    name="expected_start_time" 
                                                    className="form-control" 
                                                    value={formData.expected_start_time} 
                                                    onChange={handleChange} 
                                                    required 
                                                />
                                            </div>
                                            <div className="col-sm-6">
                                                <label className="form-label small fw-semibold">Estimated End Time</label>
                                                <input 
                                                    type="time" 
                                                    name="expected_end_time" 
                                                    className="form-control" 
                                                    value={formData.expected_end_time} 
                                                    onChange={handleChange} 
                                                    required 
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="col-12">
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
                                                Open-Box Inspection (Physical unboxing check at the gate)
                                            </label>
                                            <div className="text-muted small mt-1">
                                                Requires resident presence at the gatehouse before parcel acceptance.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* VERIFICATION & NOTES */}
                            <h6 className="text-uppercase fw-bold text-primary mb-3 pt-3 border-top mt-4" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                                Delivery Instructions & Order Screenshot
                            </h6>
                            <div className="row g-3 mb-5">
                                <div className="col-md-12">
                                    <label className="form-label text-dark small fw-semibold">Order / Tracking Screenshot <span className="text-muted fw-normal">(Optional)</span></label>
                                    {!imagePreview ? (
                                        <div className="border border-2 border-dashed rounded-3 p-4 text-center bg-light" style={{ borderColor: '#ccc', borderStyle: 'dashed' }}>
                                            <input type="file" id="photo_upload" className="d-none" accept="image/jpeg,image/png,image/jpg" onChange={handleImageChange} />
                                            <label htmlFor="photo_upload" className="btn btn-outline-primary mb-2 rounded-pill px-4">
                                                <i className="bi bi-upload me-2"></i>Choose Screenshot
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
                                    <label className="form-label text-dark small fw-semibold">Delivery Instructions / Gate Notes <span className="text-muted fw-normal">(Optional)</span></label>
                                    <textarea 
                                        name="note" 
                                        className="form-control" 
                                        rows="3" 
                                        placeholder="e.g. Please ring bell upon arrival, or call on mobile when at the gatehouse." 
                                        value={formData.note} 
                                        onChange={handleChange}
                                    ></textarea>
                                </div>
                            </div>

                            {/* SUBMIT BUTTON */}
                            <div className="d-flex gap-3 pt-3 border-top">
                                <button type="button" onClick={() => navigate('/resident')} className="btn btn-light py-2 px-4 fw-medium text-dark border">
                                    Cancel
                                </button>
                                <button type="submit" className="gv-btn-primary py-2 px-5 fw-bold d-flex align-items-center gap-2" disabled={loading}>
                                    {loading ? (
                                        <><span className="spinner-border spinner-border-sm"></span> Registering Schedule...</>
                                    ) : (
                                        <><i className="bi bi-calendar-check"></i> Register Expected Delivery</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RESCHEDULE MODAL */}
            {rescheduleItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-calendar-event me-2 text-primary"></i>
                                    Reschedule Expected Delivery
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setRescheduleItem(null)}></button>
                            </div>
                            <form onSubmit={handleRescheduleSubmit}>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded-3 mb-3 border">
                                        <div className="fw-bold text-dark">{rescheduleItem.courier_name}</div>
                                        <div className="text-muted small font-monospace">Tracking: {rescheduleItem.tracking_id}</div>
                                    </div>

                                    {rescheduleError && (
                                        <div className="alert alert-danger py-2 px-3 small border-0 mb-3">
                                            {rescheduleError}
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">New Expected Delivery Date</label>
                                        <input 
                                            type="date" 
                                            className="form-control" 
                                            value={rescheduleData.expected_delivery_date}
                                            onChange={(e) => setRescheduleData({ ...rescheduleData, expected_delivery_date: e.target.value })}
                                            min={todayStr}
                                            required 
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark mb-2">Estimated Time Window</label>
                                        <div className="d-flex flex-wrap gap-2 mb-2">
                                            {PRESET_WINDOWS.map(preset => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    className={`btn btn-sm px-2 py-1 rounded-pill ${rescheduleData.time_window_preset === preset.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                    onClick={() => {
                                                        if (preset.id === 'custom') {
                                                            setRescheduleData(prev => ({ ...prev, time_window_preset: 'custom', time_window_label: 'Custom Window' }));
                                                        } else {
                                                            setRescheduleData(prev => ({
                                                                ...prev,
                                                                time_window_preset: preset.id,
                                                                expected_start_time: preset.start,
                                                                expected_end_time: preset.end,
                                                                time_window_label: preset.label
                                                            }));
                                                        }
                                                    }}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                        {rescheduleData.time_window_preset === 'custom' && (
                                            <div className="row g-2 mt-2">
                                                <div className="col-6">
                                                    <input 
                                                        type="time" 
                                                        className="form-control form-control-sm"
                                                        value={rescheduleData.expected_start_time}
                                                        onChange={(e) => setRescheduleData({ ...rescheduleData, expected_start_time: e.target.value })}
                                                        required 
                                                    />
                                                </div>
                                                <div className="col-6">
                                                    <input 
                                                        type="time" 
                                                        className="form-control form-control-sm"
                                                        value={rescheduleData.expected_end_time}
                                                        onChange={(e) => setRescheduleData({ ...rescheduleData, expected_end_time: e.target.value })}
                                                        required 
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">Updated Instructions / Note</label>
                                        <textarea 
                                            className="form-control" 
                                            rows="2" 
                                            value={rescheduleData.note}
                                            onChange={(e) => setRescheduleData({ ...rescheduleData, note: e.target.value })}
                                            placeholder="Optional note for guards..."
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setRescheduleItem(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="gv-btn-primary px-4 py-2" disabled={rescheduleLoading}>
                                        {rescheduleLoading ? 'Saving...' : 'Update Schedule'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL CONFIRMATION MODAL */}
            {cancelItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-danger">
                                    <i className="bi bi-x-circle me-2"></i>
                                    Cancel Delivery Schedule
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setCancelItem(null)}></button>
                            </div>
                            <div className="modal-body p-4 text-center">
                                <i className="bi bi-exclamation-triangle display-4 text-warning mb-3 d-block"></i>
                                <h6 className="fw-bold text-dark">Are you sure you want to cancel this delivery schedule?</h6>
                                <p className="text-muted small mb-0">
                                    Tracking ID <strong>{cancelItem.tracking_id}</strong> from <strong>{cancelItem.courier_name}</strong> will be marked as Cancelled.
                                </p>
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-light" onClick={() => setCancelItem(null)}>
                                    Keep Schedule
                                </button>
                                <button type="button" className="btn btn-danger px-4" onClick={handleCancelSubmit} disabled={cancelLoading}>
                                    {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SendDeliveryDetails;
