import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { Link } from 'react-router-dom';

const CourierVisits = () => {
    const [activeVisits, setActiveVisits] = useState([]);
    const [completedVisits, setCompletedVisits] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [activeTab, setActiveTab] = useState('INSIDE'); // 'INSIDE' | 'COMPLETED'

    // Search and filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [purposeFilter, setPurposeFilter] = useState('');

    // Register Entry Modal State
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [formData, setFormData] = useState({
        courier_name: '',
        carrier_id: '',
        carrier_name: '',
        mobile_number: '',
        vehicle_number: '',
        visit_purpose: 'PARCEL_DELIVERY',
        remarks: '',
        confirm_duplicate: false
    });
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Exit Modal State
    const [exitModalVisit, setExitModalVisit] = useState(null);
    const [exiting, setExiting] = useState(false);

    const fetchVisitsAndCarriers = async () => {
        try {
            setLoading(true);
            const [activeRes, completedRes, carrierRes] = await Promise.all([
                axiosInstance.get('courier-visits/active/'),
                axiosInstance.get('courier-visits/?status=EXITED'),
                axiosInstance.get('carriers/')
            ]);
            setActiveVisits(activeRes.data || []);
            setCompletedVisits(completedRes.data || []);
            setCarriers(carrierRes.data || []);
            setError('');
        } catch (err) {
            console.error('Failed to load courier visits', err);
            setError('Failed to fetch courier log data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVisitsAndCarriers();
        // Periodically refresh every 45s for live durations
        const interval = setInterval(fetchVisitsAndCarriers, 45000);
        return () => clearInterval(interval);
    }, []);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (duplicateWarning) {
            setDuplicateWarning(null);
        }
    };

    const handleRegisterSubmit = async (e, forceConfirm = false) => {
        if (e) e.preventDefault();
        setSubmitting(true);
        setError('');
        setSuccessMsg('');

        try {
            const payload = {
                ...formData,
                confirm_duplicate: forceConfirm || formData.confirm_duplicate
            };

            const res = await axiosInstance.post('courier-visits/entry/', payload);
            setSuccessMsg(`Courier ${res.data.courier_name} (${res.data.carrier_display}) successfully checked in!`);
            setShowRegisterModal(false);
            setDuplicateWarning(null);
            setFormData({
                courier_name: '',
                carrier_id: '',
                carrier_name: '',
                mobile_number: '',
                vehicle_number: '',
                visit_purpose: 'PARCEL_DELIVERY',
                remarks: '',
                confirm_duplicate: false
            });
            fetchVisitsAndCarriers();
        } catch (err) {
            if (err.response?.status === 409 && err.response?.data?.duplicate_warning) {
                setDuplicateWarning(err.response.data);
            } else {
                setError(err.response?.data?.error || err.response?.data?.mobile_number?.[0] || 'Failed to register courier arrival.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmExit = async () => {
        if (!exitModalVisit) return;
        setExiting(true);
        setError('');
        setSuccessMsg('');

        try {
            const res = await axiosInstance.post(`courier-visits/${exitModalVisit.id}/exit/`);
            setSuccessMsg(res.data.message || `Courier departure confirmed. Duration: ${res.data.duration_display}.`);
            setExitModalVisit(null);
            fetchVisitsAndCarriers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to confirm courier departure.');
        } finally {
            setExiting(false);
        }
    };

    // Filtered lists
    const filterVisits = (list) => {
        return list.filter(v => {
            const matchesSearch = !searchQuery || 
                v.courier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.mobile_number.includes(searchQuery) ||
                (v.vehicle_number && v.vehicle_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (v.carrier_display && v.carrier_display.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesPurpose = !purposeFilter || v.visit_purpose === purposeFilter;

            return matchesSearch && matchesPurpose;
        });
    };

    const displayedVisits = activeTab === 'INSIDE' ? filterVisits(activeVisits) : filterVisits(completedVisits);

    return (
        <div className="pb-5">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                        <i className="bi bi-truck text-primary"></i> Courier Arrival & Departure Log
                    </h3>
                    <p className="text-muted small mb-0">
                        Log incoming delivery personnel, monitor real-time presence on premises, and track handed-over parcels.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button 
                        onClick={() => {
                            setDuplicateWarning(null);
                            setShowRegisterModal(true);
                        }} 
                        className="btn btn-primary d-flex align-items-center gap-2"
                    >
                        <i className="bi bi-person-plus-fill"></i> Register Courier Entry
                    </button>
                    <button 
                        onClick={fetchVisitsAndCarriers} 
                        className="btn btn-outline-secondary d-flex align-items-center gap-1"
                        disabled={loading}
                    >
                        <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
                    </button>
                </div>
            </div>

            {/* Error & Success Messages */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>{error}</div>
                    <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
            )}

            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>{successMsg}</div>
                    <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
                </div>
            )}

            {/* Quick KPI Counters */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                    <div className="gv-card p-3 border rounded-3 bg-white shadow-sm d-flex align-items-center justify-content-between">
                        <div>
                            <span className="text-muted small fw-semibold text-uppercase">Currently Inside</span>
                            <div className="fs-3 fw-bold text-primary mt-1">{activeVisits.length} Couriers</div>
                        </div>
                        <div className="rounded-circle bg-primary bg-opacity-10 p-3 text-primary">
                            <i className="bi bi-geo-alt-fill fs-3"></i>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-md-4">
                    <div className="gv-card p-3 border rounded-3 bg-white shadow-sm d-flex align-items-center justify-content-between">
                        <div>
                            <span className="text-muted small fw-semibold text-uppercase">Today's Completed Visits</span>
                            <div className="fs-3 fw-bold text-success mt-1">{completedVisits.length} Exited</div>
                        </div>
                        <div className="rounded-circle bg-success bg-opacity-10 p-3 text-success">
                            <i className="bi bi-check2-circle fs-3"></i>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-md-4">
                    <div className="gv-card p-3 border rounded-3 bg-white shadow-sm d-flex align-items-center justify-content-between">
                        <div>
                            <span className="text-muted small fw-semibold text-uppercase">Long Stay Alert (&gt;45m)</span>
                            <div className="fs-3 fw-bold text-warning mt-1">
                                {activeVisits.filter(v => v.is_unusually_long).length} Couriers
                            </div>
                        </div>
                        <div className="rounded-circle bg-warning bg-opacity-10 p-3 text-warning">
                            <i className="bi bi-hourglass-split fs-3"></i>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs & Search Toolbar */}
            <div className="gv-card p-3 border rounded-3 bg-white shadow-sm mb-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <ul className="nav nav-pills">
                        <li className="nav-item">
                            <button 
                                className={`nav-link py-2 px-3 fw-semibold ${activeTab === 'INSIDE' ? 'active' : ''}`}
                                onClick={() => setActiveTab('INSIDE')}
                            >
                                <i className="bi bi-box-arrow-in-right me-1"></i> Currently Inside ({activeVisits.length})
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link py-2 px-3 fw-semibold ${activeTab === 'COMPLETED' ? 'active' : ''}`}
                                onClick={() => setActiveTab('COMPLETED')}
                            >
                                <i className="bi bi-box-arrow-right me-1"></i> Exited Visits ({completedVisits.length})
                            </button>
                        </li>
                    </ul>

                    <div className="d-flex flex-wrap gap-2">
                        <div className="input-group" style={{ maxWidth: '280px' }}>
                            <span className="input-group-text bg-light border-end-0">
                                <i className="bi bi-search text-muted"></i>
                            </span>
                            <input 
                                type="text" 
                                className="form-control border-start-0 bg-light" 
                                placeholder="Search courier, phone, vehicle..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <select 
                            className="form-select bg-light" 
                            style={{ maxWidth: '200px' }}
                            value={purposeFilter}
                            onChange={(e) => setPurposeFilter(e.target.value)}
                        >
                            <option value="">All Purposes</option>
                            <option value="PARCEL_DELIVERY">Parcel Delivery</option>
                            <option value="FOOD_DELIVERY">Food Delivery</option>
                            <option value="RETURN_PICKUP">Return Pickup</option>
                            <option value="MULTIPLE_DELIVERIES">Multiple Deliveries</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Visits Listing Table / Cards */}
            <div className="gv-card border rounded-3 bg-white shadow-sm overflow-hidden">
                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="text-muted small mt-2">Loading courier visits...</div>
                    </div>
                ) : displayedVisits.length > 0 ? (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small text-muted text-uppercase">
                                <tr>
                                    <th>Courier Name</th>
                                    <th>Delivery Company</th>
                                    <th>Contact & Vehicle</th>
                                    <th>Purpose</th>
                                    <th>Entry Time</th>
                                    <th>Duration</th>
                                    <th>Guard</th>
                                    <th>Linked Parcels</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedVisits.map(visit => {
                                    const isInside = visit.status === 'INSIDE';
                                    const isLong = visit.is_unusually_long;

                                    return (
                                        <tr key={visit.id} className={isLong ? 'table-warning bg-opacity-25' : ''}>
                                            <td>
                                                <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                    {visit.courier_name}
                                                    {isLong && (
                                                        <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                                                            Long Stay (&gt;45m)
                                                        </span>
                                                    )}
                                                </div>
                                                {visit.remarks && (
                                                    <div className="small text-muted text-truncate" style={{ maxWidth: '180px' }}>
                                                        {visit.remarks}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-primary border">
                                                    {visit.carrier_display}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="small fw-semibold">{visit.mobile_number}</div>
                                                {visit.vehicle_number ? (
                                                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                        <i className="bi bi-car-front me-1"></i>{visit.vehicle_number}
                                                    </div>
                                                ) : (
                                                    <div className="text-muted small fst-italic" style={{ fontSize: '0.75rem' }}>No vehicle</div>
                                                )}
                                            </td>
                                            <td>
                                                <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
                                                    {visit.visit_purpose_display}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="small fw-medium">
                                                    {new Date(visit.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                    {new Date(visit.entry_time).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${isInside ? (isLong ? 'bg-danger' : 'bg-primary') : 'bg-light text-dark border'}`}>
                                                    <i className="bi bi-clock me-1"></i>{visit.duration_display}
                                                </span>
                                            </td>
                                            <td className="small">
                                                <div>{visit.entry_guard_name}</div>
                                                {!isInside && visit.exit_guard_name && (
                                                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                        Exit: {visit.exit_guard_name}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {visit.linked_parcels && visit.linked_parcels.length > 0 ? (
                                                    <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '220px' }}>
                                                        {visit.linked_parcels.map(p => (
                                                            <span key={p.id} className="badge bg-info bg-opacity-25 text-primary border" style={{ fontSize: '0.65rem' }}>
                                                                {p.parcel_id}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="small text-muted fst-italic">0 parcels linked</span>
                                                )}
                                            </td>
                                            <td className="text-end">
                                                {isInside ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setExitModalVisit(visit)}
                                                        className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                                                    >
                                                        <i className="bi bi-box-arrow-right"></i> Mark Exit
                                                    </button>
                                                ) : (
                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success">
                                                        <i className="bi bi-check-circle me-1"></i> Exited at {new Date(visit.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-5 text-muted">
                        <i className="bi bi-inbox fs-1 d-block mb-2 text-muted"></i>
                        <h6 className="fw-semibold">No Courier Visits Found</h6>
                        <p className="small mb-0">
                            {activeTab === 'INSIDE' 
                                ? 'No delivery couriers are currently registered inside the community.' 
                                : 'No completed courier exits matching your search criteria.'}
                        </p>
                    </div>
                )}
            </div>

            {/* Register Courier Entry Modal */}
            {showRegisterModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-3 shadow">
                            <form onSubmit={(e) => handleRegisterSubmit(e, false)}>
                                <div className="modal-header border-bottom">
                                    <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                                        <i className="bi bi-person-badge text-primary"></i> Register Courier Entry
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setShowRegisterModal(false)}></button>
                                </div>
                                <div className="modal-body">
                                    {/* Duplicate Visit Warning Alert */}
                                    {duplicateWarning && (
                                        <div className="alert alert-warning border border-warning p-3 mb-3 rounded-3">
                                            <div className="fw-bold mb-1">
                                                <i className="bi bi-exclamation-triangle-fill me-1"></i> Duplicate Active Visit Detected
                                            </div>
                                            <p className="small mb-2">
                                                {duplicateWarning.message}
                                            </p>
                                            <div className="d-flex justify-content-end gap-2">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-sm btn-outline-secondary" 
                                                    onClick={() => setDuplicateWarning(null)}
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-sm btn-warning text-dark fw-bold"
                                                    onClick={(e) => handleRegisterSubmit(e, true)}
                                                    disabled={submitting}
                                                >
                                                    {submitting ? 'Confirming...' : 'Yes, Register Separate Visit'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Courier Full Name <span className="text-danger">*</span></label>
                                        <input 
                                            type="text" 
                                            name="courier_name"
                                            className="form-control"
                                            placeholder="e.g. Ramesh Kumar"
                                            value={formData.courier_name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold">Delivery Company / Carrier</label>
                                            <select 
                                                name="carrier_id"
                                                className="form-select"
                                                value={formData.carrier_id}
                                                onChange={handleInputChange}
                                            >
                                                <option value="">Select Predefined Carrier...</option>
                                                {carriers.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                                <option value="OTHER">Other / Freeform</option>
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold">Company Name (If Other)</label>
                                            <input 
                                                type="text" 
                                                name="carrier_name"
                                                className="form-control"
                                                placeholder="e.g. Zomato, Blinkit, Shadowfax"
                                                value={formData.carrier_name}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold">Mobile Number <span className="text-danger">*</span></label>
                                            <input 
                                                type="tel" 
                                                name="mobile_number"
                                                className="form-control"
                                                placeholder="e.g. +91 9876543210"
                                                value={formData.mobile_number}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label small fw-semibold">Vehicle Number (Optional)</label>
                                            <input 
                                                type="text" 
                                                name="vehicle_number"
                                                className="form-control"
                                                placeholder="e.g. MH-12-AB-1234"
                                                value={formData.vehicle_number}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Visit Purpose <span className="text-danger">*</span></label>
                                        <select 
                                            name="visit_purpose"
                                            className="form-select"
                                            value={formData.visit_purpose}
                                            onChange={handleInputChange}
                                            required
                                        >
                                            <option value="PARCEL_DELIVERY">Parcel Delivery (Courier)</option>
                                            <option value="FOOD_DELIVERY">Food Delivery (Swiggy / Zomato)</option>
                                            <option value="RETURN_PICKUP">Return / Exchange Pickup</option>
                                            <option value="MULTIPLE_DELIVERIES">Multiple Bulk Deliveries</option>
                                            <option value="OTHER">Other Purpose</option>
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Remarks / Gatehouse Notes (Optional)</label>
                                        <textarea 
                                            name="remarks"
                                            className="form-control"
                                            rows="2"
                                            placeholder="e.g. Delivered 3 boxes, proceeding to Tower A"
                                            value={formData.remarks}
                                            onChange={handleInputChange}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setShowRegisterModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? 'Registering...' : 'Confirm Entry'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Courier Exit Modal */}
            {exitModalVisit && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-3 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                                    <i className="bi bi-box-arrow-right"></i> Confirm Courier Departure
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setExitModalVisit(null)}></button>
                            </div>
                            <div className="modal-body">
                                <p className="mb-3">
                                    Are you sure you want to mark courier <strong>{exitModalVisit.courier_name}</strong> as exited?
                                </p>

                                <div className="p-3 bg-light rounded border mb-3 small">
                                    <div className="row g-2">
                                        <div className="col-6"><strong>Company:</strong> {exitModalVisit.carrier_display}</div>
                                        <div className="col-6"><strong>Mobile:</strong> {exitModalVisit.mobile_number}</div>
                                        <div className="col-6"><strong>Entry Time:</strong> {new Date(exitModalVisit.entry_time).toLocaleTimeString()}</div>
                                        <div className="col-6"><strong>Duration:</strong> {exitModalVisit.duration_display}</div>
                                        <div className="col-12"><strong>Purpose:</strong> {exitModalVisit.visit_purpose_display}</div>
                                    </div>
                                </div>

                                <div className="border-top pt-2">
                                    <h6 className="fw-bold small mb-2">
                                        Linked Parcels ({exitModalVisit.linked_parcels?.length || 0})
                                    </h6>
                                    {exitModalVisit.linked_parcels && exitModalVisit.linked_parcels.length > 0 ? (
                                        <div className="d-flex flex-wrap gap-1">
                                            {exitModalVisit.linked_parcels.map(p => (
                                                <span key={p.id} className="badge bg-primary">
                                                    {p.parcel_id} ({p.flat})
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="small text-muted fst-italic">
                                            No parcels were linked to this visit during intake.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-light" onClick={() => setExitModalVisit(null)}>
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-danger" 
                                    onClick={handleConfirmExit}
                                    disabled={exiting}
                                >
                                    {exiting ? 'Confirming...' : 'Confirm Exit & Close Visit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourierVisits;

