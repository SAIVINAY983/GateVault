import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const TIME_WINDOWS = [
    { id: 'ALL', label: 'All Windows' },
    { id: '9-12', label: '9 AM – 12 PM', query: '9' },
    { id: '12-15', label: '12 PM – 3 PM', query: '12' },
    { id: '15-18', label: '3 PM – 6 PM', query: '3' },
    { id: '18-21', label: '6 PM – 9 PM', query: '6' }
];

const CATEGORIES = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'NORMAL', label: 'Normal Parcel' },
    { id: 'FOOD', label: 'Food Delivery' },
    { id: 'COD', label: 'Cash on Delivery (COD)' }
];

const DeliveryCalendar = () => {
    const navigate = useNavigate();

    // View filter: 'TODAY' | 'TOMORROW' | 'WEEK' | 'ALL'
    const [viewMode, setViewMode] = useState('TODAY');

    // Deliveries data
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Masters for filter dropdowns
    const [towers, setTowers] = useState([]);
    const [courierOptions, setCourierOptions] = useState([]);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourier, setSelectedCourier] = useState('ALL');
    const [selectedTower, setSelectedTower] = useState('ALL');
    const [selectedFlat, setSelectedFlat] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedWindow, setSelectedWindow] = useState('ALL');

    // Selected Day in Week View
    const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = today, 1 = +1 day, ...

    // Detail modal
    const [detailItem, setDetailItem] = useState(null);

    // Reschedule modal
    const [rescheduleItem, setRescheduleItem] = useState(null);
    const [newDate, setNewDate] = useState('');
    const [newWindow, setNewWindow] = useState('9 AM – 12 PM');
    const [rescheduleLoading, setRescheduleLoading] = useState(false);

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];

    const tomorrowObj = new Date(todayObj);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(todayObj);
        d.setDate(d.getDate() + i);
        return {
            offset: i,
            dateStr: d.toISOString().split('T')[0],
            dayName: d.toLocaleDateString('en-GB', { weekday: 'short' }),
            dayNumber: d.getDate(),
            monthName: d.toLocaleDateString('en-GB', { month: 'short' })
        };
    });

    // Fetch initial master lists
    useEffect(() => {
        const fetchMasters = async () => {
            try {
                const [towerRes, carrierRes] = await Promise.all([
                    axiosInstance.get('towers/').catch(() => ({ data: [] })),
                    axiosInstance.get('carriers/').catch(() => ({ data: [] }))
                ]);
                setTowers(towerRes.data || []);
                const defaults = ['Amazon', 'Flipkart', 'Delhivery', 'Blue Dart', 'FedEx', 'Swiggy', 'Zomato'];
                const fromCarriers = (carrierRes.data || []).map(c => c.name);
                const merged = Array.from(new Set([...defaults, ...fromCarriers]));
                setCourierOptions(merged);
            } catch (err) {
                console.error("Failed to load towers/carriers", err);
            }
        };
        fetchMasters();
    }, []);

    const fetchDeliveries = async () => {
        setLoading(true);
        setError('');

        try {
            let start_date = todayStr;
            let end_date = '';

            if (viewMode === 'TODAY') {
                start_date = todayStr;
                end_date = todayStr;
            } else if (viewMode === 'TOMORROW') {
                start_date = tomorrowStr;
                end_date = tomorrowStr;
            } else if (viewMode === 'WEEK') {
                const targetDay = weekDays[selectedDayOffset];
                start_date = targetDay ? targetDay.dateStr : todayStr;
                end_date = targetDay ? targetDay.dateStr : todayStr;
            } else if (viewMode === 'ALL') {
                start_date = todayStr;
                const end = new Date(todayObj);
                end.setDate(end.getDate() + 30);
                end_date = end.toISOString().split('T')[0];
            }

            const params = {
                start_date,
                end_date,
                search: searchQuery.trim() || undefined,
                courier: selectedCourier !== 'ALL' ? selectedCourier : undefined,
                tower: selectedTower !== 'ALL' ? selectedTower : undefined,
                flat: selectedFlat.trim() || undefined,
                category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
                time_window: selectedWindow !== 'ALL' ? selectedWindow : undefined
            };

            const res = await axiosInstance.get('expected-deliveries/calendar/', { params });
            setDeliveries(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Error fetching delivery calendar:", err);
            setError('Failed to fetch expected delivery calendar.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();
    }, [viewMode, selectedDayOffset, selectedCourier, selectedTower, selectedCategory, selectedWindow]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchDeliveries();
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setSelectedCourier('ALL');
        setSelectedTower('ALL');
        setSelectedFlat('');
        setSelectedCategory('ALL');
        setSelectedWindow('ALL');
        setViewMode('TODAY');
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleItem || !newDate) return;
        setRescheduleLoading(true);

        try {
            await axiosInstance.post(`expected-deliveries/${rescheduleItem.id}/schedule/`, {
                expected_delivery_date: newDate,
                time_window_label: newWindow,
                note: `Rescheduled by gate guard with resident consent.`
            });
            setRescheduleItem(null);
            fetchDeliveries();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reschedule delivery.');
        } finally {
            setRescheduleLoading(false);
        }
    };

    const resolveMediaUrl = (path) => {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const base = axiosInstance.defaults.baseURL.replace('/api/', '');
        return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const getStatusBadge = (item) => {
        const s = item.status || item.scheduling_status;
        if (s === 'RECEIVED') return <span className="badge bg-success px-2 py-1"><i className="bi bi-check-circle me-1"></i> Received</span>;
        if (s === 'CANCELLED') return <span className="badge bg-secondary px-2 py-1"><i className="bi bi-x-circle me-1"></i> Cancelled</span>;
        if (s === 'RESCHEDULED') return <span className="badge bg-info text-dark px-2 py-1"><i className="bi bi-arrow-repeat me-1"></i> Rescheduled</span>;
        if (item.is_missed_or_delayed) return <span className="badge bg-warning text-dark px-2 py-1"><i className="bi bi-clock-history me-1"></i> Window Passed</span>;
        return <span className="badge bg-primary px-2 py-1"><i className="bi bi-calendar-check me-1"></i> Scheduled</span>;
    };

    const isIntakeEligible = (item) => {
        return ['SCHEDULED', 'EXPECTED', 'RESCHEDULED'].includes(item.status);
    };

    return (
        <div className="container-fluid px-0 py-3">
            {/* PAGE HEADER */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">
                        <i className="bi bi-calendar3 me-2 text-primary"></i>
                        Expected Delivery Calendar
                    </h2>
                    <p className="text-muted mb-0">
                        View scheduled courier packages & instant food deliveries expected at the gatehouse.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary" onClick={fetchDeliveries}>
                        <i className="bi bi-arrow-clockwise me-1"></i> Refresh Calendar
                    </button>
                    <button className="gv-btn-primary" onClick={() => navigate('/guard/intake')}>
                        <i className="bi bi-box-seam me-1"></i> Receive Parcel
                    </button>
                </div>
            </div>

            {/* VIEW MODE TABS */}
            <div className="gv-card p-3 bg-white shadow-sm mb-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 border-bottom pb-3 mb-3">
                    <div className="btn-group shadow-sm" role="group">
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${viewMode === 'TODAY' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setViewMode('TODAY')}
                        >
                            <i className="bi bi-calendar-day me-1"></i> Today's Deliveries
                        </button>
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${viewMode === 'TOMORROW' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setViewMode('TOMORROW')}
                        >
                            <i className="bi bi-calendar-plus me-1"></i> Tomorrow
                        </button>
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${viewMode === 'WEEK' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setViewMode('WEEK')}
                        >
                            <i className="bi bi-calendar-week me-1"></i> 7-Day Weekly View
                        </button>
                        <button 
                            type="button" 
                            className={`btn px-3 py-2 fw-semibold ${viewMode === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setViewMode('ALL')}
                        >
                            <i className="bi bi-view-list me-1"></i> All Upcoming
                        </button>
                    </div>

                    <div className="small text-muted">
                        <i className="bi bi-info-circle me-1 text-primary"></i>
                        Showing: <strong>{viewMode === 'TODAY' ? 'Today (' + todayStr + ')' : viewMode === 'TOMORROW' ? 'Tomorrow (' + tomorrowStr + ')' : viewMode === 'WEEK' ? weekDays[selectedDayOffset]?.dateStr : 'Upcoming 30 Days'}</strong>
                    </div>
                </div>

                {/* 7-DAY STRIP (Only shown in WEEK mode) */}
                {viewMode === 'WEEK' && (
                    <div className="d-flex gap-2 overflow-auto pb-2 mb-3">
                        {weekDays.map(d => (
                            <button
                                key={d.offset}
                                type="button"
                                className={`btn flex-fill text-center py-2 px-3 border rounded-3 transition ${selectedDayOffset === d.offset ? 'btn-primary text-white shadow-sm' : 'bg-light text-dark'}`}
                                onClick={() => setSelectedDayOffset(d.offset)}
                                style={{ minWidth: '95px' }}
                            >
                                <div className="small text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>
                                    {d.offset === 0 ? 'Today' : d.offset === 1 ? 'Tmrw' : d.dayName}
                                </div>
                                <div className="fs-5 fw-bold">{d.dayNumber}</div>
                                <div className="small opacity-75" style={{ fontSize: '0.7rem' }}>{d.monthName}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* SEARCH & FILTERS BAR */}
                <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
                    <div className="col-12 col-md-3">
                        <div className="input-group">
                            <span className="input-group-text bg-light text-muted border-end-0">
                                <i className="bi bi-search"></i>
                            </span>
                            <input 
                                type="text" 
                                className="form-control border-start-0" 
                                placeholder="Search Tracking / Resident / Courier..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-6 col-md-2">
                        <select 
                            className="form-select" 
                            value={selectedCourier} 
                            onChange={(e) => setSelectedCourier(e.target.value)}
                        >
                            <option value="ALL">All Couriers</option>
                            {courierOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <select 
                            className="form-select" 
                            value={selectedTower} 
                            onChange={(e) => setSelectedTower(e.target.value)}
                        >
                            <option value="ALL">All Towers</option>
                            {towers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <select 
                            className="form-select" 
                            value={selectedCategory} 
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                    </div>

                    <div className="col-6 col-md-2">
                        <select 
                            className="form-select" 
                            value={selectedWindow} 
                            onChange={(e) => setSelectedWindow(e.target.value)}
                        >
                            {TIME_WINDOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                        </select>
                    </div>

                    <div className="col-12 col-md-1 d-flex gap-1">
                        <button type="submit" className="btn btn-primary w-100" title="Apply Search">
                            Filter
                        </button>
                        <button type="button" className="btn btn-outline-secondary" onClick={handleClearFilters} title="Reset">
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>
                </form>
            </div>

            {/* RESULTS CONTENT */}
            {loading ? (
                <div className="gv-card text-center p-5 bg-white shadow-sm">
                    <div className="spinner-border spinner-border-sm text-primary mb-2"></div>
                    <div className="text-muted small">Loading expected delivery calendar...</div>
                </div>
            ) : error ? (
                <div className="alert alert-danger shadow-sm rounded-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
                </div>
            ) : deliveries.length === 0 ? (
                <div className="gv-card text-center p-5 bg-white shadow-sm">
                    <i className="bi bi-calendar-check display-4 text-muted mb-3 d-block"></i>
                    <h5 className="fw-bold text-dark mb-1">No Expected Deliveries Found</h5>
                    <p className="text-muted small mb-3">There are no matching expected deliveries registered for this date or filter criteria.</p>
                    <button className="btn btn-sm btn-outline-primary" onClick={handleClearFilters}>
                        Reset Filters
                    </button>
                </div>
            ) : (
                <div className="row g-3">
                    {deliveries.map(item => {
                        const eligible = isIntakeEligible(item);
                        return (
                            <div className="col-12 col-md-6 col-lg-4" key={item.id}>
                                <div className="gv-card h-100 p-4 bg-white shadow-sm border d-flex flex-column justify-content-between">
                                    <div>
                                        {/* CARD HEADER */}
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div>
                                                <h5 className="fw-bold text-dark mb-0">{item.courier_name}</h5>
                                                <div className="text-muted small font-monospace">{item.tracking_id}</div>
                                            </div>
                                            <div>{getStatusBadge(item)}</div>
                                        </div>

                                        {/* RESIDENT & FLAT DETAILS */}
                                        <div className="bg-light p-3 rounded-3 mb-3 border">
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <span className="text-muted small">Resident:</span>
                                                <span className="fw-bold text-dark">{item.resident_name}</span>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <span className="text-muted small">Tower & Flat:</span>
                                                <span className="badge bg-white text-dark border fw-bold">
                                                    <i className="bi bi-building me-1 text-primary"></i>
                                                    {item.flat_display || 'Flat'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* SCHEDULE & TIME WINDOW */}
                                        <div className="py-2 mb-3 border-bottom">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <span className="text-muted small"><i className="bi bi-calendar-event me-1"></i> Date:</span>
                                                <span className="fw-semibold text-dark">
                                                    {new Date(item.expected_delivery_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <span className="text-muted small"><i className="bi bi-clock me-1"></i> Time Window:</span>
                                                <span className="badge bg-light text-primary border">
                                                    {item.time_window_label || 'Estimated Window'}
                                                </span>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <span className="text-muted small"><i className="bi bi-tag me-1"></i> Category:</span>
                                                <div className="d-flex gap-1">
                                                    {item.payment_type === 'COD' && (
                                                        <span className="badge bg-danger"><i className="bi bi-cash me-1"></i> COD ₹{item.cod_amount}</span>
                                                    )}
                                                    {item.delivery_type === 'FOOD' && (
                                                        <span className="badge bg-warning text-dark"><i className="bi bi-cup-straw me-1"></i> Food</span>
                                                    )}
                                                    {item.is_open_box && (
                                                        <span className="badge bg-danger"><i className="bi bi-box me-1"></i> Open Box</span>
                                                    )}
                                                    {item.payment_type !== 'COD' && item.delivery_type !== 'FOOD' && (
                                                        <span className="badge bg-secondary">Prepaid Parcel</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* INSTRUCTIONS / REMARKS */}
                                        {item.note && (
                                            <div className="small text-muted bg-light p-2 rounded mb-3">
                                                <i className="bi bi-chat-quote me-1"></i> {item.note}
                                            </div>
                                        )}

                                        {item.is_missed_or_delayed && (
                                            <div className="alert alert-warning py-1 px-2 small border-0 mb-3 d-flex align-items-center gap-1">
                                                <i className="bi bi-exclamation-triangle-fill"></i>
                                                <span>Estimated delivery window elapsed.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* ACTION BUTTONS */}
                                    <div className="pt-2 border-top d-flex gap-2">
                                        {eligible ? (
                                            <button 
                                                className="btn btn-sm btn-primary flex-fill fw-bold py-2 d-flex align-items-center justify-content-center gap-1"
                                                onClick={() => navigate(`/guard/intake?tracking=${encodeURIComponent(item.tracking_id)}`)}
                                                title="Open Parcel Intake pre-filled with this delivery"
                                            >
                                                <i className="bi bi-box-seam"></i> Receive Parcel
                                            </button>
                                        ) : (
                                            <button className="btn btn-sm btn-outline-secondary flex-fill py-2" disabled>
                                                {item.status}
                                            </button>
                                        )}

                                        <button 
                                            className="btn btn-sm btn-outline-secondary px-3"
                                            onClick={() => setDetailItem(item)}
                                            title="View Details & Instructions"
                                        >
                                            <i className="bi bi-eye"></i>
                                        </button>

                                        {eligible && (
                                            <button 
                                                className="btn btn-sm btn-outline-secondary px-3"
                                                onClick={() => {
                                                    setRescheduleItem(item);
                                                    setNewDate(item.expected_delivery_date);
                                                    setNewWindow(item.time_window_label || '9 AM – 12 PM');
                                                }}
                                                title="Reschedule with resident consent"
                                            >
                                                <i className="bi bi-pencil-square"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* DETAILS MODAL */}
            {detailItem && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-info-circle me-2 text-primary"></i>
                                    Delivery Schedule Details
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setDetailItem(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="text-center mb-3 pb-3 border-bottom">
                                    <h4 className="fw-bold text-dark mb-0">{detailItem.courier_name}</h4>
                                    <span className="text-muted font-monospace">{detailItem.tracking_id}</span>
                                </div>

                                <div className="row g-3 small mb-3">
                                    <div className="col-6">
                                        <span className="text-muted d-block">Resident</span>
                                        <strong className="text-dark">{detailItem.resident_name}</strong>
                                    </div>
                                    <div className="col-6">
                                        <span className="text-muted d-block">Flat</span>
                                        <strong className="text-dark">{detailItem.flat_display}</strong>
                                    </div>
                                    <div className="col-6">
                                        <span className="text-muted d-block">Expected Date</span>
                                        <strong className="text-dark">{detailItem.expected_delivery_date}</strong>
                                    </div>
                                    <div className="col-6">
                                        <span className="text-muted d-block">Time Window</span>
                                        <strong className="text-dark">{detailItem.time_window_label || 'Standard daytime'}</strong>
                                    </div>
                                    {detailItem.order_id && (
                                        <div className="col-6">
                                            <span className="text-muted d-block">Order ID</span>
                                            <strong className="text-dark">{detailItem.order_id}</strong>
                                        </div>
                                    )}
                                    {detailItem.payment_type === 'COD' && (
                                        <div className="col-6">
                                            <span className="text-muted d-block">COD Amount</span>
                                            <strong className="text-danger">₹{detailItem.cod_amount}</strong>
                                        </div>
                                    )}
                                </div>

                                {detailItem.note && (
                                    <div className="bg-light p-3 rounded-3 mb-3 border">
                                        <span className="text-muted small fw-bold d-block mb-1">Resident Instructions:</span>
                                        <div className="text-dark small">{detailItem.note}</div>
                                    </div>
                                )}

                                {detailItem.delivery_photo && (
                                    <div className="mt-3">
                                        <span className="text-muted small fw-bold d-block mb-1">Resident Screenshot:</span>
                                        <img 
                                            src={resolveMediaUrl(detailItem.delivery_photo)} 
                                            alt="Delivery Screenshot" 
                                            className="img-fluid rounded border shadow-sm d-block mx-auto" 
                                            style={{ maxHeight: '220px' }} 
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                {isIntakeEligible(detailItem) && (
                                    <button 
                                        className="gv-btn-primary px-4 py-2"
                                        onClick={() => {
                                            const tr = detailItem.tracking_id;
                                            setDetailItem(null);
                                            navigate(`/guard/intake?tracking=${encodeURIComponent(tr)}`);
                                        }}
                                    >
                                        <i className="bi bi-box-seam me-1"></i> Proceed to Intake
                                    </button>
                                )}
                                <button type="button" className="btn btn-secondary" onClick={() => setDetailItem(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
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
                            <form onSubmit={handleReschedule}>
                                <div className="modal-body p-4">
                                    <div className="bg-light p-3 rounded-3 mb-3 border">
                                        <div className="fw-bold">{rescheduleItem.courier_name} (Flat {rescheduleItem.flat_display})</div>
                                        <div className="text-muted small font-monospace">Tracking: {rescheduleItem.tracking_id}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">New Expected Delivery Date</label>
                                        <input 
                                            type="date" 
                                            className="form-control" 
                                            value={newDate} 
                                            onChange={(e) => setNewDate(e.target.value)} 
                                            min={todayStr} 
                                            required 
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Estimated Time Window</label>
                                        <select 
                                            className="form-select" 
                                            value={newWindow} 
                                            onChange={(e) => setNewWindow(e.target.value)}
                                        >
                                            <option value="9 AM – 12 PM">9 AM – 12 PM (Morning)</option>
                                            <option value="12 PM – 3 PM">12 PM – 3 PM (Afternoon)</option>
                                            <option value="3 PM – 6 PM">3 PM – 6 PM (Evening)</option>
                                            <option value="6 PM – 9 PM">6 PM – 9 PM (Night)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setRescheduleItem(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="gv-btn-primary px-4 py-2" disabled={rescheduleLoading}>
                                        {rescheduleLoading ? 'Saving...' : 'Update Delivery Date'}
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

export default DeliveryCalendar;

