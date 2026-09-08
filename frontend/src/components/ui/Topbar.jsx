import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const Topbar = ({ onMenuClick }) => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        if (user?.role !== 'RESIDENT') return;
        
        const fetchNotifications = async () => {
            try {
                const countRes = await axiosInstance.get('notifications/unread-count/');
                setUnreadCount(countRes.data.unread_count);
                
                if (showDropdown) {
                    const listRes = await axiosInstance.get('notifications/');
                    setNotifications(listRes.data.slice(0, 5)); // Show top 5
                }
            } catch (err) {
                console.error("Failed to fetch notifications");
            }
        };

        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // 1 minute
        return () => clearInterval(interval);
    }, [user, showDropdown]);
    
    const handleNotificationClick = async (notification) => {
        setShowDropdown(false);
        if (!notification.is_read) {
            try {
                await axiosInstance.patch(`notifications/${notification.id}/read/`);
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (err) {}
        }
        navigate('/resident/notifications'); // or specific parcel if needed
    };

    return (
        <header className="bg-white border-bottom shadow-sm py-3 px-4 d-flex align-items-center justify-content-between position-sticky top-0" style={{ zIndex: 1030 }}>
            <div className="d-flex align-items-center">
                <button className="btn btn-light d-lg-none me-3" onClick={onMenuClick}>
                    <i className="bi bi-list fs-4"></i>
                </button>
                
                <h5 className="mb-0 fw-bold text-dark d-none d-md-block">
                    {user?.role === 'ADMIN' ? 'Community Administration' : 
                     user?.role === 'GUARD' ? 'Gatehouse Operations' : 
                     'Resident Portal'}
                </h5>
            </div>

            <div className="d-flex align-items-center gap-3">
                {user?.role === 'RESIDENT' && (
                    <div className="position-relative">
                        <button 
                            className="btn btn-light rounded-circle position-relative p-2 d-flex align-items-center justify-content-center" 
                            style={{ width: '40px', height: '40px' }}
                            onClick={() => setShowDropdown(!showDropdown)}
                        >
                            <i className="bi bi-bell-fill fs-5 text-muted"></i>
                            {unreadCount > 0 && (
                                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        
                        {showDropdown && (
                            <div className="dropdown-menu dropdown-menu-end show shadow position-absolute mt-2 border-0 rounded-3" style={{ width: '320px', right: 0 }}>
                                <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light rounded-top">
                                    <h6 className="mb-0 fw-bold">Notifications</h6>
                                </div>
                                <div className="overflow-auto" style={{ maxHeight: '300px' }}>
                                    {notifications.length === 0 ? (
                                        <div className="p-4 text-center text-muted small">
                                            <i className="bi bi-inbox fs-3 d-block mb-2"></i>
                                            No recent notifications
                                        </div>
                                    ) : (
                                        notifications.map(n => (
                                            <div 
                                                key={n.id} 
                                                className={`p-3 border-bottom cursor-pointer text-start ${n.is_read ? 'bg-white' : 'bg-light'}`}
                                                onClick={() => handleNotificationClick(n)}
                                                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                                            >
                                                <div className="d-flex gap-2">
                                                    <div className="mt-1">
                                                        {n.notification_type === 'NEW_PARCEL' && <i className="bi bi-box-seam text-primary"></i>}
                                                        {n.notification_type === 'FOOD_DELIVERY' && <i className="bi bi-cup-straw text-warning"></i>}
                                                        {n.notification_type === 'OVERDUE' && <i className="bi bi-exclamation-triangle-fill text-danger"></i>}
                                                        {n.notification_type === 'HANDOVER' && <i className="bi bi-check-circle-fill text-success"></i>}
                                                    </div>
                                                    <div>
                                                        <div className={`small fw-bold ${!n.is_read ? 'text-dark' : 'text-muted'}`}>{n.title}</div>
                                                        <div className="small text-muted mb-1 lh-sm" style={{ fontSize: '0.8rem' }}>{n.message}</div>
                                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    {!n.is_read && <div className="ms-auto"><span className="p-1 bg-primary rounded-circle d-inline-block"></span></div>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="p-2 border-top text-center bg-light rounded-bottom">
                                    <button className="btn btn-link btn-sm text-decoration-none fw-bold w-100" onClick={() => { setShowDropdown(false); navigate('/resident/notifications'); }}>
                                        View All Notifications
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="text-end d-none d-sm-block">
                    <div className="fw-bold text-dark lh-sm">{user?.name || user?.username}</div>
                    <small className="text-muted text-uppercase lh-sm fw-medium" style={{ fontSize: '0.7rem' }}>{user?.role}</small>
                </div>
                <div className="bg-light text-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                    <i className="bi bi-person-fill fs-5"></i>
                </div>
            </div>
        </header>
    );
};

export default Topbar;
