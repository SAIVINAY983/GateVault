import React from 'react';

const StatusBadge = ({ status, isOverdue }) => {
    let colorClass = 'bg-secondary text-white';
    let label = status;
    let icon = 'bi-circle';

    if (status === 'HANDED_OVER') {
        colorClass = 'bg-success text-white';
        label = 'Handed Over';
        icon = 'bi-check-circle-fill';
    } else if (status === 'DELIVERED_DIRECTLY_TO_FLAT') {
        colorClass = 'bg-info text-dark';
        label = 'Direct to Flat';
        icon = 'bi-house-check-fill';
    } else if (status === 'DELIVERY_ATTEMPTED') {
        colorClass = 'bg-danger text-white';
        label = 'Delivery Attempted';
        icon = 'bi-arrow-return-left';
    } else if (status === 'RECEIVED_AT_GATEHOUSE') {
        colorClass = 'bg-primary text-white';
        label = 'At Gatehouse';
        icon = 'bi-box-seam';
    } else if (isOverdue) {
        colorClass = 'bg-danger text-white';
        label = 'Overdue';
        icon = 'bi-exclamation-triangle-fill';
    } else if (status === 'AWAITING_PICKUP') {
        colorClass = 'bg-warning text-dark';
        label = 'Awaiting Pickup';
        icon = 'bi-clock-fill';
    } else if (status === 'CANCELLED') {
        colorClass = 'bg-secondary text-white';
        label = 'Cancelled';
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
