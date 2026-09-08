import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { Link } from 'react-router-dom';
import ParcelCard from '../../components/ui/ParcelCard';
import PickupPass from '../../components/ui/PickupPass';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const ResidentDashboard = () => {
    const [parcels, setParcels] = useState([]);
    const [expectedDeliveries, setExpectedDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(false);
            const [parcelRes, expectedRes] = await Promise.all([
                axiosInstance.get('resident/parcels/'),
                axiosInstance.get('expected-deliveries/')
            ]);
            setParcels(parcelRes.data);
            setExpectedDeliveries(expectedRes.data);
        } catch (err) {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) return <LoadingSpinner message="Loading your dashboard..." />;
    if (error) return <ErrorState message="Unable to load dashboard information." onRetry={fetchDashboardData} />;

    const pendingParcels = parcels.filter(p => p.status === 'AWAITING_PICKUP' || p.is_overdue);

    return (
        <div className="container-fluid px-0">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Good evening, Resident</h2>
                <p className="text-muted">Your parcels are safe at the gatehouse.</p>
            </div>
            
            <div className="row g-3 mb-5">
                <div className="col-12 col-md-4">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-warning bg-opacity-10 text-warning rounded p-3 me-3">
                            <i className="bi bi-box-seam fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{pendingParcels.filter(p => !p.is_overdue).length}</h4>
                            <span className="text-muted small text-uppercase">Pending</span>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-danger bg-opacity-10 text-danger rounded p-3 me-3">
                            <i className="bi bi-exclamation-triangle fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{pendingParcels.filter(p => p.is_overdue).length}</h4>
                            <span className="text-muted small text-uppercase">Overdue</span>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-md-4">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-success bg-opacity-10 text-success rounded p-3 me-3">
                            <i className="bi bi-check2-circle fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{parcels.filter(p => p.status === 'HANDED_OVER').length}</h4>
                            <span className="text-muted small text-uppercase">Collected</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-4 mt-5">
                <h5 className="fw-bold mb-0">Your Pending Parcels</h5>
                <Link to="/resident/send-delivery" className="gv-btn-primary d-flex align-items-center gap-2 text-decoration-none">
                    <i className="bi bi-calendar-plus"></i>
                    <span className="d-none d-sm-inline">Send Delivery Details</span>
                    <span className="d-sm-none">Pre-register</span>
                </Link>
            </div>
            
            {pendingParcels.length === 0 ? (
                <EmptyState 
                    icon="bi-box2-heart" 
                    title="You're all caught up." 
                    message="No parcels are currently waiting for pickup at the gatehouse." 
                />
            ) : (
                <div className="row g-4">
                    {pendingParcels.map(parcel => (
                        <div className="col-12 col-md-6 col-xl-4" key={parcel.id}>
                            <div className={`gv-card overflow-hidden h-100 position-relative ${parcel.is_overdue ? 'border-danger' : 'border-primary border-opacity-50'}`} style={{ borderWidth: parcel.is_overdue ? '2px' : '1px' }}>
                                {parcel.is_overdue && (
                                    <div className="bg-danger text-white text-center py-2 px-3 small fw-bold text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                        <i className="bi bi-exclamation-triangle-fill me-2 pulse"></i> Overdue {'>'}48 hrs - Please collect immediately
                                    </div>
                                )}
                                <div className="p-4 bg-light border-bottom d-flex justify-content-between align-items-start">
                                    <div>
                                        <span className="badge bg-primary mb-2 px-2 py-1"><i className="bi bi-box-seam me-1"></i>{parcel.carrier_name}</span>
                                        {parcel.payment_type === 'COD' && (
                                            <span className="badge bg-success ms-2 mb-2 px-2 py-1">
                                                <i className="bi bi-cash me-1"></i> COD Paid via {parcel.payment_method} (₹{parcel.cod_amount})
                                            </span>
                                        )}
                                        <div className="fw-bold text-dark mb-1">{parcel.parcel_id}</div>
                                        <div className="text-muted small">Arrived: {new Date(parcel.received_at).toLocaleDateString('en-GB')} {new Date(parcel.received_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                </div>
                                <div className="p-4 text-center">
                                    <div className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>SHOW THIS PIN AT GATEHOUSE</div>
                                    <div className="d-inline-block bg-white border border-2 border-primary rounded p-3 mb-3 mx-auto shadow-sm">
                                        <div className="display-5 fw-bold text-dark pin-display tracking-widest px-2 lh-1" style={{ letterSpacing: '0.3em', fontFamily: 'monospace' }}>
                                            [ {parcel.pickup_pin.split('').join('  ')} ]
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-center gap-2 text-primary bg-primary bg-opacity-10 py-2 px-3 rounded mx-auto mb-2" style={{ width: 'fit-content' }}>
                                        <i className="bi bi-geo-alt-fill"></i>
                                        <span className="fw-bold small text-uppercase">Assigned Slot: {parcel.shelf_name}</span>
                                    </div>
                                    {parcel.payment_type === 'COD' && (
                                        <div className="alert alert-success mt-3 mb-0 py-2 px-3 small border-0 d-flex align-items-center justify-content-center rounded-3 text-start mx-auto" style={{ maxWidth: '350px' }}>
                                            <i className="bi bi-shield-check me-2 fs-4"></i>
                                            <span>Payment confirmed by gatehouse staff. No further payment required on pickup.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* EXPECTED DELIVERIES SECTION */}
            <div className="mt-5 mb-4">
                <h5 className="fw-bold mb-3">My Expected Deliveries</h5>
                {expectedDeliveries.length === 0 ? (
                    <div className="bg-light border rounded-3 p-4 text-center text-muted small">
                        You have no expected deliveries registered.
                    </div>
                ) : (
                    <div className="row g-3">
                        {expectedDeliveries.map(exp => (
                            <div className="col-12 col-xl-6" key={exp.id}>
                                <div className="gv-card border-0 shadow-sm bg-white p-3 d-flex flex-column h-100">
                                    <div className="d-flex justify-content-between align-items-start mb-2 border-bottom pb-2">
                                        <div>
                                            <span className="fw-bold text-dark fs-5">{exp.courier_name}</span>
                                            {exp.delivery_type === 'FOOD' && <span className="badge bg-warning ms-2"><i className="bi bi-cup-straw"></i> Food</span>}
                                        </div>
                                        <span className={`badge ${exp.status === 'EXPECTED' ? 'bg-primary' : 'bg-secondary'}`}>{exp.status}</span>
                                    </div>
                                    <div className="row g-2 small mt-1">
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Tracking ID</span>
                                            <span className="fw-medium text-dark">{exp.tracking_id}</span>
                                        </div>
                                        {exp.order_id && (
                                            <div className="col-6">
                                                <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Order ID</span>
                                                <span className="fw-medium text-dark">{exp.order_id}</span>
                                            </div>
                                        )}
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Expected Date</span>
                                            <span className="fw-medium text-dark">{new Date(exp.expected_delivery_date).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Payment</span>
                                            <span className={`fw-medium ${exp.payment_type === 'COD' ? 'text-danger' : 'text-success'}`}>
                                                {exp.payment_type === 'COD' ? `COD (₹${exp.cod_amount})` : 'Prepaid'}
                                            </span>
                                        </div>
                                    </div>
                                    {exp.delivery_photo && (
                                        <div className="mt-3 pt-2 border-top">
                                            <a href={exp.delivery_photo} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary py-1">
                                                <i className="bi bi-image me-1"></i> View Screenshot
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResidentDashboard;
