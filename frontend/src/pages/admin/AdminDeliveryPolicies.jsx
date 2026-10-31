import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';

const AdminDeliveryPolicies = () => {
    const [communityPolicies, setCommunityPolicies] = useState([]);
    const [towerOverrides, setTowerOverrides] = useState([]);
    const [towers, setTowers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [modes, setModes] = useState([]);
    const [auditHistory, setAuditHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modal state for editing policy
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [isTowerModal, setIsTowerModal] = useState(false);
    const [editFormData, setEditFormData] = useState({
        delivery_type: 'NORMAL',
        delivery_mode: 'GATEHOUSE_ONLY',
        allow_direct_to_flat: false,
        require_gatehouse_intake: true,
        allow_household_receiver: true,
        require_resident_presence: false,
        require_extra_verification: false,
        bypass_storage_shelf: false,
        enable_cod_coordination: true,
        description: '',
        is_active: true,
        tower_id: ''
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Modal state for viewing audit log
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);

    // Active tab: 'COMMUNITY' | 'TOWER_OVERRIDES'
    const [activeTab, setActiveTab] = useState('COMMUNITY');

    const fetchPolicies = async () => {
        try {
            setLoading(true);
            setError('');
            const [polRes, towersRes] = await Promise.all([
                axiosInstance.get('admin/delivery-policies/'),
                axiosInstance.get('towers/')
            ]);
            setCommunityPolicies(polRes.data.community_policies || []);
            setTowerOverrides(polRes.data.tower_overrides || []);
            setCategories(polRes.data.categories || []);
            setModes(polRes.data.modes || []);
            setTowers(towersRes.data || []);
        } catch (err) {
            console.error("Failed to load delivery policies", err);
            setError("Failed to load delivery policies. Please check connection.");
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditHistory = async () => {
        try {
            setAuditLoading(true);
            const res = await axiosInstance.get('admin/delivery-policies/history/');
            setAuditHistory(res.data || []);
            setShowAuditModal(true);
        } catch (err) {
            console.error("Failed to load policy audit history", err);
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicies();
    }, []);

    const openEditCommunityPolicy = (policy) => {
        setIsTowerModal(false);
        setSelectedPolicy(policy);
        setEditFormData({
            delivery_type: policy.delivery_type,
            delivery_mode: policy.delivery_mode,
            allow_direct_to_flat: policy.allow_direct_to_flat,
            require_gatehouse_intake: policy.require_gatehouse_intake,
            allow_household_receiver: policy.allow_household_receiver,
            require_resident_presence: policy.require_resident_presence,
            require_extra_verification: policy.require_extra_verification,
            bypass_storage_shelf: policy.bypass_storage_shelf,
            enable_cod_coordination: policy.enable_cod_coordination,
            description: policy.description || '',
            is_active: policy.is_active,
            tower_id: ''
        });
        setSaveError('');
    };

    const openCreateTowerOverride = (deliveryType = 'NORMAL') => {
        setIsTowerModal(true);
        setSelectedPolicy(null);
        setEditFormData({
            delivery_type: deliveryType,
            delivery_mode: 'DIRECT_TO_FLAT',
            allow_direct_to_flat: true,
            require_gatehouse_intake: false,
            allow_household_receiver: true,
            require_resident_presence: false,
            require_extra_verification: false,
            bypass_storage_shelf: false,
            enable_cod_coordination: true,
            description: '',
            is_active: true,
            tower_id: towers.length > 0 ? towers[0].id : ''
        });
        setSaveError('');
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveError('');

        try {
            if (isTowerModal && !editFormData.tower_id) {
                setSaveError('Please select a Tower for this override policy.');
                setSaving(false);
                return;
            }

            await axiosInstance.post('admin/delivery-policies/', editFormData);
            setSelectedPolicy(null);
            setIsTowerModal(false);
            setSuccessMessage(`Delivery policy for ${editFormData.delivery_type} updated successfully!`);
            fetchPolicies();
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to save delivery policy.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTowerOverride = async (id, type, towerName) => {
        if (!window.confirm(`Are you sure you want to remove the tower override for ${type} in ${towerName}? Deliveries will revert to community default.`)) {
            return;
        }

        try {
            await axiosInstance.delete(`admin/delivery-policies/${id}/`);
            setSuccessMessage(`Tower override for ${type} in ${towerName} removed.`);
            fetchPolicies();
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove tower override');
        }
    };

    const getCategoryIcon = (type) => {
        switch (type) {
            case 'NORMAL': return 'bi-box-seam';
            case 'FOOD': return 'bi-cup-hot-fill text-warning';
            case 'COD': return 'bi-cash-coin text-success';
            case 'OPEN_BOX': return 'bi-box2-heart text-danger';
            case 'HIGH_VALUE': return 'bi-gem text-info';
            default: return 'bi-box';
        }
    };

    const getModeBadge = (mode) => {
        switch (mode) {
            case 'DIRECT_TO_FLAT':
                return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i className="bi bi-door-open me-1"></i>Direct to Flat</span>;
            case 'GATEHOUSE_ONLY':
                return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1"><i className="bi bi-shield-lock me-1"></i>Gatehouse Only</span>;
            case 'RESIDENT_PREFERENCE':
                return <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1"><i className="bi bi-sliders me-1"></i>Resident Preference</span>;
            case 'AUTHORIZED_RECEIVER_ONLY':
                return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1"><i className="bi bi-person-check me-1"></i>Authorized Receiver Only</span>;
            default:
                return <span className="badge bg-secondary">{mode}</span>;
        }
    };

    // Helper explanation generator for the configuration preview
    const getPolicyExplanation = (data) => {
        const statements = [];
        if (data.delivery_mode === 'GATEHOUSE_ONLY') {
            statements.push('Packages MUST be accepted at the gatehouse, logged in parcel shelves, and picked up via resident PIN or Secure QR.');
        } else if (data.delivery_mode === 'DIRECT_TO_FLAT') {
            statements.push('Couriers are permitted to proceed directly to the resident flat for doorstep delivery without gatehouse storage.');
        } else if (data.delivery_mode === 'RESIDENT_PREFERENCE') {
            statements.push('Both Gatehouse intake and Direct-to-Flat delivery are allowed; guards follow resident pre-registered instructions.');
        } else if (data.delivery_mode === 'AUTHORIZED_RECEIVER_ONLY') {
            statements.push('Only the designated primary resident or verified active household members with explicit permission may receive the item.');
        }

        if (data.require_resident_presence) {
            statements.push('Physical presence of the primary resident is STRICTLY required; delivery to household flatmates or unattended drop-off is prohibited.');
        }
        if (data.require_extra_verification) {
            statements.push('Guard must log extra verification details (e.g. resident identity check, recipient acknowledgment).');
        }
        if (data.bypass_storage_shelf) {
            statements.push('Deliveries bypass parcel storage shelves (suitable for hot food & perishables).');
        }
        if (!data.enable_cod_coordination && data.delivery_type === 'COD') {
            statements.push('Cash-on-Delivery collections are SUSPENDED at the gatehouse under this policy.');
        }
        return statements;
    };

    return (
        <div className="container-fluid px-0">
            {/* Page Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h2 className="fw-bold text-dark mb-1">Smart Community Delivery Policies</h2>
                    <p className="text-muted mb-0">
                        Configure community-wide delivery rules, gatehouse intake requirements, direct doorstep access, and tower-specific overrides.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button onClick={fetchAuditHistory} className="btn btn-outline-secondary d-flex align-items-center gap-2">
                        <i className="bi bi-clock-history"></i> Policy Audit Log
                    </button>
                    <button onClick={() => openCreateTowerOverride()} className="btn btn-primary d-flex align-items-center gap-2">
                        <i className="bi bi-building-add"></i> Add Tower Override
                    </button>
                </div>
            </div>

            {successMessage && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>{successMessage}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setSuccessMessage('')}></button>
                </div>
            )}

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mb-4 gap-2">
                <li className="nav-item">
                    <button
                        className={`nav-link px-4 py-2 fw-semibold ${activeTab === 'COMMUNITY' ? 'active bg-primary' : 'bg-light text-dark'}`}
                        onClick={() => setActiveTab('COMMUNITY')}
                    >
                        <i className="bi bi-houses me-2"></i> Community Default Policies ({communityPolicies.length})
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link px-4 py-2 fw-semibold ${activeTab === 'TOWER_OVERRIDES' ? 'active bg-primary' : 'bg-light text-dark'}`}
                        onClick={() => setActiveTab('TOWER_OVERRIDES')}
                    >
                        <i className="bi bi-buildings me-2"></i> Tower-Specific Overrides ({towerOverrides.length})
                    </button>
                </li>
            </ul>

            {loading ? (
                <div className="p-5 text-center">
                    <LoadingSpinner message="Loading delivery policies..." />
                </div>
            ) : error ? (
                <div className="p-4">
                    <ErrorState message={error} onRetry={fetchPolicies} />
                </div>
            ) : activeTab === 'COMMUNITY' ? (
                /* COMMUNITY POLICIES CARDS */
                <div className="row g-4 mb-4">
                    {communityPolicies.map((policy) => {
                        const overridesForCategory = towerOverrides.filter(to => to.delivery_type === policy.delivery_type);
                        return (
                            <div key={policy.id} className="col-12 col-lg-6">
                                <div className="gv-card h-100 p-4 border border-light shadow-sm d-flex flex-column justify-content-between">
                                    <div>
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="p-3 rounded-circle bg-light border">
                                                    <i className={`bi ${getCategoryIcon(policy.delivery_type)} fs-3`}></i>
                                                </div>
                                                <div>
                                                    <h5 className="fw-bold text-dark mb-1">{policy.delivery_type_display}</h5>
                                                    <span className="small text-muted text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>
                                                        Community Policy
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="d-flex flex-column align-items-end gap-1">
                                                {policy.is_active ? (
                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                                                        <i className="bi bi-check-circle me-1"></i>Active
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-secondary">Inactive</span>
                                                )}
                                                {getModeBadge(policy.delivery_mode)}
                                            </div>
                                        </div>

                                        <p className="text-muted small mb-3">
                                            {policy.description || 'Standard delivery intake and distribution policy for this category.'}
                                        </p>

                                        {/* Configuration Checklist */}
                                        <div className="bg-light p-3 rounded mb-3 small">
                                            <div className="row g-2">
                                                <div className="col-6 d-flex align-items-center gap-2">
                                                    <i className={`bi ${policy.allow_direct_to_flat ? 'bi-check-circle-fill text-success' : 'bi-x-circle text-muted'}`}></i>
                                                    <span>Direct to Flat</span>
                                                </div>
                                                <div className="col-6 d-flex align-items-center gap-2">
                                                    <i className={`bi ${policy.require_gatehouse_intake ? 'bi-check-circle-fill text-primary' : 'bi-dash-circle text-muted'}`}></i>
                                                    <span>Gatehouse Intake</span>
                                                </div>
                                                <div className="col-6 d-flex align-items-center gap-2">
                                                    <i className={`bi ${policy.allow_household_receiver ? 'bi-check-circle-fill text-success' : 'bi-x-circle text-muted'}`}></i>
                                                    <span>Household Receivers</span>
                                                </div>
                                                <div className="col-6 d-flex align-items-center gap-2">
                                                    <i className={`bi ${policy.require_resident_presence ? 'bi-exclamation-triangle-fill text-danger' : 'bi-dash-circle text-muted'}`}></i>
                                                    <span>Resident Presence</span>
                                                </div>
                                                <div className="col-6 d-flex align-items-center gap-2">
                                                    <i className={`bi ${policy.require_extra_verification ? 'bi-shield-check text-info' : 'bi-dash-circle text-muted'}`}></i>
                                                    <span>Extra Verification</span>
                                                </div>
                                                <div className="col-6 d-flex align-items-center gap-2">
                                                    <i className={`bi ${policy.bypass_storage_shelf ? 'bi-box-arrow-right text-warning' : 'bi-dash-circle text-muted'}`}></i>
                                                    <span>Bypass Shelf</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tower Overrides Note */}
                                        {overridesForCategory.length > 0 && (
                                            <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-0">
                                                <i className="bi bi-buildings text-info"></i>
                                                <div>
                                                    <strong>{overridesForCategory.length} Tower Override(s) Active:</strong>{' '}
                                                    {overridesForCategory.map(to => to.tower_name).join(', ')}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
                                        <small className="text-muted">
                                            Updated: {new Date(policy.updated_at).toLocaleDateString()} by {policy.updated_by_name || 'Admin'}
                                        </small>
                                        <button
                                            onClick={() => openEditCommunityPolicy(policy)}
                                            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                                        >
                                            <i className="bi bi-gear-fill"></i> Configure Policy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TOWER OVERRIDES TAB */
                <div>
                    {towerOverrides.length === 0 ? (
                        <div className="gv-card p-5 text-center">
                            <EmptyState
                                icon="bi-buildings"
                                title="No Tower Overrides Configured"
                                message="All towers currently follow community default delivery policies. Click 'Add Tower Override' to create custom rules for specific residential towers."
                            />
                            <button onClick={() => openCreateTowerOverride()} className="btn btn-primary mt-3">
                                <i className="bi bi-building-add me-1"></i> Add Tower Override
                            </button>
                        </div>
                    ) : (
                        <div className="gv-card overflow-hidden">
                            <div className="card-header bg-white p-3 border-bottom d-flex align-items-center justify-content-between">
                                <h5 className="fw-bold mb-0">Tower Override Exceptions</h5>
                                <span className="badge bg-info text-dark rounded-pill">{towerOverrides.length} Configured</span>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light small text-uppercase text-muted" style={{ letterSpacing: '0.05em' }}>
                                        <tr>
                                            <th className="ps-4 py-3 fw-semibold">Tower</th>
                                            <th className="py-3 fw-semibold">Delivery Category</th>
                                            <th className="py-3 fw-semibold">Delivery Mode</th>
                                            <th className="py-3 fw-semibold">Direct Access</th>
                                            <th className="py-3 fw-semibold">Resident Presence</th>
                                            <th className="py-3 fw-semibold">Status</th>
                                            <th className="pe-4 py-3 fw-semibold text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {towerOverrides.map(override => (
                                            <tr key={override.id}>
                                                <td className="ps-4 py-3 fw-bold text-dark">
                                                    <i className="bi bi-building me-2 text-primary"></i>
                                                    {override.tower_name}
                                                </td>
                                                <td className="py-3">
                                                    <span className="fw-semibold text-dark">{override.delivery_type_display}</span>
                                                </td>
                                                <td className="py-3">
                                                    {getModeBadge(override.delivery_mode)}
                                                </td>
                                                <td className="py-3">
                                                    {override.allow_direct_to_flat ? (
                                                        <span className="text-success small fw-semibold"><i className="bi bi-check-circle me-1"></i>Permitted</span>
                                                    ) : (
                                                        <span className="text-muted small"><i className="bi bi-x-circle me-1"></i>Gatehouse Only</span>
                                                    )}
                                                </td>
                                                <td className="py-3">
                                                    {override.require_resident_presence ? (
                                                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">Mandatory</span>
                                                    ) : (
                                                        <span className="text-muted small">Not required</span>
                                                    )}
                                                </td>
                                                <td className="py-3">
                                                    <span className={`badge ${override.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                        {override.is_active ? 'Active' : 'Disabled'}
                                                    </span>
                                                </td>
                                                <td className="pe-4 py-3 text-end">
                                                    <div className="d-flex justify-content-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setIsTowerModal(true);
                                                                setSelectedPolicy(override);
                                                                setEditFormData({
                                                                    delivery_type: override.delivery_type,
                                                                    delivery_mode: override.delivery_mode,
                                                                    allow_direct_to_flat: override.allow_direct_to_flat,
                                                                    require_gatehouse_intake: override.require_gatehouse_intake,
                                                                    allow_household_receiver: override.allow_household_receiver,
                                                                    require_resident_presence: override.require_resident_presence,
                                                                    require_extra_verification: override.require_extra_verification,
                                                                    bypass_storage_shelf: override.bypass_storage_shelf,
                                                                    enable_cod_coordination: override.enable_cod_coordination,
                                                                    description: override.description || '',
                                                                    is_active: override.is_active,
                                                                    tower_id: override.tower
                                                                });
                                                            }}
                                                            className="btn btn-sm btn-outline-primary"
                                                        >
                                                            <i className="bi bi-pencil"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTowerOverride(override.id, override.delivery_type, override.tower_name)}
                                                            className="btn btn-sm btn-outline-danger"
                                                            title="Delete tower override and revert to community policy"
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* EDIT / CREATE POLICY MODAL */}
            {(selectedPolicy || isTowerModal) && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleFormSubmit}>
                                <div className="modal-header bg-light border-bottom">
                                    <div>
                                        <h5 className="modal-title fw-bold text-dark">
                                            <i className="bi bi-sliders me-2 text-primary"></i>
                                            {isTowerModal ? 'Configure Tower Delivery Override' : `Configure Community Policy: ${editFormData.delivery_type}`}
                                        </h5>
                                        <div className="text-muted small">
                                            {isTowerModal ? 'Tower-specific overrides take precedence over community defaults for flats in this tower.' : 'Defines baseline delivery workflows for all residents in the community.'}
                                        </div>
                                    </div>
                                    <button type="button" className="btn-close" onClick={() => { setSelectedPolicy(null); setIsTowerModal(false); }}></button>
                                </div>

                                <div className="modal-body p-4">
                                    {saveError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            {saveError}
                                        </div>
                                    )}

                                    <div className="row g-3 mb-4">
                                        {/* Tower Selector if tower modal */}
                                        {isTowerModal && (
                                            <div className="col-12 col-md-6">
                                                <label className="form-label fw-bold small text-dark">Select Tower <span className="text-danger">*</span></label>
                                                <select
                                                    className="form-select"
                                                    value={editFormData.tower_id}
                                                    onChange={(e) => setEditFormData({ ...editFormData, tower_id: e.target.value })}
                                                    required
                                                >
                                                    <option value="">-- Choose Tower --</option>
                                                    {towers.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Delivery Type */}
                                        <div className={isTowerModal ? "col-12 col-md-6" : "col-12 col-md-6"}>
                                            <label className="form-label fw-bold small text-dark">Delivery Category</label>
                                            <select
                                                className="form-select"
                                                value={editFormData.delivery_type}
                                                onChange={(e) => setEditFormData({ ...editFormData, delivery_type: e.target.value })}
                                                disabled={!isTowerModal && selectedPolicy !== null}
                                            >
                                                {categories.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Delivery Mode */}
                                        <div className={isTowerModal ? "col-12" : "col-12 col-md-6"}>
                                            <label className="form-label fw-bold small text-dark">Delivery Mode <span className="text-danger">*</span></label>
                                            <select
                                                className="form-select"
                                                value={editFormData.delivery_mode}
                                                onChange={(e) => {
                                                    const m = e.target.value;
                                                    setEditFormData({
                                                        ...editFormData,
                                                        delivery_mode: m,
                                                        allow_direct_to_flat: m === 'DIRECT_TO_FLAT' || m === 'RESIDENT_PREFERENCE',
                                                        require_gatehouse_intake: m === 'GATEHOUSE_ONLY' || m === 'RESIDENT_PREFERENCE'
                                                    });
                                                }}
                                            >
                                                {modes.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Policy Toggles */}
                                    <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">Policy Settings & Controls</h6>

                                    <div className="row g-3 mb-4">
                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="allowDirectToFlat"
                                                    checked={editFormData.allow_direct_to_flat}
                                                    onChange={(e) => setEditFormData({ ...editFormData, allow_direct_to_flat: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="allowDirectToFlat">
                                                    Allow Direct-to-Flat Delivery
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Couriers can deliver directly to flat doorsteps.
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="requireGatehouseIntake"
                                                    checked={editFormData.require_gatehouse_intake}
                                                    onChange={(e) => setEditFormData({ ...editFormData, require_gatehouse_intake: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="requireGatehouseIntake">
                                                    Require Gatehouse Intake
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Delivery must be logged and shelf assigned at gate.
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="allowHouseholdReceiver"
                                                    checked={editFormData.allow_household_receiver}
                                                    onChange={(e) => setEditFormData({ ...editFormData, allow_household_receiver: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="allowHouseholdReceiver">
                                                    Allow Authorized Household Receivers
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Permits active flatmates to accept deliveries.
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="requireResidentPresence"
                                                    checked={editFormData.require_resident_presence}
                                                    onChange={(e) => setEditFormData({ ...editFormData, require_resident_presence: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="requireResidentPresence">
                                                    Require Resident Presence
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Primary resident presence mandatory (e.g. open-box).
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="requireExtraVerification"
                                                    checked={editFormData.require_extra_verification}
                                                    onChange={(e) => setEditFormData({ ...editFormData, require_extra_verification: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="requireExtraVerification">
                                                    Require Extra Verification
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Mandates guard identity notes or high-value check.
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="bypassStorageShelf"
                                                    checked={editFormData.bypass_storage_shelf}
                                                    onChange={(e) => setEditFormData({ ...editFormData, bypass_storage_shelf: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="bypassStorageShelf">
                                                    Bypass Normal Parcel Storage
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Exempts packages from occupying shelf storage.
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="enableCodCoordination"
                                                    checked={editFormData.enable_cod_coordination}
                                                    onChange={(e) => setEditFormData({ ...editFormData, enable_cod_coordination: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="enableCodCoordination">
                                                    Enable COD Coordination
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Allows guards to coordinate cash/UPI courier payments.
                                                </small>
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <div className="form-check form-switch p-2 border rounded bg-light">
                                                <input
                                                    className="form-check-input ms-0 me-2"
                                                    type="checkbox"
                                                    id="isActivePolicy"
                                                    checked={editFormData.is_active}
                                                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                                                />
                                                <label className="form-check-label fw-semibold text-dark" htmlFor="isActivePolicy">
                                                    Policy Active
                                                </label>
                                                <small className="text-muted d-block ps-4">
                                                    Active policies are strictly enforced in intake workflows.
                                                </small>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description / Instructions */}
                                    <div className="mb-4">
                                        <label className="form-label fw-bold small text-dark">Policy Guidelines & Resident Instructions</label>
                                        <textarea
                                            rows="2"
                                            className="form-control"
                                            placeholder="Add clear community guidance and operational instructions..."
                                            value={editFormData.description}
                                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                        ></textarea>
                                    </div>

                                    {/* Clear Explanation Preview (Requirement Section 2) */}
                                    <div className="alert alert-info border-info mb-0">
                                        <div className="fw-bold small text-uppercase mb-1">
                                            <i className="bi bi-info-circle-fill me-1"></i> Policy Enforcement Summary
                                        </div>
                                        <ul className="mb-0 ps-3 small">
                                            {getPolicyExplanation(editFormData).map((text, idx) => (
                                                <li key={idx} className="mb-1">{text}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="modal-footer bg-light border-top">
                                    <button type="button" className="btn btn-light border" onClick={() => { setSelectedPolicy(null); setIsTowerModal(false); }}>
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={saving} className="btn btn-primary d-flex align-items-center gap-2">
                                        {saving ? <LoadingSpinner message="Saving Policy..." /> : <>
                                            <i className="bi bi-check-circle"></i> Save Policy Configuration
                                        </>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* AUDIT LOG MODAL */}
            {showAuditModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1070 }}>
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-light border-bottom">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark">
                                        <i className="bi bi-shield-check me-2 text-primary"></i>
                                        Delivery Policy Change History & Audit Logs
                                    </h5>
                                    <div className="text-muted small">Tracks all administrator policy modifications, toggle updates, and tower overrides.</div>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowAuditModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {auditLoading ? (
                                    <div className="text-center py-4">
                                        <LoadingSpinner message="Loading audit history..." />
                                    </div>
                                ) : auditHistory.length === 0 ? (
                                    <p className="text-muted text-center py-4 mb-0">No policy modification logs recorded yet.</p>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-sm table-hover mb-0">
                                            <thead className="bg-light small">
                                                <tr>
                                                    <th>Timestamp</th>
                                                    <th>Scope / Tower</th>
                                                    <th>Category</th>
                                                    <th>Action</th>
                                                    <th>Admin User</th>
                                                    <th>Changes Summary</th>
                                                </tr>
                                            </thead>
                                            <tbody className="small">
                                                {auditHistory.map(log => (
                                                    <tr key={log.id}>
                                                        <td className="text-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                                        <td>
                                                            {log.tower_name ? (
                                                                <span className="badge bg-info text-dark">Tower {log.tower_name}</span>
                                                            ) : (
                                                                <span className="badge bg-light text-dark border">Community</span>
                                                            )}
                                                        </td>
                                                        <td className="fw-semibold">{log.delivery_type}</td>
                                                        <td>
                                                            <span className="badge bg-secondary">{log.action_display || log.action}</span>
                                                        </td>
                                                        <td>{log.changed_by_name}</td>
                                                        <td className="text-muted small">{log.changes_summary}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAuditModal(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDeliveryPolicies;

