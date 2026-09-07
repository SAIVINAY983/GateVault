import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import ParcelCard from '../../components/ui/ParcelCard';
import PickupPass from '../../components/ui/PickupPass';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const ResidentDashboard = () => {
    const [parcels, setParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedParcel, setSelectedParcel] = useState(null);

    const fetchParcels = async () => {
        try {
            setLoading(true);
            setError(false);
            const res = await axiosInstance.get('resident/parcels/');
            setParcels(res.data);
        } catch (err) {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchParcels();
    }, []);

    if (loading) return <LoadingSpinner message="Loading your parcels..." />;
    if (error) return <ErrorState message="Unable to load parcel information." onRetry={fetchParcels} />;

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

            <h5 className="fw-bold mb-4">Your Pending Parcels</h5>
            
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
                            <ParcelCard parcel={parcel} onClickAction={setSelectedParcel} />
                        </div>
                    ))}
                </div>
            )}

            {selectedParcel && (
                <PickupPass parcel={selectedParcel} onClose={() => setSelectedParcel(null)} />
            )}
        </div>
    );
};

export default ResidentDashboard;
