import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to attach JWT token
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh/expiration (simplified)
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        // If 401 Unauthorized, we could attempt a token refresh here. 
        // For simplicity in this CA2, if we get 401 and it's not a login request, we'll just log out.
        if (error.response && error.response.status === 401 && originalRequest.url !== 'auth/login/') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            // Hard redirect to login (better handled via Context/Navigate in React, but this is a fallback)
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
