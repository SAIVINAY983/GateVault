import React from 'react';
import StatusBadge from './StatusBadge';
import { useTranslation } from '../../i18n/i18n';

export const ConditionBadge = ({ condition }) => {
    const { t } = useTranslation();
    switch (condition) {
        case 'DAMAGED':
            return <span className="badge bg-danger text-white"><i className="bi bi-exclamation-triangle-fill me-1"></i>{t('status_labels.DAMAGED', 'Damaged')}</span>;
        case 'TAMPERED':
            return <span className="badge bg-danger text-white"><i className="bi bi-shield-slash-fill me-1"></i>{t('status_labels.TAMPERED', 'Tampered')}</span>;
        case 'OPENED':
            return <span className="badge bg-warning text-dark"><i className="bi bi-box-seam me-1"></i>{t('status_labels.OPEN', 'Opened')}</span>;
        case 'INTACT':
        default:
            return <span className="badge bg-success text-white"><i className="bi bi-shield-check me-1"></i>{t('status_labels.INTACT', 'Intact')}</span>;
    }
};

const ParcelCard = ({ parcel, onClickAction, onDelegateAction, onViewInspectionAction, onGenerateQrAction, isDelegatedToMe }) => {
    const { t, i18n } = useTranslation();
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
                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>{t('resident.parcel_id', 'ID')}: {parcel.parcel_id}</small>
                        </div>
                    </div>
                    <StatusBadge status={parcel.status} isOverdue={parcel.is_overdue} />
                </div>
                
                {parcel.is_delegated && !isDelegatedToMe && (
                    <div className="mb-3 px-3 py-2 bg-info bg-opacity-10 text-info rounded border border-info border-opacity-25 small fw-medium d-flex align-items-center gap-2">
                        <i className="bi bi-person-check"></i>
                        {t('resident.share_with_guest', 'Delegated to')}: {parcel.delegated_to_name}
                    </div>
                )}
                {isDelegatedToMe && (
                    <div className="mb-3 px-3 py-2 bg-success bg-opacity-10 text-success rounded border border-success border-opacity-25 small fw-medium d-flex align-items-center gap-2">
                        <i className="bi bi-person-check-fill"></i>
                        {t('common.status', 'Authorized by')} {parcel.resident_name} ({t('common.flat', 'Flat')} {parcel.flat_details?.number})
                    </div>
                )}
                
                <div className="bg-light rounded p-3 mb-4 flex-grow-1">
                    <div className="row g-2 text-sm">
                        <div className="col-6">
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>{t('resident.arrived_at', 'Arrived')}</small>
                            <div className="fw-medium text-dark">{i18n.formatDate(parcel.received_at)}</div>
                        </div>
                        <div className="col-6">
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>{t('resident.shelf_location', 'Location')}</small>
                            <div className="fw-medium text-dark">{parcel.shelf_name}</div>
                        </div>
                        {parcel.tracking_number && (
                            <div className="col-12 mt-2">
                                <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>{t('resident.tracking_number', 'Tracking')}</small>
                                <div className="fw-medium text-dark">{parcel.tracking_number}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="d-flex flex-column gap-2 mt-auto">
                    {onGenerateQrAction && isPending && (
                        <button onClick={() => onGenerateQrAction(parcel)} className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2 fw-semibold shadow-sm">
                            <i className="bi bi-qr-code"></i>
                            {t('resident.view_qr_pass', 'Generate Pickup QR')}
                        </button>
                    )}
                    {onClickAction && (
                        <button onClick={() => onClickAction(parcel)} className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                            <i className="bi bi-key"></i>
                            {t('resident.pickup_pin', 'View Pickup PIN')}
                        </button>
                    )}
                    {onViewInspectionAction && (
                        <button onClick={() => onViewInspectionAction(parcel)} className="btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                            <i className="bi bi-search"></i>
                            {t('common.details', 'View Inspection Details')}
                        </button>
                    )}
                    {onDelegateAction && !parcel.is_delegated && isPending && (
                        <button onClick={() => onDelegateAction(parcel)} className="btn btn-outline-info w-100 d-flex align-items-center justify-content-center gap-2 py-2">
                            <i className="bi bi-people"></i>
                            {t('resident.share_with_guest', 'Delegate Pickup')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParcelCard;
