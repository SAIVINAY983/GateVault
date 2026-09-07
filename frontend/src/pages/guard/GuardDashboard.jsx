import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const GuardDashboard = () => {
    const [parcels, setParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const fetchParcels = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await axiosInstance.get('guard/pending-parcels/');
            setParcels(res.data);
        } catch (err) {
            setError('Failed to load pending parcels');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchParcels();
    }, []);

    if (loading) return <LoadingSpinner message="Loading gatehouse data..." />;
    if (error) return <ErrorState message={error} onRetry={fetchParcels} />;

    return (
        <div className="container-fluid px-0">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Gatehouse Operations</h2>
                    <p className="text-muted mb-0">Manage incoming deliveries and resident handovers.</p>
                </div>
                <div className="d-flex gap-2">
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
            
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-warning">
                        <h3 className="fw-bold mb-0 me-3">{parcels.filter(p => !p.is_overdue).length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Pending</div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
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
                        <h3 className="fw-bold mb-0 me-3">--</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Handed Over</div>
                    </div>
                </div>
            </div>

            <div className="gv-card overflow-hidden">
                <div className="card-header bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
                    <h5 className="fw-bold mb-0">Parcels Awaiting Pickup</h5>
                    <span className="badge bg-primary rounded-pill">{parcels.length} Total</span>
                </div>
                
                {parcels.length === 0 ? (
                    <div className="p-4">
                        <EmptyState 
                            icon="bi-check-all" 
                            title="Gatehouse is clear." 
                            message="No parcels are currently waiting for resident pickup." 
                        />
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 border-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold border-bottom-0">Parcel ID</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Resident / Flat</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Carrier</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Location</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                    <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody className="border-top-0">
                                {parcels.map(p => (
                                    <tr key={p.id}>
                                        <td className="ps-4 py-3 fw-bold text-dark">{p.parcel_id}</td>
                                        <td className="py-3">
                                            <div className="fw-medium text-dark">{p.resident_name || 'Unassigned'}</div>
                                            <div className="text-muted small">Flat {p.flat_details.number}</div>
                                        </td>
                                        <td className="py-3">
                                            <div className="d-flex align-items-center gap-1">
                                                <i className="bi bi-box text-muted"></i>
                                                {p.carrier_name}
                                            </div>
                                        </td>
                                        <td className="py-3 fw-medium">{p.shelf_name}</td>
                                        <td className="py-3"><StatusBadge status={p.status} isOverdue={p.is_overdue} /></td>
                                        <td className="pe-4 py-3 text-end">
                                            <button onClick={() => navigate('/guard/verify')} className="btn btn-sm btn-outline-primary fw-medium">
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
        </div>
    );
};

export default GuardDashboard;
