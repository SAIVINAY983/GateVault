import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const AdminHistory = () => {
    const [activeTab, setActiveTab] = useState('PARCELS');
    const [history, setHistory] = useState([]);
    const [guestPickups, setGuestPickups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingGuest, setLoadingGuest] = useState(false);
    const [error, setError] = useState('');
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [carrierFilter, setCarrierFilter] = useState('ALL');
    const [towerFilter, setTowerFilter] = useState('ALL');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                setError('');
                const [resHistory, resGuest] = await Promise.allSettled([
                    axiosInstance.get('admin/parcel-history/'),
                    axiosInstance.get('admin/guest-pickups/')
                ]);

                if (resHistory.status === 'fulfilled') {
                    setHistory(resHistory.value.data);
                } else {
                    setError('Failed to load parcel history');
                }

                if (resGuest.status === 'fulfilled') {
                    setGuestPickups(Array.isArray(resGuest.value.data) ? resGuest.value.data : []);
                }
            } catch (err) {
                setError('Failed to load history data');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    if (loading) return <LoadingSpinner message="Loading complete history..." />;
    if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

    // Derive filter options from data
    const carriers = [...new Set(history.map(p => p.carrier_name))].sort();
    const towers = [...new Set(history.map(p => p.flat_details.tower_name))].sort();

    // Apply filters
    const filteredHistory = history.filter(p => {
        // Status Filter
        if (statusFilter !== 'ALL') {
            if (statusFilter === 'PENDING' && (p.status !== 'AWAITING_PICKUP' || p.is_overdue)) return false;
            if (statusFilter === 'OVERDUE' && !p.is_overdue) return false;
            if (statusFilter === 'HANDED_OVER' && p.status !== 'HANDED_OVER') return false;
            if (statusFilter === 'DIRECT_TO_FLAT' && p.status !== 'DELIVERED_DIRECTLY_TO_FLAT') return false;
        }
        
        // Carrier Filter
        if (carrierFilter !== 'ALL' && p.carrier_name !== carrierFilter) return false;
        
        // Tower Filter
        if (towerFilter !== 'ALL' && p.flat_details.tower_name !== towerFilter) return false;

        // Search Filter (ID or Resident Name or Flat)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const idMatch = p.parcel_id.toLowerCase().includes(query);
            const nameMatch = (p.resident_name || '').toLowerCase().includes(query);
            const flatMatch = p.flat_details?.number?.toLowerCase().includes(query) || false;
            if (!idMatch && !nameMatch && !flatMatch) return false;
        }

        return true;
    }).sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return new Date(b.received_at) - new Date(a.received_at);
    });

    return (
        <div className="container-fluid px-0">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Parcel & Handover History</h2>
                    <p className="text-muted">Complete audit log of all gatehouse parcel activity and temporary guest authorizations.</p>
                </div>
                <div className="nav nav-pills bg-light p-1 rounded-3 border">
                    <button
                        className={`nav-link px-3 py-2 fw-semibold d-flex align-items-center gap-2 ${activeTab === 'PARCELS' ? 'active shadow-xs' : 'text-muted'}`}
                        onClick={() => setActiveTab('PARCELS')}
                    >
                        <i className="bi bi-box-seam"></i>
                        <span>Parcels History</span>
                        <span className="badge bg-light text-dark ms-1">{history.length}</span>
                    </button>
                    <button
                        className={`nav-link px-3 py-2 fw-semibold d-flex align-items-center gap-2 ${activeTab === 'GUEST_PICKUPS' ? 'active shadow-xs' : 'text-muted'}`}
                        onClick={() => setActiveTab('GUEST_PICKUPS')}
                    >
                        <i className="bi bi-person-badge"></i>
                        <span>Guest Passes Audit</span>
                        <span className="badge bg-light text-dark ms-1">{guestPickups.length}</span>
                    </button>
                </div>
            </div>
            
            {activeTab === 'PARCELS' && (
                <div className="gv-card overflow-hidden">
                <div className="card-header bg-white p-4 border-bottom">
                    <div className="row g-3">
                        <div className="col-12 col-md-4">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <i className="bi bi-search text-muted"></i>
                                </span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 ps-0 bg-light" 
                                    placeholder="Search ID, Name, or Flat..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-12 col-sm-4 col-md-2">
                            <select className="form-select bg-light" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="OVERDUE">Overdue</option>
                                <option value="HANDED_OVER">Handed Over</option>
                                <option value="DIRECT_TO_FLAT">Direct to Flat</option>
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-3">
                            <select className="form-select bg-light" value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)}>
                                <option value="ALL">All Carriers</option>
                                {carriers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="col-12 col-sm-4 col-md-3">
                            <select className="form-select bg-light" value={towerFilter} onChange={(e) => setTowerFilter(e.target.value)}>
                                <option value="ALL">All Towers</option>
                                {towers.map(t => <option key={t} value={t}>Tower {t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 border-0">
                        <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                            <tr>
                                <th className="ps-4 py-3 fw-semibold border-bottom-0">Parcel Details</th>
                                <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                <th className="py-3 fw-semibold border-bottom-0">Resident Info</th>
                                <th className="py-3 fw-semibold border-bottom-0">Timeline</th>
                            </tr>
                        </thead>
                        <tbody className="border-top-0">
                            {filteredHistory.map(p => (
                                <tr key={p.id}>
                                    <td className="ps-4 py-3">
                                        <div className="fw-bold text-dark">{p.parcel_id}</div>
                                        <div className="d-flex align-items-center gap-1 text-muted small mt-1">
                                            <i className="bi bi-box"></i> {p.carrier_name}
                                        </div>
                                    </td>
                                    <td className="py-3">
                                        <StatusBadge status={p.status} isOverdue={p.is_overdue} />
                                    </td>
                                    <td className="py-3">
                                        {p.resident_name ? (
                                            <div className="fw-medium text-dark">{p.resident_name}</div>
                                        ) : (
                                            <div className="d-flex align-items-center gap-1 text-danger bg-danger bg-opacity-10 px-2 py-1 rounded d-inline-block small fw-medium" title="Click to map to resident">
                                                <i className="bi bi-exclamation-triangle-fill"></i> Unregistered Flat Member
                                            </div>
                                        )}
                                        <div className="text-muted small mt-1">Flat {p.flat_details?.number} ({p.flat_details?.tower_name})</div>
                                        {p.actual_receiver_name && p.actual_receiver_name !== p.resident_name && (
                                            <div className="text-primary small fw-semibold mt-1">
                                                <i className="bi bi-people-fill me-1"></i>Receiver: {p.actual_receiver_name} {p.receiver_relationship ? `(${p.receiver_relationship})` : ''}
                                            </div>
                                        )}
                                        {p.delivery_location === 'DIRECT_TO_FLAT' && (
                                            <div className="text-success small" style={{ fontSize: '0.75rem' }}>
                                                <i className="bi bi-door-closed-fill me-1"></i>Direct Handover ({p.direct_delivery_verification})
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <div className="small text-muted mb-1">
                                            In: <span className="text-dark fw-medium">{new Date(p.received_at).toLocaleDateString()} {new Date(p.received_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="small text-muted">
                                            Out: {p.handed_over_at ? (
                                                <span className="text-success fw-medium">{new Date(p.handed_over_at).toLocaleDateString()} {new Date(p.handed_over_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </div>
                                        {p.payment_type === 'COD' && p.payment_status === 'PAID' && (
                                            <div className="small text-muted mt-2 pt-1 border-top" style={{ fontSize: '0.7rem' }}>
                                                Payment: COD ({p.payment_method})<br/>
                                                Verified by <strong>{p.payment_confirmed_by_username || 'Unknown'}</strong> at {p.payment_confirmed_at ? new Date(p.payment_confirmed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredHistory.length === 0 && (
                    <div className="p-5 border-top">
                        <EmptyState 
                            icon="bi-search" 
                            title="No matching parcels found" 
                            message="Try adjusting your filters or search query to find what you're looking for." 
                        />
                    </div>
                )}
            </div>
            )}

            {activeTab === 'GUEST_PICKUPS' && (
                <div className="gv-card overflow-hidden">
                    <div className="card-header bg-white p-4 border-bottom d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="fw-bold text-dark mb-0">Temporary Guest Pickup Passes Audit</h5>
                            <small className="text-muted">History of one-time guest passes generated by residents and handover records.</small>
                        </div>
                        <span className="badge bg-primary px-3 py-2">{guestPickups.length} Total Passes</span>
                    </div>

                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 border-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold border-bottom-0">Pass Code & Status</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Parcel Details</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Resident Owner</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Authorized Guest</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Collection & Verification</th>
                                </tr>
                            </thead>
                            <tbody className="border-top-0">
                                {guestPickups.map(auth => (
                                    <tr key={auth.id}>
                                        <td className="ps-4 py-3">
                                            <div className="fw-bold font-monospace text-dark fs-6">{auth.pass_code}</div>
                                            <div className="mt-1">
                                                {auth.status === 'ACTIVE' && (
                                                    <span className="badge bg-success">Active</span>
                                                )}
                                                {auth.status === 'USED' && (
                                                    <span className="badge bg-secondary">Used / Handed Over</span>
                                                )}
                                                {auth.status === 'REVOKED' && (
                                                    <span className="badge bg-danger">Revoked</span>
                                                )}
                                                {auth.status === 'EXPIRED' && (
                                                    <span className="badge bg-warning text-dark">Expired</span>
                                                )}
                                            </div>
                                            <div className="text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                                                Expires: {new Date(auth.expires_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="fw-bold text-primary">{auth.parcel_id_str}</div>
                                            <div className="text-muted small">{auth.carrier_name}</div>
                                            <div className="text-muted small">Flat {auth.flat_number} ({auth.tower_name})</div>
                                        </td>
                                        <td className="py-3">
                                            <div className="fw-bold text-dark">{auth.resident_name}</div>
                                            <div className="text-muted small" style={{ fontSize: '0.7rem' }}>
                                                Created: {new Date(auth.created_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="fw-bold text-dark">{auth.guest_name}</div>
                                            <div className="text-muted small"><i className="bi bi-telephone me-1"></i>{auth.guest_mobile}</div>
                                            <span className="badge bg-light text-primary border" style={{ fontSize: '0.65rem' }}>
                                                {auth.relationship_display}
                                            </span>
                                            {auth.instructions && (
                                                <div className="small text-muted mt-1 fst-italic">"{auth.instructions}"</div>
                                            )}
                                        </td>
                                        <td className="py-3">
                                            {auth.status === 'USED' ? (
                                                <div>
                                                    <div className="text-success fw-bold small">
                                                        <i className="bi bi-check-circle-fill me-1"></i>Collected by: {auth.actual_collector_name || auth.guest_name}
                                                    </div>
                                                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                                        Guard: <strong>{auth.verified_by_guard_name || 'Guard'}</strong>
                                                    </div>
                                                    <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                                        Time: {auth.used_at ? new Date(auth.used_at).toLocaleString() : '-'}
                                                    </div>
                                                </div>
                                            ) : auth.status === 'REVOKED' ? (
                                                <div className="text-danger small">
                                                    Revoked {auth.revoked_at ? `on ${new Date(auth.revoked_at).toLocaleString()}` : ''}
                                                    {auth.revoked_by_name && ` by ${auth.revoked_by_name}`}
                                                </div>
                                            ) : (
                                                <div className="text-muted small">
                                                    {auth.verified_by_guard_name ? `Verified by ${auth.verified_by_guard_name}` : 'Awaiting guest pickup'}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {guestPickups.length === 0 && (
                        <div className="p-5 border-top">
                            <EmptyState 
                                icon="bi-person-badge" 
                                title="No guest pickup passes found" 
                                message="No temporary guest pickup passes have been generated by residents yet." 
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminHistory;
