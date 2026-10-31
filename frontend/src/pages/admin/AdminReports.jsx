import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';
import StatusBadge from '../../components/ui/StatusBadge';

const REPORT_CATEGORIES = [
    { key: 'PARCEL_DELIVERY', label: 'Parcel Delivery', icon: 'bi-box-seam', description: 'Log of delivered, pending, and received parcels' },
    { key: 'PENDING_OVERDUE', label: 'Pending & Overdue', icon: 'bi-clock-history', description: 'Uncollected parcels exceeding standard retention threshold' },
    { key: 'COURIER_ACTIVITY', label: 'Courier Activity', icon: 'bi-truck', description: 'Gatehouse entry/exit and delivery volume logs' },
    { key: 'GUARD_SHIFTS', label: 'Guard Shifts', icon: 'bi-person-badge', description: 'Guard check-ins, check-outs, and shift handovers' },
    { key: 'PARCEL_INSPECTION', label: 'Condition & Inspection', icon: 'bi-search', description: 'Package intake inspection records and damage notes' },
    { key: 'INCIDENTS', label: 'Incident Management', icon: 'bi-shield-exclamation', description: 'Damaged, missing, or disputed parcel cases' },
    { key: 'SHELF_UTILIZATION', label: 'Shelf Utilization', icon: 'bi-bookshelf', description: 'Storage shelf occupancy, capacity, and allocation rates' },
    { key: 'COD_PAYMENTS', label: 'COD Payment Records', icon: 'bi-cash-coin', description: 'Cash-on-delivery tracking and collection logs' },
    { key: 'COMMUNITY_FEEDBACK', label: 'Community Feedback', icon: 'bi-star-fill', description: 'Resident ratings and service review submissions' },
    { key: 'MONTHLY_ACTIVITY', label: 'Monthly Community Activity', icon: 'bi-calendar-check', description: 'Aggregated monthly community trends and KPIs' },
];

const AdminReports = () => {
    const [activeTab, setActiveTab] = useState('REPORTS'); // 'REPORTS' | 'BACKUPS'
    const [summaryMetrics, setSummaryMetrics] = useState(null);
    const [activeCategory, setActiveCategory] = useState('PARCEL_DELIVERY');
    const [reportData, setReportData] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [exportingFormat, setExportingFormat] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Filter states
    const [dateRangePreset, setDateRangePreset] = useState('LAST_30'); // 'TODAY' | 'LAST_7' | 'LAST_30' | 'CUSTOM'
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterTower, setFilterTower] = useState('');
    const [filterFlat, setFilterFlat] = useState('');
    const [filterCourier, setFilterCourier] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterGuard, setFilterGuard] = useState('');

    // Backup states
    const [backups, setBackups] = useState([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);

    // Initial load: metrics and default report
    useEffect(() => {
        fetchSummaryMetrics();
        fetchReportData('PARCEL_DELIVERY');
        fetchBackups();
    }, []);

    const fetchSummaryMetrics = async () => {
        try {
            const res = await axiosInstance.get('admin/reports/summary/');
            setSummaryMetrics(res.data.metrics || null);
        } catch (err) {
            console.error('Failed to load report summary metrics', err);
        }
    };

    const fetchBackups = async () => {
        try {
            setLoadingBackups(true);
            const res = await axiosInstance.get('admin/backups/');
            setBackups(Array.isArray(res.data) ? res.data : (res.data.results || []));
        } catch (err) {
            console.error('Failed to load database backups', err);
        } finally {
            setLoadingBackups(false);
        }
    };

    const buildFilterParams = () => {
        const params = {};
        if (dateRangePreset === 'TODAY') {
            const today = new Date().toISOString().split('T')[0];
            params.date_from = today;
            params.date_to = today;
        } else if (dateRangePreset === 'LAST_7') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            params.date_from = d.toISOString().split('T')[0];
        } else if (dateRangePreset === 'LAST_30') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            params.date_from = d.toISOString().split('T')[0];
        } else if (dateRangePreset === 'CUSTOM') {
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
        }

        if (filterTower.trim()) params.tower = filterTower.trim();
        if (filterFlat.trim()) params.flat = filterFlat.trim();
        if (filterCourier.trim()) params.courier = filterCourier.trim();
        if (filterCategory.trim()) params.category = filterCategory.trim();
        if (filterStatus.trim()) params.status = filterStatus.trim();
        if (filterGuard.trim()) params.guard = filterGuard.trim();

        return params;
    };

    const fetchReportData = async (categoryKey = activeCategory) => {
        try {
            setLoadingReport(true);
            setError('');
            const params = {
                report_type: categoryKey,
                ...buildFilterParams()
            };
            const res = await axiosInstance.get('admin/reports/preview/', { params });
            setReportData(res.data);
            setActiveCategory(categoryKey);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate report preview.');
        } finally {
            setLoadingReport(false);
        }
    };

    const handleApplyFilters = (e) => {
        e.preventDefault();
        fetchReportData(activeCategory);
    };

    const handleResetFilters = () => {
        setDateRangePreset('LAST_30');
        setDateFrom('');
        setDateTo('');
        setFilterTower('');
        setFilterFlat('');
        setFilterCourier('');
        setFilterCategory('');
        setFilterStatus('');
        setFilterGuard('');
        // Immediately fetch with reset defaults
        setTimeout(() => fetchReportData(activeCategory), 50);
    };

    const handleExport = async (format) => {
        try {
            setExportingFormat(format);
            setError('');
            const params = {
                report_type: activeCategory,
                ...buildFilterParams()
            };

            const response = await axiosInstance.get(`admin/reports/export/${format}/`, {
                params,
                responseType: 'blob'
            });

            // Extract filename from Content-Disposition header if available
            let filename = `${activeCategory.toLowerCase()}_report.${format === 'excel' ? 'xlsx' : format}`;
            const disposition = response.headers['content-disposition'];
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename="([^"]+)"/.exec(disposition);
                if (matches && matches[1]) {
                    filename = matches[1];
                }
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setSuccessMsg(`Report exported successfully as ${format.toUpperCase()} (${filename})`);
            setTimeout(() => setSuccessMsg(''), 5000);
        } catch (err) {
            console.error('Export failed', err);
            setError('Failed to download report export. Please check connection and try again.');
        } finally {
            setExportingFormat(null);
        }
    };

    const handleCreateBackup = async () => {
        try {
            setCreatingBackup(true);
            setError('');
            const res = await axiosInstance.post('admin/backups/create/', { backup_type: 'MANUAL' });
            setSuccessMsg(`Database backup created successfully: ${res.data.file_name} (${res.data.file_size_formatted})`);
            fetchBackups();
            setTimeout(() => setSuccessMsg(''), 6000);
        } catch (err) {
            setError(err.response?.data?.error || 'Database backup failed.');
        } finally {
            setCreatingBackup(false);
        }
    };

    const handleDownloadBackup = async (backup) => {
        try {
            setError('');
            const response = await axiosInstance.get(`admin/backups/${backup.id}/download/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', backup.file_name || `gatevault_backup_${backup.id}.sqlite3`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to download database backup file.');
        }
    };

    return (
        <div className="container-fluid px-4 py-4">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h2 className="fw-bold mb-1 d-flex align-items-center gap-2">
                        <i className="bi bi-file-earmark-bar-graph text-primary"></i>
                        Reports & Database Backup Management
                    </h2>
                    <p className="text-muted mb-0">
                        Generate comprehensive operational reports, export multi-format compliance logs, and manage automated database backups.
                    </p>
                </div>

                {/* Tabs */}
                <div className="btn-group shadow-sm bg-white p-1 rounded-3 border" role="group">
                    <button
                        type="button"
                        className={`btn btn-sm ${activeTab === 'REPORTS' ? 'btn-primary' : 'btn-light text-muted'}`}
                        onClick={() => setActiveTab('REPORTS')}
                    >
                        <i className="bi bi-file-earmark-text me-1"></i>
                        Reports & Exports
                    </button>
                    <button
                        type="button"
                        className={`btn btn-sm ${activeTab === 'BACKUPS' ? 'btn-primary' : 'btn-light text-muted'}`}
                        onClick={() => setActiveTab('BACKUPS')}
                    >
                        <i className="bi bi-database-fill-gear me-1"></i>
                        Database Backups & Recovery
                        {backups.length > 0 && (
                            <span className="badge bg-white text-primary ms-1">{backups.length}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Alert Notifications */}
            {error && (
                <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center" role="alert">
                    <i className="bi bi-exclamation-triangle-fill fs-5 me-2"></i>
                    <div>{error}</div>
                    <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
            )}
            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center" role="alert">
                    <i className="bi bi-check-circle-fill fs-5 me-2"></i>
                    <div>{successMsg}</div>
                    <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
                </div>
            )}

            {activeTab === 'REPORTS' ? (
                <>
                    {/* Top Metric Cards */}
                    {summaryMetrics && (
                        <div className="row g-3 mb-4">
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white border-start border-4 border-primary">
                                    <div className="text-muted small fw-bold text-uppercase">Total Parcels</div>
                                    <div className="fs-3 fw-bold text-dark mt-1">{summaryMetrics.total_parcels}</div>
                                    <div className="small text-muted mt-1">All time received</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white border-start border-4 border-success">
                                    <div className="text-muted small fw-bold text-uppercase">Delivered</div>
                                    <div className="fs-3 fw-bold text-success mt-1">{summaryMetrics.delivered_parcels}</div>
                                    <div className="small text-muted mt-1">Successfully handed over</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white border-start border-4 border-warning">
                                    <div className="text-muted small fw-bold text-uppercase">Pending / Overdue</div>
                                    <div className="fs-3 fw-bold text-warning mt-1">{summaryMetrics.pending_parcels}</div>
                                    <div className="small text-muted mt-1">In gatehouse storage</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white border-start border-4 border-danger">
                                    <div className="text-muted small fw-bold text-uppercase">High Priority Alerts</div>
                                    <div className="fs-3 fw-bold text-danger mt-1">{summaryMetrics.high_priority_alerts}</div>
                                    <div className="small text-muted mt-1">Open emergency issues</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white border-start border-4 border-info">
                                    <div className="text-muted small fw-bold text-uppercase">Active Couriers</div>
                                    <div className="fs-3 fw-bold text-info mt-1">{summaryMetrics.active_couriers}</div>
                                    <div className="small text-muted mt-1">Currently checked in</div>
                                </div>
                            </div>
                            <div className="col-6 col-lg-2">
                                <div className="card border-0 shadow-sm rounded-3 h-100 p-3 bg-white border-start border-4 border-primary">
                                    <div className="text-muted small fw-bold text-uppercase">Shelf Occupancy</div>
                                    <div className="fs-3 fw-bold text-primary mt-1">{summaryMetrics.shelf_occupancy_rate}%</div>
                                    <div className="small text-muted mt-1">
                                        Avg Rating: <span className="fw-bold text-warning">★ {summaryMetrics.average_rating}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Report Category Selection Carousel / Pill Grid */}
                    <div className="card border-0 shadow-sm rounded-3 p-3 mb-4 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="text-uppercase fw-bold text-muted small" style={{ letterSpacing: '0.05em' }}>
                                Select Report Category
                            </span>
                            <span className="badge bg-light text-primary border">10 Standard Reports Available</span>
                        </div>
                        <div className="row g-2">
                            {REPORT_CATEGORIES.map((cat) => {
                                const isSelected = activeCategory === cat.key;
                                return (
                                    <div key={cat.key} className="col-6 col-md-4 col-xl-auto flex-xl-fill">
                                        <button
                                            type="button"
                                            className={`btn w-100 text-start p-2 rounded-3 border transition-all ${
                                                isSelected
                                                    ? 'btn-primary shadow-sm border-primary'
                                                    : 'btn-light border-light-subtle text-dark'
                                            }`}
                                            onClick={() => fetchReportData(cat.key)}
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <i className={`bi ${cat.icon} fs-5 ${isSelected ? 'text-white' : 'text-primary'}`}></i>
                                                <div className="text-truncate">
                                                    <div className={`fw-bold small ${isSelected ? 'text-white' : 'text-dark'}`}>
                                                        {cat.label}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filter Toolbar */}
                    <div className="card border-0 shadow-sm rounded-3 p-3 mb-4 bg-white">
                        <form onSubmit={handleApplyFilters}>
                            <div className="row g-3 align-items-end">
                                {/* Date Preset */}
                                <div className="col-12 col-md-3 col-lg-2">
                                    <label className="form-label small fw-bold text-muted">Date Range</label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={dateRangePreset}
                                        onChange={(e) => setDateRangePreset(e.target.value)}
                                    >
                                        <option value="LAST_30">Last 30 Days</option>
                                        <option value="LAST_7">Last 7 Days</option>
                                        <option value="TODAY">Today Only</option>
                                        <option value="CUSTOM">Custom Range</option>
                                    </select>
                                </div>

                                {/* Custom Dates */}
                                {dateRangePreset === 'CUSTOM' && (
                                    <>
                                        <div className="col-6 col-md-3 col-lg-2">
                                            <label className="form-label small fw-bold text-muted">Date From</label>
                                            <input
                                                type="date"
                                                className="form-control form-control-sm"
                                                value={dateFrom}
                                                onChange={(e) => setDateFrom(e.target.value)}
                                            />
                                        </div>
                                        <div className="col-6 col-md-3 col-lg-2">
                                            <label className="form-label small fw-bold text-muted">Date To</label>
                                            <input
                                                type="date"
                                                className="form-control form-control-sm"
                                                value={dateTo}
                                                onChange={(e) => setDateTo(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Tower */}
                                <div className="col-6 col-md-2 col-lg-1">
                                    <label className="form-label small fw-bold text-muted">Tower</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="e.g. A"
                                        value={filterTower}
                                        onChange={(e) => setFilterTower(e.target.value)}
                                    />
                                </div>

                                {/* Flat */}
                                <div className="col-6 col-md-2 col-lg-1">
                                    <label className="form-label small fw-bold text-muted">Flat</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="e.g. 101"
                                        value={filterFlat}
                                        onChange={(e) => setFilterFlat(e.target.value)}
                                    />
                                </div>

                                {/* Courier */}
                                <div className="col-6 col-md-2 col-lg-2">
                                    <label className="form-label small fw-bold text-muted">Courier / Carrier</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="e.g. Amazon, BlueDart"
                                        value={filterCourier}
                                        onChange={(e) => setFilterCourier(e.target.value)}
                                    />
                                </div>

                                {/* Category */}
                                <div className="col-6 col-md-2 col-lg-2">
                                    <label className="form-label small fw-bold text-muted">Category / Type</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="e.g. NORMAL, FOOD, COD"
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                    />
                                </div>

                                {/* Status */}
                                <div className="col-6 col-md-2 col-lg-1">
                                    <label className="form-label small fw-bold text-muted">Status</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Status"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="col-12 col-md-auto d-flex gap-2 ms-auto">
                                    <button type="submit" className="btn btn-primary btn-sm px-3 fw-bold">
                                        <i className="bi bi-funnel-fill me-1"></i> Apply
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-light border btn-sm px-3 text-muted"
                                        onClick={handleResetFilters}
                                    >
                                        <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Preview Table & Export Actions */}
                    <div className="card border-0 shadow-sm rounded-3 bg-white overflow-hidden">
                        {/* Table Header / Action Bar */}
                        <div className="card-header bg-white border-bottom p-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                            <div className="d-flex align-items-center gap-3">
                                <div>
                                    <h5 className="fw-bold mb-0 text-dark">
                                        {reportData?.title || 'Report Preview'}
                                    </h5>
                                    <small className="text-muted">
                                        Generated on {reportData?.generated_at ? new Date(reportData.generated_at).toLocaleString() : 'Just now'} •{' '}
                                        <span className="fw-bold text-primary">{reportData?.total_records ?? 0}</span> matching records
                                    </small>
                                </div>

                                {reportData?.summary && Object.keys(reportData.summary).length > 0 && (
                                    <div className="d-none d-lg-flex gap-2 ms-3">
                                        {Object.entries(reportData.summary).slice(0, 3).map(([k, v]) => (
                                            <span key={k} className="badge bg-light text-dark border">
                                                {k.replace(/_/g, ' ')}: <strong className="text-primary">{v}</strong>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Export Buttons */}
                            <div className="d-flex gap-2 align-items-center">
                                <span className="small text-muted me-1 fw-semibold d-none d-sm-inline">Export As:</span>
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm"
                                    onClick={() => handleExport('pdf')}
                                    disabled={exportingFormat !== null}
                                >
                                    {exportingFormat === 'pdf' ? (
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : (
                                        <i className="bi bi-file-earmark-pdf-fill"></i>
                                    )}
                                    <span>PDF</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-success btn-sm d-flex align-items-center gap-1 shadow-sm"
                                    onClick={() => handleExport('excel')}
                                    disabled={exportingFormat !== null}
                                >
                                    {exportingFormat === 'excel' ? (
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : (
                                        <i className="bi bi-file-earmark-excel-fill"></i>
                                    )}
                                    <span>Excel</span>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
                                    onClick={() => handleExport('csv')}
                                    disabled={exportingFormat !== null}
                                >
                                    {exportingFormat === 'csv' ? (
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    ) : (
                                        <i className="bi bi-file-earmark-text-fill"></i>
                                    )}
                                    <span>CSV</span>
                                </button>
                            </div>
                        </div>

                        {/* Table Content */}
                        {loadingReport ? (
                            <div className="py-5">
                                <LoadingSpinner message="Generating real-time report preview..." />
                            </div>
                        ) : !reportData || !reportData.rows || reportData.rows.length === 0 ? (
                            <div className="py-5">
                                <EmptyState
                                    icon="bi-table"
                                    title="No records found"
                                    message="No records matched the selected date range and filter criteria. Try adjusting your filters."
                                    action={
                                        <button className="btn btn-outline-primary btn-sm" onClick={handleResetFilters}>
                                            Reset Filters
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: '600px' }}>
                                <table className="table table-hover table-striped align-middle mb-0 text-nowrap">
                                    <thead className="table-light text-uppercase small text-muted position-sticky top-0 shadow-sm">
                                        <tr>
                                            <th style={{ width: '50px' }}>#</th>
                                            {reportData.columns.map((col) => (
                                                <th key={col}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.rows.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="text-muted small">{idx + 1}</td>
                                                {reportData.columns.map((col, colIdx) => {
                                                    const val = Array.isArray(row) ? row[colIdx] : (row[col] ?? row[col.toLowerCase().replace(/[^a-z0-9]/g, '_')]);
                                                    // Render status badges nicely
                                                    if (col.toLowerCase().includes('status')) {
                                                        return (
                                                            <td key={col}>
                                                                <StatusBadge status={val} />
                                                            </td>
                                                        );
                                                    }
                                                    // Render category badges nicely
                                                    if (col.toLowerCase().includes('category') || col.toLowerCase().includes('priority')) {
                                                        const isCritical = ['HIGH', 'CRITICAL', 'COD', 'HIGH_VALUE'].includes(val);
                                                        return (
                                                            <td key={col}>
                                                                <span className={`badge ${isCritical ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-light text-dark border'}`}>
                                                                    {val ?? '—'}
                                                                </span>
                                                            </td>
                                                        );
                                                    }
                                                    // Render rating stars nicely
                                                    if (col.toLowerCase().includes('rating')) {
                                                        return (
                                                            <td key={col}>
                                                                <span className="text-warning fw-bold">★ {val}</span>
                                                            </td>
                                                        );
                                                    }
                                                    return (
                                                        <td key={col} className="small">
                                                            {val !== null && val !== undefined && val !== '' ? String(val) : '—'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Table Footer */}
                        {reportData && reportData.rows && reportData.rows.length > 0 && (
                            <div className="card-footer bg-light border-top p-3 d-flex justify-content-between align-items-center">
                                <small className="text-muted">
                                    Displaying {reportData.rows.length} of {reportData.total_records} records
                                </small>
                                <span className="small text-muted">
                                    Reportlab PDF • OpenPyXL Excel • UTF-8 BOM CSV Supported
                                </span>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* BACKUPS TAB */
                <div>
                    {/* Backup Control Banner */}
                    <div className="card border-0 shadow-sm rounded-3 p-4 mb-4 bg-white">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                            <div>
                                <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                                    <i className="bi bi-database-fill-lock text-primary"></i>
                                    Automated & Manual Database Backups
                                </h4>
                                <p className="text-muted mb-0 small" style={{ maxWidth: '750px' }}>
                                    Consistent online snapshots of the SQLite database are generated using SQLite's live backup API.
                                    Backups are verified with <code>PRAGMA integrity_check</code>, stamped with SHA-256 checksums, and retained for 30 days.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary px-4 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm text-nowrap"
                                onClick={handleCreateBackup}
                                disabled={creatingBackup}
                            >
                                {creatingBackup ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span>Backing up...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-cloud-arrow-down-fill fs-5"></i>
                                        <span>Backup Database Now</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Backups List Table */}
                    <div className="card border-0 shadow-sm rounded-3 bg-white overflow-hidden mb-4">
                        <div className="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-center">
                            <div>
                                <h5 className="fw-bold mb-0 text-dark">Available Backup Snapshots</h5>
                                <small className="text-muted">Direct downloads are authenticated and restricted to administrative roles</small>
                            </div>
                            <button
                                className="btn btn-light btn-sm border text-muted"
                                onClick={fetchBackups}
                                disabled={loadingBackups}
                            >
                                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                            </button>
                        </div>

                        {loadingBackups ? (
                            <div className="py-5">
                                <LoadingSpinner message="Loading backup catalog..." />
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="py-5">
                                <EmptyState
                                    icon="bi-database-slash"
                                    title="No backups found"
                                    message="No database backups have been generated yet. Click 'Backup Database Now' to create your first consistent snapshot."
                                    action={
                                        <button
                                            className="btn btn-primary btn-sm fw-bold"
                                            onClick={handleCreateBackup}
                                            disabled={creatingBackup}
                                        >
                                            Create First Backup
                                        </button>
                                    }
                                />
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 text-nowrap">
                                    <thead className="table-light text-uppercase small text-muted">
                                        <tr>
                                            <th>Filename</th>
                                            <th>Type</th>
                                            <th>Size</th>
                                            <th>SHA-256 Checksum</th>
                                            <th>Status</th>
                                            <th>Created At</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backups.map((b) => (
                                            <tr key={b.id}>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <i className="bi bi-file-earmark-binary text-secondary fs-5"></i>
                                                        <div>
                                                            <div className="fw-bold text-dark">{b.file_name}</div>
                                                            <small className="text-muted">ID: #{b.id}</small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${b.backup_type === 'MANUAL' ? 'bg-info-subtle text-info border border-info-subtle' : 'bg-light text-dark border'}`}>
                                                        {b.backup_type}
                                                    </span>
                                                </td>
                                                <td className="fw-semibold text-secondary">
                                                    {b.file_size_formatted || `${Math.round(b.file_size / 1024)} KB`}
                                                </td>
                                                <td>
                                                    <code className="small text-muted bg-light px-2 py-1 rounded" title={b.checksum_sha256}>
                                                        {b.checksum_sha256 ? `${b.checksum_sha256.substring(0, 16)}...` : 'N/A'}
                                                    </code>
                                                </td>
                                                <td>
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                        <i className="bi bi-check-circle-fill me-1"></i> {b.status}
                                                    </span>
                                                </td>
                                                <td className="small text-muted">
                                                    {new Date(b.created_at).toLocaleString()}
                                                </td>
                                                <td className="text-end">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 shadow-sm"
                                                        onClick={() => handleDownloadBackup(b)}
                                                    >
                                                        <i className="bi bi-download"></i>
                                                        <span>Download</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Disaster Recovery Guide Card */}
                    <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <i className="bi bi-shield-shaded text-primary fs-4"></i>
                            <h5 className="fw-bold mb-0 text-dark">Disaster Recovery & Safe Database Restoration Guide</h5>
                        </div>
                        <p className="text-muted small">
                            In the event of database corruption or hardware failover, follow these documented administrative procedures:
                        </p>
                        <div className="row g-3">
                            <div className="col-12 col-md-6 col-lg-4">
                                <div className="p-3 bg-light rounded-3 h-100 border">
                                    <div className="fw-bold text-dark small mb-1">1. Stop Application Services</div>
                                    <p className="text-muted small mb-0">
                                        Terminate active Django development servers or production WSGI/ASGI workers to ensure zero active file writes to SQLite.
                                    </p>
                                </div>
                            </div>
                            <div className="col-12 col-md-6 col-lg-4">
                                <div className="p-3 bg-light rounded-3 h-100 border">
                                    <div className="fw-bold text-dark small mb-1">2. Archive Corrupt Database</div>
                                    <p className="text-muted small mb-0">
                                        Move the existing <code>backend/db.sqlite3</code> to a safe timestamped folder (e.g. <code>db.sqlite3.bak</code>) before replacement.
                                    </p>
                                </div>
                            </div>
                            <div className="col-12 col-md-6 col-lg-4">
                                <div className="p-3 bg-light rounded-3 h-100 border">
                                    <div className="fw-bold text-dark small mb-1">3. Restore Snapshot File</div>
                                    <p className="text-muted small mb-0">
                                        Copy the downloaded <code>.sqlite3</code> snapshot into <code>backend/db.sqlite3</code> with appropriate read/write system permissions.
                                    </p>
                                </div>
                            </div>
                            <div className="col-12 col-md-6 col-lg-6">
                                <div className="p-3 bg-light rounded-3 h-100 border">
                                    <div className="fw-bold text-dark small mb-1">4. Verify Integrity & SHA256 Checksum</div>
                                    <p className="text-muted small mb-0">
                                        Execute <code>PRAGMA integrity_check;</code> via sqlite3 and compare SHA-256 hash against the backup log record above.
                                    </p>
                                </div>
                            </div>
                            <div className="col-12 col-md-6 col-lg-6">
                                <div className="p-3 bg-light rounded-3 h-100 border">
                                    <div className="fw-bold text-dark small mb-1">5. Restart & Verify System Health</div>
                                    <p className="text-muted small mb-0">
                                        Run <code>python manage.py check</code> and restart application services. Review admin dashboard to verify data consistency.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReports;
