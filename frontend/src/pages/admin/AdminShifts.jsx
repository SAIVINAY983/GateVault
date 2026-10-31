import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const AdminShifts = () => {
    const [shifts, setShifts] = useState([]);
    const [metrics, setMetrics] = useState({
        total_shifts: 0,
        active_shifts: 0,
        pending_handovers: 0,
        completed_shifts: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [guardFilter, setGuardFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Modal state for viewing report
    const [selectedShift, setSelectedShift] = useState(null);
    const [shiftReport, setShiftReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Modal state for Admin Exception Force-Accept
    const [overrideShift, setOverrideShift] = useState(null);
    const [overrideReason, setOverrideReason] = useState('');
    const [overrideError, setOverrideError] = useState('');
    const [submittingOverride, setSubmittingOverride] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const fetchShifts = async () => {
        try {
            setLoading(true);
            setError('');
            const params = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (guardFilter.trim()) params.guard = guardFilter.trim();
            if (dateFilter) params.date = dateFilter;

            const res = await axiosInstance.get('admin/shifts/', { params });
            setShifts(res.data.shifts || []);
            if (res.data.metrics) {
                setMetrics(res.data.metrics);
            }
        } catch (err) {
            console.error('Failed to load shifts', err);
            setError(err.response?.data?.error || 'Failed to load shift records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [statusFilter, dateFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchShifts();
    };

    const handleClearFilters = () => {
        setStatusFilter('ALL');
        setGuardFilter('');
        setDateFilter('');
    };

    const openReportModal = async (shift) => {
        setSelectedShift(shift);
        if (shift.summary_data) {
            setShiftReport(shift.summary_data);
        } else {
            try {
                setReportLoading(true);
                const res = await axiosInstance.get(`guard/shifts/${shift.id}/report/`);
                setShiftReport(res.data.report);
            } catch (err) {
                console.error('Failed to load shift report', err);
            } finally {
                setReportLoading(false);
            }
        }
    };

    const handleForceAccept = async (e) => {
        e.preventDefault();
        if (!overrideReason.trim()) {
            setOverrideError('A mandatory reason is required for administrative handover override.');
            return;
        }

        try {
            setSubmittingOverride(true);
            setOverrideError('');
            await axiosInstance.post(`admin/shifts/${overrideShift.id}/force-accept/`, {
                reason: overrideReason.trim()
            });
            setSuccessMessage(`Shift #${overrideShift.id} was successfully accepted via admin exception override.`);
            setOverrideShift(null);
            setOverrideReason('');
            fetchShifts();
            setTimeout(() => setSuccessMessage(''), 6000);
        } catch (err) {
            setOverrideError(err.response?.data?.error || 'Failed to apply admin exception override.');
        } finally {
            setSubmittingOverride(false);
        }
    };

    const getStatusBadge = (status, isOverride) => {
        if (status === 'ACTIVE') {
            return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-broadcast me-1"></i>Active</span>;
        }
        if (status === 'HANDED_OVER') {
            return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-clock-history me-1"></i>Pending Handover</span>;
        }
        if (status === 'COMPLETED') {
            return (
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1">
                    <i className="bi bi-check2-circle me-1"></i>Completed {isOverride && <span className="text-danger fw-bold">(Override)</span>}
                </span>
            );
        }
        return <span className="badge bg-secondary">{status}</span>;
    };

    return (
        <div className="container-fluid px-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Guard Shift & Handover Management</h2>
                    <p className="text-muted mb-0">Track guard active shifts, digital handovers, operational summaries, and exception overrides.</p>
                </div>
                <div>
                    <button onClick={fetchShifts} className="btn btn-outline-primary d-flex align-items-center gap-2">
                        <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
            </div>

            {successMessage && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>{successMessage}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setSuccessMessage('')}></button>
                </div>
            )}

            {/* Metrics Cards */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-start border-4 border-primary">
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Total Shifts</div>
                        <h3 className="fw-bold mb-0 mt-1">{metrics.total_shifts}</h3>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-start border-4 border-success">
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Active Shifts</div>
                        <h3 className="fw-bold mb-0 mt-1 text-success">{metrics.active_shifts}</h3>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-start border-4 border-warning">
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Pending Handovers</div>
                        <h3 className="fw-bold mb-0 mt-1 text-warning">{metrics.pending_handovers}</h3>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-start border-4 border-info">
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Completed Shifts</div>
                        <h3 className="fw-bold mb-0 mt-1 text-info">{metrics.completed_shifts}</h3>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="gv-card p-3 mb-4">
                <div className="row g-3 align-items-end">
                    <div className="col-12 col-md-4">
                        <label className="form-label small fw-semibold text-muted">Search Guard</label>
                        <form onSubmit={handleSearchSubmit} className="input-group">
                            <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
                            <input
                                type="text"
                                className="form-control border-start-0 ps-0"
                                placeholder="Guard username or name..."
                                value={guardFilter}
                                onChange={(e) => setGuardFilter(e.target.value)}
                            />
                            <button className="btn btn-outline-secondary" type="submit">Search</button>
                        </form>
                    </div>

                    <div className="col-6 col-md-3">
                        <label className="form-label small fw-semibold text-muted">Status</label>
                        <select 
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ACTIVE">Active Shifts</option>
                            <option value="HANDED_OVER">Pending Handovers</option>
                            <option value="COMPLETED">Completed Shifts</option>
                        </select>
                    </div>

                    <div className="col-6 col-md-3">
                        <label className="form-label small fw-semibold text-muted">Date</label>
                        <input
                            type="date"
                            className="form-control"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                        />
                    </div>

                    <div className="col-12 col-md-2 text-md-end">
                        <button onClick={handleClearFilters} className="btn btn-light w-100 border text-muted">
                            <i className="bi bi-x-circle me-1"></i> Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Table of Shifts */}
            <div className="gv-card overflow-hidden">
                <div className="card-header bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
                    <h5 className="fw-bold mb-0">Shift Logs & Records</h5>
                    <span className="badge bg-primary rounded-pill">{shifts.length} Records</span>
                </div>

                {loading ? (
                    <div className="p-5 text-center">
                        <LoadingSpinner message="Loading shift history..." />
                    </div>
                ) : error ? (
                    <div className="p-4">
                        <ErrorState message={error} onRetry={fetchShifts} />
                    </div>
                ) : shifts.length === 0 ? (
                    <div className="p-4">
                        <EmptyState 
                            icon="bi-shield-check" 
                            title="No shifts found" 
                            message="No guard shift records match the selected criteria." 
                        />
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold">Shift #</th>
                                    <th className="py-3 fw-semibold">Guard</th>
                                    <th className="py-3 fw-semibold">Start Time</th>
                                    <th className="py-3 fw-semibold">End Time</th>
                                    <th className="py-3 fw-semibold">Duration</th>
                                    <th className="py-3 fw-semibold">Status</th>
                                    <th className="py-3 fw-semibold">Handover / Accept Details</th>
                                    <th className="pe-4 py-3 fw-semibold text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shifts.map((shift) => (
                                    <tr key={shift.id}>
                                        <td className="ps-4 py-3 fw-bold text-dark">#{shift.id}</td>
                                        <td className="py-3">
                                            <div className="fw-semibold text-dark">{shift.guard_name}</div>
                                            <div className="small text-muted">@{shift.guard_username}</div>
                                        </td>
                                        <td className="py-3 small">
                                            {new Date(shift.shift_start).toLocaleDateString()}{' '}
                                            <span className="text-muted">{new Date(shift.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="py-3 small">
                                            {shift.shift_end ? (
                                                <>
                                                    {new Date(shift.shift_end).toLocaleDateString()}{' '}
                                                    <span className="text-muted">{new Date(shift.shift_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </>
                                            ) : (
                                                <span className="badge bg-success bg-opacity-25 text-success">In Progress</span>
                                            )}
                                        </td>
                                        <td className="py-3">
                                            <span className="badge bg-light text-dark border">{shift.duration_display}</span>
                                        </td>
                                        <td className="py-3">
                                            {getStatusBadge(shift.status, shift.is_admin_override)}
                                        </td>
                                        <td className="py-3 small">
                                            {shift.status === 'COMPLETED' ? (
                                                <div>
                                                    <span className="fw-medium text-dark">Accepted by {shift.accepted_by_name || 'Guard'}</span>
                                                    {shift.is_admin_override && (
                                                        <div className="text-danger small mt-1">
                                                            <i className="bi bi-shield-exclamation me-1"></i>
                                                            Admin Override: {shift.admin_override_reason}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : shift.status === 'HANDED_OVER' ? (
                                                <span className="text-warning fw-medium">
                                                    <i className="bi bi-exclamation-circle me-1"></i>
                                                    Awaiting incoming guard
                                                </span>
                                            ) : (
                                                <span className="text-muted">On Gatehouse duty</span>
                                            )}
                                            {shift.handover_notes && (
                                                <div className="text-muted fst-italic small text-truncate mt-1" style={{ maxWidth: '240px' }} title={shift.handover_notes}>
                                                    "{shift.handover_notes}"
                                                </div>
                                            )}
                                        </td>
                                        <td className="pe-4 py-3 text-end">
                                            <div className="d-flex justify-content-end gap-2">
                                                <button
                                                    onClick={() => openReportModal(shift)}
                                                    className="btn btn-sm btn-outline-info"
                                                    title="View Full Handover Report"
                                                >
                                                    <i className="bi bi-file-earmark-text me-1"></i> Report
                                                </button>
                                                {shift.status === 'HANDED_OVER' && (
                                                    <button
                                                        onClick={() => {
                                                            setOverrideShift(shift);
                                                            setOverrideReason('');
                                                            setOverrideError('');
                                                        }}
                                                        className="btn btn-sm btn-outline-danger"
                                                        title="Force Accept via Admin Exception"
                                                    >
                                                        <i className="bi bi-shield-lock me-1"></i> Override
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Handover Report Modal */}
            {selectedShift && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-light border-bottom">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark">Shift Handover Report #{selectedShift.id}</h5>
                                    <div className="text-muted small">
                                        Guard: <span className="fw-semibold text-dark">{selectedShift.guard_name}</span> | Duration: <span className="fw-semibold">{selectedShift.duration_display}</span>
                                    </div>
                                </div>
                                <button type="button" className="btn-close" onClick={() => { setSelectedShift(null); setShiftReport(null); }}></button>
                            </div>
                            <div className="modal-body p-4">
                                {reportLoading ? (
                                    <div className="text-center py-4">
                                        <LoadingSpinner message="Compiling shift operational snapshot..." />
                                    </div>
                                ) : shiftReport ? (
                                    <div>
                                        {/* Status & Timing */}
                                        <div className="d-flex flex-wrap align-items-center justify-content-between p-3 rounded bg-light border mb-4">
                                            <div>
                                                <div className="text-muted small">Shift Window</div>
                                                <div className="fw-medium text-dark">
                                                    {new Date(selectedShift.shift_start).toLocaleString()} -{' '}
                                                    {selectedShift.shift_end ? new Date(selectedShift.shift_end).toLocaleString() : 'Ongoing'}
                                                </div>
                                            </div>
                                            <div>
                                                {getStatusBadge(selectedShift.status, selectedShift.is_admin_override)}
                                            </div>
                                        </div>

                                        {/* Outgoing Guard Remarks */}
                                        {selectedShift.handover_notes && (
                                            <div className="alert alert-info border-info mb-4">
                                                <div className="fw-bold small text-uppercase mb-1"><i className="bi bi-chat-left-quote me-1"></i> Guard Handover Remarks</div>
                                                <div>{selectedShift.handover_notes}</div>
                                            </div>
                                        )}

                                        {/* Operational Metrics Grid */}
                                        <h6 className="fw-bold text-dark mb-3">Operational Summary at Shift Handover</h6>
                                        <div className="row g-3 mb-4">
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Pending Parcels</div>
                                                    <div className="fs-4 fw-bold text-warning">{shiftReport.pending_parcels}</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Overdue Parcels</div>
                                                    <div className="fs-4 fw-bold text-danger">{shiftReport.overdue_parcels}</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Damaged / Tampered</div>
                                                    <div className="fs-4 fw-bold text-danger">{shiftReport.damaged_parcels}</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Open Incidents</div>
                                                    <div className="fs-4 fw-bold text-danger">{shiftReport.open_incidents}</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Pending COD Records</div>
                                                    <div className="fs-4 fw-bold text-primary">{shiftReport.pending_cod_parcels}</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Shelf Occupancy</div>
                                                    <div className="fs-4 fw-bold text-secondary">
                                                        {shiftReport.shelf_occupancy?.occupancy_pct || 0}%
                                                    </div>
                                                    <div className="small text-muted">{shiftReport.shelf_occupancy?.total_occupied || 0} / {shiftReport.shelf_occupancy?.total_capacity || 0} slots</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Parcels Received</div>
                                                    <div className="fs-4 fw-bold text-primary">{shiftReport.parcels_received_count}</div>
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3">
                                                <div className="p-3 border rounded bg-white text-center">
                                                    <div className="text-muted small">Parcels Handed Over</div>
                                                    <div className="fs-4 fw-bold text-success">{shiftReport.parcels_handed_over_count}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Shift Activity Breakdown */}
                                        <div className="mb-4">
                                            <h6 className="fw-bold text-dark mb-2">Parcels Intake Activity During Shift ({shiftReport.parcels_received?.length || 0})</h6>
                                            {(!shiftReport.parcels_received || shiftReport.parcels_received.length === 0) ? (
                                                <p className="text-muted small fst-italic">No parcels were received during this shift.</p>
                                            ) : (
                                                <div className="table-responsive border rounded">
                                                    <table className="table table-sm table-hover mb-0">
                                                        <thead className="bg-light small">
                                                            <tr>
                                                                <th>Parcel ID</th>
                                                                <th>Flat</th>
                                                                <th>Carrier</th>
                                                                <th>Condition</th>
                                                                <th>Time</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="small">
                                                            {shiftReport.parcels_received.map((p) => (
                                                                <tr key={p.id}>
                                                                    <td className="fw-semibold">{p.parcel_id}</td>
                                                                    <td>{p.flat}</td>
                                                                    <td>{p.carrier}</td>
                                                                    <td>
                                                                        <span className={`badge ${p.condition === 'INTACT' ? 'bg-success' : 'bg-danger'}`}>
                                                                            {p.condition}
                                                                        </span>
                                                                    </td>
                                                                    <td>{p.received_at ? new Date(p.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h6 className="fw-bold text-dark mb-2">Parcels Handover Activity During Shift ({shiftReport.parcels_handed_over?.length || 0})</h6>
                                            {(!shiftReport.parcels_handed_over || shiftReport.parcels_handed_over.length === 0) ? (
                                                <p className="text-muted small fst-italic">No parcels were handed over during this shift.</p>
                                            ) : (
                                                <div className="table-responsive border rounded">
                                                    <table className="table table-sm table-hover mb-0">
                                                        <thead className="bg-light small">
                                                            <tr>
                                                                <th>Parcel ID</th>
                                                                <th>Flat</th>
                                                                <th>Collected By</th>
                                                                <th>Role</th>
                                                                <th>Time</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="small">
                                                            {shiftReport.parcels_handed_over.map((p) => (
                                                                <tr key={p.id}>
                                                                    <td className="fw-semibold">{p.parcel_id}</td>
                                                                    <td>{p.flat}</td>
                                                                    <td>{p.collector}</td>
                                                                    <td><span className="badge bg-light text-dark border">{p.collector_role}</span></td>
                                                                    <td>{p.handed_over_at ? new Date(p.handed_over_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted">No report data available for this shift.</p>
                                )}
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => { setSelectedShift(null); setShiftReport(null); }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Exception Override Modal */}
            {overrideShift && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
                    <div className="modal-dialog">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleForceAccept}>
                                <div className="modal-header bg-danger text-white">
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-shield-exclamation me-2"></i>
                                        Admin Exception Override: Shift #{overrideShift.id}
                                    </h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setOverrideShift(null)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="alert alert-warning mb-3 small">
                                        <strong>Notice:</strong> This administrative override force-accepts the shift handover when an incoming guard or the outgoing guard is unavailable. A mandatory documented justification is recorded for compliance audit.
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">Shift Details</label>
                                        <div className="p-2 rounded bg-light border small">
                                            <div><strong>Guard:</strong> {overrideShift.guard_name} (@{overrideShift.guard_username})</div>
                                            <div><strong>Shift Duration:</strong> {overrideShift.duration_display}</div>
                                            <div><strong>Status:</strong> {overrideShift.status}</div>
                                        </div>
                                    </div>

                                    {overrideError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            {overrideError}
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-dark">
                                            Mandatory Administrative Override Reason <span className="text-danger">*</span>
                                        </label>
                                        <textarea
                                            rows="4"
                                            className="form-control"
                                            placeholder="Explain why this shift is being force-accepted by administrator (e.g., incoming guard delayed due to emergency, relief guard shift assigned)..."
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light border-top">
                                    <button type="button" className="btn btn-light border" onClick={() => setOverrideShift(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={submittingOverride} className="btn btn-danger d-flex align-items-center gap-2">
                                        {submittingOverride ? <LoadingSpinner message="Applying..." /> : <>
                                            <i className="bi bi-shield-check"></i> Confirm Exception Override
                                        </>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminShifts;

