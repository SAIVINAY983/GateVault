import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

const Topbar = ({ onMenuClick }) => {
    const { user } = useContext(AuthContext);

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
