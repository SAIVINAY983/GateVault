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
                role: user.role,
                name: user.name
            };

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setUser(userData);
            return { success: true, role: userData.role };
        } catch (error) {
            console.error("Login Error:", error);
            let errMsg = 'Invalid credentials';
            if (!error.response) {
                errMsg = 'Network Error: Cannot connect to backend (http://127.0.0.1:8000)';
            } else if (error.response.data && error.response.data.detail) {
                errMsg = error.response.data.detail;
            }
            return { success: false, message: errMsg };
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
