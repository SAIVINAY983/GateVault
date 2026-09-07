import React from 'react';

export const LoadingSpinner = ({ message = "Loading data..." }) => (
    <div className="d-flex flex-column align-items-center justify-content-center p-5 text-muted">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
        </div>
        <div className="fw-medium">{message}</div>
    </div>
);

export const EmptyState = ({ icon = "bi-inbox", title = "No data found", message, action }) => (
    <div className="text-center p-5 rounded-4 bg-white border border-light shadow-sm">
        <div className="d-inline-flex align-items-center justify-content-center bg-light text-muted rounded-circle mb-4" style={{ width: '80px', height: '80px' }}>
            <i className={`bi ${icon} fs-1`}></i>
        </div>
        <h4 className="fw-bold text-dark mb-2">{title}</h4>
        <p className="text-muted mb-4 mx-auto" style={{ maxWidth: '400px' }}>{message}</p>
        {action && action}
    </div>
);

export const ErrorState = ({ message = "Something went wrong.", onRetry }) => (
    <div className="alert alert-danger rounded-3 shadow-sm border-0 d-flex align-items-center justify-content-between p-4 my-4">
        <div className="d-flex align-items-center">
            <i className="bi bi-exclamation-triangle-fill fs-3 me-3"></i>
            <div>
                <h6 className="fw-bold mb-1">Error Loading Data</h6>
                <div className="text-danger opacity-75 small">{message}</div>
            </div>
        </div>
        {onRetry && (
            <button onClick={onRetry} className="btn btn-outline-danger btn-sm fw-bold">
                Try Again
            </button>
        )}
    </div>
);
