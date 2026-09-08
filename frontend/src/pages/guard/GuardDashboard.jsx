import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const GuardDashboard = () => {
    const [parcels, setParcels] = useState([]);
    const [expectedDeliveries, setExpectedDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedExpected, setSelectedExpected] = useState(null);
    const navigate = useNavigate();

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError('');
            const [parcelsRes, expectedRes] = await Promise.all([
                axiosInstance.get('parcels/pending/'),
                axiosInstance.get('expected-deliveries/')
            ]);
            setParcels(parcelsRes.data);
            
            // Only show active expected deliveries for today or earlier
            const activeExpected = expectedRes.data.filter(e => e.status === 'EXPECTED');
            setExpectedDeliveries(activeExpected);
        } catch (err) {
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) return <LoadingSpinner message="Loading gatehouse data..." />;
    if (error) return <ErrorState message={error} onRetry={fetchDashboardData} />;

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
                <div className="col-4 col-md-2">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-warning">
                        <h3 className="fw-bold mb-0 me-3">{parcels.filter(p => !p.is_overdue).length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Pending</div>
                    </div>
                </div>
                <div className="col-4 col-md-2">
                    <div className="gv-card p-3 d-flex align-items-center border-start border-4 border-info">
                        <h3 className="fw-bold mb-0 me-3">{expectedDeliveries.length}</h3>
                        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>Expected Today</div>
                    </div>
                </div>
                <div className="col-4 col-md-2">
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

            {/* EXPECTED DELIVERIES SECTION */}
            <div className="gv-card overflow-hidden mb-5 border-info border-opacity-50">
                <div className="card-header bg-white p-3 border-bottom d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between">
                    <div>
                        <h5 className="fw-bold mb-0 text-info">EXPECTED DELIVERIES</h5>
                        <p className="text-muted small mb-0 mt-1">Deliveries residents have registered as expected.</p>
                    </div>
                    <span className="badge bg-info mt-2 mt-sm-0 rounded-pill text-dark">{expectedDeliveries.length} Expected</span>
                </div>
                
                {expectedDeliveries.length === 0 ? (
                    <div className="p-4">
                        <EmptyState 
                            icon="bi-box-seam" 
                            title="No expected deliveries." 
                            message="Residents have not registered any upcoming deliveries." 
                        />
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 border-0">
                            <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4 py-3 fw-semibold border-bottom-0">Resident</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Flat</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Tracking ID</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Courier</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Payment</th>
                                    <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Action</th>
                                </tr>
                            </thead>
                            <tbody className="border-top-0">
                                {expectedDeliveries.map(exp => (
                                    <tr key={exp.id}>
                                        <td className="ps-4 py-3 fw-bold text-dark">{exp.resident_name}</td>
                                        <td className="py-3 text-muted">{exp.flat_display}</td>
                                        <td className="py-3 fw-medium">{exp.tracking_id}</td>
                                        <td className="py-3">
                                            {exp.courier_name}
                                            {exp.delivery_type === 'FOOD' && <span className="badge bg-warning text-dark ms-2">Food</span>}
                                        </td>
                                        <td className="py-3">
                                            {exp.payment_type === 'COD' ? (
                                                <span className="text-danger fw-semibold">COD (₹{exp.cod_amount})</span>
                                            ) : (
                                                <span className="text-success fw-semibold">Prepaid</span>
                                            )}
                                        </td>
                                        <td className="pe-4 py-3 text-end">
                                            <button onClick={() => setSelectedExpected(exp)} className="btn btn-sm btn-outline-info fw-medium">
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
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
                                            {p.resident_name ? (
                                                <div className="fw-medium text-dark">{p.resident_name}</div>
                                            ) : (
                                                <div className="d-flex align-items-center gap-1 text-warning bg-warning bg-opacity-10 px-2 py-1 rounded d-inline-block small fw-bold">
                                                    <i className="bi bi-exclamation-triangle-fill"></i> Unassigned Resident (Verify ID)
                                                </div>
                                            )}
                                            <div className="text-muted small mt-1">Flat {p.flat_details?.number}</div>
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
                                            <button onClick={() => navigate('/guard/verify', { state: { parcel_id: p.parcel_id } })} className="btn btn-sm btn-outline-primary fw-medium">
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

            {/* View Details Modal for Expected Delivery */}
            {selectedExpected && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg overflow-hidden">
                            <div className="modal-header bg-light border-0 px-4 py-3">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-card-heading text-info me-2"></i>
                                    Expected Delivery Details
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedExpected(null)}></button>
                            </div>
                            <div className="modal-body px-4 py-4">
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Resident</small>
                                        <div className="fw-medium fs-6">{selectedExpected.resident_name}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Flat</small>
                                        <div className="fw-medium fs-6">{selectedExpected.flat_display}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Tracking ID</small>
                                        <div className="fw-medium text-dark">{selectedExpected.tracking_id}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Courier</small>
                                        <div className="fw-medium text-dark">{selectedExpected.courier_name}</div>
                                    </div>
                                    {selectedExpected.order_id && (
                                        <div className="col-6">
                                            <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Order ID</small>
                                            <div className="fw-medium text-dark">{selectedExpected.order_id}</div>
                                        </div>
                                    )}
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Payment</small>
                                        <div className={`fw-bold ${selectedExpected.payment_type === 'COD' ? 'text-danger' : 'text-success'}`}>
                                            {selectedExpected.payment_type === 'COD' ? `COD (₹${selectedExpected.cod_amount})` : 'Prepaid'}
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Expected Date</small>
                                        <div className="fw-medium text-dark">{new Date(selectedExpected.expected_delivery_date).toLocaleDateString('en-GB')}</div>
                                    </div>
                                    <div className="col-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>Status</small>
                                        <div><span className="badge bg-info">{selectedExpected.status}</span></div>
                                    </div>
                                </div>
                                {selectedExpected.note && (
                                    <div className="mb-3 p-3 bg-light rounded border">
                                        <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.75rem' }}>Resident Note</small>
                                        <div>{selectedExpected.note}</div>
                                    </div>
                                )}
                                {selectedExpected.delivery_photo && (
                                    <div className="text-center">
                                        <a href={selectedExpected.delivery_photo} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary w-100">
                                            <i className="bi bi-image me-2"></i>View Delivery Screenshot
                                        </a>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-0 px-4 pb-4">
                                <button type="button" className="btn btn-light w-100 fw-medium border" onClick={() => setSelectedExpected(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardDashboard;
