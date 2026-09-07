import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

const ParcelIntake = () => {
    const navigate = useNavigate();
    const [towers, setTowers] = useState([]);
    const [flats, setFlats] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [shelves, setShelves] = useState([]);
    
    const [formData, setFormData] = useState({
        tower: '',
        flat: '',
        carrier: '',
        tracking_number: '',
        shelf: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null); // stores registered parcel info

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [towerRes, carrierRes, shelfRes] = await Promise.all([
                    axiosInstance.get('towers/'),
                    axiosInstance.get('carriers/'),
                    axiosInstance.get('shelves/')
                ]);
                setTowers(towerRes.data);
                setCarriers(carrierRes.data);
                setShelves(shelfRes.data.filter(s => !s.is_full));
            } catch (err) {
                console.error("Failed to load form data", err);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (formData.tower) {
            axiosInstance.get(`flats/?tower=${formData.tower}`)
                .then(res => setFlats(res.data))
                .catch(err => console.error("Failed to fetch flats", err));
        } else {
            setFlats([]);
        }
    }, [formData.tower]);

    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axiosInstance.post('parcels/intake/', formData);
            // res.data contains parcel_id and pickup_pin
            const selectedFlat = flats.find(f => f.id.toString() === formData.flat);
            const selectedShelf = shelves.find(s => s.id.toString() === formData.shelf);
            
            setSuccessData({
                parcel_id: res.data.parcel_id,
                pickup_pin: res.data.pickup_pin,
                resident_name: res.data.resident_name || 'Resident',
                flat_number: selectedFlat?.number,
                shelf_name: selectedShelf?.name
            });
            
            // Refresh shelves in background
            const shelfRes = await axiosInstance.get('shelves/');
            setShelves(shelfRes.data.filter(s => !s.is_full));
            
        } catch (err) {
            setError(err.response?.data?.shelf || 'Failed to register parcel. Please check all fields.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterAnother = () => {
        setSuccessData(null);
        setFormData({
            ...formData,
            flat: '',
            tracking_number: '',
            shelf: ''
        });
    };

    if (successData) {
        return (
            <div className="container-fluid px-0 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                    <div className="bg-success text-white text-center p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                            <i className="bi bi-check-lg fs-1"></i>
                        </div>
                        <h3 className="fw-bold mb-0">Parcel Registered</h3>
                    </div>
                    
                    <div className="p-4">
                        <div className="bg-light rounded p-3 mb-4 text-center border">
                            <div className="text-uppercase text-muted fw-bold mb-1" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Pickup PIN Generated</div>
                            <div className="display-4 fw-bold text-dark pin-display">{successData.pickup_pin}</div>
                        </div>

                        <div className="row g-3 mb-4">
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Parcel ID</small>
                                <div className="fw-medium text-dark">{successData.parcel_id}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident</small>
                                <div className="fw-medium text-dark">{successData.resident_name}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Destination</small>
                                <div className="fw-medium text-dark">Flat {successData.flat_number}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Storage</small>
                                <div className="fw-medium text-dark">{successData.shelf_name}</div>
                            </div>
                        </div>

                        <div className="d-flex flex-column gap-2">
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Register Another Parcel
                            </button>
                            <button onClick={() => navigate('/guard/verify')} className="btn btn-light py-2 w-100 fw-medium">
                                Go to Pickup Verification
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid px-0">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Receive New Parcel</h2>
                <p className="text-muted">Register an incoming delivery and assign it to a storage shelf.</p>
            </div>
            
            <div className="gv-card" style={{ maxWidth: '700px' }}>
                <div className="card-body p-4 p-md-5">
                    {error && (
                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm">
                            <i className="bi bi-exclamation-circle-fill fs-5 me-3"></i>
                            {error}
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit}>
                        {/* SECTION 1 */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>1. Resident Details</h6>
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-semibold">Tower</label>
                                <select className="form-select bg-light" name="tower" value={formData.tower} onChange={handleChange} required>
                                    <option value="">Select Tower...</option>
                                    {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-semibold">Flat Number</label>
                                <select className="form-select bg-light" name="flat" value={formData.flat} onChange={handleChange} required disabled={!formData.tower}>
                                    <option value="">Select Flat...</option>
                                    {flats.map(f => <option key={f.id} value={f.id}>{f.number} {f.residents && f.residents.length > 0 ? `(${f.residents[0].user.first_name || f.residents[0].user.username})` : ''}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* SECTION 2 */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>2. Delivery Details</h6>
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-semibold">Carrier / Courier</label>
                                <select className="form-select bg-light" name="carrier" value={formData.carrier} onChange={handleChange} required>
                                    <option value="">Select Carrier...</option>
                                    {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-semibold">Tracking Number <span className="fw-normal opacity-50">(Optional)</span></label>
                                <input type="text" className="form-control bg-light" name="tracking_number" value={formData.tracking_number} onChange={handleChange} placeholder="e.g., AWB123456789" />
                            </div>
                        </div>

                        {/* SECTION 3 */}
                        <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>3. Storage Assignment</h6>
                        <div className="mb-5">
                            <label className="form-label text-muted small fw-semibold">Gatehouse Shelf</label>
                            <select className="form-select bg-light form-select-lg fs-6" name="shelf" value={formData.shelf} onChange={handleChange} required>
                                <option value="">Select Available Shelf...</option>
                                {shelves.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.available} / {s.capacity} available)
                                    </option>
                                ))}
                            </select>
                            {shelves.length === 0 && <div className="text-danger small mt-2 fw-medium"><i className="bi bi-x-circle me-1"></i> No available shelves! Please process pending pickups.</div>}
                        </div>

                        <button type="submit" className="gv-btn-primary w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2" disabled={loading || shelves.length === 0}>
                            {loading ? (
                                <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...</>
                            ) : (
                                <><i className="bi bi-box-seam"></i> REGISTER PARCEL</>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ParcelIntake;
