import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const ResidentHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError(false);
            const res = await axiosInstance.get('resident/parcels/');
            // Only show handed over / past history here
            setHistory(res.data.filter(p => p.status === 'HANDED_OVER' || p.status === 'CANCELLED'));
        } catch (err) {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    if (loading) return <LoadingSpinner message="Loading your delivery history..." />;
    if (error) return <ErrorState message="Unable to load parcel history." onRetry={fetchHistory} />;

    return (
        <div className="container-fluid px-0">
            <h4 className="fw-bold text-dark mb-4">Delivery History</h4>

            {history.length === 0 ? (
                <EmptyState 
                    icon="bi-clock-history" 
                    title="No delivery history yet." 
                    message="Once you collect a parcel from the gatehouse, it will appear here." 
                />
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="d-none d-md-block gv-card overflow-hidden">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0 border-0">
                                <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                    <tr>
                                        <th className="ps-4 py-3 fw-semibold border-bottom-0">Parcel ID</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Carrier</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Received Time</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Collected Time</th>
                                        <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="border-top-0">
                                    {history.map(parcel => (
                                        <tr key={parcel.id}>
                                            <td className="ps-4 py-3 text-dark fw-medium">{parcel.parcel_id}</td>
                                            <td className="py-3">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-box text-muted"></i>
                                                    {parcel.carrier_name}
                                                </div>
                                            </td>
                                            <td className="py-3 text-muted">{new Date(parcel.received_at).toLocaleString()}</td>
                                            <td className="py-3 fw-medium text-dark">{new Date(parcel.handed_over_at).toLocaleString()}</td>
                                            <td className="pe-4 py-3 text-end"><StatusBadge status={parcel.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Timeline/Card View */}
                    <div className="d-md-none row g-3">
                        {history.map(parcel => (
                            <div className="col-12" key={parcel.id}>
                                <div className="gv-card p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="fw-bold">{parcel.carrier_name}</div>
                                        <StatusBadge status={parcel.status} />
                                    </div>
                                    <div className="text-muted small mb-3">ID: {parcel.parcel_id}</div>
                                    
                                    <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                                        <i className="bi bi-box-arrow-in-right text-secondary"></i>
                                        Arrived: <span className="text-dark fw-medium">{new Date(parcel.received_at).toLocaleString()}</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2 text-muted small">
                                        <i className="bi bi-check-circle-fill text-success"></i>
                                        Collected: <span className="text-dark fw-medium">{new Date(parcel.handed_over_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ResidentHistory;
