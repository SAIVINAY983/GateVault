import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const RoleBasedRoute = ({ children, allowedRoles }) => {
    const { user } = useContext(AuthContext);

    if (!user) {
        // Not logged in, redirect to login page
        return <Navigate to="/login" replace />;
    }

    // Security check: Block pending or rejected residents from accessing parcel and resident features
    if (user.role === 'RESIDENT' && user.approval_status && user.approval_status !== 'APPROVED') {
        return <Navigate to="/pending-approval" replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        // Logged in but doesn't have the right role, redirect to appropriate dashboard
        switch (user.role) {
            case 'ADMIN': return <Navigate to="/admin" replace />;
            case 'GUARD': return <Navigate to="/guard" replace />;
            case 'RESIDENT': return <Navigate to="/resident" replace />;
            default: return <Navigate to="/login" replace />;
        }
    }

    return children;
};

export default RoleBasedRoute;
