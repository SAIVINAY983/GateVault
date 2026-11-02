import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import DashboardCard from '../../components/ui/DashboardCard';
import StarRating from '../../components/ui/StarRating';
import { LoadingSpinner, ErrorState } from '../../components/ui/StateComponents';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [incidentCount, setIncidentCount] = useState(0);
    const [feedbackAnalytics, setFeedbackAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Delivery Schedule Analytics State
    const [scheduleAnalytics, setScheduleAnalytics] = useState(null);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [schedCourierFilter, setSchedCourierFilter] = useState('ALL');
    const [schedCategoryFilter, setSchedCategoryFilter] = useState('ALL');
    const [schedDateFrom, setSchedDateFrom] = useState('');
    const [schedDateTo, setSchedDateTo] = useState('');

    const fetchScheduleAnalytics = async () => {
        try {
            setScheduleLoading(true);
            const params = {};
            if (schedCourierFilter !== 'ALL') params.courier = schedCourierFilter;
            if (schedCategoryFilter !== 'ALL') params.category = schedCategoryFilter;
            if (schedDateFrom) params.date_from = schedDateFrom;
            if (schedDateTo) params.date_to = schedDateTo;

            const res = await axiosInstance.get('admin/delivery-schedule-analytics/', { params });
            setScheduleAnalytics(res.data);
        } catch (err) {
            console.error("Failed to fetch schedule analytics", err);
        } finally {
            setScheduleLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError('');
            const [dashRes, incRes, schedRes, fbRes] = await Promise.allSettled([
                axiosInstance.get('admin/dashboard/'),
                axiosInstance.get('admin/incidents/'),
                axiosInstance.get('admin/delivery-schedule-analytics/'),
                axiosInstance.get('admin/feedback/analytics/')
            ]);

            if (dashRes.status === 'fulfilled') {
                setStats(dashRes.value.data);
            } else {
                setError('Failed to load analytics');
            }

            if (incRes.status === 'fulfilled' && Array.isArray(incRes.value.data)) {
                setIncidentCount(incRes.value.data.filter(i => i.status === 'OPEN' || i.status === 'UNDER_REVIEW').length);
            }

            if (schedRes.status === 'fulfilled') {
                setScheduleAnalytics(schedRes.value.data);
            }

            if (fbRes.status === 'fulfilled') {
                setFeedbackAnalytics(fbRes.value.data);
            }
        } catch (err) {
            setError('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchScheduleAnalytics();
    }, [schedCourierFilter, schedCategoryFilter, schedDateFrom, schedDateTo]);

    if (loading) return <LoadingSpinner message="Loading gatehouse analytics..." />;
    if (error) return <ErrorState message={error} onRetry={fetchStats} />;

    const storageData = [
        { name: 'Occupied', value: stats.storage.occupied },
        { name: 'Available', value: stats.storage.capacity - stats.storage.occupied }
    ];
    // Navy and Light Gray for pie chart
    const storageColors = ['#0f172a', '#e2e8f0'];

    const carrierColors = ['#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#ef4444', '#8b5cf6'];
    const carrierData = stats.carrier_stats.map((c, i) => ({
        name: c.carrier__name || 'Unknown',
        parcels: c.count,
        fill: carrierColors[i % carrierColors.length]
    }));

    const occupancyRate = Math.round((stats.storage.occupied / stats.storage.capacity) * 100);

    return (
        <div className="container-fluid px-0">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Good morning, Admin</h2>
                    <p className="text-muted">Gatehouse operations overview and real-time analytics.</p>
                </div>
                <div className="d-flex gap-2">
                    <Link to="/admin/community" className="btn btn-outline-primary d-flex align-items-center gap-2">
                        <i className="bi bi-buildings"></i>
                        <span>Community Overview</span>
                    </Link>
                    <Link to="/admin/incidents" className="btn btn-outline-danger d-flex align-items-center gap-2">
                        <i className="bi bi-shield-exclamation"></i>
                        <span>Incident Portal</span>
                        {incidentCount > 0 && <span className="badge bg-danger rounded-pill">{incidentCount}</span>}
                    </Link>
                </div>
            </div>
            
            <div className="row g-4 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Total Parcels" 
                        value={stats.total_parcels} 
                        icon="bi-boxes" 
                        colorClass="text-primary" 
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Pending Pickup" 
                        value={stats.pending_parcels} 
                        icon="bi-clock-history" 
                        colorClass="text-warning" 
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Handed Over Today" 
                        value={stats.handed_over_today} 
                        icon="bi-check-circle-fill" 
                        colorClass="text-success" 
                    />
                </div>
                <div className="col-12 col-sm-6 col-xl-3">
                    <DashboardCard 
                        title="Overdue" 
                        value={stats.overdue_parcels} 
                        subtitle=">48 Hours"
                        icon="bi-exclamation-triangle-fill" 
                        colorClass="text-danger" 
                    />
                </div>
            </div>

            {incidentCount > 0 && (
                <div className="alert alert-warning border-0 shadow-sm rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                        <i className="bi bi-exclamation-triangle-fill text-warning fs-3 me-3"></i>
                        <div>
                            <div className="fw-bold text-dark">{incidentCount} Parcel Incident{incidentCount > 1 ? 's' : ''} Require Immediate Review</div>
                            <div className="text-muted small">Residents have reported packaging damage or issues that require administrative resolution.</div>
                        </div>
                    </div>
                    <Link to="/admin/incidents" className="btn btn-warning fw-semibold btn-sm px-3">
                        Review Incidents
                    </Link>
                </div>
            )}

            <div className="row g-4">
                <div className="col-12 col-lg-5">
                    <div className="gv-card h-100">
                        <div className="card-body p-4 d-flex flex-column">
                            <h5 className="fw-bold mb-1">Gatehouse Storage</h5>
                            <p className="text-muted small mb-4">Current physical space utilization</p>
                            
                            <div className="flex-grow-1 position-relative d-flex align-items-center justify-content-center" style={{ minHeight: '250px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={storageData}
                                            innerRadius={70}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {storageData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={storageColors[index % storageColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ color: '#0f172a', fontWeight: '600' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="position-absolute top-50 start-50 translate-middle text-center">
                                    <div className="display-5 fw-bold text-dark lh-1">{occupancyRate}%</div>
                                    <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Occupied</small>
                                </div>
                            </div>
                            
                            <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                                <div>
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <div className="rounded-circle bg-primary" style={{ width: '10px', height: '10px' }}></div>
                                        <small className="text-muted fw-medium">Occupied</small>
                                    </div>
                                    <div className="fw-bold fs-5 ps-3">{stats.storage.occupied}</div>
                                </div>
                                <div className="text-end">
                                    <div className="d-flex align-items-center gap-2 mb-1 justify-content-end">
                                        <div className="rounded-circle bg-light border" style={{ width: '10px', height: '10px' }}></div>
                                        <small className="text-muted fw-medium">Available</small>
                                    </div>
                                    <div className="fw-bold fs-5 pe-1">{stats.storage.capacity - stats.storage.occupied}</div>
                                </div>
                            </div>
                            
                            {/* New Shelf Breakdown */}
                            <div className="mt-4 pt-3 border-top">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="fw-semibold small text-muted mb-0">Occupancy by Zone</h6>
                                    <Link to="/admin/shelves" className="btn btn-sm btn-link p-0 text-decoration-none small fw-bold">
                                        Manage Shelves <i className="bi bi-arrow-right"></i>
                                    </Link>
                                </div>
                                {stats.storage.breakdown?.map(shelf => {
                                    const isNearCap = (shelf.occupied / shelf.capacity) >= 0.85;
                                    return (
                                        <div key={shelf.name} className="mb-3">
                                            <div className="d-flex justify-content-between small mb-1">
                                                <span className="fw-medium text-dark d-flex align-items-center gap-1">
                                                    {shelf.name}
                                                    {isNearCap && (
                                                        <span className="badge bg-danger text-white ms-1" style={{ fontSize: '0.6rem' }}>
                                                            Near Capacity
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-muted">{shelf.occupied}/{shelf.capacity}</span>
                                            </div>
                                            <div className="progress" style={{ height: '6px' }}>
                                                <div 
                                                    className={`progress-bar ${isNearCap ? 'bg-danger' : (shelf.occupied/shelf.capacity) > 0.6 ? 'bg-warning' : 'bg-primary'}`} 
                                                    style={{ width: `${Math.min((shelf.occupied / shelf.capacity) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="col-12 col-lg-7">
                    <div className="gv-card h-100">
                        <div className="card-body p-4 d-flex flex-column">
                            <h5 className="fw-bold mb-1">Carrier Distribution</h5>
                            <p className="text-muted small mb-4">Volume of parcels delivered by carrier</p>
                            
                            <div className="flex-grow-1 w-100" style={{ minHeight: '300px' }}>
                                {carrierData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={carrierData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                            <Tooltip 
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="parcels" radius={[4, 4, 4, 4]} barSize={40}>
                                                {carrierData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center">
                                        <div className="bg-light rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px' }}>
                                            <i className="bi bi-box-seam text-muted fs-3"></i>
                                        </div>
                                        <h6 className="fw-semibold text-dark">No Carrier Data Yet</h6>
                                        <p className="text-muted small px-4">There are currently no parcels recorded to generate carrier distribution.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DELIVERY SCHEDULE ANALYTICS SECTION */}
            <div className="mt-5 mb-5">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                    <div>
                        <h4 className="fw-bold text-dark mb-1">
                            <i className="bi bi-calendar-range me-2 text-primary"></i>
                            Delivery Schedule Analytics
                        </h4>
                        <p className="text-muted small mb-0">Overview of resident-scheduled deliveries, courier volume forecasts, and gate receipt performance.</p>
                    </div>

                    {/* FILTERS */}
                    <div className="d-flex flex-wrap gap-2 align-items-center">
                        <select 
                            className="form-select form-select-sm" 
                            style={{ width: 'auto' }}
                            value={schedCourierFilter}
                            onChange={(e) => setSchedCourierFilter(e.target.value)}
                        >
                            <option value="ALL">All Couriers</option>
                            <option value="Amazon">Amazon</option>
                            <option value="Flipkart">Flipkart</option>
                            <option value="Delhivery">Delhivery</option>
                            <option value="Blue Dart">Blue Dart</option>
                            <option value="Swiggy">Swiggy</option>
                            <option value="Zomato">Zomato</option>
                        </select>

                        <select 
                            className="form-select form-select-sm" 
                            style={{ width: 'auto' }}
                            value={schedCategoryFilter}
                            onChange={(e) => setSchedCategoryFilter(e.target.value)}
                        >
                            <option value="ALL">All Categories</option>
                            <option value="NORMAL">Normal Parcel</option>
                            <option value="FOOD">Food Delivery</option>
                            <option value="COD">COD Deliveries</option>
                        </select>

                        <input 
                            type="date" 
                            className="form-control form-control-sm" 
                            style={{ width: 'auto' }}
                            value={schedDateFrom}
                            onChange={(e) => setSchedDateFrom(e.target.value)}
                            title="From Date"
                        />

                        <input 
                            type="date" 
                            className="form-control form-control-sm" 
                            style={{ width: 'auto' }}
                            value={schedDateTo}
                            onChange={(e) => setSchedDateTo(e.target.value)}
                            title="To Date"
                        />

                        {(schedCourierFilter !== 'ALL' || schedCategoryFilter !== 'ALL' || schedDateFrom || schedDateTo) && (
                            <button 
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => {
                                    setSchedCourierFilter('ALL');
                                    setSchedCategoryFilter('ALL');
                                    setSchedDateFrom('');
                                    setSchedDateTo('');
                                }}
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {scheduleLoading ? (
                    <div className="p-4 text-center text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                        Updating schedule analytics...
                    </div>
                ) : scheduleAnalytics ? (
                    <>
                        {/* KPI METRIC CARDS */}
                        <div className="row g-3 mb-4">
                            <div className="col-6 col-md-4 col-xl-2">
                                <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-primary">
                                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Expected Today</div>
                                    <div className="fs-3 fw-bold text-dark mt-1">{scheduleAnalytics.today_count}</div>
                                    <small className="text-muted">For today</small>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-xl-2">
                                <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-info">
                                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Tomorrow</div>
                                    <div className="fs-3 fw-bold text-dark mt-1">{scheduleAnalytics.tomorrow_count}</div>
                                    <small className="text-muted">Next 24h forecast</small>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-xl-2">
                                <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-secondary">
                                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Upcoming Week</div>
                                    <div className="fs-3 fw-bold text-dark mt-1">{scheduleAnalytics.upcoming_week_count}</div>
                                    <small className="text-muted">Next 7 days</small>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-xl-2">
                                <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-success">
                                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Received</div>
                                    <div className="fs-3 fw-bold text-success mt-1">{scheduleAnalytics.received_as_scheduled}</div>
                                    <small className="text-muted">Gate verified</small>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-xl-2">
                                <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-warning">
                                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Missed Window</div>
                                    <div className="fs-3 fw-bold text-warning mt-1">{scheduleAnalytics.delayed_or_missed}</div>
                                    <small className="text-muted">Grace exceeded</small>
                                </div>
                            </div>
                            <div className="col-6 col-md-4 col-xl-2">
                                <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-danger">
                                    <div className="text-muted small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Cancelled</div>
                                    <div className="fs-3 fw-bold text-danger mt-1">{scheduleAnalytics.cancelled_count}</div>
                                    <small className="text-muted">By resident</small>
                                </div>
                            </div>
                        </div>

                        {/* CHARTS ROW */}
                        <div className="row g-4">
                            {/* COURIER VOLUME FORECAST */}
                            <div className="col-12 col-lg-6">
                                <div className="gv-card h-100 p-4 bg-white shadow-sm">
                                    <h5 className="fw-bold mb-1">Expected Parcel Volume by Courier</h5>
                                    <p className="text-muted small mb-4">Volume of expected packages categorized by delivery partner</p>

                                    <div style={{ height: '280px' }}>
                                        {scheduleAnalytics.by_courier?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={scheduleAnalytics.by_courier} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                                    <XAxis dataKey="courier" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    <Bar dataKey="total" name="Total Scheduled" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                                                No courier schedule records for selected criteria.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* DELIVERIES BY TIME WINDOW */}
                            <div className="col-12 col-lg-6">
                                <div className="gv-card h-100 p-4 bg-white shadow-sm">
                                    <h5 className="fw-bold mb-1">Expected Deliveries by Time Window</h5>
                                    <p className="text-muted small mb-4">Distribution across resident-estimated delivery slots</p>

                                    <div style={{ height: '280px' }}>
                                        {scheduleAnalytics.by_time_window?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={scheduleAnalytics.by_time_window} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                                    <XAxis dataKey="window" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    <Bar dataKey="count" name="Deliveries" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                                                No time window distribution records for selected criteria.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            {/* COMMUNITY FEEDBACK & RATING ANALYTICS SECTION */}
            {feedbackAnalytics && (
                <div className="mt-5 pt-3 border-top">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-2">
                        <div>
                            <h4 className="fw-bold text-dark mb-1">
                                <i className="bi bi-star-fill text-warning me-2"></i>
                                Community Satisfaction & Feedback
                            </h4>
                            <p className="text-muted small mb-0">Resident experience ratings, service feedback, and resolution tracking</p>
                        </div>
                        <Link to="/admin/feedback" className="btn btn-outline-primary btn-sm fw-semibold">
                            Manage All Feedback <i className="bi bi-arrow-right ms-1"></i>
                        </Link>
                    </div>

                    {/* KPI Cards */}
                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-3">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-warning">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Average Rating</small>
                                <div className="d-flex align-items-center gap-2 mt-1">
                                    <div className="fs-3 fw-bold text-warning">{feedbackAnalytics.average_rating || 'N/A'}</div>
                                    <StarRating value={Math.round(feedbackAnalytics.average_rating || 0)} readOnly size="sm" />
                                </div>
                                <small className="text-muted">out of 5.0 stars</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-primary">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Total Reviews</small>
                                <div className="fs-3 fw-bold text-dark mt-1">{feedbackAnalytics.total_feedbacks}</div>
                                <small className="text-muted">{feedbackAnalytics.responded_count} with response</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-success">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Positive Feedback</small>
                                <div className="fs-3 fw-bold text-success mt-1">{feedbackAnalytics.sentiment?.positive || 0}</div>
                                <small className="text-muted">4–5 star ratings</small>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="gv-card p-3 bg-white shadow-sm h-100 border-start border-4 border-danger">
                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Negative Issues</small>
                                <div className={`fs-3 fw-bold mt-1 ${feedbackAnalytics.sentiment?.negative > 0 ? 'text-danger' : 'text-muted'}`}>
                                    {feedbackAnalytics.sentiment?.negative || 0}
                                </div>
                                <small className="text-muted">≤ 2 star complaints</small>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    {feedbackAnalytics.total_feedbacks > 0 && (
                        <div className="row g-4">
                            {/* Rating Distribution */}
                            <div className="col-12 col-lg-4">
                                <div className="gv-card h-100 p-4 bg-white shadow-sm">
                                    <h6 className="fw-bold mb-1">Rating Distribution</h6>
                                    <p className="text-muted small mb-3">1 to 5 star rating breakdown</p>
                                    <div style={{ height: '220px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={feedbackAnalytics.rating_distribution}>
                                                <XAxis dataKey="rating" tickFormatter={(r) => `${r}★`} />
                                                <YAxis allowDecimals={false} />
                                                <Tooltip formatter={(v) => [`${v} reviews`, 'Count']} />
                                                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Category Distribution */}
                            <div className="col-12 col-lg-4">
                                <div className="gv-card h-100 p-4 bg-white shadow-sm">
                                    <h6 className="fw-bold mb-1">Feedback by Category</h6>
                                    <p className="text-muted small mb-3">Service area distribution</p>
                                    <div style={{ height: '220px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={feedbackAnalytics.category_distribution} layout="vertical">
                                                <XAxis type="number" allowDecimals={false} />
                                                <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 11 }} />
                                                <Tooltip formatter={(v) => [`${v} reviews`, 'Count']} />
                                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Monthly Trends */}
                            <div className="col-12 col-lg-4">
                                <div className="gv-card h-100 p-4 bg-white shadow-sm">
                                    <h6 className="fw-bold mb-1">Monthly Rating Trends</h6>
                                    <p className="text-muted small mb-3">Average rating evolution over time</p>
                                    <div style={{ height: '220px' }}>
                                        {feedbackAnalytics.monthly_trends?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={feedbackAnalytics.monthly_trends}>
                                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                                    <YAxis domain={[1, 5]} allowDecimals={true} />
                                                    <Tooltip formatter={(v) => [`${v} ★`, 'Avg Rating']} />
                                                    <Line type="monotone" dataKey="avg_rating" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-center h-100 text-muted small">
                                                Trend data accumulating.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
