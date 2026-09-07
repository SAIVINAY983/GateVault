import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    // Modals
    const [showResidentModal, setShowResidentModal] = useState(false);
    const [showGuardModal, setShowGuardModal] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Pre-requisite data for forms
    const [towers, setTowers] = useState([]);
    const [flats, setFlats] = useState([]);

    // Form states
    const initialResidentState = { first_name: '', last_name: '', username: '', email: '', password: '', confirm_password: '', tower: '', flat_id: '' };
    const initialGuardState = { first_name: '', last_name: '', username: '', email: '', password: '', confirm_password: '' };
    
    const [residentForm, setResidentForm] = useState(initialResidentState);
    const [guardForm, setGuardForm] = useState(initialGuardState);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('admin/users/');
            setUsers(res.data);
        } catch (err) {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const fetchTowers = async () => {
        try {
            const res = await axiosInstance.get('towers/');
            setTowers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchTowers();
    }, []);

    useEffect(() => {
        if (residentForm.tower) {
            axiosInstance.get(`flats/?tower=${residentForm.tower}`)
                .then(res => setFlats(res.data))
                .catch(err => console.error(err));
        } else {
            setFlats([]);
        }
    }, [residentForm.tower]);

    const handleToggleActive = async (userId) => {
        try {
            const res = await axiosInstance.patch(`admin/users/${userId}/toggle-active/`);
            setUsers(users.map(u => u.id === userId ? { ...u, status: res.data.is_active ? 'Active' : 'Inactive' } : u));
        } catch (err) {
            alert('Failed to toggle user status');
        }
    };

    const handleCreateResident = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        if (residentForm.password !== residentForm.confirm_password) {
            return setFormError('Passwords do not match');
        }

        setFormLoading(true);
        try {
            const res = await axiosInstance.post('admin/users/resident/', {
                first_name: residentForm.first_name,
                last_name: residentForm.last_name,
                username: residentForm.username,
                email: residentForm.email,
                password: residentForm.password,
                flat_id: residentForm.flat_id
            });
            setUsers([res.data.user, ...users]);
            setFormSuccess('Resident created successfully!');
            setResidentForm(initialResidentState);
            setTimeout(() => setShowResidentModal(false), 2000);
        } catch (err) {
            setFormError(err.response?.data?.username?.[0] || err.response?.data?.error || 'Failed to create resident. Check username uniqueness.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleCreateGuard = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');

        if (guardForm.password !== guardForm.confirm_password) {
            return setFormError('Passwords do not match');
        }

        setFormLoading(true);
        try {
            const res = await axiosInstance.post('admin/users/guard/', {
                first_name: guardForm.first_name,
                last_name: guardForm.last_name,
                username: guardForm.username,
                email: guardForm.email,
                password: guardForm.password
            });
            setUsers([res.data.user, ...users]);
            setFormSuccess('Guard created successfully!');
            setGuardForm(initialGuardState);
            setTimeout(() => setShowGuardModal(false), 2000);
        } catch (err) {
            setFormError(err.response?.data?.username?.[0] || err.response?.data?.error || 'Failed to create guard. Check username uniqueness.');
        } finally {
            setFormLoading(false);
        }
    };

    const filteredUsers = users.filter(u => {
        if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (u.username.toLowerCase().includes(query) || 
                    (u.first_name + ' ' + u.last_name).toLowerCase().includes(query) || 
                    u.email.toLowerCase().includes(query));
        }
        return true;
    });

    if (loading) return <LoadingSpinner message="Loading users..." />;
    if (error) return <ErrorState message={error} onRetry={fetchUsers} />;

    return (
        <div className="container-fluid px-0">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark mb-1">User Management</h2>
                    <p className="text-muted mb-0">Securely manage Guard and Resident access.</p>
                </div>
                <div className="d-flex gap-2">
                    <button onClick={() => {setShowResidentModal(true); setFormError(''); setFormSuccess('');}} className="btn btn-outline-primary fw-medium d-flex align-items-center gap-2">
                        <i className="bi bi-person-plus"></i> New Resident
                    </button>
                    <button onClick={() => {setShowGuardModal(true); setFormError(''); setFormSuccess('');}} className="gv-btn-primary fw-medium d-flex align-items-center gap-2">
                        <i className="bi bi-shield-plus"></i> New Guard
                    </button>
                </div>
            </div>
            
            <div className="gv-card overflow-hidden">
                <div className="card-header bg-white p-4 border-bottom">
                    <div className="row g-3">
                        <div className="col-12 col-md-6">
                            <div className="input-group">
                                <span className="input-group-text bg-light border-end-0">
                                    <i className="bi bi-search text-muted"></i>
                                </span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0 ps-0 bg-light" 
                                    placeholder="Search name, username, or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-12 col-md-3">
                            <select className="form-select bg-light" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                                <option value="ALL">All Roles</option>
                                <option value="RESIDENT">Residents</option>
                                <option value="GUARD">Guards</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 border-0">
                        <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                            <tr>
                                <th className="ps-4 py-3 fw-semibold border-bottom-0">Name / Email</th>
                                <th className="py-3 fw-semibold border-bottom-0">Username</th>
                                <th className="py-3 fw-semibold border-bottom-0">Role</th>
                                <th className="py-3 fw-semibold border-bottom-0">Assignment</th>
                                <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="border-top-0">
                            {filteredUsers.map(u => (
                                <tr key={u.id}>
                                    <td className="ps-4 py-3">
                                        <div className="fw-bold text-dark">{u.first_name} {u.last_name}</div>
                                        <div className="text-muted small">{u.email || 'No email provided'}</div>
                                    </td>
                                    <td className="py-3 fw-medium text-dark">{u.username}</td>
                                    <td className="py-3">
                                        <span className={`badge ${u.role === 'GUARD' ? 'bg-primary' : 'bg-success'} bg-opacity-10 text-${u.role === 'GUARD' ? 'primary' : 'success'} border border-${u.role === 'GUARD' ? 'primary' : 'success'} border-opacity-25`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {u.flat_details ? (
                                            <div>
                                                <div className="fw-medium text-dark">Flat {u.flat_details?.number}</div>
                                                <div className="text-muted small">{u.flat_details.tower}</div>
                                            </div>
                                        ) : (
                                            <span className="text-muted small">-</span>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        {u.status === 'Active' ? (
                                            <span className="text-success small fw-bold d-flex align-items-center gap-1"><i className="bi bi-circle-fill" style={{fontSize: '0.5rem'}}></i> Active</span>
                                        ) : (
                                            <span className="text-danger small fw-bold d-flex align-items-center gap-1"><i className="bi bi-circle-fill" style={{fontSize: '0.5rem'}}></i> Inactive</span>
                                        )}
                                    </td>
                                    <td className="pe-4 py-3 text-end">
                                        <button 
                                            onClick={() => handleToggleActive(u.id)}
                                            className={`btn btn-sm fw-medium ${u.status === 'Active' ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                        >
                                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="p-5 border-top">
                        <EmptyState 
                            icon="bi-people" 
                            title="No users found" 
                            message="Try adjusting your filters or search query." 
                        />
                    </div>
                )}
            </div>

            {/* CREATE RESIDENT MODAL */}
            {showResidentModal && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">Create New Resident</h5>
                                <button type="button" className="btn-close" onClick={() => setShowResidentModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {formError && <div className="alert alert-danger py-2">{formError}</div>}
                                {formSuccess && <div className="alert alert-success py-2">{formSuccess}</div>}
                                
                                <form onSubmit={handleCreateResident}>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">First Name</label>
                                            <input type="text" className="form-control bg-light" required value={residentForm.first_name} onChange={e => setResidentForm({...residentForm, first_name: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Last Name</label>
                                            <input type="text" className="form-control bg-light" required value={residentForm.last_name} onChange={e => setResidentForm({...residentForm, last_name: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Username</label>
                                            <input type="text" className="form-control bg-light" required value={residentForm.username} onChange={e => setResidentForm({...residentForm, username: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Email</label>
                                            <input type="email" className="form-control bg-light" value={residentForm.email} onChange={e => setResidentForm({...residentForm, email: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Password</label>
                                            <input type="password" className="form-control bg-light" required value={residentForm.password} onChange={e => setResidentForm({...residentForm, password: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Confirm Password</label>
                                            <input type="password" className="form-control bg-light" required value={residentForm.confirm_password} onChange={e => setResidentForm({...residentForm, confirm_password: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-4 border-top pt-3 mt-1">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Tower</label>
                                            <select className="form-select bg-light" required value={residentForm.tower} onChange={e => setResidentForm({...residentForm, tower: e.target.value, flat_id: ''})}>
                                                <option value="">Select Tower...</option>
                                                {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Flat</label>
                                            <select className="form-select bg-light" required disabled={!residentForm.tower} value={residentForm.flat_id} onChange={e => setResidentForm({...residentForm, flat_id: e.target.value})}>
                                                <option value="">Select Flat...</option>
                                                {flats.map(f => <option key={f.id} value={f.id}>{f.number}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <button type="submit" className="gv-btn-primary w-100 py-2" disabled={formLoading}>
                                        {formLoading ? 'Creating...' : 'Create Resident Account'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE GUARD MODAL */}
            {showGuardModal && (
                <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">Create New Guard</h5>
                                <button type="button" className="btn-close" onClick={() => setShowGuardModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {formError && <div className="alert alert-danger py-2">{formError}</div>}
                                {formSuccess && <div className="alert alert-success py-2">{formSuccess}</div>}
                                
                                <form onSubmit={handleCreateGuard}>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">First Name</label>
                                            <input type="text" className="form-control bg-light" required value={guardForm.first_name} onChange={e => setGuardForm({...guardForm, first_name: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Last Name</label>
                                            <input type="text" className="form-control bg-light" required value={guardForm.last_name} onChange={e => setGuardForm({...guardForm, last_name: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Username</label>
                                            <input type="text" className="form-control bg-light" required value={guardForm.username} onChange={e => setGuardForm({...guardForm, username: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Email</label>
                                            <input type="email" className="form-control bg-light" value={guardForm.email} onChange={e => setGuardForm({...guardForm, email: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="row g-3 mb-4 border-bottom pb-4">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Password</label>
                                            <input type="password" className="form-control bg-light" required value={guardForm.password} onChange={e => setGuardForm({...guardForm, password: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Confirm Password</label>
                                            <input type="password" className="form-control bg-light" required value={guardForm.confirm_password} onChange={e => setGuardForm({...guardForm, confirm_password: e.target.value})} />
                                        </div>
                                    </div>
                                    <button type="submit" className="gv-btn-primary w-100 py-2" disabled={formLoading}>
                                        {formLoading ? 'Creating...' : 'Create Guard Account'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsers;
