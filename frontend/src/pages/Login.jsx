import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);
        
        if (result.success) {
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
        <div className="container-fluid vh-100 p-0 overflow-hidden">
            <div className="row g-0 h-100">
            {/* Left Column: Branding (hidden on mobile) */}
            <div className="col-lg-6 bg-primary text-white d-none d-lg-flex flex-column justify-content-center p-5 position-relative" style={{background: 'linear-gradient(135deg, var(--gv-primary) 0%, #1e293b 100%)'}}>
                <div className="position-absolute top-0 start-0 p-5">
                    <Link to="/" className="text-white text-decoration-none d-flex align-items-center gap-2">
                        <i className="bi bi-shield-check fs-2 text-info"></i>
                        <span className="fs-3 fw-bold tracking-tight">GateVault</span>
                    </Link>
                </div>
                
                <div className="px-xl-5 z-1">
                    <h1 className="display-4 fw-bold mb-4" style={{letterSpacing: '-0.02em'}}>
                        Secure every parcel from gatehouse to handover.
                    </h1>
                    <p className="fs-5 text-white-50 mb-5 pb-3 w-75">
                        A complete digital chain of custody for modern residential communities. Seamless tracking, secure verification, and total peace of mind.
                    </p>
                    
                    {/* Illustration / Decorative UI */}
                    <div className="bg-white bg-opacity-10 p-4 rounded-4 border border-white border-opacity-25 shadow-lg backdrop-blur" style={{backdropFilter: 'blur(10px)', maxWidth: '400px'}}>
                        <div className="d-flex align-items-center gap-3 mb-3">
                            <div className="bg-success rounded-circle p-2 bg-opacity-25">
                                <i className="bi bi-check-circle-fill text-success fs-4"></i>
                            </div>
                            <div>
                                <h6 className="mb-0 fw-bold">Verified Handover</h6>
                                <small className="text-white-50">Parcel GV-2026-X89 delivered</small>
                            </div>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-info rounded-circle p-2 bg-opacity-25">
                                <i className="bi bi-shield-lock-fill text-info fs-4"></i>
                            </div>
                            <div>
                                <h6 className="mb-0 fw-bold">Secure Access</h6>
                                <small className="text-white-50">Role-based data isolation</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Background decorative elements */}
                <div className="position-absolute bottom-0 end-0 p-5 opacity-25">
                    <i className="bi bi-box-seam-fill" style={{fontSize: '15rem'}}></i>
                </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="col-12 col-lg-6 d-flex flex-column justify-content-center bg-white p-4 p-md-5">
                {/* Mobile Branding */}
                <div className="d-lg-none text-center mb-5 mt-3">
                    <Link to="/" className="text-decoration-none d-flex align-items-center justify-content-center gap-2">
                        <i className="bi bi-shield-check fs-2 text-primary"></i>
                        <span className="fs-3 fw-bold text-dark tracking-tight">GateVault</span>
                    </Link>
                </div>

                <div className="mx-auto w-100" style={{maxWidth: '420px'}}>
                    <div className="mb-5">
                        <h2 className="fw-bold text-dark mb-2">Welcome back</h2>
                        <p className="text-muted">Sign in to your GateVault account.</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger d-flex align-items-center gap-2 border-0 bg-danger bg-opacity-10 text-danger mb-4 rounded-3 p-3">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <span className="small fw-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="form-label small fw-semibold text-dark">Username</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <i className="bi bi-person text-muted"></i>
                                </span>
                                <input 
                                    type="text" 
                                    className="form-control bg-light border-start-0 ps-0 py-2" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required 
                                    placeholder="Enter username"
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="form-label small fw-semibold text-dark">Password</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <i className="bi bi-lock text-muted"></i>
                                </span>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    className="form-control bg-light border-start-0 border-end-0 ps-0 py-2" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required 
                                    placeholder="Enter password"
                                />
                                <button 
                                    type="button" 
                                    className="btn btn-light bg-light border border-start-0 text-muted" 
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                </button>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary w-100 py-3 fw-bold rounded-3 mb-4 shadow-sm"
                            disabled={loading}
                            style={{background: 'var(--gv-primary)'}}
                        >
                            {loading ? (
                                <><span className="spinner-border spinner-border-sm me-2"></span>Authenticating...</>
                            ) : 'Login'}
                        </button>
                    </form>

                    <div className="text-center text-muted mb-4 mt-2">
                        Don't have an account? <Link to="/register" className="text-primary fw-semibold text-decoration-none ms-1">Create Resident Account</Link>
                    </div>

                    <div className="mt-5 p-3 bg-light rounded-3 text-center border">
                        <span className="small fw-bold text-muted text-uppercase d-block mb-2" style={{letterSpacing: '0.05em'}}>Local Development Demo Credentials</span>
                        <div className="small text-muted d-flex flex-column gap-1">
                            <div><span className="fw-medium text-dark">Admin:</span> admin / adminpass</div>
                            <div><span className="fw-medium text-dark">Guard:</span> guard1 / guardpass</div>
                            <div><span className="fw-medium text-dark">Resident:</span> resident1 / respass</div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default Login;
