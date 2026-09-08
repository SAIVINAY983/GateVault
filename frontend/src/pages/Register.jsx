import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// Since the user is not authenticated yet, we use a raw axios instance directly hitting the API URL.
const publicAxios = axios.create({
    baseURL: 'http://localhost:8000/api/',
    headers: { 'Content-Type': 'application/json' }
});

const Register = () => {
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        confirm_password: '',
        tower: '',
        flat_id: ''
    });
    
    const [towers, setTowers] = useState([]);
    const [flats, setFlats] = useState([]);
    
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch towers for public registration (Requires Towers API to be public, but let's see)
        // If Towers API is currently protected, the backend should ideally allow public access to Tower/Flat list,
        // or we use the auth token if we somehow have it. However, the user request says: 
        // "If a suitable endpoint does not exist, create the minimum required Django API." 
        // But the previous config in views.py has `permission_classes = [IsAuthenticated]` for TowerViewSet.
        // I will temporarily catch errors and inform the user if it fails, but I will modify the backend in the next step to allow public viewing of Towers/Flats for registration.
        
        publicAxios.get('towers/')
            .then(res => setTowers(res.data))
            .catch(err => console.error("Could not load towers. Backend may require authentication adjustment.", err));
    }, []);

    useEffect(() => {
        if (formData.tower) {
            publicAxios.get(`flats/?tower=${formData.tower}`)
                .then(res => setFlats(res.data))
                .catch(err => console.error(err));
        } else {
            setFlats([]);
        }
    }, [formData.tower]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirm_password) {
            return setError('Passwords do not match.');
        }

        setLoading(true);
        try {
            const res = await publicAxios.post('auth/register/', {
                first_name: formData.first_name,
                last_name: formData.last_name,
                username: formData.username,
                email: formData.email,
                password: formData.password,
                flat_id: formData.flat_id,
                role: 'RESIDENT'
            });
            
            setSuccess('Account created successfully.');
            setFormData({ first_name: '', last_name: '', username: '', email: '', password: '', confirm_password: '', tower: '', flat_id: '' });
            setTimeout(() => {
                navigate('/login');
            }, 2000);
            
        } catch (err) {
            setError(err.response?.data?.username?.[0] || err.response?.data?.error || 'Failed to create account. Please check your details.');
        } finally {
            setLoading(false);
        }
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
                                <i className="bi bi-person-check-fill text-success fs-4"></i>
                            </div>
                            <div>
                                <h6 className="mb-0 fw-bold">Resident Access</h6>
                                <small className="text-white-50">Generate secure pickup PINs instantly</small>
                            </div>
                        </div>
                        <div className="d-flex align-items-center gap-3">
                            <div className="bg-info rounded-circle p-2 bg-opacity-25">
                                <i className="bi bi-bell-fill text-info fs-4"></i>
                            </div>
                            <div>
                                <h6 className="mb-0 fw-bold">Real-time Dashboard</h6>
                                <small className="text-white-50">Track incoming and pending parcels</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Background decorative elements */}
                <div className="position-absolute bottom-0 end-0 p-5 opacity-25">
                    <i className="bi bi-building" style={{fontSize: '15rem'}}></i>
                </div>
            </div>

            {/* Right Column: Register Form */}
            <div className="col-12 col-lg-6 d-flex flex-column justify-content-center bg-white p-4 p-md-5 overflow-auto">
                <div className="d-lg-none text-center mb-4 mt-2">
                    <Link to="/" className="text-decoration-none d-flex align-items-center justify-content-center gap-2">
                        <i className="bi bi-shield-check fs-2 text-primary"></i>
                        <span className="fs-3 fw-bold text-dark tracking-tight">GateVault</span>
                    </Link>
                </div>

                <div className="mx-auto w-100 py-3" style={{maxWidth: '480px'}}>
                    <div className="mb-4">
                        <h2 className="fw-bold text-dark mb-2">Create your GateVault account</h2>
                        <p className="text-muted">Register as a resident to manage and securely collect your parcels.</p>
                    </div>

                    {error && (
                        <div className="alert alert-danger d-flex align-items-center gap-2 border-0 bg-danger bg-opacity-10 text-danger mb-4 rounded-3 p-3">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <span className="small fw-medium">{error}</span>
                        </div>
                    )}
                    
                    {success && (
                        <div className="alert alert-success d-flex align-items-center justify-content-between border-0 bg-success bg-opacity-10 text-success mb-4 rounded-3 p-3">
                            <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-check-circle-fill"></i>
                                <span className="small fw-medium">{success}</span>
                            </div>
                            <Link to="/login" className="btn btn-sm btn-success fw-bold">Go to Login</Link>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="row g-3 mb-3">
                            <div className="col-6">
                                <label className="form-label small fw-semibold text-dark">First Name</label>
                                <input type="text" className="form-control bg-light py-2" required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
                            </div>
                            <div className="col-6">
                                <label className="form-label small fw-semibold text-dark">Last Name</label>
                                <input type="text" className="form-control bg-light py-2" required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
                            </div>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Username</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-person text-muted"></i></span>
                                    <input type="text" className="form-control bg-light border-start-0 ps-0 py-2" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                                </div>
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Email</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-envelope text-muted"></i></span>
                                    <input type="email" className="form-control bg-light border-start-0 ps-0 py-2" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        <div className="row g-3 mb-4">
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Tower</label>
                                <select className="form-select bg-light py-2" required value={formData.tower} onChange={e => setFormData({...formData, tower: e.target.value, flat_id: ''})}>
                                    <option value="">Select Tower...</option>
                                    {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="col-12 col-md-6">
                                <label className="form-label small fw-semibold text-dark">Flat</label>
                                <select className="form-select bg-light py-2" required disabled={!formData.tower} value={formData.flat_id} onChange={e => setFormData({...formData, flat_id: e.target.value})}>
                                    <option value="">Select Flat...</option>
                                    {flats.map(f => <option key={f.id} value={f.id}>{f.number}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="form-label small fw-semibold text-dark">Password</label>
                            <div className="input-group mb-2">
                                <span className="input-group-text bg-light border-end-0"><i className="bi bi-lock text-muted"></i></span>
                                <input type={showPassword ? "text" : "password"} className="form-control bg-light border-start-0 border-end-0 ps-0 py-2" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                <button type="button" className="btn btn-light bg-light border border-start-0 text-muted" onClick={() => setShowPassword(!showPassword)}>
                                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                </button>
                            </div>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0"><i className="bi bi-check2-circle text-muted"></i></span>
                                <input type={showPassword ? "text" : "password"} className="form-control bg-light border-start-0 border-end-0 ps-0 py-2" required placeholder="Confirm password" value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})} />
                                <span className="input-group-text bg-light border-start-0 bg-transparent"></span>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-100 py-3 fw-bold rounded-3 mb-4 shadow-sm" disabled={loading} style={{background: 'var(--gv-primary)'}}>
                            {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating Account...</> : 'Register Resident Account'}
                        </button>
                    </form>

                    <div className="text-center text-muted mb-2">
                        Already have an account? <Link to="/login" className="text-primary fw-semibold text-decoration-none ms-1">Sign in</Link>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default Register;
