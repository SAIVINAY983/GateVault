import React from 'react';
import { useTranslation } from '../../i18n/i18n';

const StatusBadge = ({ status, isOverdue }) => {
    const { t } = useTranslation();
    let colorClass = 'bg-secondary text-white';
    let label = status;
    let icon = 'bi-circle';

    if (status === 'HANDED_OVER') {
        colorClass = 'bg-success text-white';
        label = t('status_labels.HANDED_OVER', 'Handed Over');
        icon = 'bi-check-circle-fill';
    } else if (status === 'DELIVERED_DIRECTLY_TO_FLAT') {
        colorClass = 'bg-info text-dark';
        label = t('status_labels.DELIVERED_DIRECTLY_TO_FLAT', 'Direct to Flat');
        icon = 'bi-house-check-fill';
    } else if (status === 'DELIVERY_ATTEMPTED') {
        colorClass = 'bg-danger text-white';
        label = t('status_labels.DELIVERY_ATTEMPTED', 'Delivery Attempted');
        icon = 'bi-arrow-return-left';
    } else if (status === 'RECEIVED_AT_GATEHOUSE') {
        colorClass = 'bg-primary text-white';
        label = t('status_labels.RECEIVED_AT_GATEHOUSE', 'At Gatehouse');
        icon = 'bi-box-seam';
    } else if (isOverdue) {
        colorClass = 'bg-danger text-white';
        label = t('notifications_page.overdue_title', 'Overdue');
        icon = 'bi-exclamation-triangle-fill';
    } else if (status === 'AWAITING_PICKUP') {
        colorClass = 'bg-warning text-dark';
        label = t('status_labels.AWAITING_PICKUP', 'Awaiting Pickup');
        icon = 'bi-clock-fill';
    } else if (status === 'CANCELLED') {
        colorClass = 'bg-secondary text-white';
        label = t('status_labels.CANCELLED', 'Cancelled');
        icon = 'bi-x-circle-fill';
    }

    return (
        <span className={`badge rounded-pill px-3 py-2 fw-medium shadow-sm ${colorClass}`} style={{ fontSize: '0.75rem' }}>
            <i className={`bi ${icon} me-1`}></i>
            {label}
        </span>
    );
};

export default StatusBadge;
