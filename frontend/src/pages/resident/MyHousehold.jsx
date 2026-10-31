import React, { useState, useEffect, useContext } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { AuthContext } from '../../context/AuthContext';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const RELATIONSHIP_CHOICES = [
    { value: 'WIFE', label: 'Wife' },
    { value: 'HUSBAND', label: 'Husband' },
    { value: 'FATHER', label: 'Father' },
    { value: 'MOTHER', label: 'Mother' },
    { value: 'BROTHER', label: 'Brother' },
    { value: 'SISTER', label: 'Sister' },
    { value: 'OTHER', label: 'Other' },
];

const MyHousehold = () => {
    const { user } = useContext(AuthContext);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Add Member Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addFormData, setAddFormData] = useState({
        full_name: '',
        relationship: 'WIFE',
        mobile_number: '',
        email: '',
        password: '',
        can_receive_parcels: true,
        can_receive_food: true,
        can_collect_gatehouse_parcels: true,
        can_view_delivery_notifications: true
    });
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState('');

    // Edit Member Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);
    const [editFormData, setEditFormData] = useState({
        full_name: '',
        relationship: 'WIFE',
        mobile_number: '',
        email: '',
        is_active: true,
        can_receive_parcels: true,
        can_receive_food: true,
        can_collect_gatehouse_parcels: true,
        can_view_delivery_notifications: true
    });
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState('');

    // Audit Trail Modal State
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditMemberName, setAuditMemberName] = useState('');

    const fetchMembers = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await axiosInstance.get('resident/household/');
            setMembers(res.data);
        } catch (err) {
            setError('Failed to load household members.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleOpenAddModal = () => {
        setAddFormData({
            full_name: '',
            relationship: 'WIFE',
            mobile_number: '',
            email: '',
            password: '',
            can_receive_parcels: true,
            can_receive_food: true,
            can_collect_gatehouse_parcels: true,
            can_view_delivery_notifications: true
        });
        setAddError('');
        setShowAddModal(true);
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        setAddSubmitting(true);
        setAddError('');

        try {
            await axiosInstance.post('resident/household/add/', addFormData);
            setShowAddModal(false);
            setSuccessMsg('Household member added and authorized successfully.');
            setTimeout(() => setSuccessMsg(''), 5000);
            fetchMembers();
        } catch (err) {
            setAddError(err.response?.data?.error || 'Failed to add household member. Check your input.');
        } finally {
            setAddSubmitting(false);
        }
    };

    const handleOpenEditModal = (member) => {
        setSelectedMember(member);
        setEditFormData({
            full_name: member.full_name,
            relationship: member.relationship,
            mobile_number: member.mobile_number,
            email: member.email || '',
            is_active: member.is_active,
            can_receive_parcels: member.can_receive_parcels,
            can_receive_food: member.can_receive_food,
            can_collect_gatehouse_parcels: member.can_collect_gatehouse_parcels,
            can_view_delivery_notifications: member.can_view_delivery_notifications
        });
        setEditError('');
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMember) return;
        setEditSubmitting(true);
        setEditError('');

        try {
            await axiosInstance.patch(`resident/household/${selectedMember.id}/`, editFormData);
            setShowEditModal(false);
            setSuccessMsg(`Permissions and details for ${editFormData.full_name} updated successfully.`);
            setTimeout(() => setSuccessMsg(''), 5000);
            fetchMembers();
        } catch (err) {
            setEditError(err.response?.data?.error || 'Failed to update member.');
        } finally {
            setEditSubmitting(false);
        }
    };

    const handleToggleActive = async (member) => {
        try {
            await axiosInstance.patch(`resident/household/${member.id}/`, {
                is_active: !member.is_active
            });
            setSuccessMsg(`Authorization status changed to ${!member.is_active ? 'Active' : 'Deactivated'}.`);
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchMembers();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update status.');
        }
    };

    const handleRevokeAuthorization = async (member) => {
        if (!window.confirm(`Are you sure you want to completely revoke authorization for ${member.full_name}? They will no longer be able to receive deliveries or collect parcels.`)) {
            return;
        }

        try {
            await axiosInstance.delete(`resident/household/${member.id}/`);
            setSuccessMsg(`Authorization for ${member.full_name} has been revoked.`);
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchMembers();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to revoke member authorization.');
        }
    };

    const handleOpenAuditModal = (member) => {
        setAuditMemberName(member.full_name);
        setAuditLogs(member.audit_logs || []);
        setShowAuditModal(true);
    };

    const isPrimary = user?.is_primary !== false;

    if (loading) return <LoadingSpinner message="Loading household members..." />;
    if (error) return <ErrorState message={error} onRetry={fetchMembers} />;

    return (
        <div className="container-fluid px-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1">
                        <i className="bi bi-people-fill text-primary me-2"></i>My Household
                    </h3>
                    <p className="text-muted small mb-0">
                        Authorize family members to receive parcels, collect gatehouse packages, and receive food deliveries.
                    </p>
                </div>
                {isPrimary ? (
                    <button onClick={handleOpenAddModal} className="gv-btn-primary d-flex align-items-center gap-2">
                        <i className="bi bi-person-plus-fill"></i> Add Household Member
                    </button>
                ) : (
                    <div className="alert alert-info py-2 px-3 small mb-0 d-flex align-items-center gap-2">
                        <i className="bi bi-info-circle-fill"></i> Secondary Member (Read-Only)
                    </div>
                )}
            </div>

            {/* Success alert */}
            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
                    <i className="bi bi-check-circle-fill fs-5 me-2"></i>
                    <div>{successMsg}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setSuccessMsg('')}></button>
                </div>
            )}

            {!isPrimary && (
                <div className="alert alert-warning py-3 px-4 mb-4 border-0 shadow-sm d-flex align-items-center gap-3">
                    <i className="bi bi-shield-lock-fill fs-3 text-warning"></i>
                    <div>
                        <div className="fw-bold">Household Authorization Management Notice</div>
                        <div className="small text-muted">
                            Only the primary resident of your flat is permitted to add, edit permissions, or revoke household members.
                        </div>
                    </div>
                </div>
            )}

            {/* Household Members List */}
            {members.length === 0 ? (
                <EmptyState 
                    icon="bi-people" 
                    title="No household members added yet." 
                    message="Authorize family members (wife, husband, parents, siblings) to accept parcel and food deliveries on your behalf." 
                />
            ) : (
                <div className="row g-4">
                    {members.map(member => (
                        <div className="col-12 col-lg-6" key={member.id}>
                            <div className={`gv-card h-100 overflow-hidden border-2 ${member.is_active ? 'border-primary border-opacity-25' : 'border-secondary border-opacity-25 bg-light'}`}>
                                <div className="p-4">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className={`rounded-circle d-flex align-items-center justify-content-center text-white fw-bold ${member.is_active ? 'bg-primary' : 'bg-secondary'}`} style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                                                {member.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h5 className="fw-bold text-dark mb-0">{member.full_name}</h5>
                                                <div className="d-flex align-items-center gap-2 mt-1">
                                                    <span className="badge bg-light text-primary border">
                                                        <i className="bi bi-heart me-1"></i>{member.relationship_display}
                                                    </span>
                                                    <span className="text-muted small">Flat {member.flat_number} ({member.tower_name})</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            {member.is_active ? (
                                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                                                    <i className="bi bi-check-circle-fill me-1"></i>Active Authorized
                                                </span>
                                            ) : (
                                                <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1">
                                                    <i className="bi bi-pause-circle-fill me-1"></i>Deactivated
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact Info */}
                                    <div className="bg-light rounded p-3 mb-3 small">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="text-muted"><i className="bi bi-telephone me-2"></i>Mobile:</span>
                                            <span className="fw-semibold text-dark">{member.mobile_number}</span>
                                        </div>
                                        {member.email && (
                                            <div className="d-flex align-items-center justify-content-between mb-1">
                                                <span className="text-muted"><i className="bi bi-envelope me-2"></i>Email:</span>
                                                <span className="fw-medium text-dark">{member.email}</span>
                                            </div>
                                        )}
                                        {member.username && (
                                            <div className="d-flex align-items-center justify-content-between">
                                                <span className="text-muted"><i className="bi bi-person-badge me-2"></i>Login Username:</span>
                                                <span className="badge bg-secondary">{member.username}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Configured Permissions */}
                                    <div className="mb-4">
                                        <div className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                                            Configured Permissions
                                        </div>
                                        <div className="d-flex flex-wrap gap-2">
                                            <span className={`badge px-2 py-2 d-flex align-items-center gap-1 ${member.can_receive_parcels ? 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25' : 'bg-light text-muted border text-decoration-line-through'}`}>
                                                <i className="bi bi-box-seam"></i> Parcels
                                            </span>
                                            <span className={`badge px-2 py-2 d-flex align-items-center gap-1 ${member.can_receive_food ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' : 'bg-light text-muted border text-decoration-line-through'}`}>
                                                <i className="bi bi-cup-hot"></i> Food Deliveries
                                            </span>
                                            <span className={`badge px-2 py-2 d-flex align-items-center gap-1 ${member.can_collect_gatehouse_parcels ? 'bg-info bg-opacity-10 text-info border border-info border-opacity-25' : 'bg-light text-muted border text-decoration-line-through'}`}>
                                                <i className="bi bi-qr-code"></i> Gatehouse Pickup
                                            </span>
                                            <span className={`badge px-2 py-2 d-flex align-items-center gap-1 ${member.can_view_delivery_notifications ? 'bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25' : 'bg-light text-muted border text-decoration-line-through'}`}>
                                                <i className="bi bi-bell"></i> Notifications
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="d-flex flex-wrap gap-2 pt-3 border-top">
                                        {isPrimary && (
                                            <>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleOpenEditModal(member)} 
                                                    className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                                                >
                                                    <i className="bi bi-sliders"></i> Permissions
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleToggleActive(member)} 
                                                    className={`btn btn-sm ${member.is_active ? 'btn-outline-warning' : 'btn-outline-success'} d-flex align-items-center gap-1`}
                                                >
                                                    <i className={`bi ${member.is_active ? 'bi-pause-circle' : 'bi-play-circle'}`}></i>
                                                    {member.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRevokeAuthorization(member)} 
                                                    className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 ms-auto"
                                                >
                                                    <i className="bi bi-trash3"></i> Revoke
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            type="button" 
                                            onClick={() => handleOpenAuditModal(member)} 
                                            className={`btn btn-sm btn-light border d-flex align-items-center gap-1 ${!isPrimary ? 'w-100 justify-content-center' : ''}`}
                                        >
                                            <i className="bi bi-clock-history"></i> Audit Trail ({member.audit_logs?.length || 0})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ADD HOUSEHOLD MEMBER MODAL */}
            {showAddModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-person-plus-fill me-2"></i>Add Authorized Household Member
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
                            </div>
                            <form onSubmit={handleAddSubmit}>
                                <div className="modal-body p-4">
                                    {addError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>{addError}
                                        </div>
                                    )}

                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Full Name <span className="text-danger">*</span></label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="e.g. Jane Doe"
                                                value={addFormData.full_name}
                                                onChange={(e) => setAddFormData({...addFormData, full_name: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Relationship <span className="text-danger">*</span></label>
                                            <select 
                                                className="form-select"
                                                value={addFormData.relationship}
                                                onChange={(e) => setAddFormData({...addFormData, relationship: e.target.value})}
                                                required
                                            >
                                                {RELATIONSHIP_CHOICES.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Mobile Number <span className="text-danger">*</span></label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                placeholder="e.g. 9876543210"
                                                value={addFormData.mobile_number}
                                                onChange={(e) => setAddFormData({...addFormData, mobile_number: e.target.value})}
                                                required
                                            />
                                            <div className="form-text small">Used for identification and notification matching.</div>
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Email Address (Optional)</label>
                                            <input 
                                                type="email" 
                                                className="form-control" 
                                                placeholder="e.g. member@example.com"
                                                value={addFormData.email}
                                                onChange={(e) => setAddFormData({...addFormData, email: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label text-muted small fw-semibold">Member Account Password (Optional)</label>
                                        <input 
                                            type="password" 
                                            className="form-control" 
                                            placeholder="Leave empty to generate secure default (GV@last4digits!)"
                                            value={addFormData.password}
                                            onChange={(e) => setAddFormData({...addFormData, password: e.target.value})}
                                        />
                                        <div className="form-text small">
                                            A member account will be created and linked to your flat so they can log in and view authorized parcels.
                                        </div>
                                    </div>

                                    {/* Permissions configuration */}
                                    <div className="border rounded p-3 bg-light">
                                        <div className="fw-bold text-dark small text-uppercase mb-2" style={{ letterSpacing: '0.05em' }}>
                                            Authorization Permissions
                                        </div>
                                        <div className="row g-2">
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="add_can_receive_parcels"
                                                        checked={addFormData.can_receive_parcels}
                                                        onChange={(e) => setAddFormData({...addFormData, can_receive_parcels: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="add_can_receive_parcels">
                                                        <i className="bi bi-box-seam me-1 text-primary"></i> Can receive parcels
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="add_can_receive_food"
                                                        checked={addFormData.can_receive_food}
                                                        onChange={(e) => setAddFormData({...addFormData, can_receive_food: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="add_can_receive_food">
                                                        <i className="bi bi-cup-hot me-1 text-success"></i> Can receive food deliveries
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="add_can_collect_gatehouse_parcels"
                                                        checked={addFormData.can_collect_gatehouse_parcels}
                                                        onChange={(e) => setAddFormData({...addFormData, can_collect_gatehouse_parcels: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="add_can_collect_gatehouse_parcels">
                                                        <i className="bi bi-qr-code me-1 text-info"></i> Can collect gatehouse parcels
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="add_can_view_delivery_notifications"
                                                        checked={addFormData.can_view_delivery_notifications}
                                                        onChange={(e) => setAddFormData({...addFormData, can_view_delivery_notifications: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="add_can_view_delivery_notifications">
                                                        <i className="bi bi-bell me-1 text-warning"></i> View delivery notifications
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-light" onClick={() => setShowAddModal(false)}>Cancel</button>
                                    <button type="submit" className="gv-btn-primary" disabled={addSubmitting}>
                                        {addSubmitting ? <><span className="spinner-border spinner-border-sm me-1"></span> Adding...</> : 'Save & Authorize Member'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MEMBER MODAL */}
            {showEditModal && selectedMember && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-dark text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-sliders me-2"></i>Configure Permissions & Details: {selectedMember.full_name}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
                            </div>
                            <form onSubmit={handleEditSubmit}>
                                <div className="modal-body p-4">
                                    {editError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>{editError}
                                        </div>
                                    )}

                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Full Name</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                value={editFormData.full_name}
                                                onChange={(e) => setEditFormData({...editFormData, full_name: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Relationship</label>
                                            <select 
                                                className="form-select"
                                                value={editFormData.relationship}
                                                onChange={(e) => setEditFormData({...editFormData, relationship: e.target.value})}
                                                required
                                            >
                                                {RELATIONSHIP_CHOICES.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Mobile Number</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                value={editFormData.mobile_number}
                                                onChange={(e) => setEditFormData({...editFormData, mobile_number: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="col-12 col-md-6">
                                            <label className="form-label text-muted small fw-semibold">Email Address</label>
                                            <input 
                                                type="email" 
                                                className="form-control" 
                                                value={editFormData.email}
                                                onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                            />
                                        </div>
                                    </div>

                                    {/* Active toggle */}
                                    <div className="form-check form-switch mb-3 p-3 bg-light rounded border">
                                        <input 
                                            className="form-check-input ms-0 me-3" 
                                            type="checkbox" 
                                            id="edit_is_active"
                                            checked={editFormData.is_active}
                                            onChange={(e) => setEditFormData({...editFormData, is_active: e.target.checked})}
                                        />
                                        <label className="form-check-label fw-bold text-dark" htmlFor="edit_is_active">
                                            Authorization Active
                                        </label>
                                        <div className="small text-muted ms-5">
                                            When deactivated, this member will not be permitted to receive or collect packages.
                                        </div>
                                    </div>

                                    {/* Permissions */}
                                    <div className="border rounded p-3 bg-light">
                                        <div className="fw-bold text-dark small text-uppercase mb-2" style={{ letterSpacing: '0.05em' }}>
                                            Permissions
                                        </div>
                                        <div className="row g-2">
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="edit_can_receive_parcels"
                                                        checked={editFormData.can_receive_parcels}
                                                        onChange={(e) => setEditFormData({...editFormData, can_receive_parcels: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="edit_can_receive_parcels">
                                                        <i className="bi bi-box-seam me-1 text-primary"></i> Can receive parcels
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="edit_can_receive_food"
                                                        checked={editFormData.can_receive_food}
                                                        onChange={(e) => setEditFormData({...editFormData, can_receive_food: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="edit_can_receive_food">
                                                        <i className="bi bi-cup-hot me-1 text-success"></i> Can receive food deliveries
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="edit_can_collect_gatehouse_parcels"
                                                        checked={editFormData.can_collect_gatehouse_parcels}
                                                        onChange={(e) => setEditFormData({...editFormData, can_collect_gatehouse_parcels: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="edit_can_collect_gatehouse_parcels">
                                                        <i className="bi bi-qr-code me-1 text-info"></i> Can collect gatehouse parcels
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="col-12 col-md-6">
                                                <div className="form-check">
                                                    <input 
                                                        className="form-check-input" 
                                                        type="checkbox" 
                                                        id="edit_can_view_delivery_notifications"
                                                        checked={editFormData.can_view_delivery_notifications}
                                                        onChange={(e) => setEditFormData({...editFormData, can_view_delivery_notifications: e.target.checked})}
                                                    />
                                                    <label className="form-check-label small fw-medium" htmlFor="edit_can_view_delivery_notifications">
                                                        <i className="bi bi-bell me-1 text-warning"></i> View delivery notifications
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-light" onClick={() => setShowEditModal(false)}>Cancel</button>
                                    <button type="submit" className="gv-btn-primary" disabled={editSubmitting}>
                                        {editSubmitting ? <><span className="spinner-border spinner-border-sm me-1"></span> Saving...</> : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* AUDIT TRAIL MODAL */}
            {showAuditModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title fw-bold text-dark">
                                    <i className="bi bi-clock-history me-2 text-primary"></i>Authorization Audit Trail: {auditMemberName}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowAuditModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {auditLogs.length === 0 ? (
                                    <div className="text-center text-muted py-4">No audit logs recorded for this member.</div>
                                ) : (
                                    <div className="timeline">
                                        {auditLogs.map((log) => (
                                            <div className="d-flex gap-3 mb-3 pb-3 border-bottom" key={log.id}>
                                                <div className="text-primary fs-4">
                                                    <i className="bi bi-shield-check"></i>
                                                </div>
                                                <div className="flex-grow-1">
                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                        <span className="badge bg-secondary">{log.action_display || log.action}</span>
                                                        <span className="text-muted small">
                                                            {new Date(log.timestamp).toLocaleDateString('en-GB')} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className="text-dark small fw-medium">{log.details}</div>
                                                    <div className="text-muted small mt-1">Performed by: {log.performed_by_name}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAuditModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyHousehold;

