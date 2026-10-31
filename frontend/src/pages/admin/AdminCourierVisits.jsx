import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const AdminCourierVisits = () => {
    const [analytics, setAnalytics] = useState(null);
    const [visits, setVisits] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter and search state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [purposeFilter, setPurposeFilter] = useState('');
    const [carrierFilter, setCarrierFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Modal state for viewing linked parcels
    const [selectedVisit, setSelectedVisit] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [analyticsRes, visitsRes, carriersRes] = await Promise.all([
                axiosInstance.get('admin/courier-analytics/'),
                axiosInstance.get('admin/courier-visits/', {
                    params: {
                        search: searchQuery || undefined,
                        status: statusFilter || undefined,
                        purpose: purposeFilter || undefined,
                        carrier: carrierFilter || undefined,
                        date: dateFilter || undefined
                    }
                }),
                axiosInstance.get('carriers/')
            ]);
            setAnalytics(analyticsRes.data);
            setVisits(visitsRes.data || []);
            setCarriers(carriersRes.data || []);
            setError('');
        } catch (err) {
            console.error('Failed to load courier analytics', err);
            setError('Failed to fetch courier visit analytics. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [statusFilter, purposeFilter, carrierFilter, dateFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchData();
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setPurposeFilter('');
        setCarrierFilter('');
        setDateFilter('');
    };

    const metrics = analytics?.metrics || {};
    const charts = analytics?.charts || {};
    const unusuallyLong = analytics?.unusually_long_visits || [];

    return (
        <div className="pb-5">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
                        <i className="bi bi-truck-flatbed text-primary"></i> Courier Visit History & Site Analytics
                    </h3>
                    <p className="text-muted small mb-0">
                        Audit external delivery visits, turnaround times, long-stay security alerts, and parcel volume distributions.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <Link to="/admin" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                        <i className="bi bi-arrow-left"></i> Dashboard
                    </Link>
                    <button 
                        onClick={fetchData} 
                        className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                        disabled={loading}
                    >
                        <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
                    <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
            )}

            {/* Unusually Long Visits Security Alert */}
            {unusuallyLong.length > 0 && (
                <div className="alert alert-warning border border-warning border-opacity-50 p-3 mb-4 rounded-3 shadow-sm">
                    <div className="d-flex align-items-center gap-3 mb-2">
                        <div className="rounded-circle bg-warning bg-opacity-25 p-2 text-warning">
                            <i className="bi bi-exclamation-triangle-fill fs-4 text-warning"></i>
                        </div>
                        <div>
                            <div className="fw-bold text-dark">
                                Security Alert: {unusuallyLong.length} Courier{unusuallyLong.length > 1 ? 's' : ''} Exceeding Standard Stay (&gt;45m)
                            </div>
                            <div className="small text-muted">
                                Delivery personnel currently inside for an unusually long duration. Recommended guard follow-up.
                            </div>
                        </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                        {unusuallyLong.map(v => (
                            <span key={v.id} className="badge bg-white text-dark border p-2 d-flex align-items-center gap-2">
                                <span className="fw-bold">{v.courier_name}</span>
                                <span className="text-muted">({v.carrier_display})</span>
                                <span className="badge bg-danger">Inside {v.duration_display}</span>
                                <a href={`tel:${v.mobile_number}`} className="text-primary text-decoration-none small">
                                    <i className="bi bi-telephone-fill me-1"></i>{v.mobile_number}
                                </a>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Metrics Row */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-2">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="text-muted small fw-semibold text-uppercase">Total Visits</div>
                        <div className="fs-3 fw-bold text-dark mt-1">{metrics.total_visits || 0}</div>
                        <div className="small text-muted mt-1">Recorded arrivals</div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-2">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="text-muted small fw-semibold text-uppercase">Currently Inside</div>
                        <div className="fs-3 fw-bold text-primary mt-1">{metrics.currently_inside || 0}</div>
                        <div className="small text-muted mt-1">Active on premises</div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-2">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="text-muted small fw-semibold text-uppercase">Completed Exits</div>
                        <div className="fs-3 fw-bold text-success mt-1">{metrics.completed_visits || 0}</div>
                        <div className="small text-muted mt-1">Departures logged</div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-2">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="text-muted small fw-semibold text-uppercase">Avg Visit Time</div>
                        <div className="fs-3 fw-bold text-dark mt-1">{metrics.average_duration_minutes || 0}m</div>
                        <div className="small text-muted mt-1">Turnaround average</div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-2">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="text-muted small fw-semibold text-uppercase">Parcels Handled</div>
                        <div className="fs-3 fw-bold text-info mt-1">{metrics.total_parcels_delivered || 0}</div>
                        <div className="small text-muted mt-1">Packages received</div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-2">
                    <div className="gv-card h-100 p-3 border rounded-3 bg-white shadow-sm">
                        <div className="text-muted small fw-semibold text-uppercase">Parcels / Visit</div>
                        <div className="fs-3 fw-bold text-purple mt-1">{metrics.average_parcels_per_visit || 0}</div>
                        <div className="small text-muted mt-1">Avg delivery load</div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="row g-3 mb-4">
                {/* Visits by Delivery Company */}
                <div className="col-12 col-lg-4">
                    <div className="gv-card h-100 border rounded-3 bg-white shadow-sm p-3">
                        <h6 className="fw-bold text-dark mb-1">Top Delivery Companies</h6>
                        <p className="text-muted small mb-3">Volume by courier company</p>
                        <div style={{ height: '220px' }}>
                            {charts.carrier_distribution && charts.carrier_distribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={charts.carrier_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="carrier" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={45} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="visits" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="d-flex align-items-center justify-content-center h-100 text-muted small">No carrier data</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Visits by Purpose */}
                <div className="col-12 col-lg-4">
                    <div className="gv-card h-100 border rounded-3 bg-white shadow-sm p-3">
                        <h6 className="fw-bold text-dark mb-1">Visit Purpose Distribution</h6>
                        <p className="text-muted small mb-3">Deliveries vs Pickups vs Food</p>
                        <div style={{ height: '220px' }}>
                            {charts.purpose_distribution && charts.purpose_distribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={charts.purpose_distribution} 
                                            dataKey="count" 
                                            nameKey="purpose" 
                                            cx="50%" 
                                            cy="50%" 
                                            outerRadius={75}
                                            label={({ purpose, percent }) => `${(percent * 100).toFixed(0)}%`}
                                        >
                                            {charts.purpose_distribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="d-flex align-items-center justify-content-center h-100 text-muted small">No purpose data</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hourly Arrival Patterns */}
                <div className="col-12 col-lg-4">
                    <div className="gv-card h-100 border rounded-3 bg-white shadow-sm p-3">
                        <h6 className="fw-bold text-dark mb-1">Hourly Arrival Patterns</h6>
                        <p className="text-muted small mb-3">Peak courier gate entry times</p>
                        <div style={{ height: '220px' }}>
                            {charts.hourly_arrivals && charts.hourly_arrivals.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={charts.hourly_arrivals} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="visits" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="d-flex align-items-center justify-content-center h-100 text-muted small">No hourly data</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="gv-card p-3 border rounded-3 bg-white shadow-sm mb-4">
                <form onSubmit={handleSearchSubmit}>
                    <div className="row g-2 align-items-center">
                        <div className="col-12 col-md-3">
                            <input 
                                type="text"
                                className="form-control"
                                placeholder="Search courier, mobile, vehicle..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="col-6 col-md-2">
                            <select 
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="INSIDE">Currently Inside</option>
                                <option value="EXITED">Exited</option>
                            </select>
                        </div>

                        <div className="col-6 col-md-2">
                            <select 
                                className="form-select"
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

                        <div className="col-6 col-md-2">
                            <select 
                                className="form-select"
                                value={carrierFilter}
                                onChange={(e) => setCarrierFilter(e.target.value)}
                            >
                                <option value="">All Carriers</option>
                                {carriers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-6 col-md-2">
                            <input 
                                type="date"
                                className="form-control"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>

                        <div className="col-12 col-md-1 d-flex gap-1">
                            <button type="submit" className="btn btn-primary w-100" title="Apply Filters">
                                <i className="bi bi-funnel-fill"></i>
                            </button>
                            <button type="button" onClick={handleResetFilters} className="btn btn-light border" title="Reset">
                                <i className="bi bi-x-circle"></i>
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Visit Log Table */}
            <div className="gv-card border rounded-3 bg-white shadow-sm overflow-hidden">
                <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                    <h5 className="fw-bold mb-0">Courier Visits Log ({visits.length})</h5>
                    <span className="small text-muted">Showing all matching arrival and departure records</span>
                </div>

                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status"></div>
                        <div className="text-muted small mt-2">Loading visits...</div>
                    </div>
                ) : visits.length > 0 ? (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light small text-muted text-uppercase">
                                <tr>
                                    <th>Courier Name</th>
                                    <th>Delivery Company</th>
                                    <th>Contact & Vehicle</th>
                                    <th>Purpose</th>
                                    <th>Entry Time</th>
                                    <th>Exit Time</th>
                                    <th>Total Duration</th>
                                    <th>Status</th>
                                    <th>Guards</th>
                                    <th>Parcels Linked</th>
                                    <th className="text-end">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visits.map(v => (
                                    <tr key={v.id}>
                                        <td className="fw-bold text-dark">{v.courier_name}</td>
                                        <td>
                                            <span className="badge bg-light text-primary border">
                                                {v.carrier_display}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="small fw-semibold">{v.mobile_number}</div>
                                            {v.vehicle_number && (
                                                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                    {v.vehicle_number}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
                                                {v.visit_purpose_display}
                                            </span>
                                        </td>
                                        <td className="small">
                                            <div>{new Date(v.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{new Date(v.entry_time).toLocaleDateString()}</div>
                                        </td>
                                        <td className="small text-muted">
                                            {v.exit_time ? (
                                                <>
                                                    <div>{new Date(v.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    <div style={{ fontSize: '0.7rem' }}>{new Date(v.exit_time).toLocaleDateString()}</div>
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <span className={`badge ${v.status === 'INSIDE' ? 'bg-primary' : 'bg-light text-dark border'}`}>
                                                {v.duration_display}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${v.status === 'INSIDE' ? 'bg-warning text-dark' : 'bg-success'}`}>
                                                {v.status_display}
                                            </span>
                                        </td>
                                        <td className="small">
                                            <div>In: {v.entry_guard_name}</div>
                                            {v.exit_guard_name && <div className="text-muted" style={{ fontSize: '0.7rem' }}>Out: {v.exit_guard_name}</div>}
                                        </td>
                                        <td>
                                            <span className="badge bg-info bg-opacity-25 text-primary border">
                                                {v.linked_parcels_count || 0} parcels
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <button 
                                                type="button" 
                                                onClick={() => setSelectedVisit(v)}
                                                className="btn btn-sm btn-outline-secondary"
                                                title="View Linked Parcels and Remarks"
                                            >
                                                <i className="bi bi-eye"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-5 text-muted small">
                        No courier visit logs matched your criteria.
                    </div>
                )}
            </div>

            {/* Visit Details & Linked Parcels Modal */}
            {selectedVisit && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content rounded-3 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold">
                                    Visit Details: {selectedVisit.courier_name}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedVisit(null)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="p-3 bg-light rounded border mb-3 small">
                                    <div className="row g-2">
                                        <div className="col-6"><strong>Company:</strong> {selectedVisit.carrier_display}</div>
                                        <div className="col-6"><strong>Mobile:</strong> {selectedVisit.mobile_number}</div>
                                        <div className="col-6"><strong>Vehicle:</strong> {selectedVisit.vehicle_number || 'None'}</div>
                                        <div className="col-6"><strong>Purpose:</strong> {selectedVisit.visit_purpose_display}</div>
                                        <div className="col-6"><strong>Entry Time:</strong> {new Date(selectedVisit.entry_time).toLocaleString()}</div>
                                        <div className="col-6"><strong>Exit Time:</strong> {selectedVisit.exit_time ? new Date(selectedVisit.exit_time).toLocaleString() : 'Currently Inside'}</div>
                                        <div className="col-6"><strong>Duration:</strong> {selectedVisit.duration_display}</div>
                                        <div className="col-6"><strong>Status:</strong> {selectedVisit.status_display}</div>
                                        <div className="col-6"><strong>Entry Guard:</strong> {selectedVisit.entry_guard_name}</div>
                                        <div className="col-6"><strong>Exit Guard:</strong> {selectedVisit.exit_guard_name || '-'}</div>
                                    </div>
                                    {selectedVisit.remarks && (
                                        <div className="mt-2 pt-2 border-top">
                                            <strong>Remarks:</strong> {selectedVisit.remarks}
                                        </div>
                                    )}
                                </div>

                                <h6 className="fw-bold small mb-2">
                                    Parcels Linked to this Visit ({selectedVisit.linked_parcels?.length || 0})
                                </h6>
                                {selectedVisit.linked_parcels && selectedVisit.linked_parcels.length > 0 ? (
                                    <div className="list-group list-group-flush border rounded overflow-auto" style={{ maxHeight: '200px' }}>
                                        {selectedVisit.linked_parcels.map(p => (
                                            <div key={p.id} className="list-group-item d-flex justify-content-between align-items-center small py-2">
                                                <div>
                                                    <span className="fw-bold text-dark me-2">{p.parcel_id}</span>
                                                    <span className="text-muted">Flat: {p.flat}</span>
                                                    {p.shelf && <span className="badge bg-light text-muted ms-1">Shelf: {p.shelf}</span>}
                                                </div>
                                                <span className="badge bg-secondary">{p.status_display}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-muted small fst-italic py-2 text-center border rounded bg-light">
                                        No parcels were associated with this visit during intake.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-light" onClick={() => setSelectedVisit(null)}>
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

export default AdminCourierVisits;

