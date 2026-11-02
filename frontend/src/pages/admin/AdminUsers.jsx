import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approvalsLoading, setApprovalsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Active Tab: 'USERS' or 'APPROVALS'
    const [activeTab, setActiveTab] = useState('USERS');
    const [approvalFilter, setApprovalFilter] = useState('PENDING_APPROVAL');

    // Filters for Users
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    // Modals
    const [showResidentModal, setShowResidentModal] = useState(false);
    const [showGuardModal, setShowGuardModal] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    // Rejection Modal
    const [rejectProfile, setRejectProfile] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectLoading, setRejectLoading] = useState(false);

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

    const fetchApprovals = async (status = approvalFilter) => {
        try {
            setApprovalsLoading(true);
            const param = status === 'ALL' ? '' : `?status=${status}`;
            const res = await axiosInstance.get(`admin/resident-approvals/${param}`);
            setApprovals(res.data);
        } catch (err) {
            console.error('Failed to load resident approvals', err);
        } finally {
            setApprovalsLoading(false);
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
        fetchApprovals('PENDING_APPROVAL');
        fetchTowers();
    }, []);

    useEffect(() => {
        if (activeTab === 'APPROVALS') {
            fetchApprovals(approvalFilter);
        }
    }, [activeTab, approvalFilter]);

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

    const handleApproveResident = async (profileId) => {
        try {
            const res = await axiosInstance.post(`admin/resident-approvals/${profileId}/approve/`);
            // Update approvals list
            setApprovals(prev => prev.map(p => p.id === profileId ? { ...p, approval_status: 'APPROVED', approved_at: new Date().toISOString() } : p));
            // Refresh users
            fetchUsers();
            alert(res.data.message || 'Resident approved successfully!');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to approve resident.');
        }
    };

    const handleRejectSubmit = async (e) => {
        e.preventDefault();
        if (!rejectProfile) return;
        setRejectLoading(true);
        try {
            const res = await axiosInstance.post(`admin/resident-approvals/${rejectProfile.id}/reject/`, {
                reason: rejectReason
            });
            setApprovals(prev => prev.map(p => p.id === rejectProfile.id ? { ...p, approval_status: 'REJECTED', rejection_reason: rejectReason } : p));
            setRejectProfile(null);
            setRejectReason('');
            fetchUsers();
            alert(res.data.message || 'Resident registration rejected.');
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to reject resident.');
        } finally {
            setRejectLoading(false);
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

    const pendingApprovalsCount = approvals.filter(a => a.approval_status === 'PENDING_APPROVAL').length;

    const filteredUsers = users.filter(u => {
        if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (u.username.toLowerCase().includes(query) || 
                    (u.first_name + ' ' + u.last_name).toLowerCase().includes(query) || 
                    (u.email && u.email.toLowerCase().includes(query)));
        }
        return true;
    });

    if (loading) return <LoadingSpinner message="Loading users..." />;
    if (error) return <ErrorState message={error} onRetry={fetchUsers} />;

    return (
        <div className="container-fluid px-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark mb-1">User & Access Management</h2>
                    <p className="text-muted mb-0">Manage resident approvals, security guards, and account credentials.</p>
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

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mb-4 gap-2 bg-light p-2 rounded-3">
                <li className="nav-item">
                    <button 
                        className={`nav-link rounded-pill px-4 fw-semibold ${activeTab === 'USERS' ? 'active shadow-sm' : 'text-dark'}`}
                        onClick={() => setActiveTab('USERS')}
                    >
                        <i className="bi bi-people-fill me-2"></i> All User Accounts ({users.length})
                    </button>
                </li>
                <li className="nav-item">
                    <button 
                        className={`nav-link rounded-pill px-4 fw-semibold position-relative ${activeTab === 'APPROVALS' ? 'active shadow-sm' : 'text-dark'}`}
                        onClick={() => setActiveTab('APPROVALS')}
                    >
                        <i className="bi bi-person-check-fill me-2"></i> Resident Approvals
                        {pendingApprovalsCount > 0 && (
                            <span className="badge bg-danger rounded-pill ms-2">
                                {pendingApprovalsCount} pending
                            </span>
                        )}
                    </button>
                </li>
            </ul>

            {/* TAB 1: ALL USER ACCOUNTS */}
            {activeTab === 'USERS' && (
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
                                    <option value="ADMIN">Admins</option>
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
                                    <th className="py-3 fw-semibold border-bottom-0">Flat Assignment</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Auth / Approval</th>
                                    <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                    <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="border-top-0">
                                {filteredUsers.map(u => (
                                    <tr key={u.id}>
                                        <td className="ps-4 py-3">
                                            <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                {u.first_name} {u.last_name}
                                                {u.google_linked && (
                                                    <span className="badge bg-light text-danger border p-1 rounded-circle" title="Google OAuth Linked">
                                                        <i className="bi bi-google" style={{ fontSize: '0.75rem' }}></i>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-muted small">{u.email || 'No email provided'}</div>
                                        </td>
                                        <td className="py-3 fw-medium text-dark">{u.username}</td>
                                        <td className="py-3">
                                            <span className={`badge ${u.role === 'GUARD' ? 'bg-primary' : (u.role === 'ADMIN' ? 'bg-dark' : 'bg-success')} bg-opacity-10 text-${u.role === 'GUARD' ? 'primary' : (u.role === 'ADMIN' ? 'dark' : 'success')} border border-${u.role === 'GUARD' ? 'primary' : (u.role === 'ADMIN' ? 'dark' : 'success')} border-opacity-25`}>
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
                                            {u.role === 'RESIDENT' ? (
                                                <span className={`badge ${
                                                    u.approval_status === 'APPROVED' ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' :
                                                    (u.approval_status === 'PENDING_APPROVAL' ? 'bg-warning bg-opacity-10 text-warning-emphasis border border-warning' : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25')
                                                }`}>
                                                    {u.approval_status === 'APPROVED' ? 'Approved' : (u.approval_status === 'PENDING_APPROVAL' ? 'Pending Approval' : 'Rejected')}
                                                </span>
                                            ) : (
                                                <span className="text-muted small">Standard Credential</span>
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
            )}

            {/* TAB 2: RESIDENT APPROVALS */}
            {activeTab === 'APPROVALS' && (
                <div className="gv-card overflow-hidden">
                    <div className="card-header bg-white p-4 border-bottom d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div>
                            <h5 className="fw-bold mb-1">Resident Registration Verification</h5>
                            <p className="text-muted small mb-0">Verify resident occupancy before granting parcel and gatehouse access.</p>
                        </div>
                        <div className="d-flex gap-2">
                            {['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL'].map(st => (
                                <button
                                    key={st}
                                    className={`btn btn-sm rounded-pill px-3 ${approvalFilter === st ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => setApprovalFilter(st)}
                                >
                                    {st.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {approvalsLoading ? (
                        <div className="p-5 text-center">
                            <div className="spinner-border text-primary" role="status"></div>
                            <p className="text-muted mt-2 mb-0">Loading approvals...</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0 border-0">
                                <thead className="bg-light text-muted small text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                    <tr>
                                        <th className="ps-4 py-3 fw-semibold border-bottom-0">Resident / Email</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Assigned Tower & Flat</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Google OAuth</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Status</th>
                                        <th className="py-3 fw-semibold border-bottom-0">Details / Reason</th>
                                        <th className="pe-4 py-3 fw-semibold border-bottom-0 text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="border-top-0">
                                    {approvals.map(p => (
                                        <tr key={p.id}>
                                            <td className="ps-4 py-3">
                                                <div className="fw-bold text-dark">{p.full_name}</div>
                                                <div className="text-muted small">{p.email || p.username}</div>
                                                {p.phone_number && (
                                                    <div className="text-muted small"><i className="bi bi-telephone me-1"></i>{p.phone_number}</div>
                                                )}
                                            </td>
                                            <td className="py-3">
                                                <span className="fw-semibold text-dark">Tower {p.tower_name}</span>
                                                <div className="text-muted small">Flat {p.flat_number}</div>
                                            </td>
                                            <td className="py-3">
                                                {p.google_linked ? (
                                                    <span className="badge bg-light text-dark border px-2 py-1">
                                                        <i className="bi bi-google text-danger me-1"></i> Google Verified
                                                    </span>
                                                ) : (
                                                    <span className="text-muted small">Password Account</span>
                                                )}
                                            </td>
                                            <td className="py-3">
                                                <span className={`badge ${
                                                    p.approval_status === 'APPROVED' ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' :
                                                    (p.approval_status === 'PENDING_APPROVAL' ? 'bg-warning bg-opacity-10 text-warning-emphasis border border-warning' : 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25')
                                                } px-2 py-1`}>
                                                    {p.approval_status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 small">
                                                {p.approval_status === 'APPROVED' && p.approved_by_name && (
                                                    <span className="text-muted">Approved by {p.approved_by_name}</span>
                                                )}
                                                {p.approval_status === 'REJECTED' && (
                                                    <span className="text-danger">{p.rejection_reason || 'No reason specified.'}</span>
                                                )}
                                                {p.approval_status === 'PENDING_APPROVAL' && (
                                                    <span className="text-muted">Awaiting admin review</span>
                                                )}
                                            </td>
                                            <td className="pe-4 py-3 text-end">
                                                {p.approval_status === 'PENDING_APPROVAL' && (
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <button
                                                            className="btn btn-sm btn-success rounded-pill px-3 fw-semibold"
                                                            onClick={() => handleApproveResident(p.id)}
                                                        >
                                                            <i className="bi bi-check-lg me-1"></i> Approve
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold"
                                                            onClick={() => {
                                                                setRejectProfile(p);
                                                                setRejectReason('');
                                                            }}
                                                        >
                                                            <i className="bi bi-x-lg me-1"></i> Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {p.approval_status === 'REJECTED' && (
                                                    <button
                                                        className="btn btn-sm btn-outline-success rounded-pill px-3"
                                                        onClick={() => handleApproveResident(p.id)}
                                                    >
                                                        Re-approve
                                                    </button>
                                                )}
                                                {p.approval_status === 'APPROVED' && (
                                                    <span className="text-success small fw-medium">
                                                        <i className="bi bi-check-circle-fill me-1"></i> Active Resident
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!approvalsLoading && approvals.length === 0 && (
                        <div className="p-5 border-top">
                            <EmptyState 
                                icon="bi-shield-check" 
                                title="No registrations found" 
                                message={`There are currently no resident registrations matching '${approvalFilter}'.`} 
                            />
                        </div>
                    )}
                </div>
            )}

            {/* REJECTION REASON MODAL */}
            {rejectProfile && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-bottom pb-3">
                                <h5 className="modal-title fw-bold text-danger">Reject Resident Registration</h5>
                                <button type="button" className="btn-close" onClick={() => setRejectProfile(null)}></button>
                            </div>
                            <form onSubmit={handleRejectSubmit}>
                                <div className="modal-body p-4">
                                    <p className="text-muted small mb-3">
                                        You are rejecting the registration for <strong>{rejectProfile.full_name}</strong> (Tower {rejectProfile.tower_name}, Flat {rejectProfile.flat_number}).
                                    </p>
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Reason for Rejection</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="e.g. Tower and flat tenancy could not be verified with building management."
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            required
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer border-top p-3 d-flex justify-content-end gap-2">
                                    <button type="button" className="btn btn-light rounded-pill px-3" onClick={() => setRejectProfile(null)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-danger rounded-pill px-4 fw-semibold" disabled={rejectLoading}>
                                        {rejectLoading ? 'Rejecting...' : 'Confirm Rejection'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

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
                                    <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={formLoading}>
                                        {formLoading ? 'Creating...' : 'Create Resident'}
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
                                <h5 className="modal-title fw-bold">Create New Security Guard</h5>
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
                                    <div className="row g-3 mb-4">
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Password</label>
                                            <input type="password" className="form-control bg-light" required value={guardForm.password} onChange={e => setGuardForm({...guardForm, password: e.target.value})} />
                                        </div>
                                        <div className="col-6">
                                            <label className="form-label small fw-semibold">Confirm Password</label>
                                            <input type="password" className="form-control bg-light" required value={guardForm.confirm_password} onChange={e => setGuardForm({...guardForm, confirm_password: e.target.value})} />
                                        </div>
                                    </div>
                                    <button type="submit" className="btn btn-primary w-100 py-2 fw-semibold" disabled={formLoading}>
                                        {formLoading ? 'Creating...' : 'Create Guard'}
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
