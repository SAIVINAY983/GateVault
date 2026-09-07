import React from 'react';

const DashboardCard = ({ title, value, subtitle, icon, colorClass = 'text-primary' }) => {
    return (
        <div className="gv-card h-100 d-flex flex-column">
            <div className="card-body p-4 d-flex align-items-start justify-content-between">
                <div>
                    <h6 className="text-muted text-uppercase fw-semibold mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                        {title}
                    </h6>
                    <h2 className="display-6 fw-bold text-dark mb-1">{value}</h2>
                    {subtitle && <small className="text-muted fw-medium">{subtitle}</small>}
                </div>
                <div className={`rounded p-3 bg-light ${colorClass}`}>
                    <i className={`bi ${icon} fs-4`}></i>
                </div>
            </div>
        </div>
    );
};

export default DashboardCard;
