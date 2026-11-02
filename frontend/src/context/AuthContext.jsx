import React, { createContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // On initial load, check if user exists in local storage
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                // Simple expiration check
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    const storedUser = JSON.parse(localStorage.getItem('user'));
                    setUser(storedUser);
                }
            } catch (error) {
                logout();
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const response = await axiosInstance.post('auth/login/', {
                username,
                password
            });
            
            const { access, refresh, user } = response.data;
            
            // user object is in the response body, not the token payload
            const userData = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                name: user.name,
                is_primary: user.is_primary !== undefined ? user.is_primary : true,
                approval_status: user.approval_status || 'APPROVED',
                flat: user.flat,
                tower: user.tower,
                google_linked: Boolean(user.google_linked)
            };

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setUser(userData);
            return { 
                success: true, 
                role: userData.role, 
                approval_status: userData.approval_status,
                user: userData 
            };
        } catch (error) {
            console.error("Login Error:", error);
            let errMsg = 'Invalid credentials';
            if (!error.response) {
                errMsg = 'Network Error: Cannot connect to backend (http://127.0.0.1:8000)';
            } else if (error.response.data && error.response.data.detail) {
                errMsg = error.response.data.detail;
            } else if (error.response.data && error.response.data.error) {
                errMsg = error.response.data.error;
            }
            return { success: false, message: errMsg };
        }
    };

    /**
     * Authenticate or initiate registration via verified Google ID token.
     * Exclusively for Residents.
     */
    const googleAuth = async (idToken) => {
        try {
            const response = await axiosInstance.post('auth/google/', {
                id_token: idToken
            });

            const data = response.data;

            if (data.action === 'LOGIN') {
                const userData = {
                    id: data.user.id,
                    username: data.user.username,
                    email: data.user.email,
                    role: data.user.role,
                    name: data.user.name,
                    is_primary: data.user.is_primary !== undefined ? data.user.is_primary : true,
                    approval_status: data.user.approval_status || 'APPROVED',
                    flat: data.user.flat,
                    tower: data.user.tower,
                    google_linked: true
                };

                localStorage.setItem('access_token', data.access);
                localStorage.setItem('refresh_token', data.refresh);
                localStorage.setItem('user', JSON.stringify(userData));

                setUser(userData);
                return { success: true, action: 'LOGIN', role: userData.role, user: userData };
            }

            if (data.action === 'REGISTER_REQUIRED') {
                return {
                    success: true,
                    action: 'REGISTER_REQUIRED',
                    registration_token: data.registration_token,
                    google_user: data.google_user
                };
            }

            if (data.action === 'PENDING_APPROVAL') {
                return {
                    success: true,
                    action: 'PENDING_APPROVAL',
                    message: data.message,
                    user: data.user
                };
            }

            if (data.action === 'REJECTED') {
                return {
                    success: false,
                    action: 'REJECTED',
                    message: data.message,
                    rejection_reason: data.rejection_reason,
                    user: data.user
                };
            }

            return { success: false, message: 'Unexpected response from authentication service.' };
        } catch (error) {
            console.error("Google Auth Error:", error);
            let errMsg = 'Google authentication failed.';
            if (error.response?.data?.error) {
                errMsg = error.response.data.error;
            } else if (error.response?.data?.detail) {
                errMsg = error.response.data.detail;
            }
            return { 
                success: false, 
                message: errMsg,
                code: error.response?.data?.code 
            };
        }
    };

    /**
     * Complete resident profile onboarding with verified Google token and Tower/Flat selection.
     */
    const registerGoogleResident = async ({ registration_token, tower_id, flat_id, phone_number }) => {
        try {
            const response = await axiosInstance.post('auth/google/register/', {
                registration_token,
                tower_id,
                flat_id,
                phone_number
            });

            return {
                success: true,
                action: 'PENDING_APPROVAL',
                message: response.data.message,
                user: response.data.user
            };
        } catch (error) {
            console.error("Google Resident Registration Error:", error);
            const errMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to submit registration.';
            return { success: false, message: errMsg };
        }
    };

    /**
     * Link Google account to an already logged-in resident profile.
     */
    const linkGoogleAccount = async (idToken) => {
        try {
            const response = await axiosInstance.post('resident/link-google/', {
                id_token: idToken
            });
            if (user) {
                const updatedUser = { ...user, google_linked: true };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
            }
            return { success: true, message: response.data.message };
        } catch (error) {
            console.error("Link Google Error:", error);
            const errMsg = error.response?.data?.error || error.response?.data?.detail || 'Failed to link Google account.';
            return { success: false, message: errMsg };
        }
    };

    const updateUserApprovalStatus = (newStatus) => {
        if (user) {
            const updated = { ...user, approval_status: newStatus };
            localStorage.setItem('user', JSON.stringify(updated));
            setUser(updated);
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            login, 
            logout, 
            googleAuth, 
            registerGoogleResident, 
            linkGoogleAccount,
            updateUserApprovalStatus
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
