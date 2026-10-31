import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import StatusBadge from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const ResidentHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [feedbackMap, setFeedbackMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            setError(false);
            const [parcelsRes, feedbackRes] = await Promise.allSettled([
                axiosInstance.get('resident/parcels/'),
                axiosInstance.get('resident/feedback/')
            ]);

            const data = parcelsRes.status === 'fulfilled' && Array.isArray(parcelsRes.value?.data) ? parcelsRes.value.data : [];
            const filtered = data.filter(p => p.status === 'HANDED_OVER' || p.status === 'DELIVERED_DIRECTLY_TO_FLAT' || p.status === 'CANCELLED');
            filtered.sort((a, b) => new Date(b.handed_over_at) - new Date(a.handed_over_at));
            setHistory(filtered);

            if (feedbackRes.status === 'fulfilled' && Array.isArray(feedbackRes.value?.data)) {
                const map = {};
                feedbackRes.value.data.forEach(f => {
                    if (f.parcel) map[f.parcel] = f;
                });
                setFeedbackMap(map);
            }
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
                                        <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                        <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Feedback</th>
                                    </tr>
                                </thead>
                                <tbody className="border-top-0">
                                    {history.map(parcel => {
                                        let rDate = new Date(parcel.received_at);
                                        let cDate = new Date(parcel.handed_over_at);
                                        if (cDate < rDate) {
                                            const temp = rDate; rDate = cDate; cDate = temp;
                                        }
                                        const rFormat = rDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + rDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        const cFormat = cDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + cDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        
                                        return (
                                        <tr key={parcel.id}>
                                            <td className="ps-4 py-3 text-dark fw-medium">{parcel.parcel_id}</td>
                                            <td className="py-3">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-box text-muted"></i>
                                                    {parcel.carrier_name}
                                                    {parcel.payment_type === 'COD' && (
                                                        <span className="badge bg-success bg-opacity-10 text-success ms-1" style={{ fontSize: '0.65rem' }}>COD</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 text-muted">
                                                <div className="d-flex flex-column">
                                                    <span>{rFormat}</span>
                                                    {parcel.payment_type === 'COD' ? (
                                                        <span className="text-success small fw-medium"><i className="bi bi-cash"></i> COD Paid via {parcel.payment_method} (₹{parcel.cod_amount})</span>
                                                    ) : (
                                                        <span className="text-muted small"><i className="bi bi-credit-card"></i> Prepaid</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 fw-medium text-dark">
                                                <div className="d-flex flex-column">
                                                    <span>{cFormat}</span>
                                                    {parcel.collected_by_role_type === 'DELEGATED_FLATMATE' ? (
                                                        <span className="text-info small fw-bold"><i className="bi bi-person-check"></i> {parcel.delegated_to_name} (Delegate)</span>
                                                    ) : parcel.collected_by_role_type === 'HOUSEHOLD_MEMBER' || (parcel.actual_receiver_name && parcel.actual_receiver_name !== parcel.resident_name) ? (
                                                        <span className="text-primary small fw-bold"><i className="bi bi-people-fill"></i> {parcel.actual_receiver_name || parcel.collected_by_name} {parcel.receiver_relationship ? `(${parcel.receiver_relationship})` : ''}</span>
                                                    ) : (
                                                        <span className="text-muted small">Me</span>
                                                    )}
                                                    {parcel.delivery_location === 'DIRECT_TO_FLAT' && (
                                                        <span className="text-success small" style={{ fontSize: '0.7rem' }}>
                                                            <i className="bi bi-door-closed-fill"></i> Handed at Flat ({parcel.direct_delivery_verification || 'Doorstep'})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3"><StatusBadge status={parcel.status} /></td>
                                            <td className="pe-4 py-3 text-end">
                                                {feedbackMap[parcel.id] ? (
                                                    <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25" title="Feedback submitted">
                                                        <i className="bi bi-star-fill text-warning me-1"></i>
                                                        {feedbackMap[parcel.id].rating}★ Rated
                                                    </span>
                                                ) : parcel.status === 'HANDED_OVER' || parcel.status === 'DELIVERED_DIRECTLY_TO_FLAT' ? (
                                                    <button
                                                        onClick={() => navigate('/resident/feedback', { state: { rateParcelId: parcel.id } })}
                                                        className="btn btn-outline-warning btn-sm fw-semibold"
                                                    >
                                                        <i className="bi bi-star me-1"></i> Rate
                                                    </button>
                                                ) : (
                                                    <span className="text-muted small">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Timeline/Card View */}
                    <div className="d-md-none row g-3">
                        {history.map(parcel => {
                            let rDate = new Date(parcel.received_at);
                            let cDate = new Date(parcel.handed_over_at);
                            if (cDate < rDate) {
                                const temp = rDate; rDate = cDate; cDate = temp;
                            }
                            const rFormat = rDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + rDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                            const cFormat = cDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + cDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                            return (
                            <div className="col-12" key={parcel.id}>
                                <div className="gv-card p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="fw-bold">
                                            {parcel.carrier_name}
                                            {parcel.payment_type === 'COD' && <span className="badge bg-success bg-opacity-10 text-success ms-2" style={{ fontSize: '0.65rem' }}>COD</span>}
                                        </div>
                                        <StatusBadge status={parcel.status} />
                                    </div>
                                    <div className="text-muted small mb-3">ID: {parcel.parcel_id}</div>
                                    
                                    <div className="d-flex align-items-center gap-2 text-muted small mb-1">
                                        <i className="bi bi-box-arrow-in-right text-secondary"></i>
                                        Arrived: <span className="text-dark fw-medium">{rFormat}</span>
                                    </div>
                                    <div className="text-muted small mb-1 ms-4">
                                        {parcel.payment_type === 'COD' ? (
                                            <span className="text-success fw-medium"><i className="bi bi-cash"></i> COD Paid via {parcel.payment_method} (₹{parcel.cod_amount})</span>
                                        ) : (
                                            <span><i className="bi bi-credit-card"></i> Prepaid</span>
                                        )}
                                    </div>
                                    <div className="d-flex align-items-center gap-2 text-muted small">
                                        <i className="bi bi-check-circle-fill text-success"></i>
                                        Collected: <span className="text-dark fw-medium">{cFormat}</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2 text-muted small mt-1 ms-4">
                                        Collected By: <span className="text-dark fw-medium">
                                            {parcel.collected_by_role_type === 'DELEGATED_FLATMATE' ? (
                                                `${parcel.delegated_to_name} (Delegate)`
                                            ) : parcel.collected_by_role_type === 'HOUSEHOLD_MEMBER' || (parcel.actual_receiver_name && parcel.actual_receiver_name !== parcel.resident_name) ? (
                                                `${parcel.actual_receiver_name || parcel.collected_by_name} (${parcel.receiver_relationship || 'Household'})`
                                            ) : (
                                                'Me'
                                            )}
                                        </span>
                                    </div>
                                    {parcel.delivery_location === 'DIRECT_TO_FLAT' && (
                                        <div className="small text-success mt-1 ms-4">
                                            <i className="bi bi-door-closed-fill me-1"></i>Handed at Flat ({parcel.direct_delivery_verification})
                                        </div>
                                    )}

                                    {feedbackMap[parcel.id] ? (
                                        <div className="mt-3 pt-2 border-top d-flex justify-content-between align-items-center">
                                            <span className="small text-muted">Your Rating:</span>
                                            <span className="badge bg-warning bg-opacity-10 text-dark">
                                                <i className="bi bi-star-fill text-warning me-1"></i>
                                                {feedbackMap[parcel.id].rating}★ Rated
                                            </span>
                                        </div>
                                    ) : (parcel.status === 'HANDED_OVER' || parcel.status === 'DELIVERED_DIRECTLY_TO_FLAT') && (
                                        <div className="mt-3 pt-2 border-top text-end">
                                            <button
                                                onClick={() => navigate('/resident/feedback', { state: { rateParcelId: parcel.id } })}
                                                className="btn btn-warning btn-sm text-dark fw-bold w-100"
                                            >
                                                <i className="bi bi-star-fill me-1"></i> Rate Your Experience
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )})}
                    </div>
                </>
            )}
        </div>
    );
};

export default ResidentHistory;
