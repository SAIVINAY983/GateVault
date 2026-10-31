import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CATEGORIES = [
    { id: 'SECURITY_EMERGENCY', label: 'Security Emergency' },
    { id: 'DAMAGED_PARCEL', label: 'Damaged Parcel' },
    { id: 'TAMPERED_PARCEL', label: 'Tampered Parcel' },
    { id: 'OVERDUE_PARCEL', label: 'Overdue Parcel' },
    { id: 'HIGH_VALUE_DELIVERY', label: 'High-Value Delivery' },
    { id: 'FOOD_DELIVERY_DELAY', label: 'Food Delivery Delay' },
    { id: 'GATEHOUSE_OPERATION', label: 'Gatehouse Operation' },
    { id: 'OTHER', label: 'Other Issue' },
];

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'];

const PRIORITY_COLORS = {
    CRITICAL: '#ef4444',
    HIGH: '#f59e0b',
    MEDIUM: '#06b6d4',
    LOW: '#64748b'
};

const CATEGORY_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#6366f1', '#a855f7', '#64748b'];

const AdminAlerts = () => {
    const [alerts, setAlerts] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [guardsList, setGuardsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [priorityFilter, setPriorityFilter] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Assign Modal
    const [assignItem, setAssignItem] = useState(null);
    const [selectedGuardId, setSelectedGuardId] = useState('');
    const [assignNotes, setAssignNotes] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);

    // Resolve / Dismiss Modal
    const [resolveItem, setResolveItem] = useState(null);
    const [resolveStatus, setResolveStatus] = useState('RESOLVED');
    const [resolveNotes, setResolveNotes] = useState('');
    const [resolveLoading, setResolveLoading] = useState(false);

    // Priority Change Modal
    const [priorityItem, setPriorityItem] = useState(null);
    const [newPriority, setNewPriority] = useState('HIGH');
    const [priorityNotes, setPriorityNotes] = useState('');
    const [priorityLoading, setPriorityLoading] = useState(false);

    // Detail & Timeline Modal
    const [detailAlert, setDetailAlert] = useState(null);

    const fetchGuards = async () => {
        try {
            const res = await axiosInstance.get('admin/users/');
            const guards = (res.data || []).filter(u => u.role === 'GUARD');
            setGuardsList(guards);
        } catch (err) {
            console.error("Failed to load guards", err);
        }
    };

    const fetchAnalytics = async () => {
        try {
            const res = await axiosInstance.get('admin/alert-analytics/');
            setAnalytics(res.data);
        } catch (err) {
            console.error("Failed to load alert analytics", err);
        }
    };

    const fetchAlerts = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (priorityFilter !== 'ALL') params.priority = priorityFilter;
            if (categoryFilter !== 'ALL') params.category = categoryFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            const res = await axiosInstance.get('admin/alerts/', { params });
            setAlerts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch emergency alerts.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGuards();
        fetchAnalytics();
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [statusFilter, priorityFilter, categoryFilter, dateFrom, dateTo]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchAlerts();
    };

    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (!assignItem || !selectedGuardId) return;
        setAssignLoading(true);

        try {
            await axiosInstance.post(`alerts/${assignItem.id}/assign/`, {
                guard_id: selectedGuardId,
                notes: assignNotes.trim()
            });
            setAssignItem(null);
            fetchAlerts();
            fetchAnalytics();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to assign alert.');
        } finally {
            setAssignLoading(false);
        }
    };

    const handleResolveSubmit = async (e) => {
        e.preventDefault();
        if (!resolveItem) return;
        setResolveLoading(true);

        try {
            await axiosInstance.patch(`alerts/${resolveItem.id}/status/`, {
                status: resolveStatus,
                notes: resolveNotes.trim()
            });
            setResolveItem(null);
            fetchAlerts();
            fetchAnalytics();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update alert status.');
        } finally {
            setResolveLoading(false);
        }
    };

    const handlePrioritySubmit = async (e) => {
        e.preventDefault();
        if (!priorityItem) return;
        setPriorityLoading(true);

        try {
            await axiosInstance.patch(`alerts/${priorityItem.id}/status/`, {
                status: priorityItem.status,
                priority: newPriority,
                notes: priorityNotes.trim() || `Priority adjusted to ${newPriority} by Administrator.`
            });
            setPriorityItem(null);
            fetchAlerts();
            fetchAnalytics();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to adjust priority.');
        } finally {
            setPriorityLoading(false);
        }
    };

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
            {/* HEADER */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">
                        <i className="bi bi-shield-exclamation text-danger me-2"></i>
                        Emergency & Priority Alerts Administration
                    </h2>
                    <p className="text-muted mb-0">Security oversight, priority dispatch, guard delegation, and resolution analytics.</p>
                </div>
                <button className="btn btn-outline-primary" onClick={() => { fetchAlerts(); fetchAnalytics(); }}>
                    <i className="bi bi-arrow-clockwise me-1"></i> Refresh Analytics
                </button>
            </div>

            {/* ANALYTICS KPI ROW */}
            {analytics && (
                <>
                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-4 col-xl-2">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-primary">
                                <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Total Alerts</div>
                                <div className="fs-3 fw-bold text-dark mt-1">{analytics.total_alerts}</div>
                                <small className="text-muted">All-time logged</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-danger">
                                <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Critical Emergencies</div>
                                <div className="fs-3 fw-bold text-danger mt-1">{analytics.critical_alerts}</div>
                                <small className="text-muted">High-severity</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-warning">
                                <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Open & Active</div>
                                <div className="fs-3 fw-bold text-warning mt-1">{analytics.open_alerts}</div>
                                <small className="text-muted">Requires action</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-success">
                                <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Resolved</div>
                                <div className="fs-3 fw-bold text-success mt-1">{analytics.resolved_alerts}</div>
                                <small className="text-muted">Successfully closed</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-info">
                                <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Avg Ack Time</div>
                                <div className="fs-3 fw-bold text-dark mt-1">{analytics.avg_acknowledgement_minutes}m</div>
                                <small className="text-muted">Guard response</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-4 col-xl-2">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-secondary">
                                <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Avg Resolution</div>
                                <div className="fs-3 fw-bold text-dark mt-1">{analytics.avg_resolution_minutes}m</div>
                                <small className="text-muted">Mean time to resolve</small>
                            </div>
                        </div>
                    </div>

                    {/* RECHARTS ROW */}
                    <div className="row g-4 mb-4">
                        <div className="col-12 col-lg-7">
                            <div className="gv-card p-4 bg-white shadow-sm h-100">
                                <h5 className="fw-bold mb-1">Alerts by Category</h5>
                                <p className="text-muted small mb-4">Frequency of alerts grouped by operational category</p>
                                <div style={{ height: '260px' }}>
                                    {analytics.by_category?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analytics.by_category} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="count" name="Alerts" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={36}>
                                                    {analytics.by_category.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="text-center text-muted small p-5">No category metrics available.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-lg-5">
                            <div className="gv-card p-4 bg-white shadow-sm h-100">
                                <h5 className="fw-bold mb-1">Priority Distribution</h5>
                                <p className="text-muted small mb-4">Proportion of alerts by severity tier</p>
                                <div style={{ height: '260px' }}>
                                    {analytics.by_priority?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={analytics.by_priority}
                                                    dataKey="count"
                                                    nameKey="label"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={85}
                                                    innerRadius={45}
                                                    paddingAngle={3}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {analytics.by_priority.map((entry) => (
                                                        <Cell key={`pri-${entry.priority}`} fill={PRIORITY_COLORS[entry.priority] || '#64748b'} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="text-center text-muted small p-5">No priority metrics available.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* SEARCH & FILTERS BAR */}
            <div className="gv-card p-3 bg-white shadow-sm mb-4">
                <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
                    <div className="col-12 col-md-3">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-end-0 text-muted"><i className="bi bi-search"></i></span>
                            <input 
                                type="text" 
                                className="form-control border-start-0" 
                                placeholder="Search Title, Parcel ID, Tracking..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-6 col-md-2">
                        <select className="form-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                            <option value="ALL">All Priorities</option>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="ALL">All Statuses</option>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                            <option value="ALL">All Categories</option>
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <input 
                            type="date" 
                            className="form-control" 
                            value={dateFrom} 
                            onChange={(e) => setDateFrom(e.target.value)} 
                            title="From Date" 
                        />
                    </div>

                    <div className="col-12 col-md-1 d-flex gap-1">
                        <button type="submit" className="btn btn-primary w-100">Filter</button>
                        {(searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || categoryFilter !== 'ALL' || dateFrom) && (
                            <button 
                                type="button" 
                                className="btn btn-outline-secondary"
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('ALL');
                                    setPriorityFilter('ALL');
                                    setCategoryFilter('ALL');
                                    setDateFrom('');
                                    setDateTo('');
                                }}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* ALERTS TABLE */}
            <div className="gv-card overflow-hidden bg-white shadow-sm">
                {loading ? (
                    <div className="p-5 text-center text-muted">
                        <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                        <div>Loading community alerts...</div>
                    </div>
                ) : error ? (
                    <div className="p-4 text-danger">{error}</div>
                ) : alerts.length === 0 ? (
                    <div className="p-5 text-center text-muted">
                        <i className="bi bi-shield-check display-4 text-success d-block mb-3"></i>
                        <h5>No Alerts Matching Filters</h5>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light text-uppercase small text-muted">
                                <tr>
                                    <th>Severity</th>
                                    <th>Alert Details</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th>Reported</th>
                                    <th>Assigned Guard</th>
                                    <th className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map(a => (
                                    <tr key={a.id}>
                                        <td>{getPriorityBadge(a.priority)}</td>
                                        <td>
                                            <div className="fw-bold text-dark">{a.title}</div>
                                            {a.parcel_id_display && (
                                                <small className="text-muted font-monospace">Parcel: {a.parcel_id_display}</small>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {a.category_display || a.category}
                                            </span>
                                        </td>
                                        <td>{getStatusBadge(a.status)}</td>
                                        <td>
                                            <div className="small text-dark">{a.created_by_name || 'System'}</div>
                                            <small className="text-muted">{new Date(a.created_at).toLocaleDateString('en-GB')}</small>
                                        </td>
                                        <td>
                                            {a.assigned_to_name ? (
                                                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary">
                                                    <i className="bi bi-person-badge me-1"></i>{a.assigned_to_name}
                                                </span>
                                            ) : (
                                                <span className="text-muted small">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="text-end">
                                            <div className="dropdown d-inline-block">
                                                <button className="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                    Manage
                                                </button>
                                                <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                                                    <li>
                                                        <button className="dropdown-item small" onClick={() => setDetailAlert(a)}>
                                                            <i className="bi bi-clock-history me-2 text-primary"></i> View Timeline & Notes
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button className="dropdown-item small" onClick={() => { setAssignItem(a); setSelectedGuardId(a.assigned_to || ''); }}>
                                                            <i className="bi bi-person-plus me-2 text-info"></i> Assign to Guard
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button className="dropdown-item small" onClick={() => { setPriorityItem(a); setNewPriority(a.priority); }}>
                                                            <i className="bi bi-arrow-up-down me-2 text-warning"></i> Adjust Priority
                                                        </button>
                                                    </li>
                                                    <li><hr className="dropdown-divider" /></li>
                                                    {a.status !== 'RESOLVED' && (
                                                        <li>
                                                            <button className="dropdown-item small text-success" onClick={() => { setResolveItem(a); setResolveStatus('RESOLVED'); setResolveNotes(''); }}>
                                                                <i className="bi bi-check-all me-2"></i> Resolve Alert
                                                            </button>
                                                        </li>
                                                    )}
                                                    {a.status !== 'DISMISSED' && (
                                                        <li>
                                                            <button className="dropdown-item small text-danger" onClick={() => { setResolveItem(a); setResolveStatus('DISMISSED'); setResolveNotes(''); }}>
                                                                <i className="bi bi-x-circle me-2"></i> Dismiss Alert
                                                            </button>
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ASSIGN GUARD MODAL */}
            {assignItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-person-plus me-2 text-primary"></i> Assign Alert to Guard
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setAssignItem(null)}></button>
                            </div>
                            <form onSubmit={handleAssignSubmit}>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded mb-3 border">
                                        <div className="fw-bold">{assignItem.title}</div>
                                        <div className="text-muted small">Priority: {assignItem.priority} | Status: {assignItem.status}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Select Security Guard *</label>
                                        <select 
                                            className="form-select" 
                                            value={selectedGuardId} 
                                            onChange={(e) => setSelectedGuardId(e.target.value)}
                                            required
                                        >
                                            <option value="">Choose active guard...</option>
                                            {guardsList.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    {g.first_name || g.username} ({g.username})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Assignment Instructions / Dispatch Notes</label>
                                        <textarea 
                                            className="form-control" 
                                            rows="2" 
                                            placeholder="Provide explicit instructions for the assigned guard..."
                                            value={assignNotes}
                                            onChange={(e) => setAssignNotes(e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setAssignItem(null)}>Cancel</button>
                                    <button type="submit" className="gv-btn-primary px-4 py-2" disabled={assignLoading}>
                                        {assignLoading ? 'Dispatching...' : 'Assign & Notify Guard'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* RESOLVE / DISMISS MODAL */}
            {resolveItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    {resolveStatus === 'RESOLVED' ? <><i className="bi bi-check-all me-2 text-success"></i> Resolve Alert</> : <><i className="bi bi-x-circle me-2 text-danger"></i> Dismiss Alert</>}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setResolveItem(null)}></button>
                            </div>
                            <form onSubmit={handleResolveSubmit}>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded mb-3 border">
                                        <div className="fw-bold">{resolveItem.title}</div>
                                        <div className="text-muted small">Category: {resolveItem.category_display}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">
                                            {resolveStatus === 'RESOLVED' ? 'Official Resolution Notes *' : 'Reason for Dismissal *'}
                                        </label>
                                        <textarea 
                                            className="form-control" 
                                            rows="3" 
                                            placeholder="Document the resolution outcome, root cause, or grounds for dismissal..."
                                            value={resolveNotes}
                                            onChange={(e) => setResolveNotes(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setResolveItem(null)}>Cancel</button>
                                    <button 
                                        type="submit" 
                                        className={`btn px-4 fw-bold ${resolveStatus === 'RESOLVED' ? 'btn-success' : 'btn-danger'}`} 
                                        disabled={resolveLoading}
                                    >
                                        {resolveLoading ? 'Processing...' : `Confirm ${resolveStatus === 'RESOLVED' ? 'Resolution' : 'Dismissal'}`}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ADJUST PRIORITY MODAL */}
            {priorityItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-arrow-up-down me-2 text-warning"></i> Adjust Alert Priority
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setPriorityItem(null)}></button>
                            </div>
                            <form onSubmit={handlePrioritySubmit}>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded mb-3 border">
                                        <div className="fw-bold">{priorityItem.title}</div>
                                        <div className="text-muted small">Current Priority: <strong>{priorityItem.priority}</strong></div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">New Priority Level *</label>
                                        <select className="form-select" value={newPriority} onChange={(e) => setNewPriority(e.target.value)} required>
                                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Administrative Justification / Reason *</label>
                                        <textarea 
                                            className="form-control" 
                                            rows="2" 
                                            placeholder="Provide reason for escalating or de-escalating priority..."
                                            value={priorityNotes}
                                            onChange={(e) => setPriorityNotes(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setPriorityItem(null)}>Cancel</button>
                                    <button type="submit" className="gv-btn-primary px-4 py-2" disabled={priorityLoading}>
                                        {priorityLoading ? 'Updating...' : 'Update Priority'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL & AUDIT TIMELINE MODAL */}
            {detailAlert && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-shield-check me-2 text-primary"></i> Alert Overview & Historical Audit
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setDetailAlert(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex justify-content-between align-items-start mb-3 pb-3 border-bottom">
                                    <div>
                                        <h4 className="fw-bold text-dark mb-1">{detailAlert.title}</h4>
                                        <div className="text-muted small">
                                            Category: <strong>{detailAlert.category_display}</strong> | Severity: {getPriorityBadge(detailAlert.priority)}
                                        </div>
                                    </div>
                                    <div>{getStatusBadge(detailAlert.status)}</div>
                                </div>

                                <div className="bg-light p-3 rounded-3 mb-3 border">
                                    <div className="fw-semibold text-dark mb-1">Description:</div>
                                    <p className="mb-0 small text-muted">{detailAlert.description}</p>
                                </div>

                                {detailAlert.resolution_notes && (
                                    <div className="alert alert-success small mb-3">
                                        <strong>Resolution Notes:</strong> {detailAlert.resolution_notes}
                                    </div>
                                )}

                                {/* TIMELINE */}
                                <h6 className="fw-bold text-dark text-uppercase small mb-3">Audit History Timeline</h6>
                                <div className="border-start border-2 border-primary ms-2 ps-3 py-1">
                                    {detailAlert.history?.length > 0 ? (
                                        detailAlert.history.map((h, i) => (
                                            <div className="mb-3" key={h.id || i}>
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="fw-bold text-dark small">
                                                        <span className="badge bg-secondary me-2">{h.new_status}</span>
                                                        {h.action_by_name} ({h.action_by_role || 'ADMIN'})
                                                    </span>
                                                    <span className="text-muted small">
                                                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                {h.notes && <div className="small text-muted bg-light p-2 rounded">{h.notes}</div>}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="small text-muted">No historical events recorded.</div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => setDetailAlert(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAlerts;

