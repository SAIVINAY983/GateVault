import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';
import ResidentGoogleOnboardingModal from '../components/auth/ResidentGoogleOnboardingModal';

const Login = () => {
    const { login, googleAuth } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Google OAuth State
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [registrationToken, setRegistrationToken] = useState('');
    const [googleUser, setGoogleUser] = useState(null);
    const [googleNotice, setGoogleNotice] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setGoogleNotice(null);
        setLoading(true);

        const result = await login(username, password);
        
        if (result.success) {
            if (result.role === 'RESIDENT' && result.approval_status && result.approval_status !== 'APPROVED') {
                navigate('/pending-approval');
                return;
            }

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

    const handleGoogleSuccess = async (idToken) => {
        setError('');
        setGoogleNotice(null);

        const res = await googleAuth(idToken);
        if (res.success) {
            if (res.action === 'LOGIN') {
                navigate('/resident');
            } else if (res.action === 'REGISTER_REQUIRED') {
                setRegistrationToken(res.registration_token);
                setGoogleUser(res.google_user);
                setShowOnboarding(true);
            } else if (res.action === 'PENDING_APPROVAL') {
                setGoogleNotice({
                    type: 'warning',
                    title: 'Registration Pending Approval',
                    message: res.message || 'Your resident registration is awaiting Community Admin approval.'
                });
            }
        } else {
            if (res.action === 'REJECTED') {
                setGoogleNotice({
                    type: 'danger',
                    title: 'Registration Rejected',
                    message: res.message || `Reason: ${res.rejection_reason || 'Please contact administration.'}`
                });
            } else {
                setError(res.message);
            }
        }
    };

    const handleOnboardingComplete = (data) => {
        setShowOnboarding(false);
        setGoogleNotice({
            type: 'info',
            title: 'Registration Submitted',
            message: data.message || 'Your resident profile has been submitted and is currently pending approval by the Community Admin.'
        });
    };

    return (
        <div className="container-fluid vh-100 p-0 overflow-hidden">
            <style>
                {`
                .form-control:focus, .form-select:focus {
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
                    border-color: #3b82f6 !important;
                }
                `}
            </style>
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
                    <h1 className="display-4 fw-bold mb-4 text-white" style={{letterSpacing: '-0.02em'}}>
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
            <div className="col-12 col-lg-6 d-flex flex-column justify-content-center bg-white p-4 p-md-5 overflow-auto">
                {/* Mobile Branding */}
                <div className="d-lg-none text-center mb-4 mt-2">
                    <Link to="/" className="text-decoration-none d-flex align-items-center justify-content-center gap-2">
                        <i className="bi bi-shield-check fs-2 text-primary"></i>
                        <span className="fs-3 fw-bold text-dark tracking-tight">GateVault</span>
                    </Link>
                </div>

                <div className="mx-auto w-100" style={{maxWidth: '420px'}}>
                    <div className="mb-4">
                        <h2 className="fw-bold text-dark mb-1">Welcome back</h2>
                        <p className="text-muted">Sign in to your GateVault account.</p>
                    </div>

                    {/* Google Notice (Pending / Rejected / Submitted) */}
                    {googleNotice && (
                        <div className={`alert alert-${googleNotice.type} border-0 rounded-3 mb-4 p-3 shadow-sm`}>
                            <h6 className="fw-bold mb-1 d-flex align-items-center gap-2">
                                <i className="bi bi-info-circle-fill"></i> {googleNotice.title}
                            </h6>
                            <p className="small mb-0">{googleNotice.message}</p>
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-danger d-flex align-items-center gap-2 border-0 bg-danger bg-opacity-10 text-danger mb-4 rounded-3 p-3">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <span className="small fw-medium">{error}</span>
                        </div>
                    )}

                    {/* Resident Google OAuth Button */}
                    <div className="mb-4">
                        <div className="text-muted small fw-semibold mb-2">
                            <i className="bi bi-person-heart text-primary me-1"></i> Residents Quick Sign-In
                        </div>
                        <GoogleLoginButton
                            onSuccess={handleGoogleSuccess}
                            onError={(err) => setError(err)}
                            text="Continue with Google"
                            disabled={loading}
                        />
                    </div>

                    {/* Divider */}
                    <div className="d-flex align-items-center my-4">
                        <hr className="flex-grow-1 my-0 text-muted" />
                        <span className="px-3 text-muted small fw-medium text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                            Or sign in with username
                        </span>
                        <hr className="flex-grow-1 my-0 text-muted" />
                    </div>

                    {/* Standard Credentials Form */}
                    <form onSubmit={handleSubmit}>
                        <div className="mb-3">
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
                            className="btn btn-primary w-100 py-3 fw-bold rounded-3 mb-3 shadow-sm"
                            disabled={loading}
                            style={{background: 'var(--gv-primary)'}}
                        >
                            {loading ? (
                                <><span className="spinner-border spinner-border-sm me-2"></span>Authenticating...</>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    <div className="text-center text-muted mb-4 mt-2">
                        Don't have an account? <Link to="/register" className="text-primary fw-semibold text-decoration-none ms-1">Create Resident Account</Link>
                    </div>

                    <div className="mt-4 p-3 bg-light rounded-4 text-center border">
                        <span className="small fw-bold text-muted text-uppercase d-block mb-2" style={{letterSpacing: '0.05em', fontSize: '0.72rem'}}>Demo Quick-Fill</span>
                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold" onClick={() => { setUsername('admin'); setPassword('adminpass'); }}>
                                Admin
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold" onClick={() => { setUsername('guard1'); setPassword('guardpass'); }}>
                                Guard
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold" onClick={() => { setUsername('resident1'); setPassword('respass'); }}>
                                Resident
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </div>

            {/* Resident Google Profile Onboarding Modal */}
            <ResidentGoogleOnboardingModal
                show={showOnboarding}
                googleUser={googleUser}
                registrationToken={registrationToken}
                onClose={() => setShowOnboarding(false)}
                onComplete={handleOnboardingComplete}
            />
        </div>
    );
};

export default Login;
