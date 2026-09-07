import React, { useContext } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';

const DashboardLayout = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="d-flex vh-100 overflow-hidden bg-light">
            {/* Sidebar */}
            <div className="bg-dark text-white p-3 d-flex flex-column" style={{ width: '250px' }}>
                <h3 className="mb-4 text-center fw-bold text-primary">GateVault</h3>
                
                <div className="mb-4">
                    <small className="text-muted text-uppercase fw-bold">Logged in as</small>
                    <div className="fs-5">{user?.name || user?.username}</div>
                    <span className="badge bg-secondary">{user?.role}</span>
                </div>

                <ul className="nav nav-pills flex-column mb-auto">
                    {user?.role === 'ADMIN' && (
                        <>
                            <li className="nav-item">
                                <Link to="/admin" className="nav-link text-white">Dashboard</Link>
                            </li>
                            <li className="nav-item">
                                <Link to="/admin/history" className="nav-link text-white">Parcel History</Link>
                            </li>
                        </>
                    )}
                    
                    {user?.role === 'GUARD' && (
                        <>
                            <li className="nav-item">
                                <Link to="/guard" className="nav-link text-white">Pending Parcels</Link>
                            </li>
                            <li className="nav-item">
                                <Link to="/guard/intake" className="nav-link text-white text-warning fw-bold">+ Receive Parcel</Link>
                            </li>
                            <li className="nav-item">
                                <Link to="/guard/verify" className="nav-link text-white text-success fw-bold">✓ Verify Pickup</Link>
                            </li>
                        </>
                    )}

                    {user?.role === 'RESIDENT' && (
                        <>
                            <li className="nav-item">
                                <Link to="/resident" className="nav-link text-white">My Parcels</Link>
                            </li>
                        </>
                    )}
                </ul>

                <hr />
                <button onClick={handleLogout} className="btn btn-outline-danger w-100">
                    Logout
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow-1 overflow-auto p-4">
                <Outlet />
            </div>
        </div>
    );
};

export default DashboardLayout;
