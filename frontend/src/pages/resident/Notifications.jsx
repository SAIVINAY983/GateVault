import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const res = await axiosInstance.get('notifications/');
            setNotifications(res.data);
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleMarkAsRead = async (id) => {
        try {
            await axiosInstance.patch(`notifications/${id}/read/`);
            setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error("Failed to mark read", err);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await axiosInstance.patch('notifications/read-all/');
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error("Failed to mark all read", err);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'NEW_PARCEL': return <i className="bi bi-box-seam text-primary fs-3"></i>;
            case 'FOOD_DELIVERY': return <i className="bi bi-cup-straw text-warning fs-3"></i>;
            case 'OVERDUE': return <i className="bi bi-exclamation-triangle-fill text-danger fs-3"></i>;
            case 'HANDOVER': return <i className="bi bi-check-circle-fill text-success fs-3"></i>;
            default: return <i className="bi bi-bell text-muted fs-3"></i>;
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid px-0">
            <div className="d-flex justify-content-between align-items-end mb-4">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Notifications</h2>
                    <p className="text-muted mb-0">Stay updated on your deliveries and parcels.</p>
                </div>
                {notifications.some(n => !n.is_read) && (
                    <button onClick={handleMarkAllRead} className="btn btn-sm btn-outline-primary fw-medium">
                        <i className="bi bi-check2-all me-1"></i> Mark all as read
                    </button>
                )}
            </div>

            <div className="gv-card">
                {notifications.length === 0 ? (
                    <div className="text-center p-5">
                        <div className="display-1 text-muted mb-3 opacity-25">
                            <i className="bi bi-bell-slash"></i>
                        </div>
                        <h4 className="fw-bold text-dark">You're all caught up.</h4>
                        <p className="text-muted">You have no notifications at the moment.</p>
                        <button onClick={() => navigate('/resident')} className="gv-btn-primary mt-3 px-4">
                            Go to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="list-group list-group-flush">
                        {notifications.map(n => (
                            <div key={n.id} className={`list-group-item p-4 border-bottom ${!n.is_read ? 'bg-light' : 'bg-white'}`}>
                                <div className="d-flex gap-4 align-items-start">
                                    <div className="mt-1">
                                        {getIcon(n.notification_type)}
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <h6 className={`mb-0 fw-bold ${!n.is_read ? 'text-dark' : 'text-muted'}`}>{n.title}</h6>
                                            <small className="text-muted fw-medium">{new Date(n.created_at).toLocaleString()}</small>
                                        </div>
                                        <p className="mb-2 text-dark">{n.message}</p>
                                        <div className="d-flex align-items-center gap-3">
                                            {n.parcel_id && (
                                                <span className="badge bg-secondary rounded-pill py-1 px-3">
                                                    ID: {n.parcel_id}
                                                </span>
                                            )}
                                            {!n.is_read && (
                                                <button onClick={() => handleMarkAsRead(n.id)} className="btn btn-sm btn-link text-decoration-none p-0 fw-medium">
                                                    Mark as read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {!n.is_read && (
                                        <div className="ms-3 mt-2">
                                            <span className="p-1.5 bg-primary rounded-circle d-inline-block" style={{ width: '10px', height: '10px' }}></span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Notifications;
