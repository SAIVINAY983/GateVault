import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const GuardDashboard = () => {
    const [parcels, setParcels] = useState([]);
    const [expectedDeliveries, setExpectedDeliveries] = useState([]);
    const [activeAlertsCount, setActiveAlertsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedExpected, setSelectedExpected] = useState(null);
    const navigate = useNavigate();

    // Shift Management State
    const [shiftData, setShiftData] = useState({
        active_shift: null,
        live_report: null,
        pending_handover: null,
        recent_shifts: []
    });
    const [elapsedTime, setElapsedTime] = useState('00:00:00');
    const [shiftActionLoading, setShiftActionLoading] = useState(false);
    const [shiftSuccessMsg, setShiftSuccessMsg] = useState('');
    const [shiftErrorMsg, setShiftErrorMsg] = useState('');

    // Modals
    const [showStartModal, setShowStartModal] = useState(false);
    const [startNotes, setStartNotes] = useState('');
    const [showEndModal, setShowEndModal] = useState(false);
    const [endNotes, setEndNotes] = useState('');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [viewingPastReport, setViewingPastReport] = useState(null);
    const [showHistory, setShowHistory] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError('');
            const [parcelsRes, expectedRes, shiftsRes, alertsRes] = await Promise.all([
                axiosInstance.get('parcels/pending/'),
                axiosInstance.get('expected-deliveries/'),
                axiosInstance.get('guard/shifts/current/'),
                axiosInstance.get('alerts/?status=OPEN').catch(() => ({ data: [] }))
            ]);
            setParcels(parcelsRes.data);
            
            // Only show active expected deliveries for today or earlier
            const activeExpected = expectedRes.data.filter(e => e.status === 'EXPECTED');
            setExpectedDeliveries(activeExpected);

            setShiftData(shiftsRes.data);
            if (Array.isArray(alertsRes.data)) {
                setActiveAlertsCount(alertsRes.data.length);
            }
        } catch (err) {
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const fetchShiftData = async () => {
        try {
            const res = await axiosInstance.get('guard/shifts/current/');
            setShiftData(res.data);
        } catch (err) {
            console.error('Failed to refresh shift status', err);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Live Shift Timer
    useEffect(() => {
        if (!shiftData.active_shift?.shift_start) {
            setElapsedTime('00:00:00');
            return;
        }

        const updateTimer = () => {
            const startTime = new Date(shiftData.active_shift.shift_start).getTime();
            const now = Date.now();
            const diffSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
            const hours = Math.floor(diffSeconds / 3600);
            const minutes = Math.floor((diffSeconds % 3600) / 60);
            const seconds = diffSeconds % 60;
            setElapsedTime(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [shiftData.active_shift]);

    // Handle Start Shift
    const handleStartShift = async (e) => {
        e.preventDefault();
        try {
            setShiftActionLoading(true);
            setShiftErrorMsg('');
            await axiosInstance.post('guard/shifts/start/', {
                handover_notes: startNotes.trim()
            });
            setShowStartModal(false);
            setStartNotes('');
            setShiftSuccessMsg('Shift started successfully! Gatehouse live timer active.');
            await fetchShiftData();
            setTimeout(() => setShiftSuccessMsg(''), 5000);
        } catch (err) {
            setShiftErrorMsg(err.response?.data?.error || 'Failed to start shift');
        } finally {
            setShiftActionLoading(false);
        }
    };

    // Handle End Shift & Handover
    const handleEndShift = async (e) => {
        e.preventDefault();
        if (!shiftData.active_shift) return;

        try {
            setShiftActionLoading(true);
            setShiftErrorMsg('');
            await axiosInstance.post(`guard/shifts/${shiftData.active_shift.id}/handover/`, {
                handover_notes: endNotes.trim()
            });
            setShowEndModal(false);
            setEndNotes('');
            setShiftSuccessMsg('Shift concluded and digital handover report generated for incoming guard.');
            await fetchShiftData();
            setTimeout(() => setShiftSuccessMsg(''), 6000);
        } catch (err) {
            setShiftErrorMsg(err.response?.data?.error || 'Failed to submit shift handover');
        } finally {
            setShiftActionLoading(false);
        }
    };

    // Handle Accept Handover
    const handleAcceptHandover = async () => {
        if (!shiftData.pending_handover) return;

        try {
            setShiftActionLoading(true);
            setShiftErrorMsg('');
            await axiosInstance.post(`guard/shifts/${shiftData.pending_handover.id}/accept/`);
            setShowReviewModal(false);
            setShiftSuccessMsg(`Shift handover from ${shiftData.pending_handover.guard_name} successfully accepted!`);
            await fetchShiftData();
            setTimeout(() => setShiftSuccessMsg(''), 6000);
        } catch (err) {
            setShiftErrorMsg(err.response?.data?.error || 'Failed to accept handover');
        } finally {
            setShiftActionLoading(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading gatehouse data..." />;
    if (error) return <ErrorState message={error} onRetry={fetchDashboardData} />;

    const activeShift = shiftData.active_shift;
    const pendingHandover = shiftData.pending_handover;
    const liveReport = shiftData.live_report;

    return (
        <div className="container-fluid px-0">
            {/* Page Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Gatehouse Operations</h2>
                    <p className="text-muted mb-0">Manage incoming deliveries, guard shift digital handovers, and resident parcel pickups.</p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                    <button onClick={() => navigate('/guard/alerts')} className="btn btn-outline-danger position-relative d-flex align-items-center gap-2">
                        <i className="bi bi-shield-exclamation"></i>
                        Priority Alerts
                        {activeAlertsCount > 0 && (
                            <span className="badge rounded-pill bg-danger ms-1">
                                {activeAlertsCount}
                            </span>
                        )}
                    </button>
                    <button onClick={() => navigate('/guard/intake')} className="gv-btn-primary d-flex align-items-center gap-2">
                        <i className="bi bi-plus-circle"></i>
                        Receive Parcel
                    </button>
                    <button onClick={() => navigate('/guard/verify')} className="gv-btn-accent d-flex align-items-center gap-2">
                        <i className="bi bi-qr-code-scan"></i>
                        Verify Pickup
                    </button>
                </div>
            </div>

            {/* Notification Messages */}
            {shiftSuccessMsg && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>{shiftSuccessMsg}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setShiftSuccessMsg('')}></button>
                </div>
            )}

            {shiftErrorMsg && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-exclamation-triangle-fill fs-5"></i>
                    <div>{shiftErrorMsg}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setShiftErrorMsg('')}></button>
                </div>
            )}

            {/* ACTIVE PRIORITY ALERTS BANNER */}
            {activeAlertsCount > 0 && (
                <div className="alert alert-danger border-danger border-2 p-3 mb-4 rounded-3 shadow-sm d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <i className="bi bi-exclamation-octagon-fill fs-2 text-danger"></i>
                        <div>
                            <h6 className="fw-bold text-danger mb-0">Active Priority & Security Alerts</h6>
                            <p className="mb-0 text-dark small">There {activeAlertsCount === 1 ? 'is 1 active alert' : `are ${activeAlertsCount} active alerts`} requiring gatehouse attention or acknowledgment.</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/guard/alerts')} className="btn btn-danger btn-sm fw-semibold">
                        View Alerts ({activeAlertsCount})
                    </button>
                </div>
            )}

            {/* PENDING SHIFT HANDOVER ALERT (Incoming Guard Workflow) */}
            {pendingHandover && (
                <div className="alert alert-warning border-warning border-2 p-3 mb-4 rounded-3 shadow-sm">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                        <div className="d-flex align-items-start gap-3">
                            <i className="bi bi-clock-history fs-2 text-warning"></i>
                            <div>
                                <h5 className="fw-bold text-dark mb-1">
                                    Incoming Shift Handover Awaiting Acceptance
                                </h5>
                                <p className="mb-0 text-dark opacity-75 small">
                                    Guard <strong>{pendingHandover.guard_name}</strong> (@{pendingHandover.guard_username}) ended shift on{' '}
                                    {new Date(pendingHandover.shift_end || pendingHandover.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                                    {pendingHandover.summary_data && (
                                        <span className="ms-1">
                                            (Pending Parcels: <strong>{pendingHandover.summary_data.pending_parcels}</strong>, Damaged: <strong>{pendingHandover.summary_data.damaged_parcels}</strong>)
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowReviewModal(true)}
                            className="btn btn-warning text-dark fw-bold d-flex align-items-center gap-2 px-3 py-2 flex-shrink-0"
                        >
                            <i className="bi bi-clipboard-check"></i> Review & Accept Handover
                        </button>
                    </div>
                </div>
            )}

            {/* GUARD SHIFT MANAGEMENT SECTION */}
            <div className="gv-card p-4 mb-4 border-primary border-opacity-25 bg-white shadow-sm">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-3 border-bottom mb-3">
                    <div className="d-flex align-items-center gap-3">
                        <div className={`p-3 rounded-circle ${activeShift ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>
                            <i className={`bi ${activeShift ? 'bi-broadcast fs-3' : 'bi-person-badge fs-3'}`}></i>
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <h5 className="fw-bold text-dark mb-0">Guard Shift & Accountability</h5>
                                {activeShift ? (
                                    <span className="badge bg-success px-2 py-1">
                                        <i className="bi bi-circle-fill me-1 small"></i> Active Shift
                                    </span>
                                ) : (
                                    <span className="badge bg-secondary px-2 py-1">Off-Duty</span>
                                )}
                            </div>
                            <p className="text-muted small mb-0 mt-1">
                                {activeShift ? (
                                    <>
                                        Started at <strong>{new Date(activeShift.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> ({new Date(activeShift.shift_start).toLocaleDateString()})
                                    </>
                                ) : (
                                    'No active shift currently in progress. Start your shift to begin duty.'
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        {activeShift ? (
                            <>
                                <div className="text-end me-3 d-none d-sm-block">
                                    <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Shift Duration</small>
                                    <div className="fw-bold fs-4 text-primary font-monospace">{elapsedTime}</div>
                                </div>
                                <button
                                    onClick={() => setShowEndModal(true)}
                                    className="btn btn-outline-danger d-flex align-items-center gap-2 fw-semibold px-3 py-2"
                                >
                                    <i className="bi bi-box-arrow-right"></i> End Shift & Handover
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setShowStartModal(true)}
                                className="btn btn-success d-flex align-items-center gap-2 fw-semibold px-4 py-2"
                            >
                                <i className="bi bi-play-circle-fill"></i> Start Shift
                            </button>
                        )}
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="btn btn-light border text-muted d-flex align-items-center gap-1"
                            title="Toggle Shift History"
                        >
                            <i className="bi bi-clock-history"></i>
                            <span className="d-none d-md-inline">History</span>
                        </button>
                    </div>
                </div>

                {/* Live shift operational status cards (when active) */}
                {activeShift && liveReport && (
                    <div className="row g-2 pt-1">
                        <div className="col-6 col-md-2">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Received on Shift</small>
                                <strong className="fs-5 text-primary">{liveReport.parcels_received_count}</strong>
                            </div>
                        </div>
                        <div className="col-6 col-md-2">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Handed Over on Shift</small>
                                <strong className="fs-5 text-success">{liveReport.parcels_handed_over_count}</strong>
                            </div>
                        </div>
                        <div className="col-6 col-md-2">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Pending Parcels</small>
                                <strong className="fs-5 text-warning">{liveReport.pending_parcels}</strong>
                            </div>
                        </div>
                        <div className="col-6 col-md-2">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Overdue Parcels</small>
                                <strong className={`fs-5 ${liveReport.overdue_parcels > 0 ? 'text-danger' : 'text-muted'}`}>{liveReport.overdue_parcels}</strong>
                            </div>
                        </div>
                        <div className="col-6 col-md-2">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Damaged / Tampered</small>
                                <strong className={`fs-5 ${liveReport.damaged_parcels > 0 ? 'text-danger' : 'text-muted'}`}>{liveReport.damaged_parcels}</strong>
                            </div>
                        </div>
                        <div className="col-6 col-md-2">
                            <div className="p-2 border rounded bg-light text-center">
                                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Shelf Occupancy</small>
                                <strong className="fs-5 text-dark">{liveReport.shelf_occupancy?.occupancy_pct || 0}%</strong>
                            </div>
                        </div>
                    </div>
                )}

                {/* Collapsible Shift History */}
                {showHistory && (
                    <div className="mt-4 pt-3 border-top">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="fw-bold text-dark mb-0">My Recent Shifts</h6>
                            <small className="text-muted">Last {shiftData.recent_shifts?.length || 0} shifts</small>
                        </div>
                        {(!shiftData.recent_shifts || shiftData.recent_shifts.length === 0) ? (
                            <p className="text-muted small fst-italic mb-0">No past shift records found.</p>
                        ) : (
                            <div className="table-responsive border rounded mt-2">
                                <table className="table table-sm table-hover mb-0">
                                    <thead className="bg-light small">
                                        <tr>
                                            <th>Shift #</th>
                                            <th>Start Time</th>
                                            <th>End Time</th>
                                            <th>Duration</th>
                                            <th>Status</th>
                                            <th>Accepted By</th>
                                            <th className="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="small">
                                        {shiftData.recent_shifts.map((s) => (
                                            <tr key={s.id}>
                                                <td className="fw-semibold">#{s.id}</td>
                                                <td>{new Date(s.shift_start).toLocaleString()}</td>
                                                <td>{s.shift_end ? new Date(s.shift_end).toLocaleString() : 'In Progress'}</td>
                                                <td><span className="badge bg-light text-dark border">{s.duration_display}</span></td>
                                                <td>
                                                    <span className={`badge ${s.status === 'COMPLETED' ? 'bg-primary' : (s.status === 'ACTIVE' ? 'bg-success' : 'bg-warning text-dark')}`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td>{s.accepted_by_name || (s.status === 'COMPLETED' ? 'Admin' : '—')}</td>
                                                <td className="text-end">
                                                    <button
                                                        onClick={() => setViewingPastReport(s)}
                                                        className="btn btn-sm btn-link p-0 text-decoration-none"
                                                    >
                                                        View Report
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Standard Dashboard Quick Stats */}
            <div className="row g-3 mb-4">
                <div className="col-4 col-md-2">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-warning">
                        <h3 className="fw-bold mb-0 me-3">{parcels.filter(p => !p.is_overdue).length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Pending</div>
                    </div>
                </div>
                <div className="col-4 col-md-2">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-info">
                        <h3 className="fw-bold mb-0 me-3">{expectedDeliveries.length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Expected Today</div>
                    </div>
                </div>
                <div className="col-4 col-md-2">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-danger">
                        <h3 className="fw-bold mb-0 me-3">{parcels.filter(p => p.is_overdue).length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Overdue</div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-primary">
                        <h3 className="fw-bold mb-0 me-3">{parcels.filter(p => new Date(p.received_at).toDateString() === new Date().toDateString()).length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Received Today</div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-success">
                        <h3 className="fw-bold mb-0 me-3">
                            {liveReport ? liveReport.parcels_handed_over_count : '--'}
                        </h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Shift Handovers</div>
                    </div>
                </div>
            </div>

            {/* EXPECTED DELIVERIES SECTION */}
            <div className="gv-card overflow-hidden mb-5 border-info border-opacity-50">
                <div className="card-header bg-white p-3 border-bottom d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between">
                    <div>
                        <h5 className="fw-bold mb-0 text-info">EXPECTED DELIVERIES</h5>
                        <p className="text-muted small mb-0 mt-1">Deliveries residents have registered as expected.</p>
                    </div>
                    <span className="badge bg-info mt-2 mt-sm-0 rounded-pill text-dark">{expectedDeliveries.length} Expected</span>
                </div>
                
                {expectedDeliveries.length === 0 ? (
                    <div className="p-4">
                        <EmptyState 
                            icon="bi-box-seam" 
                            title="No expected deliveries." 
                            message="Residents have not registered any upcoming deliveries." 
                        />
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 border-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold border-bottom-0">Resident</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Flat</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Tracking ID</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Courier</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Payment</th>
                                    <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody className="border-top-0">
                                {expectedDeliveries.map(exp => (
                                    <tr key={exp.id}>
                                        <td className="ps-4 py-3 fw-bold text-dark">{exp.resident_name}</td>
                                        <td className="py-3 text-muted">{exp.flat_display}</td>
                                        <td className="py-3 fw-medium">{exp.tracking_id}</td>
                                        <td className="py-3">
                                            {exp.courier_name}
                                            {exp.delivery_type === 'FOOD' && <span className="badge bg-warning text-dark ms-2">Food</span>}
                                        </td>
                                        <td className="py-3">
                                            {exp.payment_type === 'COD' ? (
                                                <span className="text-danger fw-semibold">COD (₹{exp.cod_amount})</span>
                                            ) : (
                                                <span className="text-success fw-semibold">Prepaid</span>
                                            )}
                                        </td>
                                        <td className="pe-4 py-3 text-end">
                                            <button onClick={() => setSelectedExpected(exp)} className="btn btn-sm btn-outline-info fw-medium">
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* PARCELS AWAITING PICKUP SECTION */}
            <div className="gv-card overflow-hidden">
                <div className="card-header bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
                    <h5 className="fw-bold mb-0">Parcels Awaiting Pickup</h5>
                    <span className="badge bg-primary rounded-pill">{parcels.length} Total</span>
                </div>
                
                {parcels.length === 0 ? (
                    <div className="p-4">
                        <EmptyState 
                            icon="bi-box2" 
                            title="No pending parcels" 
                            message="All parcels have been picked up or none are currently registered." 
                        />
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold">Parcel ID</th>
                                    <th className="py-3 fw-semibold">Flat</th>
                                    <th className="py-3 fw-semibold">Resident</th>
                                    <th className="py-3 fw-semibold">Carrier</th>
                                    <th className="py-3 fw-semibold">Condition</th>
                                    <th className="py-3 fw-semibold">Shelf</th>
                                    <th className="py-3 fw-semibold">Status</th>
                                    <th className="pe-4 py-3 fw-semibold text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parcels.map(p => (
                                    <tr key={p.id}>
                                        <td className="ps-4 py-3 fw-bold text-dark">{p.parcel_id}</td>
                                        <td className="py-3">{p.flat_display}</td>
                                        <td className="py-3">{p.resident_name || 'N/A'}</td>
                                        <td className="py-3">{p.carrier_name}</td>
                                        <td className="py-3">
                                            <span className={`badge ${p.condition === 'INTACT' ? 'bg-success' : (p.condition === 'DAMAGED' || p.condition === 'TAMPERED' ? 'bg-danger' : 'bg-warning text-dark')}`}>
                                                {p.condition || 'INTACT'}
                                            </span>
                                        </td>
                                        <td className="py-3 fw-medium">{p.shelf_name}</td>
                                        <td className="py-3"><StatusBadge status={p.status} isOverdue={p.is_overdue} /></td>
                                        <td className="pe-4 py-3 text-end">
                                            <button onClick={() => navigate('/guard/verify', { state: { parcel_id: p.parcel_id } })} className="btn btn-sm btn-outline-primary fw-medium">
                                                Verify
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* START SHIFT MODAL */}
            {showStartModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleStartShift}>
                                <div className="modal-header bg-success text-white">
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-play-circle-fill me-2"></i> Start Duty Shift
                                    </h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowStartModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <p className="text-muted small mb-3">
                                        Starting your shift establishes digital accountability for gatehouse intake, security condition inspections, and parcel pick-ups.
                                    </p>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold text-dark">Shift Start Remarks (Optional)</label>
                                        <textarea
                                            rows="3"
                                            className="form-control"
                                            placeholder="Note gatehouse status, weather, equipment or relief details..."
                                            value={startNotes}
                                            onChange={(e) => setStartNotes(e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light border-top">
                                    <button type="button" className="btn btn-light border" onClick={() => setShowStartModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={shiftActionLoading} className="btn btn-success d-flex align-items-center gap-2">
                                        {shiftActionLoading ? <LoadingSpinner message="Starting..." /> : <>
                                            <i className="bi bi-check-lg"></i> Begin Shift
                                        </>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* END SHIFT & HANDOVER MODAL */}
            {showEndModal && activeShift && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleEndShift}>
                                <div className="modal-header bg-danger text-white">
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-box-arrow-right me-2"></i> End Shift & Submit Digital Handover
                                    </h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowEndModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    <div className="alert alert-light border mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <strong className="text-dark">Shift Duration:</strong>
                                            <span className="badge bg-primary fs-6">{elapsedTime}</span>
                                        </div>
                                        <div className="text-muted small">
                                            Upon submission, an immutable digital handover snapshot will be compiled and made available for the incoming relief guard to review and accept.
                                        </div>
                                    </div>

                                    {/* Operational Snapshot Preview */}
                                    {liveReport && (
                                        <div className="mb-4">
                                            <h6 className="fw-bold text-dark mb-2">Current Gatehouse Operational State</h6>
                                            <div className="row g-2 text-center">
                                                <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Pending</small>
                                                    <strong className="text-warning fs-5">{liveReport.pending_parcels}</strong>
                                                </div>
                                                <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Overdue</small>
                                                    <strong className="text-danger fs-5">{liveReport.overdue_parcels}</strong>
                                                </div>
                                                <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Damaged</small>
                                                    <strong className="text-danger fs-5">{liveReport.damaged_parcels}</strong>
                                                </div>
                                                <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Incidents</small>
                                                    <strong className="text-danger fs-5">{liveReport.open_incidents}</strong>
                                                </div>
                                                <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Received</small>
                                                    <strong className="text-primary fs-5">{liveReport.parcels_received_count}</strong>
                                                </div>
                                                <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                                    <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Handed Over</small>
                                                    <strong className="text-success fs-5">{liveReport.parcels_handed_over_count}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label fw-bold small text-dark">
                                            Handover Remarks & Pending Operational Issues
                                        </label>
                                        <textarea
                                            rows="4"
                                            className="form-control"
                                            placeholder="Detail any unresolved parcels, expected high-priority deliveries, COD amounts pending, or specific instructions for the next guard..."
                                            value={endNotes}
                                            onChange={(e) => setEndNotes(e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light border-top">
                                    <button type="button" className="btn btn-light border" onClick={() => setShowEndModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={shiftActionLoading} className="btn btn-danger d-flex align-items-center gap-2">
                                        {shiftActionLoading ? <LoadingSpinner message="Submitting Handover..." /> : <>
                                            <i className="bi bi-clipboard-check"></i> Complete & Submit Handover
                                        </>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* INCOMING GUARD REVIEW & ACCEPT MODAL */}
            {showReviewModal && pendingHandover && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-warning text-dark">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-clipboard-check me-2"></i> Review Incoming Shift Handover #{pendingHandover.id}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowReviewModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex justify-content-between align-items-center p-3 rounded bg-light border mb-4">
                                    <div>
                                        <div className="text-muted small">Outgoing Guard</div>
                                        <div className="fw-bold fs-6 text-dark">{pendingHandover.guard_name} (@{pendingHandover.guard_username})</div>
                                    </div>
                                    <div>
                                        <div className="text-muted small">Shift Duration</div>
                                        <span className="badge bg-light text-dark border fs-6">{pendingHandover.duration_display}</span>
                                    </div>
                                </div>

                                {/* Outgoing Notes */}
                                {pendingHandover.handover_notes ? (
                                    <div className="alert alert-info border-info mb-4">
                                        <div className="fw-bold small text-uppercase mb-1"><i className="bi bi-chat-left-quote me-1"></i> Remarks from Outgoing Guard</div>
                                        <div>{pendingHandover.handover_notes}</div>
                                    </div>
                                ) : (
                                    <p className="text-muted small fst-italic mb-3">No specific remarks left by outgoing guard.</p>
                                )}

                                {/* Summary Grid */}
                                {pendingHandover.summary_data && (
                                    <div>
                                        <h6 className="fw-bold text-dark mb-3">Gatehouse Handover Operational Status</h6>
                                        <div className="row g-2 text-center mb-4">
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Pending Parcels</div>
                                                <div className="fs-4 fw-bold text-warning">{pendingHandover.summary_data.pending_parcels}</div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Overdue Parcels</div>
                                                <div className="fs-4 fw-bold text-danger">{pendingHandover.summary_data.overdue_parcels}</div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Damaged / Tampered</div>
                                                <div className="fs-4 fw-bold text-danger">{pendingHandover.summary_data.damaged_parcels}</div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Open Incidents</div>
                                                <div className="fs-4 fw-bold text-danger">{pendingHandover.summary_data.open_incidents}</div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Pending COD Records</div>
                                                <div className="fs-4 fw-bold text-primary">{pendingHandover.summary_data.pending_cod_parcels}</div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Shelf Occupancy</div>
                                                <div className="fs-4 fw-bold text-secondary">
                                                    {pendingHandover.summary_data.shelf_occupancy?.occupancy_pct || 0}%
                                                </div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Parcels Received</div>
                                                <div className="fs-4 fw-bold text-primary">{pendingHandover.summary_data.parcels_received_count}</div>
                                            </div>
                                            <div className="col-6 col-md-3 p-3 border rounded bg-white">
                                                <div className="text-muted small">Parcels Handed Over</div>
                                                <div className="fs-4 fw-bold text-success">{pendingHandover.summary_data.parcels_handed_over_count}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button type="button" className="btn btn-light border" onClick={() => setShowReviewModal(false)}>
                                    Dismiss
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAcceptHandover}
                                    disabled={shiftActionLoading}
                                    className="btn btn-warning text-dark fw-bold d-flex align-items-center gap-2"
                                >
                                    {shiftActionLoading ? <LoadingSpinner message="Accepting..." /> : <>
                                        <i className="bi bi-check2-circle"></i> Accept Handover & Assume Responsibility
                                    </>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAST REPORT VIEW MODAL */}
            {viewingPastReport && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-light border-bottom">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark">Shift #{viewingPastReport.id} Summary</h5>
                                    <div className="text-muted small">
                                        Duration: {viewingPastReport.duration_display} | Status: <span className="badge bg-secondary">{viewingPastReport.status}</span>
                                    </div>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setViewingPastReport(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {viewingPastReport.handover_notes && (
                                    <div className="alert alert-info mb-3">
                                        <strong>Notes:</strong> {viewingPastReport.handover_notes}
                                    </div>
                                )}
                                {viewingPastReport.summary_data ? (
                                    <div className="row g-2 text-center">
                                        <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                            <small className="text-muted d-block">Pending</small>
                                            <strong className="text-warning fs-5">{viewingPastReport.summary_data.pending_parcels}</strong>
                                        </div>
                                        <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                            <small className="text-muted d-block">Overdue</small>
                                            <strong className="text-danger fs-5">{viewingPastReport.summary_data.overdue_parcels}</strong>
                                        </div>
                                        <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                            <small className="text-muted d-block">Damaged</small>
                                            <strong className="text-danger fs-5">{viewingPastReport.summary_data.damaged_parcels}</strong>
                                        </div>
                                        <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                            <small className="text-muted d-block">Incidents</small>
                                            <strong className="text-danger fs-5">{viewingPastReport.summary_data.open_incidents}</strong>
                                        </div>
                                        <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                            <small className="text-muted d-block">Received</small>
                                            <strong className="text-primary fs-5">{viewingPastReport.summary_data.parcels_received_count}</strong>
                                        </div>
                                        <div className="col-4 col-md-2 p-2 border rounded bg-light">
                                            <small className="text-muted d-block">Handed Over</small>
                                            <strong className="text-success fs-5">{viewingPastReport.summary_data.parcels_handed_over_count}</strong>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted small fst-italic">No frozen snapshot recorded for this shift.</p>
                                )}
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => setViewingPastReport(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal for Expected Delivery */}
            {selectedExpected && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg overflow-hidden">
                            <div className="modal-header bg-light border-0 px-4 py-3">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-card-heading text-info me-2"></i>
                                    Expected Delivery Details
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedExpected(null)}></button>
                            </div>
                            <div className="modal-body px-4 py-4">
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Resident</small>
                                        <div className="fw-medium fs-6">{selectedExpected.resident_name}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Flat</small>
                                        <div className="fw-medium fs-6">{selectedExpected.flat_display}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Tracking ID</small>
                                        <div className="fw-medium text-dark">{selectedExpected.tracking_id}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Courier</small>
                                        <div className="fw-medium text-dark">{selectedExpected.courier_name}</div>
                                    </div>
                                    {selectedExpected.order_id && (
                                        <div className="col-6">
                                            <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Order ID</small>
                                            <div className="fw-medium text-dark">{selectedExpected.order_id}</div>
                                        </div>
                                    )}
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Payment</small>
                                        <div className={`fw-bold ${selectedExpected.payment_type === 'COD' ? 'text-danger' : 'text-success'}`}>
                                            {selectedExpected.payment_type === 'COD' ? `COD (₹${selectedExpected.cod_amount})` : 'Prepaid'}
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Expected Date</small>
                                        <div className="fw-medium text-dark">{new Date(selectedExpected.expected_delivery_date).toLocaleDateString('en-GB')}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Status</small>
                                        <div><span className="badge bg-info">{selectedExpected.status}</span></div>
                                    </div>
                                </div>
                                {selectedExpected.note && (
                                    <div className="mb-3 p-3 bg-light rounded border">
                                        <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.75rem' }}>Resident Note</small>
                                        <div>{selectedExpected.note}</div>
                                    </div>
                                )}
                                {selectedExpected.delivery_photo && (
                                    <div className="text-center">
                                        <a href={selectedExpected.delivery_photo} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary w-100">
                                            <i className="bi bi-image me-2"></i>View Delivery Screenshot
                                        </a>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-0 px-4 pb-4">
                                <button type="button" className="btn btn-light w-100 fw-medium border" onClick={() => setSelectedExpected(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardDashboard;
