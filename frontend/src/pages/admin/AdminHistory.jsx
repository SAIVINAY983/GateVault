import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const AdminHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
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
                const res = await axiosInstance.get('admin/parcel-history/');
                setHistory(res.data);
            } catch (err) {
                setError('Failed to load parcel history');
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
            const flatMatch = p.flat_details.number.toLowerCase().includes(query);
            if (!idMatch && !nameMatch && !flatMatch) return false;
        }

        return true;
    });

    return (
        <div className="container-fluid px-0">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Parcel History</h2>
                <p className="text-muted">Complete audit log of all gatehouse parcel activity.</p>
            </div>
            
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
                                <option value="HANDED_OVER">Completed</option>
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
                                        <div className="fw-medium text-dark">{p.resident_name || 'Unassigned'}</div>
                                        <div className="text-muted small mt-1">Flat {p.flat_details.number} ({p.flat_details.tower_name})</div>
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
        </div>
    );
};

export default AdminHistory;
