import React from 'react';
import StatusBadge from './StatusBadge';

export const ConditionBadge = ({ condition }) => {
    switch (condition) {
        case 'DAMAGED':
            return <span className="badge bg-danger text-white"><i className="bi bi-exclamation-triangle-fill me-1"></i>Damaged</span>;
        case 'TAMPERED':
            return <span className="badge bg-danger text-white"><i className="bi bi-shield-slash-fill me-1"></i>Tampered</span>;
        case 'OPENED':
            return <span className="badge bg-warning text-dark"><i className="bi bi-box-seam me-1"></i>Opened</span>;
        case 'INTACT':
        default:
            return <span className="badge bg-success text-white"><i className="bi bi-shield-check me-1"></i>Intact</span>;
    }
};

const ParcelCard = ({ parcel, onClickAction, onDelegateAction, onViewInspectionAction, onGenerateQrAction, isDelegatedToMe }) => {
    const isPending = parcel.status === 'AWAITING_PICKUP' || parcel.is_overdue;
    return (
        <div className="gv-card h-100">
            <div className="card-body p-4 d-flex flex-column h-100">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <div className="bg-light rounded p-2 text-primary d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                            <i className="bi bi-box-seam fs-5"></i>
                        </div>
                        <div>
                            <div className="d-flex align-items-center gap-2">
                                <h6 className="mb-0 fw-bold">{parcel.carrier_name}</h6>
                                <ConditionBadge condition={parcel.condition} />
                            </div>
                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>ID: {parcel.parcel_id}</small>
                        </div>
                    </div>
                    <StatusBadge status={parcel.status} isOverdue={parcel.is_overdue} />
                </div>
                
                {parcel.is_delegated && !isDelegatedToMe && (
                    <div className="mb-3 px-3 py-2 bg-info bg-opacity-10 text-info rounded border border-info border-opacity-25 small fw-medium d-flex align-items-center gap-2">
                        <i className="bi bi-person-check"></i>
                        Delegated to: {parcel.delegated_to_name}
                    </div>
                )}
                {isDelegatedToMe && (
                    <div className="mb-3 px-3 py-2 bg-success bg-opacity-10 text-success rounded border border-success border-opacity-25 small fw-medium d-flex align-items-center gap-2">
                        <i className="bi bi-person-check-fill"></i>
                        Authorized by {parcel.resident_name} (Flat {parcel.flat_details?.number})
                    </div>
                )}
                
                <div className="bg-light rounded p-3 mb-4 flex-grow-1">
                    <div className="row g-2 text-sm">
                        <div className="col-6">
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Arrived</small>
                            <div className="fw-medium text-dark">{new Date(parcel.received_at).toLocaleDateString()}</div>
                        </div>
                        <div className="col-6">
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Location</small>
                            <div className="fw-medium text-dark">{parcel.shelf_name}</div>
                        </div>
                        {parcel.tracking_number && (
                            <div className="col-12 mt-2">
                                <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Tracking</small>
                                <div className="fw-medium text-dark">{parcel.tracking_number}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="d-flex flex-column gap-2 mt-auto">
                    {onGenerateQrAction && isPending && (
                        <button onClick={() => onGenerateQrAction(parcel)} className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold shadow-sm">
                            <i className="bi bi-qr-code"></i>
                            Generate Pickup QR
                        </button>
                    )}
                    {onClickAction && (
                        <button onClick={() => onClickAction(parcel)} className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                            <i className="bi bi-key"></i>
                            View 4-Digit PIN
                        </button>
                    )}
                    {onViewInspectionAction && (
                        <button onClick={() => onViewInspectionAction(parcel)} className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                            <i className="bi bi-search"></i>
                            View Inspection Details
                        </button>
                    )}
                    {onDelegateAction && !parcel.is_delegated && isPending && (
                        <button onClick={() => onDelegateAction(parcel)} className="btn btn-outline-info w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                            <i className="bi bi-people"></i>
                            Delegate Pickup
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParcelCard;
