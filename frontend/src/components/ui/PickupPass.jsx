import React from 'react';

const PickupPass = ({ parcel, onClose }) => {
    if (!parcel) return null;

    return (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060, backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-4 shadow-lg overflow-hidden position-relative animate-scale-in mx-3" style={{ maxWidth: '400px', width: '100%', animation: 'fadeIn 0.2s ease-out' }}>
                
                <button 
                    onClick={onClose}
                    className="btn btn-sm btn-light position-absolute top-0 end-0 m-3 rounded-circle d-flex align-items-center justify-content-center" 
                    style={{ width: '32px', height: '32px', zIndex: 10 }}
                >
                    <i className="bi bi-x-lg"></i>
                </button>

                <div className="bg-primary text-white text-center p-4">
                    <div className="d-flex align-items-center justify-content-center gap-2 mb-1 opacity-75">
                        <i className="bi bi-shield-check fs-5"></i>
                        <span className="fw-semibold text-uppercase tracking-wide" style={{ letterSpacing: '0.1em', fontSize: '0.75rem' }}>GateVault</span>
                    </div>
                    <h3 className="fw-bold mb-0">Pickup Pass</h3>
                </div>

                <div className="p-4 text-center">
                    <h5 className="fw-bold text-dark mb-1">{parcel.carrier_name} Delivery</h5>
                    <div className="text-muted small mb-4">Parcel ID: {parcel.parcel_id}</div>

                    <div className="bg-light border rounded-4 p-4 mb-4">
                        <div className="text-uppercase text-muted fw-bold mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Secure PIN</div>
                        <div className="display-3 fw-bold text-dark pin-display lh-1 mb-0">
                            {parcel.pickup_pin}
                        </div>
                    </div>

                    <div className="row g-2 text-start bg-main rounded-3 p-3 mb-4 mx-0">
                        <div className="col-6 border-end">
                            <small className="text-muted d-block text-uppercase mb-1" style={{ fontSize: '0.65rem' }}>Destination</small>
                            <div className="fw-bold text-dark">Flat {parcel.flat_details.number}</div>
                            <div className="small text-muted">{parcel.flat_details.tower_name} Tower</div>
                        </div>
                        <div className="col-6 ps-3">
                            <small className="text-muted d-block text-uppercase mb-1" style={{ fontSize: '0.65rem' }}>Arrived</small>
                            <div className="fw-bold text-dark">{new Date(parcel.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="small text-muted">{new Date(parcel.received_at).toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="d-flex align-items-center justify-content-center text-muted small">
                        <i className="bi bi-info-circle me-2"></i>
                        Show this pass to the gatehouse guard.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PickupPass;
