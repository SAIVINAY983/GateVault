import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { ConditionBadge } from '../../components/ui/ParcelCard';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';
import { resolveMediaUrl } from '../../utils/mediaUtils';

const INCIDENT_CATEGORIES = [
    { value: 'DAMAGED', label: 'Parcel damaged' },
    { value: 'TAMPERED', label: 'Parcel tampered with' },
    { value: 'MISSING_CONTENTS', label: 'Missing contents' },
    { value: 'INCORRECT_PARCEL', label: 'Incorrect parcel' },
    { value: 'OTHER', label: 'Other' },
];

const getIncidentCategoryLabel = (category) => {
    const match = INCIDENT_CATEGORIES.find(c => c.value === category);
    return match ? match.label : category;
};

const getIncidentStatusBadge = (status) => {
    switch (status) {
        case 'OPEN':
            return <span className="badge bg-primary text-white"><i className="bi bi-clock me-1"></i>Open</span>;
        case 'UNDER_REVIEW':
            return <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Under Review</span>;
        case 'RESOLVED':
            return <span className="badge bg-success text-white"><i className="bi bi-check-circle-fill me-1"></i>Resolved</span>;
        case 'REJECTED':
            return <span className="badge bg-danger text-white"><i className="bi bi-x-circle me-1"></i>Rejected</span>;
        default:
            return <span className="badge bg-secondary">{status}</span>;
    }
};

const AdminIncidents = () => {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');

    // Modal state
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('UNDER_REVIEW');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const [updateSuccess, setUpdateSuccess] = useState('');

    const fetchIncidents = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await axiosInstance.get('admin/incidents/');
            setIncidents(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError('Failed to load incident reports.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncidents();
    }, []);

    const handleOpenReview = (incident) => {
        setSelectedIncident(incident);
        setUpdateStatus(incident.status);
        setResolutionNotes(incident.resolution_note || '');
        setUpdateError('');
        setUpdateSuccess('');
        setShowReviewModal(true);
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        if (!selectedIncident) return;

        try {
            setUpdating(true);
            setUpdateError('');
            setUpdateSuccess('');

            const res = await axiosInstance.patch(`admin/incidents/${selectedIncident.id}/status/`, {
                status: updateStatus,
                resolution_notes: resolutionNotes.trim()
            });

            setUpdateSuccess('Incident status and resolution note saved successfully.');
            setSelectedIncident(res.data);

            // Update item in local list
            setIncidents(prev => prev.map(item => item.id === res.data.id ? res.data : item));

            setTimeout(() => {
                setUpdateSuccess('');
            }, 2000);
        } catch (err) {
            setUpdateError(err.response?.data?.error || 'Failed to update incident status.');
        } finally {
            setUpdating(false);
        }
    };

    // Filtered Incidents
    const filteredIncidents = incidents.filter(inc => {
        const matchesSearch = searchTerm.trim() === '' || 
            (inc.parcel_id_str && inc.parcel_id_str.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inc.resident_name && inc.resident_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inc.carrier_name && inc.carrier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inc.flat_number && inc.flat_number.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesCategory = !selectedCategory || inc.category === selectedCategory;
        const matchesStatus = !selectedStatus || inc.status === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    // Counts
    const countTotal = incidents.length;
    const countOpen = incidents.filter(i => i.status === 'OPEN').length;
    const countReview = incidents.filter(i => i.status === 'UNDER_REVIEW').length;
    const countResolved = incidents.filter(i => i.status === 'RESOLVED').length;

    if (loading) return <LoadingSpinner message="Loading incident management records..." />;
    if (error) return <ErrorState message={error} onRetry={fetchIncidents} />;

    return (
        <div className="container-fluid px-0">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Parcel Incident Management</h2>
                    <p className="text-muted">Review condition issues, investigate discrepancies, and resolve claims.</p>
                </div>
                <button onClick={fetchIncidents} className="btn btn-outline-secondary d-flex align-items-center gap-2">
                    <i className="bi bi-arrow-clockwise"></i> Refresh
                </button>
            </div>

            {/* Metrics Row */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-primary bg-opacity-10 text-primary rounded p-3 me-3">
                            <i className="bi bi-shield-exclamation fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{countTotal}</h4>
                            <span className="text-muted small text-uppercase">Total Incidents</span>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-danger bg-opacity-10 text-danger rounded p-3 me-3">
                            <i className="bi bi-clock fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{countOpen}</h4>
                            <span className="text-muted small text-uppercase">Open / Pending</span>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-warning bg-opacity-10 text-warning rounded p-3 me-3">
                            <i className="bi bi-hourglass-split fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{countReview}</h4>
                            <span className="text-muted small text-uppercase">Under Review</span>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-success bg-opacity-10 text-success rounded p-3 me-3">
                            <i className="bi bi-check-circle-fill fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{countResolved}</h4>
                            <span className="text-muted small text-uppercase">Resolved</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="gv-card p-3 mb-4 bg-white shadow-sm border-0">
                <div className="row g-3 align-items-center">
                    <div className="col-12 col-md-5">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0">
                                <i className="bi bi-search text-muted"></i>
                            </span>
                            <input 
                                type="text"
                                className="form-control bg-light border-start-0"
                                placeholder="Search by Parcel ID, Resident, Flat, or Courier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <select 
                            className="form-select bg-light"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {INCIDENT_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-6 col-md-3">
                        <select 
                            className="form-select bg-light"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                    <div className="col-12 col-md-1 text-end">
                        {(searchTerm || selectedCategory || selectedStatus) && (
                            <button 
                                className="btn btn-sm btn-link text-decoration-none text-muted"
                                onClick={() => { setSearchTerm(''); setSelectedCategory(''); setSelectedStatus(''); }}
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Incidents Table / Cards */}
            {filteredIncidents.length === 0 ? (
                <EmptyState 
                    icon="bi-shield-check"
                    title="No incidents found."
                    message={searchTerm || selectedCategory || selectedStatus ? "No incident records matched your active search filters." : "No parcels have active incident reports. Everything is in order."}
                />
            ) : (
                <div className="gv-card overflow-hidden shadow-sm bg-white border-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 border-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold border-bottom-0">Incident ID</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Parcel / Courier</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Resident / Flat</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Category</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Intake Condition</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                    <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="border-top-0">
                                {filteredIncidents.map(inc => (
                                    <tr key={inc.id}>
                                        <td className="ps-4">
                                            <div className="fw-bold text-dark">#{inc.id}</div>
                                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                {new Date(inc.reported_at).toLocaleDateString('en-GB')}
                                            </small>
                                        </td>
                                        <td>
                                            <div className="fw-semibold text-dark">{inc.parcel_id_str}</div>
                                            <small className="text-muted">{inc.carrier_name}</small>
                                        </td>
                                        <td>
                                            <div className="fw-medium text-dark">{inc.resident_name || 'Resident'}</div>
                                            <small className="text-muted">Flat {inc.flat_number} ({inc.tower_name})</small>
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary bg-opacity-25 text-dark fw-medium">
                                                {getIncidentCategoryLabel(inc.category)}
                                            </span>
                                        </td>
                                        <td>
                                            <ConditionBadge condition={inc.inspection_condition || 'INTACT'} />
                                        </td>
                                        <td>
                                            {getIncidentStatusBadge(inc.status)}
                                        </td>
                                        <td className="pe-4 text-end">
                                            <button 
                                                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                                onClick={() => handleOpenReview(inc)}
                                            >
                                                <i className="bi bi-search"></i> Review & Resolve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* REVIEW & RESOLVE MODAL */}
            {showReviewModal && selectedIncident && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-xl">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark mb-0">
                                        Incident #{selectedIncident.id} Review – Parcel {selectedIncident.parcel_id_str}
                                    </h5>
                                    <small className="text-muted">
                                        Reported by {selectedIncident.resident_name} (Flat {selectedIncident.flat_number}) on {new Date(selectedIncident.reported_at).toLocaleString('en-GB')}
                                    </small>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowReviewModal(false)}></button>
                            </div>
                            
                            <div className="modal-body p-4">
                                {updateError && (
                                    <div className="alert alert-danger py-2 small mb-3 border-0">
                                        <i className="bi bi-exclamation-circle-fill me-2"></i>{updateError}
                                    </div>
                                )}
                                {updateSuccess && (
                                    <div className="alert alert-success py-2 small mb-3 border-0">
                                        <i className="bi bi-check-circle-fill me-2"></i>{updateSuccess}
                                    </div>
                                )}

                                {/* SIDE-BY-SIDE EVIDENCE COMPARISON */}
                                <div className="row g-4 mb-4">
                                    {/* Left: Guard Inspection */}
                                    <div className="col-12 col-md-6">
                                        <div className="p-3 bg-light rounded-3 border h-100">
                                            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                <h6 className="fw-bold text-primary mb-0">
                                                    <i className="bi bi-shield-check me-2"></i>Guard Intake Inspection
                                                </h6>
                                                <ConditionBadge condition={selectedIncident.inspection_condition || 'INTACT'} />
                                            </div>
                                            
                                            <div className="mb-3">
                                                <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Guard Remarks</small>
                                                <div className="p-2 bg-white rounded border small text-dark">
                                                    {selectedIncident.inspection_remarks || <span className="text-muted italic">No remarks logged at intake.</span>}
                                                </div>
                                            </div>

                                            <div>
                                                <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Intake Photograph</small>
                                                {selectedIncident.inspection_photo ? (
                                                    <div className="text-center bg-white p-2 rounded border">
                                                        <a href={resolveMediaUrl(selectedIncident.inspection_photo)} target="_blank" rel="noopener noreferrer">
                                                            <img 
                                                                src={resolveMediaUrl(selectedIncident.inspection_photo)} 
                                                                alt="Guard Intake" 
                                                                className="img-fluid rounded border" 
                                                                style={{ maxHeight: '200px', objectFit: 'contain' }} 
                                                            />
                                                        </a>
                                                        <div className="text-muted small mt-1">
                                                            <i className="bi bi-zoom-in me-1"></i>Click to expand intake photo
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-white rounded text-center text-muted small border">
                                                        <i className="bi bi-camera-slash fs-4 d-block mb-1"></i>
                                                        No guard intake photograph on file
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Resident Incident Claim */}
                                    <div className="col-12 col-md-6">
                                        <div className="p-3 bg-light rounded-3 border h-100">
                                            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                                <h6 className="fw-bold text-danger mb-0">
                                                    <i className="bi bi-exclamation-octagon me-2"></i>Resident Incident Claim
                                                </h6>
                                                <span className="badge bg-secondary bg-opacity-25 text-dark fw-bold">
                                                    {getIncidentCategoryLabel(selectedIncident.category)}
                                                </span>
                                            </div>

                                            <div className="mb-3">
                                                <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident Description</small>
                                                <div className="p-2 bg-white rounded border small text-dark">
                                                    {selectedIncident.description}
                                                </div>
                                            </div>

                                            <div>
                                                <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident Evidence Photo</small>
                                                {selectedIncident.evidence_photo ? (
                                                    <div className="text-center bg-white p-2 rounded border">
                                                        <a href={resolveMediaUrl(selectedIncident.evidence_photo)} target="_blank" rel="noopener noreferrer">
                                                            <img 
                                                                src={resolveMediaUrl(selectedIncident.evidence_photo)} 
                                                                alt="Resident Evidence" 
                                                                className="img-fluid rounded border" 
                                                                style={{ maxHeight: '200px', objectFit: 'contain' }} 
                                                            />
                                                        </a>
                                                        <div className="text-muted small mt-1">
                                                            <i className="bi bi-zoom-in me-1"></i>Click to expand evidence photo
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-white rounded text-center text-muted small border">
                                                        <i className="bi bi-camera-slash fs-4 d-block mb-1"></i>
                                                        No resident evidence photograph provided
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ADMIN STATUS UPDATE & RESOLUTION NOTES */}
                                <form onSubmit={handleUpdateStatus} className="p-3 bg-white rounded-3 border mb-4">
                                    <h6 className="fw-bold text-dark mb-3">
                                        <i className="bi bi-pencil-square me-2 text-primary"></i>Administrative Action & Resolution
                                    </h6>
                                    
                                    <div className="row g-3">
                                        <div className="col-md-4">
                                            <label className="form-label text-dark small fw-semibold">Update Incident Status <span className="text-danger">*</span></label>
                                            <select 
                                                className="form-select bg-light fw-bold"
                                                value={updateStatus}
                                                onChange={(e) => setUpdateStatus(e.target.value)}
                                                required
                                            >
                                                <option value="OPEN">OPEN</option>
                                                <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                                                <option value="RESOLVED">RESOLVED</option>
                                                <option value="REJECTED">REJECTED</option>
                                            </select>
                                        </div>
                                        <div className="col-md-8">
                                            <label className="form-label text-dark small fw-semibold">Administrative Resolution Note</label>
                                            <textarea 
                                                className="form-control bg-light"
                                                rows="2"
                                                value={resolutionNotes}
                                                onChange={(e) => setResolutionNotes(e.target.value)}
                                                placeholder="Provide resolution details, courier claim details, replacement status, or rejection rationale..."
                                            ></textarea>
                                        </div>
                                    </div>

                                    <div className="d-flex justify-content-end mt-3">
                                        <button 
                                            type="submit" 
                                            className="btn btn-primary fw-semibold px-4"
                                            disabled={updating}
                                        >
                                            {updating ? (
                                                <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                                            ) : (
                                                <><i className="bi bi-check-circle me-1"></i>Update Status & Save Note</>
                                            )}
                                        </button>
                                    </div>
                                </form>

                                {/* COMPLETE AUDIT HISTORY */}
                                <div>
                                    <h6 className="fw-bold text-dark small text-uppercase mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                                        Complete Audit History ({selectedIncident.history?.length || 0} Events)
                                    </h6>
                                    
                                    {(!selectedIncident.history || selectedIncident.history.length === 0) ? (
                                        <div className="p-3 bg-light rounded text-muted text-center small border">
                                            No status transitions recorded yet. The incident is currently <strong>{selectedIncident.status}</strong>.
                                        </div>
                                    ) : (
                                        <div className="timeline ps-3 border-start border-2 border-primary ms-2">
                                            {selectedIncident.history.map((h, idx) => (
                                                <div className="position-relative mb-3 ps-3" key={h.id || idx}>
                                                    <div className="position-absolute rounded-circle bg-primary" style={{ width: '10px', height: '10px', left: '-7px', top: '5px' }}></div>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <span className="badge bg-secondary">{h.old_status}</span>
                                                        <i className="bi bi-arrow-right text-muted"></i>
                                                        <span className="badge bg-primary">{h.new_status}</span>
                                                        <span className="text-muted small ms-2">
                                                            {new Date(h.timestamp || h.changed_at).toLocaleString('en-GB')}
                                                        </span>
                                                    </div>
                                                    <div className="small text-dark">
                                                        Recorded by Administrator: <strong>{h.action_by_name || h.changed_by_name || 'Admin'}</strong>
                                                    </div>
                                                    {h.notes && (
                                                        <div className="p-2 bg-light rounded border text-muted small mt-1">
                                                            "{h.notes}"
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminIncidents;
