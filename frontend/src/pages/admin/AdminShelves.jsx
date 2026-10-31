import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { Link } from 'react-router-dom';

const AdminShelves = () => {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Maintenance modal state
    const [selectedShelf, setSelectedShelf] = useState(null);
    const [statusAction, setStatusAction] = useState('MAINTENANCE');
    const [maintenanceNotes, setMaintenanceNotes] = useState('');
    const [statusUpdating, setStatusUpdating] = useState(false);

    // Relocation modal state
    const [relocatingParcel, setRelocatingParcel] = useState(null);
    const [destinationShelfId, setDestinationShelfId] = useState('');
    const [relocationReason, setRelocationReason] = useState('');
    const [relocating, setRelocating] = useState(false);

    // Shelf History modal state
    const [historyShelf, setHistoryShelf] = useState(null);
    const [shelfHistoryLogs, setShelfHistoryLogs] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('admin/shelf-analytics/');
            setAnalytics(res.data);
            setError('');
        } catch (err) {
            console.error('Failed to fetch shelf analytics', err);
            setError(err.response?.data?.error || 'Failed to load smart shelf analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        if (!selectedShelf) return;

        setStatusUpdating(true);
        setError('');
        setSuccessMsg('');

        try {
            const res = await axiosInstance.patch(`admin/shelves/${selectedShelf.id}/status/`, {
                status: statusAction,
                maintenance_notes: maintenanceNotes
            });

            setSuccessMsg(`Shelf "${selectedShelf.name}" status updated to ${statusAction}.`);
            setSelectedShelf(null);
            setMaintenanceNotes('');
            fetchAnalytics();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update shelf status.');
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleRelocateParcel = async (e) => {
        e.preventDefault();
        if (!relocatingParcel || !destinationShelfId) return;

        setRelocating(true);
        setError('');
        setSuccessMsg('');

        try {
            const res = await axiosInstance.post(`parcels/${relocatingParcel.parcel_id}/relocate/`, {
                new_shelf_id: destinationShelfId,
                reason: relocationReason || 'Authorized guard/admin shelf relocation'
            });

            setSuccessMsg(res.data.message || `Parcel ${relocatingParcel.parcel_id} successfully relocated.`);
            setRelocatingParcel(null);
            setDestinationShelfId('');
            setRelocationReason('');
            fetchAnalytics();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to relocate parcel.');
        } finally {
            setRelocating(false);
        }
    };

    const handleViewHistory = async (shelf) => {
        setHistoryShelf(shelf);
        setHistoryLoading(true);
        try {
            const res = await axiosInstance.get(`shelves/${shelf.id}/history/`);
            setShelfHistoryLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load history', err);
            setShelfHistoryLogs([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const metrics = analytics?.metrics || {};
    const shelves = analytics?.shelves || [];
    const recentHistory = analytics?.recent_assignments || [];

    return (
        <div className="pb-5">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                        <i className="bi bi-bookshelf text-primary"></i> Smart Shelf & Allocation Management
                    </h3>
                    <p className="text-muted small mb-0">
                        Monitor live zone capacities, manage maintenance states, view parcel allocations, and inspect relocation history.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <Link to="/admin" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                        <i className="bi bi-arrow-left"></i> Dashboard
                    </Link>
                    <button 
                        onClick={fetchAnalytics} 
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                        disabled={loading}
                    >
                        <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
                    </button>
                </div>
            </div>

            {/* Error & Success Alerts */}
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

            {/* Capacity Warning Banner */}
            {metrics.near_capacity_shelves_count > 0 && (
                <div className="alert alert-warning border border-warning border-opacity-50 p-3 mb-4 rounded-3 d-flex align-items-center justify-content-between shadow-sm">
                    <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle bg-warning bg-opacity-25 p-2 text-warning">
                            <i className="bi bi-exclamation-triangle-fill fs-4 text-warning"></i>
                        </div>
                        <div>
                            <div className="fw-bold text-dark">
                                {metrics.near_capacity_shelves_count} Shelf Zone{metrics.near_capacity_shelves_count > 1 ? 's are' : ' is'} Near Capacity (&gt;85% full)
                            </div>
                            <div className="small text-muted">
                                Consider dispatching pickup reminders or putting additional shelves into active service.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Metric KPI Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small fw-semibold text-uppercase">Total Capacity</span>
                            <i className="bi bi-boxes fs-4 text-primary"></i>
                        </div>
                        <div className="fs-3 fw-bold text-dark">{metrics.total_capacity || 0} Slots</div>
                        <div className="small text-muted mt-1">Across {metrics.total_shelves || 0} storage zones</div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small fw-semibold text-uppercase">Occupancy & Reserved</span>
                            <i className="bi bi-pie-chart-fill fs-4 text-info"></i>
                        </div>
                        <div className="fs-3 fw-bold text-dark">
                            {metrics.total_occupied || 0}
                            <span className="fs-6 fw-normal text-muted ms-1">
                                (+{metrics.total_reserved || 0} reserved)
                            </span>
                        </div>
                        <div className="small text-muted mt-1">
                            {metrics.total_available || 0} slots remaining available
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small fw-semibold text-uppercase">Utilization Rate</span>
                            <i className="bi bi-speedometer fs-4 text-success"></i>
                        </div>
                        <div className="fs-3 fw-bold text-dark">{metrics.overall_utilization || 0}%</div>
                        <div className="progress mt-2" style={{ height: '6px' }}>
                            <div 
                                className={`progress-bar ${metrics.overall_utilization > 85 ? 'bg-danger' : metrics.overall_utilization > 60 ? 'bg-warning' : 'bg-success'}`}
                                style={{ width: `${Math.min(metrics.overall_utilization || 0, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small fw-semibold text-uppercase">Status Health</span>
                            <i className="bi bi-shield-check fs-4 text-warning"></i>
                        </div>
                        <div className="d-flex gap-2 align-items-center mt-1">
                            <span className="badge bg-success">{metrics.active_shelves || 0} Active</span>
                            <span className="badge bg-warning text-dark">{metrics.maintenance_shelves || 0} Maint.</span>
                            <span className="badge bg-secondary">{metrics.inactive_shelves || 0} Inactive</span>
                        </div>
                        <div className="small text-muted mt-2">
                            {metrics.near_capacity_shelves_count || 0} zones near full capacity
                        </div>
                    </div>
                </div>
            </div>

            {/* Shelf Grid & Visualizer */}
            <div className="gv-card mb-4 border rounded-3 bg-white shadow-sm p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold mb-0">Storage Shelf Visualizer & Zone Details</h5>
                    <span className="small text-muted">Real-time allocation status</span>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="text-muted small mt-2">Loading shelf analytics...</div>
                    </div>
                ) : (
                    <div className="row g-3">
                        {shelves.map(shelf => {
                            const isNearCap = shelf.is_near_capacity || (shelf.occupied / shelf.capacity) >= 0.85;
                            const isFull = shelf.is_full;
                            const isMaint = shelf.status === 'MAINTENANCE';
                            const isInactive = shelf.status === 'INACTIVE';

                            let statusBadgeClass = 'bg-success';
                            if (isMaint) statusBadgeClass = 'bg-warning text-dark';
                            else if (isInactive) statusBadgeClass = 'bg-secondary';

                            return (
                                <div key={shelf.id} className="col-12 col-md-6 col-xl-4">
                                    <div className={`p-3 rounded-3 border h-100 d-flex flex-column ${isNearCap ? 'border-danger border-opacity-50 bg-danger bg-opacity-10' : (isMaint ? 'border-warning bg-warning bg-opacity-10' : 'bg-light')}`}>
                                        {/* Header */}
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div>
                                                <h6 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                                                    {shelf.name}
                                                    <span className="badge bg-primary bg-opacity-25 text-primary small" style={{ fontSize: '0.65rem' }}>
                                                        {shelf.max_parcel_size} Tier
                                                    </span>
                                                </h6>
                                                <div className="small text-muted">
                                                    {shelf.occupied} / {shelf.capacity} slots filled ({shelf.available} available)
                                                </div>
                                            </div>
                                            <div className="d-flex flex-column align-items-end gap-1">
                                                <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.7rem' }}>
                                                    {shelf.status}
                                                </span>
                                                {isNearCap && (
                                                    <span className="badge bg-danger text-white" style={{ fontSize: '0.65rem' }}>
                                                        &gt;85% Full
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="progress mb-3" style={{ height: '8px' }}>
                                            <div 
                                                className={`progress-bar ${isFull || isNearCap ? 'bg-danger' : (shelf.utilization_percentage > 60 ? 'bg-warning' : 'bg-success')}`}
                                                style={{ width: `${Math.min(shelf.utilization_percentage || 0, 100)}%` }}
                                            ></div>
                                        </div>

                                        {/* Maintenance Notes if any */}
                                        {shelf.maintenance_notes && (
                                            <div className="small text-muted fst-italic mb-2 p-2 bg-white rounded border">
                                                <i className="bi bi-info-circle me-1"></i> {shelf.maintenance_notes}
                                            </div>
                                        )}

                                        {/* Active Parcels Summary */}
                                        <div className="flex-grow-1 mb-3">
                                            <div className="d-flex justify-content-between small text-muted fw-semibold mb-1">
                                                <span>Active Parcels ({shelf.active_parcels?.length || 0})</span>
                                            </div>
                                            {shelf.active_parcels && shelf.active_parcels.length > 0 ? (
                                                <div className="bg-white rounded border p-2 overflow-auto" style={{ maxHeight: '140px' }}>
                                                    {shelf.active_parcels.map(p => (
                                                        <div key={p.id} className="d-flex justify-content-between align-items-center py-1 border-bottom border-light small">
                                                            <div>
                                                                <span className="fw-bold text-dark me-1">{p.parcel_id}</span>
                                                                <span className="text-muted">({p.flat_number})</span>
                                                                <span className="badge bg-light text-muted ms-1" style={{ fontSize: '0.65rem' }}>{p.parcel_size}</span>
                                                            </div>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => {
                                                                    setRelocatingParcel(p);
                                                                    setDestinationShelfId('');
                                                                    setRelocationReason('');
                                                                }}
                                                                className="btn btn-sm btn-outline-primary py-0 px-2"
                                                                style={{ fontSize: '0.7rem' }}
                                                                title="Relocate to another shelf"
                                                            >
                                                                <i className="bi bi-arrows-move me-1"></i>Move
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="small text-muted py-2 text-center bg-white rounded border">
                                                    No parcels stored on this shelf
                                                </div>
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="d-flex gap-2 mt-auto pt-2 border-top">
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setSelectedShelf(shelf);
                                                    setStatusAction(shelf.status === 'MAINTENANCE' ? 'ACTIVE' : 'MAINTENANCE');
                                                    setMaintenanceNotes(shelf.maintenance_notes || '');
                                                }}
                                                className={`btn btn-sm flex-fill ${shelf.status === 'ACTIVE' ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                            >
                                                <i className="bi bi-tools me-1"></i>
                                                {shelf.status === 'ACTIVE' ? 'Set Maintenance' : 'Activate Shelf'}
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleViewHistory(shelf)}
                                                className="btn btn-sm btn-outline-secondary"
                                                title="View assignment & relocation history"
                                            >
                                                <i className="bi bi-clock-history"></i> History
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Assignment & Relocation History Table */}
            <div className="gv-card border rounded-3 bg-white shadow-sm p-4">
                <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                    <i className="bi bi-clock-history text-primary"></i> Recent Shelf Allocation & Relocation Log
                </h5>
                {recentHistory.length > 0 ? (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small text-muted text-uppercase">
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Parcel ID</th>
                                    <th>Action</th>
                                    <th>Previous Shelf</th>
                                    <th>Assigned Shelf</th>
                                    <th>Guard</th>
                                    <th>Reason / Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentHistory.map(h => (
                                    <tr key={h.id}>
                                        <td className="small text-muted">
                                            {new Date(h.timestamp).toLocaleString()}
                                        </td>
                                        <td className="fw-semibold text-dark">{h.parcel_id_str}</td>
                                        <td>
                                            <span className={`badge ${
                                                h.action_type === 'INITIAL_INTAKE' ? 'bg-primary' : 
                                                h.action_type === 'RELOCATION' ? 'bg-info text-dark' : 
                                                h.action_type === 'HANDOVER_RELEASE' ? 'bg-success' : 'bg-warning text-dark'
                                            }`}>
                                                {h.action_type_display || h.action_type}
                                            </span>
                                        </td>
                                        <td className="text-muted">{h.previous_shelf_name || 'None'}</td>
                                        <td className="fw-semibold text-dark">{h.new_shelf_name || 'None (Released)'}</td>
                                        <td className="small">{h.guard_name}</td>
                                        <td className="small text-muted">{h.reason || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted small">
                        No shelf movements or assignment logs recorded yet.
                    </div>
                )}
            </div>

            {/* Maintenance Modal */}
            {selectedShelf && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-3 shadow">
                            <form onSubmit={handleUpdateStatus}>
                                <div className="modal-header border-bottom">
                                    <h5 className="modal-title fw-bold">
                                        Update Shelf Status: {selectedShelf.name}
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setSelectedShelf(null)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">New Operational Status</label>
                                        <select 
                                            className="form-select"
                                            value={statusAction}
                                            onChange={(e) => setStatusAction(e.target.value)}
                                        >
                                            <option value="ACTIVE">ACTIVE (Accepts parcels and reservations)</option>
                                            <option value="MAINTENANCE">UNDER MAINTENANCE (Excludes from recommendations)</option>
                                            <option value="INACTIVE">INACTIVE (Disabled)</option>
                                        </select>
                                    </div>

                                    {statusAction !== 'ACTIVE' && selectedShelf.occupied > 0 && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                            <strong>Warning:</strong> Shelf currently contains {selectedShelf.occupied} active parcel(s). System safety rules prevent setting under maintenance or inactive until all parcels are relocated.
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Maintenance Notes / Guidelines</label>
                                        <textarea 
                                            className="form-control"
                                            rows="3"
                                            placeholder="e.g., Routine cleaning, hardware repair, reserved for high-priority logistics"
                                            value={maintenanceNotes}
                                            onChange={(e) => setMaintenanceNotes(e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setSelectedShelf(null)}>
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={statusUpdating || (statusAction !== 'ACTIVE' && selectedShelf.occupied > 0)}
                                    >
                                        {statusUpdating ? 'Updating...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Relocation Modal */}
            {relocatingParcel && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-3 shadow">
                            <form onSubmit={handleRelocateParcel}>
                                <div className="modal-header border-bottom">
                                    <h5 className="modal-title fw-bold">
                                        Relocate Parcel {relocatingParcel.parcel_id}
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setRelocatingParcel(null)}></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3 p-2 bg-light rounded border small">
                                        <div><strong>Carrier:</strong> {relocatingParcel.carrier_name}</div>
                                        <div><strong>Parcel Size:</strong> {relocatingParcel.parcel_size}</div>
                                        <div><strong>Destination Flat:</strong> {relocatingParcel.flat_number}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Destination Storage Shelf <span className="text-danger">*</span></label>
                                        <select 
                                            className="form-select"
                                            value={destinationShelfId}
                                            onChange={(e) => setDestinationShelfId(e.target.value)}
                                            required
                                        >
                                            <option value="">Select Destination Shelf...</option>
                                            {shelves
                                                .filter(s => s.status === 'ACTIVE' && !s.is_full)
                                                .map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name} [{s.max_parcel_size} Tier] &mdash; {s.available} / {s.capacity} available
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Reason for Relocation</label>
                                        <input 
                                            type="text" 
                                            className="form-control"
                                            placeholder="e.g., Space consolidation, shelf maintenance, oversized load"
                                            value={relocationReason}
                                            onChange={(e) => setRelocationReason(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setRelocatingParcel(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary" disabled={relocating || !destinationShelfId}>
                                        {relocating ? 'Relocating...' : 'Confirm Relocation'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Shelf History Modal */}
            {historyShelf && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content rounded-3 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold">
                                    Allocation History for {historyShelf.name}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setHistoryShelf(null)}></button>
                            </div>
                            <div className="modal-body p-0">
                                {historyLoading ? (
                                    <div className="text-center py-4">
                                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                        <div className="small text-muted mt-2">Loading movement logs...</div>
                                    </div>
                                ) : shelfHistoryLogs.length > 0 ? (
                                    <div className="table-responsive" style={{ maxHeight: '350px' }}>
                                        <table className="table table-hover table-striped align-middle mb-0 small">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Date/Time</th>
                                                    <th>Parcel ID</th>
                                                    <th>Action</th>
                                                    <th>Previous</th>
                                                    <th>New</th>
                                                    <th>Guard</th>
                                                    <th>Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {shelfHistoryLogs.map(l => (
                                                    <tr key={l.id}>
                                                        <td className="text-muted">{new Date(l.timestamp).toLocaleString()}</td>
                                                        <td className="fw-semibold">{l.parcel_id_str}</td>
                                                        <td>
                                                            <span className="badge bg-secondary">{l.action_type_display}</span>
                                                        </td>
                                                        <td>{l.previous_shelf_name || '-'}</td>
                                                        <td className="fw-medium text-dark">{l.new_shelf_name || 'Handed Over'}</td>
                                                        <td>{l.guard_name}</td>
                                                        <td className="text-muted">{l.reason || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-muted small">
                                        No historical allocations or movements recorded for this shelf.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-light" onClick={() => setHistoryShelf(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminShelves;

