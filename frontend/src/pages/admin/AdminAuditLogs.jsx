import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, ErrorState } from '../../components/ui/StateComponents';
import { useTranslation } from '../../i18n/i18n';

const EVENT_TYPES = [
    { value: 'ALL', label: 'All Event Types' },
    { value: 'LOGIN_SUCCESS', label: 'Login Success' },
    { value: 'LOGIN_FAILED', label: 'Login Failed' },
    { value: 'LOGOUT', label: 'Logout' },
    { value: 'USER_REGISTERED', label: 'User Registered' },
    { value: 'ACCOUNT_ACTIVATED', label: 'Account Activated' },
    { value: 'ACCOUNT_DEACTIVATED', label: 'Account Deactivated' },
    { value: 'ROLE_CHANGED', label: 'Role Changed' },
    { value: 'PARCEL_REGISTERED', label: 'Parcel Registered' },
    { value: 'PARCEL_MODIFIED', label: 'Parcel Modified' },
    { value: 'PIN_GENERATED', label: 'PIN Generated' },
    { value: 'PIN_VERIFICATION_FAILED', label: 'PIN Verification Failed' },
    { value: 'PICKUP_SUCCESSFUL', label: 'Pickup Successful' },
    { value: 'QR_VERIFIED', label: 'QR Pass Verified' },
    { value: 'QR_VERIFICATION_FAILED', label: 'QR Verification Failed' },
    { value: 'UNAUTHORIZED_ACCESS_ATTEMPT', label: 'Unauthorized Access Attempt' },
    { value: 'UNAUTHORIZED_ROLE_MUTATION', label: 'Unauthorized Role Mutation' },
    { value: 'INACTIVE_ACCOUNT_ACTIVITY', label: 'Inactive Account Activity' },
    { value: 'TOKEN_REUSE_ATTEMPT', label: 'Token Reuse Attempt' },
    { value: 'SECURITY_ALERT_RESOLVED', label: 'Security Alert Resolved' },
    { value: 'ADMIN_OPERATION', label: 'Admin Operation' }
];

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const ROLES = ['ALL', 'ADMIN', 'GUARD', 'RESIDENT', 'SYSTEM', 'ANONYMOUS'];
const STATUSES = ['ALL', 'SUCCESS', 'FAILED', 'BLOCKED'];

const SEVERITY_BADGE = {
    CRITICAL: 'bg-danger text-white',
    HIGH: 'bg-warning text-dark',
    MEDIUM: 'bg-info text-dark',
    LOW: 'bg-secondary text-white'
};

const STATUS_BADGE = {
    SUCCESS: 'bg-success text-white',
    FAILED: 'bg-danger text-white',
    BLOCKED: 'bg-dark text-white'
};

const AdminAuditLogs = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('LOGS'); // 'LOGS' or 'ALERTS'

    // Stats
    const [stats, setStats] = useState({
        total_events: 0,
        failed_logins_24h: 0,
        failed_verifications_24h: 0,
        unauthorized_attempts_24h: 0,
        open_alerts_count: 0,
        critical_alerts_count: 0,
        high_alerts_count: 0
    });

    // Audit Logs State
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [logsError, setLogsError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Filters for Audit Logs
    const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Security Alerts State
    const [alerts, setAlerts] = useState([]);
    const [alertsLoading, setAlertsLoading] = useState(false);
    const [alertStatusFilter, setAlertStatusFilter] = useState('ALL');
    const [alertSeverityFilter, setAlertSeverityFilter] = useState('ALL');

    // Modals
    const [selectedLog, setSelectedLog] = useState(null);
    const [resolvingAlert, setResolvingAlert] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch Stats
    const fetchStats = async () => {
        try {
            const res = await axiosInstance.get('admin/audit-logs/stats/');
            setStats(res.data);
        } catch (err) {
            console.error('Failed to load audit stats', err);
        }
    };

    // Fetch Logs with Filters & Pagination
    const fetchLogs = async (targetPage = 1) => {
        try {
            setLogsLoading(true);
            setLogsError('');
            const params = { page: targetPage };
            if (eventTypeFilter !== 'ALL') params.event_type = eventTypeFilter;
            if (severityFilter !== 'ALL') params.severity = severityFilter;
            if (roleFilter !== 'ALL') params.actor_role = roleFilter;
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const res = await axiosInstance.get('admin/audit-logs/', { params });
            if (res.data.results) {
                setLogs(res.data.results);
                setTotalCount(res.data.count || 0);
                setTotalPages(Math.ceil((res.data.count || 1) / 25));
            } else if (Array.isArray(res.data)) {
                setLogs(res.data);
                setTotalCount(res.data.length);
                setTotalPages(1);
            }
            setPage(targetPage);
        } catch (err) {
            setLogsError(err.response?.data?.error || 'Failed to load audit logs.');
        } finally {
            setLogsLoading(false);
        }
    };

    // Fetch Security Alerts
    const fetchAlerts = async () => {
        try {
            setAlertsLoading(true);
            const params = {};
            if (alertStatusFilter !== 'ALL') params.status = alertStatusFilter;
            if (alertSeverityFilter !== 'ALL') params.severity = alertSeverityFilter;
            const res = await axiosInstance.get('admin/security-alerts/', { params });
            const list = res.data.results || (Array.isArray(res.data) ? res.data : []);
            setAlerts(list);
        } catch (err) {
            console.error('Failed to load security alerts', err);
        } finally {
            setAlertsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchLogs(1);
    }, [eventTypeFilter, severityFilter, roleFilter, statusFilter, dateFrom, dateTo]);

    useEffect(() => {
        if (activeTab === 'ALERTS') {
            fetchAlerts();
        }
    }, [activeTab, alertStatusFilter, alertSeverityFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchLogs(1);
    };

    const handleResetFilters = () => {
        setEventTypeFilter('ALL');
        setSeverityFilter('ALL');
        setRoleFilter('ALL');
        setStatusFilter('ALL');
        setSearchQuery('');
        setDateFrom('');
        setDateTo('');
    };

    const handleReviewAlert = async (alertId) => {
        try {
            setActionLoading(true);
            await axiosInstance.post(`admin/security-alerts/${alertId}/review/`);
            await fetchAlerts();
            await fetchStats();
        } catch (err) {
            alert('Failed to review alert: ' + (err.response?.data?.error || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolveAlert = async (e) => {
        e.preventDefault();
        if (!resolvingAlert) return;
        try {
            setActionLoading(true);
            await axiosInstance.post(`admin/security-alerts/${resolvingAlert.id}/resolve/`, {
                resolution_notes: resolutionNotes
            });
            setResolvingAlert(null);
            setResolutionNotes('');
            await fetchAlerts();
            await fetchStats();
        } catch (err) {
            alert('Failed to resolve alert: ' + (err.response?.data?.error || err.message));
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="container-fluid py-4 px-2 px-md-4">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                        <i className="bi bi-shield-shaded text-primary"></i>
                        Audit & Security Monitoring
                    </h2>
                    <p className="text-muted mb-0">
                        Centralized, tamper-resistant audit logs and suspicious activity detection engine.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button 
                        className="btn btn-outline-secondary d-flex align-items-center gap-2"
                        onClick={() => { fetchStats(); if (activeTab === 'LOGS') fetchLogs(page); else fetchAlerts(); }}
                        disabled={logsLoading || alertsLoading}
                    >
                        <i className="bi bi-arrow-clockwise"></i> Refresh
                    </button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase">Total Events</div>
                                <div className="fs-3 fw-bold text-dark mt-1">{stats.total_events}</div>
                                <div className="small text-muted mt-1">Recorded audit trails</div>
                            </div>
                            <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-3">
                                <i className="bi bi-journal-text fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase">Failed Logins (24h)</div>
                                <div className={`fs-3 fw-bold mt-1 ${stats.failed_logins_24h > 0 ? 'text-danger' : 'text-dark'}`}>
                                    {stats.failed_logins_24h}
                                </div>
                                <div className="small text-muted mt-1">Authentication failures</div>
                            </div>
                            <div className="bg-danger bg-opacity-10 text-danger rounded-3 p-3">
                                <i className="bi bi-key-fill fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase">Verification Failures (24h)</div>
                                <div className={`fs-3 fw-bold mt-1 ${stats.failed_verifications_24h > 0 ? 'text-warning' : 'text-dark'}`}>
                                    {stats.failed_verifications_24h}
                                </div>
                                <div className="small text-muted mt-1">Incorrect PIN / invalid QR</div>
                            </div>
                            <div className="bg-warning bg-opacity-10 text-warning rounded-3 p-3">
                                <i className="bi bi-qr-code-scan fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100">
                        <div className="d-flex justify-content-between align-items-start">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase">Active Security Alerts</div>
                                <div className="fs-3 fw-bold text-dark mt-1 d-flex align-items-center gap-2">
                                    {stats.open_alerts_count}
                                    {stats.critical_alerts_count > 0 && (
                                        <span className="badge bg-danger fs-6">{stats.critical_alerts_count} Critical</span>
                                    )}
                                </div>
                                <div className="small text-muted mt-1">Suspicious detections open</div>
                            </div>
                            <div className="bg-danger bg-opacity-10 text-danger rounded-3 p-3">
                                <i className="bi bi-exclamation-octagon-fill fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mb-4 gap-2 bg-white p-2 rounded-4 shadow-sm border">
                <li className="nav-item">
                    <button 
                        className={`nav-link rounded-3 fw-semibold px-4 d-flex align-items-center gap-2 ${activeTab === 'LOGS' ? 'active' : ''}`}
                        onClick={() => setActiveTab('LOGS')}
                    >
                        <i className="bi bi-list-columns-reverse"></i> Audit Event Logs
                    </button>
                </li>
                <li className="nav-item">
                    <button 
                        className={`nav-link rounded-3 fw-semibold px-4 d-flex align-items-center gap-2 ${activeTab === 'ALERTS' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ALERTS')}
                    >
                        <i className="bi bi-shield-exclamation"></i> Suspicious Activity Alerts
                        {stats.open_alerts_count > 0 && (
                            <span className="badge bg-danger rounded-pill">{stats.open_alerts_count}</span>
                        )}
                    </button>
                </li>
            </ul>

            {/* TAB 1: AUDIT EVENT LOGS */}
            {activeTab === 'LOGS' && (
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                    {/* Filters Toolbar */}
                    <div className="p-3 p-md-4 border-bottom bg-light bg-opacity-50">
                        <form onSubmit={handleSearchSubmit}>
                            <div className="row g-3">
                                <div className="col-12 col-md-4 col-xl-3">
                                    <div className="input-group">
                                        <span className="input-group-text bg-white border-end-0">
                                            <i className="bi bi-search text-muted"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0"
                                            placeholder="Search description, user, IP..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="col-6 col-md-3 col-xl-2">
                                    <select
                                        className="form-select"
                                        value={eventTypeFilter}
                                        onChange={(e) => setEventTypeFilter(e.target.value)}
                                    >
                                        {EVENT_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-6 col-md-2 col-xl-2">
                                    <select
                                        className="form-select"
                                        value={severityFilter}
                                        onChange={(e) => setSeverityFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Severities</option>
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </div>

                                <div className="col-6 col-md-2 col-xl-2">
                                    <select
                                        className="form-select"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="SUCCESS">Success</option>
                                        <option value="FAILED">Failed</option>
                                        <option value="BLOCKED">Blocked</option>
                                    </select>
                                </div>

                                <div className="col-6 col-md-2 col-xl-1">
                                    <select
                                        className="form-select"
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                    >
                                        <option value="ALL">Role</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="GUARD">Guard</option>
                                        <option value="RESIDENT">Resident</option>
                                        <option value="SYSTEM">System</option>
                                    </select>
                                </div>

                                <div className="col-12 col-xl-2 d-flex gap-2">
                                    <button type="submit" className="btn btn-primary flex-grow-1 fw-semibold">
                                        <i className="bi bi-funnel-fill me-1"></i> Apply
                                    </button>
                                    <button type="button" className="btn btn-outline-secondary" onClick={handleResetFilters} title="Reset">
                                        <i className="bi bi-x-circle"></i>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Table */}
                    {logsLoading ? (
                        <div className="p-5 text-center">
                            <LoadingSpinner message="Loading audit trails..." />
                        </div>
                    ) : logsError ? (
                        <div className="p-4">
                            <ErrorState message={logsError} onRetry={() => fetchLogs(page)} />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="bi bi-shield-check fs-1 text-muted d-block mb-2"></i>
                            <h5 className="fw-bold text-dark">No Audit Records Found</h5>
                            <p className="text-muted small">No security or operational events match the current filter criteria.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light text-uppercase small text-muted">
                                    <tr>
                                        <th style={{ width: '160px' }}>Timestamp</th>
                                        <th>Event Type</th>
                                        <th>Severity</th>
                                        <th>Actor</th>
                                        <th>Target</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>IP Address</th>
                                        <th className="text-end">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id}>
                                            <td className="small text-muted font-monospace">
                                                {new Date(log.timestamp).toLocaleString(undefined, {
                                                    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                })}
                                            </td>
                                            <td>
                                                <span className="fw-semibold text-dark small">{log.event_type}</span>
                                            </td>
                                            <td>
                                                <span className={`badge rounded-pill small px-2 py-1 ${SEVERITY_BADGE[log.severity] || 'bg-secondary'}`}>
                                                    {log.severity}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fw-medium small text-dark">{log.actor_username || 'System'}</div>
                                                <span className="badge bg-light text-muted border small" style={{ fontSize: '0.65rem' }}>
                                                    {log.actor_role}
                                                </span>
                                            </td>
                                            <td>
                                                {log.target_entity_type ? (
                                                    <div className="small">
                                                        <span className="text-muted">{log.target_entity_type}:</span>{' '}
                                                        <strong className="text-dark">{log.target_entity_id || '-'}</strong>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted small">-</span>
                                                )}
                                            </td>
                                            <td className="small text-dark text-truncate" style={{ maxWidth: '280px' }}>
                                                {log.action_description}
                                            </td>
                                            <td>
                                                <span className={`badge rounded-pill small px-2 ${STATUS_BADGE[log.status] || 'bg-secondary'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="small text-muted font-monospace">
                                                {log.ip_address || '-'}
                                            </td>
                                            <td className="text-end">
                                                <button
                                                    className="btn btn-sm btn-outline-primary rounded-3"
                                                    onClick={() => setSelectedLog(log)}
                                                >
                                                    <i className="bi bi-eye"></i> View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-3 border-top d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                Showing page {page} of {totalPages} ({totalCount} total entries)
                            </small>
                            <div className="btn-group">
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    disabled={page <= 1 || logsLoading}
                                    onClick={() => fetchLogs(page - 1)}
                                >
                                    <i className="bi bi-chevron-left"></i> Previous
                                </button>
                                <button
                                    className="btn btn-sm btn-outline-secondary"
                                    disabled={page >= totalPages || logsLoading}
                                    onClick={() => fetchLogs(page + 1)}
                                >
                                    Next <i className="bi bi-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: SUSPICIOUS ACTIVITY ALERTS */}
            {activeTab === 'ALERTS' && (
                <div>
                    {/* Alerts Toolbar */}
                    <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
                        <div className="row g-3 align-items-center">
                            <div className="col-12 col-md-6 col-lg-4">
                                <div className="d-flex gap-2">
                                    <select
                                        className="form-select"
                                        value={alertStatusFilter}
                                        onChange={(e) => setAlertStatusFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Statuses</option>
                                        <option value="OPEN">Open Only</option>
                                        <option value="REVIEWED">Reviewed</option>
                                        <option value="RESOLVED">Resolved</option>
                                    </select>
                                    <select
                                        className="form-select"
                                        value={alertSeverityFilter}
                                        onChange={(e) => setAlertSeverityFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Severities</option>
                                        <option value="CRITICAL">Critical</option>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                    </select>
                                </div>
                            </div>
                            <div className="col-12 col-md-6 col-lg-8 text-md-end text-muted small">
                                Suspicious patterns are detected using real-time sliding windows to prevent brute-force and privilege escalations.
                            </div>
                        </div>
                    </div>

                    {alertsLoading ? (
                        <div className="p-5 text-center">
                            <LoadingSpinner message="Loading suspicious activity alerts..." />
                        </div>
                    ) : alerts.length === 0 ? (
                        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                            <i className="bi bi-shield-check fs-1 text-success d-block mb-3"></i>
                            <h4 className="fw-bold text-dark">No Active Security Alerts</h4>
                            <p className="text-muted mb-0">System integrity is normal. No suspicious activity detected matching criteria.</p>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {alerts.map(alertItem => (
                                <div key={alertItem.id} className="col-12">
                                    <div className={`card border-0 shadow-sm rounded-4 p-4 bg-white border-start border-4 ${alertItem.severity === 'CRITICAL' ? 'border-danger' : alertItem.severity === 'HIGH' ? 'border-warning' : 'border-info'}`}>
                                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3">
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-2">
                                                    <span className={`badge rounded-pill ${SEVERITY_BADGE[alertItem.severity] || 'bg-secondary'}`}>
                                                        {alertItem.severity}
                                                    </span>
                                                    <span className={`badge rounded-pill ${alertItem.status === 'RESOLVED' ? 'bg-success text-white' : alertItem.status === 'REVIEWED' ? 'bg-info text-dark' : 'bg-danger text-white'}`}>
                                                        {alertItem.status}
                                                    </span>
                                                    <span className="badge bg-light text-muted border font-monospace small">
                                                        {alertItem.alert_id}
                                                    </span>
                                                    <span className="small text-muted">
                                                        Detected {alertItem.event_count} time{alertItem.event_count !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <h5 className="fw-bold text-dark mb-1">{alertItem.title}</h5>
                                                <p className="text-secondary small mb-3">{alertItem.details}</p>

                                                <div className="d-flex flex-wrap gap-3 text-muted small">
                                                    <div>
                                                        <i className="bi bi-person me-1"></i>
                                                        Account: <strong className="text-dark">{alertItem.affected_username || 'Anonymous'}</strong>
                                                    </div>
                                                    <div>
                                                        <i className="bi bi-hdd-network me-1"></i>
                                                        IP: <strong className="text-dark">{alertItem.source_ip || '127.0.0.1'}</strong>
                                                    </div>
                                                    <div>
                                                        <i className="bi bi-clock me-1"></i>
                                                        Last detected:{' '}
                                                        <span className="text-dark">
                                                            {new Date(alertItem.last_detected_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {alertItem.resolved_by_name && (
                                                        <div className="text-success">
                                                            <i className="bi bi-check-circle me-1"></i>
                                                            Resolved by {alertItem.resolved_by_name} ({alertItem.resolution_notes || 'Resolved'})
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="d-flex gap-2">
                                                {alertItem.status === 'OPEN' && (
                                                    <button
                                                        className="btn btn-sm btn-outline-info rounded-3"
                                                        onClick={() => handleReviewAlert(alertItem.id)}
                                                        disabled={actionLoading}
                                                    >
                                                        <i className="bi bi-eye me-1"></i> Mark Reviewed
                                                    </button>
                                                )}
                                                {alertItem.status !== 'RESOLVED' && (
                                                    <button
                                                        className="btn btn-sm btn-success rounded-3"
                                                        onClick={() => { setResolvingAlert(alertItem); setResolutionNotes(''); }}
                                                        disabled={actionLoading}
                                                    >
                                                        <i className="bi bi-check-lg me-1"></i> Resolve
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: AUDIT LOG DETAILS */}
            {selectedLog && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header bg-primary text-white p-3 p-md-4">
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-shield-check fs-4"></i>
                                    <div>
                                        <h5 className="modal-title fw-bold mb-0">Audit Record Details</h5>
                                        <small className="opacity-75 font-monospace">{selectedLog.event_id}</small>
                                    </div>
                                </div>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedLog(null)}></button>
                            </div>

                            <div className="modal-body p-4">
                                <div className="row g-3 mb-4">
                                    <div className="col-6 col-md-3">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>Event Type</small>
                                        <div className="fw-bold text-dark">{selectedLog.event_type}</div>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>Severity</small>
                                        <span className={`badge rounded-pill ${SEVERITY_BADGE[selectedLog.severity]}`}>
                                            {selectedLog.severity}
                                        </span>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>Status</small>
                                        <span className={`badge rounded-pill ${STATUS_BADGE[selectedLog.status]}`}>
                                            {selectedLog.status}
                                        </span>
                                    </div>
                                    <div className="col-6 col-md-3">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>IP Address</small>
                                        <div className="font-monospace text-dark">{selectedLog.ip_address || '127.0.0.1'}</div>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>Actor</small>
                                        <div className="fw-semibold text-dark">
                                            {selectedLog.actor_name} ({selectedLog.actor_role})
                                        </div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>Target Entity</small>
                                        <div className="fw-semibold text-dark">
                                            {selectedLog.target_entity_type ? `${selectedLog.target_entity_type}: ${selectedLog.target_entity_id}` : 'None'}
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <small className="text-muted text-uppercase d-block fw-bold" style={{ fontSize: '0.7rem' }}>Description</small>
                                        <div className="p-3 bg-light rounded-3 text-dark">{selectedLog.action_description}</div>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <small className="text-muted text-uppercase d-block fw-bold mb-2" style={{ fontSize: '0.7rem' }}>Safe Metadata Payload</small>
                                    <pre className="bg-dark text-light p-3 rounded-3 small font-monospace mb-0" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            <div className="modal-footer bg-light p-3">
                                <button type="button" className="btn btn-secondary rounded-3 px-4" onClick={() => setSelectedLog(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 2: RESOLVE SECURITY ALERT */}
            {resolvingAlert && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <form onSubmit={handleResolveAlert}>
                                <div className="modal-header bg-success text-white p-3 p-md-4">
                                    <h5 className="modal-title fw-bold mb-0">Resolve Security Alert</h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setResolvingAlert(null)}></button>
                                </div>

                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Alert</label>
                                        <div className="fw-bold text-dark">{resolvingAlert.title}</div>
                                        <div className="small text-muted mt-1">{resolvingAlert.details}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label text-muted small fw-bold text-uppercase">Resolution Notes *</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="Explain actions taken to mitigate or resolve this security alert..."
                                            value={resolutionNotes}
                                            onChange={(e) => setResolutionNotes(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light p-3">
                                    <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setResolvingAlert(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-success rounded-3 px-4 fw-bold" disabled={actionLoading}>
                                        {actionLoading ? 'Resolving...' : 'Confirm Resolution'}
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

export default AdminAuditLogs;

