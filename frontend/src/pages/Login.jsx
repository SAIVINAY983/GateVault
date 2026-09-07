import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

const Login = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);
        
        if (result.success) {
            // Redirect based on role
            switch (result.role) {
                case 'ADMIN': navigate('/admin'); break;
                case 'GUARD': navigate('/guard'); break;
                case 'RESIDENT': navigate('/resident'); break;
                default: navigate('/'); break;
            }
        } else {
            setError(result.message);
        }
        setLoading(false);
    };

    return (
        <div className="d-flex align-items-center justify-content-center vh-100 bg-light">
            <div className="card shadow-lg p-4" style={{ width: '400px', borderRadius: '15px' }}>
                <div className="text-center mb-4">
                    <h2 className="fw-bold text-primary">GateVault</h2>
                    <p className="text-muted">Smart Parcel Verification</p>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label className="form-label">Username</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required 
                            placeholder="Enter username"
                        />
                    </div>
                    <div className="mb-4">
                        <label className="form-label">Password</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                            placeholder="Enter password"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="btn btn-primary w-100 fw-bold"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="mt-4 text-center text-muted small">
                    <p>Demo Accounts:<br/>
                    Admin: admin / adminpass<br/>
                    Guard: guard1 / guardpass<br/>
                    Resident: resident1 / respass</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
