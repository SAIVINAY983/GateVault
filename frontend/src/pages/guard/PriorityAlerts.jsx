import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
    { id: 'SECURITY_EMERGENCY', label: 'Security Emergency', icon: 'bi-shield-fill-exclamation', color: 'danger' },
    { id: 'DAMAGED_PARCEL', label: 'Damaged Parcel', icon: 'bi-box-seam', color: 'warning' },
    { id: 'TAMPERED_PARCEL', label: 'Tampered Parcel', icon: 'bi-exclamation-diamond-fill', color: 'danger' },
    { id: 'OVERDUE_PARCEL', label: 'Overdue Parcel', icon: 'bi-clock-history', color: 'warning' },
    { id: 'HIGH_VALUE_DELIVERY', label: 'High-Value Delivery', icon: 'bi-gem', color: 'info' },
    { id: 'FOOD_DELIVERY_DELAY', label: 'Food Delivery Delay', icon: 'bi-cup-straw', color: 'warning' },
    { id: 'GATEHOUSE_OPERATION', label: 'Gatehouse Operation', icon: 'bi-gear-wide-connected', color: 'primary' },
    { id: 'OTHER', label: 'Other Issue', icon: 'bi-info-circle', color: 'secondary' },
];

const PRIORITIES = [
    { id: 'CRITICAL', label: 'Critical', bg: 'bg-danger text-white', icon: 'bi-fire' },
    { id: 'HIGH', label: 'High', bg: 'bg-warning text-dark', icon: 'bi-exclamation-triangle-fill' },
    { id: 'MEDIUM', label: 'Medium', bg: 'bg-info text-dark', icon: 'bi-info-circle-fill' },
    { id: 'LOW', label: 'Low', bg: 'bg-light text-dark border', icon: 'bi-check-circle' },
];

const PriorityAlerts = () => {
    const navigate = useNavigate();

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'CRITICAL' | 'RESOLVED'
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        title: '',
        category: 'SECURITY_EMERGENCY',
        priority: 'HIGH',
        description: '',
        parcel_identifier: '',
        initial_notes: ''
    });
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    // Detail & History Modal State
    const [selectedAlert, setSelectedAlert] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Action Modal State (Acknowledge / In Progress / Notes / Resolve)
    const [actionItem, setActionItem] = useState(null);
    const [actionType, setActionType] = useState('ACKNOWLEDGE'); // 'ACKNOWLEDGE' | 'IN_PROGRESS' | 'RESOLVE' | 'NOTE'
    const [actionNotes, setActionNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const fetchAlerts = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (statusFilter === 'ACTIVE') {
                // handled on client or by querying non-resolved
            } else if (statusFilter === 'CRITICAL') {
                params.priority = 'CRITICAL';
            } else if (statusFilter === 'RESOLVED') {
                params.status = 'RESOLVED';
            } else if (statusFilter !== 'ALL') {
                params.status = statusFilter;
            }

            if (categoryFilter !== 'ALL') params.category = categoryFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const res = await axiosInstance.get('alerts/', { params });
            let list = Array.isArray(res.data) ? res.data : [];
            if (statusFilter === 'ACTIVE') {
                list = list.filter(a => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(a.status));
            }
            setAlerts(list);
        } catch (err) {
            console.error("Error loading alerts:", err);
            setError('Failed to load priority alerts. Access restricted to security personnel and admins.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, [statusFilter, categoryFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchAlerts();
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            setCreateError('Only JPG, JPEG, and PNG images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setCreateError('Photo file size cannot exceed 5MB.');
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setCreateError('');
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateError('');

        if (!createFormData.title.trim()) {
            setCreateError('Alert title is required.');
            return;
        }
        if (!createFormData.description.trim()) {
            setCreateError('Description is required.');
            return;
        }

        setCreateLoading(true);
        try {
            const data = new FormData();
            data.append('title', createFormData.title.trim());
            data.append('category', createFormData.category);
            data.append('priority', createFormData.priority);
            data.append('description', createFormData.description.trim());
            if (createFormData.parcel_identifier.trim()) {
                data.append('parcel_identifier', createFormData.parcel_identifier.trim());
            }
            if (createFormData.initial_notes.trim()) {
                data.append('initial_notes', createFormData.initial_notes.trim());
            }
            if (photoFile) {
                data.append('photo', photoFile);
            }

            await axiosInstance.post('alerts/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setShowCreateModal(false);
            setCreateFormData({
                title: '',
                category: 'SECURITY_EMERGENCY',
                priority: 'HIGH',
                description: '',
                parcel_identifier: '',
                initial_notes: ''
            });
            setPhotoFile(null);
            setPhotoPreview(null);
            fetchAlerts();
        } catch (err) {
            console.error(err);
            setCreateError(err.response?.data?.error || 'Failed to submit emergency alert.');
        } finally {
            setCreateLoading(false);
        }
    };

    const openActionModal = (alert, type) => {
        setActionItem(alert);
        setActionType(type);
        setActionNotes('');
        setActionError('');
    };

    const handleActionSubmit = async (e) => {
        e.preventDefault();
        if (!actionItem) return;
        setActionLoading(true);
        setActionError('');

        try {
            if (actionType === 'ACKNOWLEDGE') {
                await axiosInstance.post(`alerts/${actionItem.id}/acknowledge/`, {
                    notes: actionNotes.trim()
                });
            } else if (actionType === 'IN_PROGRESS') {
                await axiosInstance.patch(`alerts/${actionItem.id}/status/`, {
                    status: 'IN_PROGRESS',
                    notes: actionNotes.trim() || 'Investigation / action initiated by guard.'
                });
            } else if (actionType === 'RESOLVE') {
                await axiosInstance.patch(`alerts/${actionItem.id}/status/`, {
                    status: 'RESOLVED',
                    notes: actionNotes.trim()
                });
            } else if (actionType === 'NOTE') {
                await axiosInstance.patch(`alerts/${actionItem.id}/status/`, {
                    status: actionItem.status,
                    notes: actionNotes.trim()
                });
            }

            setActionItem(null);
            fetchAlerts();
        } catch (err) {
            console.error(err);
            setActionError(err.response?.data?.error || 'Action failed. Please verify your permissions.');
        } finally {
            setActionLoading(false);
        }
    };

    const openDetailModal = async (alert) => {
        setDetailLoading(true);
        try {
            const res = await axiosInstance.get(`alerts/${alert.id}/`);
            setSelectedAlert(res.data);
        } catch (err) {
            console.error(err);
            setSelectedAlert(alert);
        } finally {
            setDetailLoading(false);
        }
    };

    const resolveMediaUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const base = axiosInstance.defaults.baseURL.replace('/api/', '');
        return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    // Counters
    const criticalCount = alerts.filter(a => a.priority === 'CRITICAL' && a.status !== 'RESOLVED' && a.status !== 'DISMISSED').length;
    const openCount = alerts.filter(a => a.status === 'OPEN').length;
    const inProgressCount = alerts.filter(a => a.status === 'IN_PROGRESS').length;
    const acknowledgedCount = alerts.filter(a => a.status === 'ACKNOWLEDGED').length;

    const getPriorityBadge = (p) => {
        if (p === 'CRITICAL') return <span className="badge bg-danger text-white py-1 px-2 fw-bold"><i className="bi bi-fire me-1"></i> CRITICAL</span>;
        if (p === 'HIGH') return <span className="badge bg-warning text-dark py-1 px-2 fw-semibold"><i className="bi bi-exclamation-triangle-fill me-1"></i> HIGH</span>;
        if (p === 'MEDIUM') return <span className="badge bg-info text-dark py-1 px-2 fw-semibold"><i className="bi bi-info-circle me-1"></i> MEDIUM</span>;
        return <span className="badge bg-light text-dark border py-1 px-2">LOW</span>;
    };

    const getStatusBadge = (s) => {
        if (s === 'OPEN') return <span className="badge bg-danger py-1 px-2">OPEN</span>;
        if (s === 'ACKNOWLEDGED') return <span className="badge bg-primary py-1 px-2">ACKNOWLEDGED</span>;
        if (s === 'IN_PROGRESS') return <span className="badge bg-warning text-dark py-1 px-2">IN PROGRESS</span>;
        if (s === 'RESOLVED') return <span className="badge bg-success py-1 px-2">RESOLVED</span>;
        return <span className="badge bg-secondary py-1 px-2">{s}</span>;
    };

    return (
        <div className="container-fluid px-0 py-3">
            {/* PAGE HEADER */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">
                        <i className="bi bi-shield-exclamation text-danger me-2"></i>
                        Emergency & Priority Alert Management
                    </h2>
                    <p className="text-muted mb-0">Monitor gatehouse security emergencies, parcel tamper incidents, and operational alerts.</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary" onClick={fetchAlerts}>
                        <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                    </button>
                    <button className="btn btn-danger fw-bold d-flex align-items-center gap-2 shadow-sm" onClick={() => setShowCreateModal(true)}>
                        <i className="bi bi-megaphone-fill"></i> Create Emergency Alert
                    </button>
                </div>
            </div>

            {/* KPI METRIC CARDS */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-danger">
                        <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Critical Emergencies</div>
                        <div className="fs-3 fw-bold text-danger mt-1">{criticalCount}</div>
                        <small className="text-muted">Immediate action required</small>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-primary">
                        <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Open Alerts</div>
                        <div className="fs-3 fw-bold text-primary mt-1">{openCount}</div>
                        <small className="text-muted">Awaiting acknowledgement</small>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-warning">
                        <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>In Progress</div>
                        <div className="fs-3 fw-bold text-warning mt-1">{inProgressCount}</div>
                        <small className="text-muted">Under active investigation</small>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-info">
                        <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Acknowledged</div>
                        <div className="fs-3 fw-bold text-dark mt-1">{acknowledgedCount}</div>
                        <small className="text-muted">Staff assigned / aware</small>
                    </div>
                </div>
            </div>

            {/* FILTER & SEARCH CONTROLS */}
            <div className="gv-card p-3 bg-white shadow-sm mb-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 border-bottom pb-3 mb-3">
                    <div className="btn-group shadow-sm" role="group">
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${statusFilter === 'ACTIVE' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setStatusFilter('ACTIVE')}
                        >
                            <i className="bi bi-bell-fill me-1"></i> Active Alerts
                        </button>
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${statusFilter === 'CRITICAL' ? 'btn-danger' : 'btn-outline-secondary'}`}
                            onClick={() => setStatusFilter('CRITICAL')}
                        >
                            <i className="bi bi-fire me-1"></i> Critical Only
                        </button>
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setStatusFilter('ALL')}
                        >
                            All Alerts
                        </button>
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${statusFilter === 'RESOLVED' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setStatusFilter('RESOLVED')}
                        >
                            <i className="bi bi-check-circle me-1"></i> Resolved History
                        </button>
                    </div>

                    <div className="small text-muted">
                        Total records: <strong>{alerts.length}</strong>
                    </div>
                </div>

                <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
                    <div className="col-12 col-md-5">
                        <div className="input-group">
                            <span className="input-group-text bg-light text-muted border-end-0">
                                <i className="bi bi-search"></i>
                            </span>
                            <input 
                                type="text" 
                                className="form-control border-start-0" 
                                placeholder="Search by alert title, description, or parcel ID..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-8 col-md-5">
                        <select 
                            className="form-select" 
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="ALL">All Categories</option>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>

                    <div className="col-4 col-md-2 d-flex gap-1">
                        <button type="submit" className="btn btn-primary w-100">Filter</button>
                        {(searchQuery || categoryFilter !== 'ALL') && (
                            <button 
                                type="button" 
                                className="btn btn-outline-secondary" 
                                onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* ALERTS LIST */}
            {loading ? (
                <div className="gv-card text-center p-5 bg-white shadow-sm">
                    <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                    <div className="text-muted small">Loading priority alerts...</div>
                </div>
            ) : error ? (
                <div className="alert alert-danger shadow-sm rounded-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
                </div>
            ) : alerts.length === 0 ? (
                <div className="gv-card text-center p-5 bg-white shadow-sm">
                    <i className="bi bi-shield-check display-4 text-success mb-3 d-block"></i>
                    <h5 className="fw-bold text-dark">No Active Priority Alerts</h5>
                    <p className="text-muted small mb-3">All gatehouse operations and parcel security checks are normal.</p>
                </div>
            ) : (
                <div className="row g-3">
                    {alerts.map(alert => {
                        const isCritical = alert.priority === 'CRITICAL';
                        return (
                            <div className="col-12 col-md-6 col-lg-4" key={alert.id}>
                                <div className={`gv-card h-100 p-4 bg-white shadow-sm border d-flex flex-column justify-content-between ${isCritical && alert.status !== 'RESOLVED' ? 'border-danger border-2' : ''}`}>
                                    <div>
                                        {/* TOP BADGES */}
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div className="d-flex gap-1 flex-wrap">
                                                {getPriorityBadge(alert.priority)}
                                                <span className="badge bg-light text-dark border">
                                                    {alert.category_display || alert.category}
                                                </span>
                                            </div>
                                            <div>{getStatusBadge(alert.status)}</div>
                                        </div>

                                        {/* ALERT TITLE */}
                                        <h5 className="fw-bold text-dark mt-2 mb-1">{alert.title}</h5>
                                        <p className="text-muted small mb-3" style={{ minHeight: '40px' }}>
                                            {alert.description.length > 140 ? alert.description.substring(0, 140) + '...' : alert.description}
                                        </p>

                                        {/* PARCEL REFERENCE */}
                                        {alert.parcel_id_display && (
                                            <div className="bg-light p-2 rounded-2 mb-3 small d-flex align-items-center justify-content-between border">
                                                <span className="text-muted"><i className="bi bi-box-seam me-1"></i> Related Parcel:</span>
                                                <span className="fw-bold font-monospace text-primary">{alert.parcel_id_display}</span>
                                            </div>
                                        )}

                                        {/* AUTHOR & ASSIGNEE */}
                                        <div className="small text-muted py-2 border-top mb-3">
                                            <div className="d-flex justify-content-between mb-1">
                                                <span>Reported By:</span>
                                                <strong className="text-dark">{alert.created_by_name || 'System'}</strong>
                                            </div>
                                            {alert.assigned_to_name && (
                                                <div className="d-flex justify-content-between mb-1">
                                                    <span>Assigned Guard:</span>
                                                    <strong className="text-primary"><i className="bi bi-person-badge me-1"></i>{alert.assigned_to_name}</strong>
                                                </div>
                                            )}
                                            <div className="d-flex justify-content-between">
                                                <span>Time:</span>
                                                <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ACTIONS */}
                                    <div className="pt-2 border-top d-flex gap-2 flex-wrap">
                                        {alert.status === 'OPEN' && (
                                            <button 
                                                className="btn btn-sm btn-primary flex-fill fw-bold"
                                                onClick={() => openActionModal(alert, 'ACKNOWLEDGE')}
                                            >
                                                <i className="bi bi-check2-circle me-1"></i> Acknowledge
                                            </button>
                                        )}

                                        {['OPEN', 'ACKNOWLEDGED'].includes(alert.status) && (
                                            <button 
                                                className="btn btn-sm btn-warning text-dark flex-fill fw-bold"
                                                onClick={() => openActionModal(alert, 'IN_PROGRESS')}
                                            >
                                                <i className="bi bi-play-circle me-1"></i> In Progress
                                            </button>
                                        )}

                                        {['ACKNOWLEDGED', 'IN_PROGRESS'].includes(alert.status) && (
                                            <button 
                                                className="btn btn-sm btn-success flex-fill fw-bold"
                                                onClick={() => openActionModal(alert, 'RESOLVE')}
                                            >
                                                <i className="bi bi-check-all me-1"></i> Resolve
                                            </button>
                                        )}

                                        <button 
                                            className="btn btn-sm btn-outline-secondary px-3"
                                            onClick={() => openDetailModal(alert)}
                                            title="View Details & Audit Timeline"
                                        >
                                            <i className="bi bi-clock-history"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CREATE EMERGENCY ALERT MODAL */}
            {showCreateModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-danger text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-megaphone-fill me-2"></i>
                                    Create Emergency / Priority Alert
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
                            </div>
                            <form onSubmit={handleCreateSubmit}>
                                <div className="modal-body p-4">
                                    {createError && (
                                        <div className="alert alert-danger py-2 px-3 small border-0 mb-3">
                                            {createError}
                                        </div>
                                    )}

                                    <div className="row g-3">
                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-dark">Alert Title <span className="text-danger">*</span></label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="e.g. Unauthorized gatehouse entry attempt, Broken parcel seal detected"
                                                value={createFormData.title}
                                                onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                                                required 
                                            />
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold text-dark">Alert Category <span className="text-danger">*</span></label>
                                            <select 
                                                className="form-select" 
                                                value={createFormData.category}
                                                onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value })}
                                                required
                                            >
                                                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold text-dark">Priority Level <span className="text-danger">*</span></label>
                                            <select 
                                                className="form-select" 
                                                value={createFormData.priority}
                                                onChange={(e) => setCreateFormData({ ...createFormData, priority: e.target.value })}
                                                required
                                            >
                                                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-dark">Related Parcel Reference <span className="text-muted fw-normal">(Optional)</span></label>
                                            <input 
                                                type="text" 
                                                className="form-control font-monospace" 
                                                placeholder="Enter Parcel ID (e.g. P-1001) or Tracking Number"
                                                value={createFormData.parcel_identifier}
                                                onChange={(e) => setCreateFormData({ ...createFormData, parcel_identifier: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-dark">Detailed Description <span className="text-danger">*</span></label>
                                            <textarea 
                                                className="form-control" 
                                                rows="3" 
                                                placeholder="Provide detailed context, security observations, or specific actions taken..."
                                                value={createFormData.description}
                                                onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                                                required
                                            ></textarea>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-dark">Initial Operational Notes <span className="text-muted fw-normal">(Optional)</span></label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="e.g. Guard deployed to Tower B gate, courier detained"
                                                value={createFormData.initial_notes}
                                                onChange={(e) => setCreateFormData({ ...createFormData, initial_notes: e.target.value })}
                                            />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label small fw-semibold text-dark">Incident / Evidence Photograph <span className="text-muted fw-normal">(Optional)</span></label>
                                            {!photoPreview ? (
                                                <div className="border border-2 border-dashed rounded-3 p-3 text-center bg-light">
                                                    <input type="file" id="alert_photo" className="d-none" accept="image/jpeg,image/png,image/jpg" onChange={handlePhotoChange} />
                                                    <label htmlFor="alert_photo" className="btn btn-sm btn-outline-danger mb-1 rounded-pill px-3">
                                                        <i className="bi bi-camera me-1"></i> Attach Photo
                                                    </label>
                                                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>JPG, JPEG, PNG up to 5MB</div>
                                                </div>
                                            ) : (
                                                <div className="position-relative d-inline-block rounded-3 overflow-hidden border">
                                                    <img src={photoPreview} alt="Preview" style={{ maxHeight: '140px', objectFit: 'contain' }} />
                                                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="btn btn-danger btn-sm position-absolute top-0 end-0 m-1 rounded-circle" style={{ width: '26px', height: '26px', padding: 0 }}>
                                                        <i className="bi bi-x"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-danger px-4 fw-bold" disabled={createLoading}>
                                        {createLoading ? 'Logging Alert...' : 'Publish Emergency Alert'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTION MODAL (ACKNOWLEDGE / IN PROGRESS / RESOLVE) */}
            {actionItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    {actionType === 'ACKNOWLEDGE' && <><i className="bi bi-check2-circle me-2 text-primary"></i> Acknowledge Priority Alert</>}
                                    {actionType === 'IN_PROGRESS' && <><i className="bi bi-play-circle me-2 text-warning"></i> Mark Alert In Progress</>}
                                    {actionType === 'RESOLVE' && <><i className="bi bi-check-all me-2 text-success"></i> Resolve Alert</>}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setActionItem(null)}></button>
                            </div>
                            <form onSubmit={handleActionSubmit}>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded-3 mb-3 border">
                                        <div className="fw-bold text-dark">{actionItem.title}</div>
                                        <div className="text-muted small">Category: {actionItem.category_display} | Priority: {actionItem.priority}</div>
                                    </div>

                                    {actionError && (
                                        <div className="alert alert-danger py-2 px-3 small border-0 mb-3">
                                            {actionError}
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">
                                            {actionType === 'RESOLVE' ? 'Resolution Details & Outcome *' : 'Operational Note / Action Taken'}
                                        </label>
                                        <textarea 
                                            className="form-control" 
                                            rows="3" 
                                            placeholder={actionType === 'RESOLVE' ? "State the resolution, root cause, and remedial action..." : "Describe actions currently being undertaken by the security team..."}
                                            value={actionNotes}
                                            onChange={(e) => setActionNotes(e.target.value)}
                                            required={actionType === 'RESOLVE'}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setActionItem(null)}>Cancel</button>
                                    <button 
                                        type="submit" 
                                        className={`btn px-4 fw-bold ${actionType === 'RESOLVE' ? 'btn-success' : 'btn-primary'}`} 
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Saving...' : 'Confirm Action'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL & AUDIT TIMELINE MODAL */}
            {selectedAlert && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-clock-history me-2 text-primary"></i>
                                    Alert Details & Audit History
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedAlert(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex justify-content-between align-items-start mb-3 pb-3 border-bottom">
                                    <div>
                                        <h4 className="fw-bold text-dark mb-1">{selectedAlert.title}</h4>
                                        <div className="text-muted small">
                                            Category: <strong>{selectedAlert.category_display}</strong> | Priority: {getPriorityBadge(selectedAlert.priority)}
                                        </div>
                                    </div>
                                    <div>{getStatusBadge(selectedAlert.status)}</div>
                                </div>

                                <p className="text-dark bg-light p-3 rounded-3 border mb-3">
                                    {selectedAlert.description}
                                </p>

                                {selectedAlert.photo && (
                                    <div className="mb-3 text-center">
                                        <img 
                                            src={resolveMediaUrl(selectedAlert.photo)} 
                                            alt="Alert evidence" 
                                            className="img-fluid rounded border shadow-sm" 
                                            style={{ maxHeight: '200px' }} 
                                        />
                                    </div>
                                )}

                                {selectedAlert.resolution_notes && (
                                    <div className="alert alert-success border-0 small mb-4">
                                        <strong>Resolution Notes:</strong> {selectedAlert.resolution_notes}
                                        {selectedAlert.resolved_by_name && <div><small className="text-muted">Resolved by: {selectedAlert.resolved_by_name}</small></div>}
                                    </div>
                                )}

                                {/* TIMELINE */}
                                <h6 className="fw-bold text-dark text-uppercase small mb-3" style={{ letterSpacing: '0.05em' }}>
                                    Audit History & Action Timeline
                                </h6>
                                <div className="border-start border-2 border-primary ms-2 ps-3 py-1">
                                    {selectedAlert.history?.length > 0 ? (
                                        selectedAlert.history.map((h, i) => (
                                            <div className="mb-3 position-relative" key={h.id || i}>
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="fw-bold text-dark small">
                                                        <span className="badge bg-secondary me-2">{h.new_status}</span>
                                                        {h.action_by_name} ({h.action_by_role || 'STAFF'})
                                                    </span>
                                                    <span className="text-muted small">
                                                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                {h.notes && <div className="small text-muted bg-light p-2 rounded">{h.notes}</div>}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="small text-muted">No historical events recorded yet.</div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedAlert(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriorityAlerts;

