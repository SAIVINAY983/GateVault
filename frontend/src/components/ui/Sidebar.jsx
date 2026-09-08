import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const Sidebar = ({ isMobileOpen, setIsMobileOpen }) => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => {
        if (path === '/admin' && location.pathname !== '/admin') return false;
        if (path === '/guard' && location.pathname !== '/guard') return false;
        if (path === '/resident' && location.pathname !== '/resident') return false;
        return location.pathname.startsWith(path);
    };

    const NavLink = ({ to, icon, label, primary }) => (
        <li className="nav-item mb-1">
            <Link 
                to={to} 
                onClick={() => setIsMobileOpen(false)}
                className={`sidebar-link ${isActive(to) ? 'active' : ''} ${primary ? 'text-white bg-primary bg-opacity-25' : ''}`}
            >
                <i className={`bi ${icon} me-3 fs-5`}></i>
                {label}
            </Link>
        </li>
    );

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div 
                    className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
                    style={{ zIndex: 1040 }}
                    onClick={() => setIsMobileOpen(false)}
                ></div>
            )}

            {/* Sidebar Content */}
            <div 
                className={`d-flex flex-column flex-shrink-0 p-3 text-white bg-primary vh-100 position-fixed overflow-auto ${isMobileOpen ? 'd-block' : 'd-none d-lg-flex'}`} 
                style={{ width: '280px', zIndex: 1050, transition: 'transform 0.3s ease-in-out', background: 'var(--gv-primary)' }}
            >
                <div className="d-flex align-items-center justify-content-between mb-4 mt-2 px-2">
                    <Link to="/" className="text-white text-decoration-none d-flex align-items-center gap-2">
                        <i className="bi bi-shield-check fs-3 text-info"></i>
                        <span className="fs-4 fw-bold tracking-tight">GateVault</span>
                    </Link>
                    <button className="btn btn-link text-white d-lg-none p-0" onClick={() => setIsMobileOpen(false)}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
                
                <div className="px-2 mb-4">
                    <div className="small text-uppercase text-white-50 fw-bold mb-1" style={{ letterSpacing: '0.05em' }}>Logged in as</div>
                    <div className="fw-semibold fs-6 text-truncate">{user?.name || user?.username}</div>
                    <span className="badge bg-light text-primary mt-1">{user?.role}</span>
                </div>

                <ul className="nav nav-pills flex-column mb-auto">
                    {user?.role === 'ADMIN' && (
                        <>
                            <NavLink to="/admin" icon="bi-grid-1x2-fill" label="Dashboard" />
                            <NavLink to="/admin/history" icon="bi-clock-history" label="Parcel History" />
                            <NavLink to="/admin/users" icon="bi-people-fill" label="User Management" />
                        </>
                    )}
                    
                    {user?.role === 'GUARD' && (
                        <>
                            <NavLink to="/guard" icon="bi-list-ul" label="Dashboard" />
                            <NavLink to="/guard/intake" icon="bi-box-seam-fill" label="Receive Parcel" primary />
                            <NavLink to="/guard/verify" icon="bi-qr-code-scan" label="Verify Pickup" />
                        </>
                    )}

                    {user?.role === 'RESIDENT' && (
                        <>
                            <NavLink to="/resident" icon="bi-grid-1x2-fill" label="My Dashboard" />
                            <NavLink to="/resident/send-delivery" icon="bi-calendar-plus" label="Send Delivery Details" />
                            <NavLink to="/resident/history" icon="bi-clock-history" label="Delivery History" />
                        </>
                    )}
                </ul>

                <hr className="border-secondary opacity-25" />
                
                <button onClick={handleLogout} className="btn btn-outline-light border-0 text-start d-flex align-items-center sidebar-link">
                    <i className="bi bi-box-arrow-right me-3 fs-5"></i>
                    Logout
                </button>
            </div>
        </>
    );
};

export default Sidebar;
