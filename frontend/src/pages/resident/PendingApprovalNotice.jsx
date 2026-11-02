import React, { useContext, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';

const PendingApprovalNotice = () => {
    const { user, logout, updateUserApprovalStatus } = useContext(AuthContext);
    const navigate = useNavigate();
    const [checking, setChecking] = useState(false);
    const [checkMessage, setCheckMessage] = useState('');

    const handleSignOut = () => {
        logout();
        navigate('/login');
    };

    const handleCheckStatus = async () => {
        setChecking(true);
        setCheckMessage('');
        try {
            // Check if profile has been updated/approved
            const res = await axiosInstance.get('notifications/unread-count/');
            // If the user is approved, the API request succeeds without 403
            setCheckMessage('Status updated! Redirecting to your dashboard...');
            updateUserApprovalStatus && updateUserApprovalStatus('APPROVED');
            setTimeout(() => {
                navigate('/resident');
            }, 1000);
        } catch (err) {
            if (err.response?.status === 403) {
                setCheckMessage('Your account is still awaiting Community Admin approval. Please check back shortly.');
            } else {
                setCheckMessage('Could not verify status. Please try again.');
            }
        } finally {
            setChecking(false);
        }
    };

    const isRejected = user?.approval_status === 'REJECTED';

    return (
        <div className="container py-5 d-flex align-items-center justify-content-center min-vh-100">
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden" style={{ maxWidth: '580px', width: '100%' }}>
                {/* Header Strip */}
                <div className={`p-4 text-center text-white ${isRejected ? 'bg-danger' : 'bg-primary'}`} 
                     style={{ background: isRejected ? 'linear-gradient(135deg, #ef4444, #991b1b)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                    <div className="bg-white bg-opacity-25 rounded-circle d-inline-flex p-3 mb-3">
                        <i className={`bi ${isRejected ? 'bi-shield-x' : 'bi-clock-history'} fs-1`}></i>
                    </div>
                    <h3 className="fw-bold mb-1">
                        {isRejected ? 'Registration Not Approved' : 'Registration Pending Approval'}
                    </h3>
                    <p className="mb-0 text-white-50 small">
                        {isRejected ? 'GateVault Community Access Denied' : 'GateVault Community Security Verification'}
                    </p>
                </div>

                {/* Body Content */}
                <div className="card-body p-4 p-md-5">
                    {checkMessage && (
                        <div className={`alert ${checkMessage.includes('Redirecting') ? 'alert-success' : 'alert-warning'} border-0 rounded-3 mb-4 p-3 small`}>
                            <i className="bi bi-info-circle me-1"></i> {checkMessage}
                        </div>
                    )}

                    <div className="mb-4">
                        <p className="text-muted leading-relaxed">
                            {isRejected ? (
                                <>
                                    Your resident registration request for <strong>GateVault</strong> was reviewed and not approved by the Community Admin.
                                </>
                            ) : (
                                <>
                                    Thank you for registering with <strong>GateVault</strong>. To maintain high community security and protect resident deliveries, all new accounts require verification by the Community Admin before access is granted.
                                </>
                            )}
                        </p>
                    </div>

                    {/* Account Details Box */}
                    <div className="bg-light rounded-3 p-3 mb-4 border">
                        <h6 className="fw-bold text-dark small text-uppercase mb-3" style={{ letterSpacing: '0.05em' }}>
                            Registration Details
                        </h6>
                        <div className="d-flex justify-content-between py-1 border-bottom small">
                            <span className="text-muted">Resident Name:</span>
                            <span className="fw-semibold text-dark">{user?.name || user?.username || 'Resident'}</span>
                        </div>
                        <div className="d-flex justify-content-between py-1 border-bottom small">
                            <span className="text-muted">Account Email:</span>
                            <span className="fw-semibold text-dark">{user?.email || 'N/A'}</span>
                        </div>
                        {user?.tower && (
                            <div className="d-flex justify-content-between py-1 border-bottom small">
                                <span className="text-muted">Assigned Tower:</span>
                                <span className="fw-semibold text-dark">{user.tower}</span>
                            </div>
                        )}
                        {user?.flat && (
                            <div className="d-flex justify-content-between py-1 border-bottom small">
                                <span className="text-muted">Flat Number:</span>
                                <span className="fw-semibold text-dark">Flat {user.flat}</span>
                            </div>
                        )}
                        <div className="d-flex justify-content-between py-1 small">
                            <span className="text-muted">Current Status:</span>
                            <span className={`badge ${isRejected ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                {isRejected ? 'REJECTED' : 'PENDING APPROVAL'}
                            </span>
                        </div>
                    </div>

                    {/* Rejection reason if applicable */}
                    {isRejected && user?.rejection_reason && (
                        <div className="alert alert-danger border-0 bg-danger bg-opacity-10 text-danger rounded-3 p-3 mb-4 small">
                            <strong>Reason for rejection:</strong>
                            <p className="mb-0 mt-1">{user.rejection_reason}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="d-grid gap-2">
                        {!isRejected && (
                            <button
                                type="button"
                                className="btn btn-primary py-2 fw-semibold rounded-pill"
                                onClick={handleCheckStatus}
                                disabled={checking}
                            >
                                {checking ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                        Checking Approval Status...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-arrow-clockwise me-1"></i> Check Approval Status
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-outline-secondary py-2 fw-semibold rounded-pill"
                            onClick={handleSignOut}
                        >
                            <i className="bi bi-box-arrow-right me-1"></i> Sign Out
                        </button>
                    </div>

                    <div className="text-center mt-4">
                        <small className="text-muted">
                            Need urgent access? Contact your building management or security gatehouse desk.
                        </small>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PendingApprovalNotice;

