import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { Link } from 'react-router-dom';
import { ConditionBadge } from '../../components/ui/ParcelCard';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import QRCodeDisplay from '../../components/ui/QRCodeDisplay';

const INCIDENT_CATEGORIES = [
    { value: 'DAMAGED', label: 'Parcel damaged' },
    { value: 'TAMPERED', label: 'Parcel tampered with' },
    { value: 'MISSING_CONTENTS', label: 'Missing contents' },
    { value: 'INCORRECT_PARCEL', label: 'Incorrect parcel' },
    { value: 'OTHER', label: 'Other' },
];

const getIncidentCategoryLabel = (category) => {
    const match = INCIDENT_CATEGORIES.find(c => c.value === category);
    return match ? match.label : category;
};

const getIncidentStatusBadge = (status) => {
    switch (status) {
        case 'OPEN':
            return <span className="badge bg-primary text-white"><i className="bi bi-clock me-1"></i>Open</span>;
        case 'UNDER_REVIEW':
            return <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>Under Review</span>;
        case 'RESOLVED':
            return <span className="badge bg-success text-white"><i className="bi bi-check-circle-fill me-1"></i>Resolved</span>;
        case 'REJECTED':
            return <span className="badge bg-danger text-white"><i className="bi bi-x-circle me-1"></i>Rejected</span>;
        default:
            return <span className="badge bg-secondary">{status}</span>;
    }
};

const ResidentDashboard = () => {
    const [parcels, setParcels] = useState([]);
    const [expectedDeliveries, setExpectedDeliveries] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [householdMembers, setHouseholdMembers] = useState([]);
    const [eligibleFeedbackParcels, setEligibleFeedbackParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Delegation state
    const [showDelegateModal, setShowDelegateModal] = useState(false);
    const [selectedParcelForDelegate, setSelectedParcelForDelegate] = useState(null);
    const [flatmates, setFlatmates] = useState([]);
    const [loadingFlatmates, setLoadingFlatmates] = useState(false);
    const [selectedFlatmate, setSelectedFlatmate] = useState('');
    const [delegateLoading, setDelegateLoading] = useState(false);
    const [delegateError, setDelegateError] = useState('');

    // Inspection Modal state
    const [showInspectionModal, setShowInspectionModal] = useState(false);
    const [selectedParcelForInspection, setSelectedParcelForInspection] = useState(null);
    const [selectedInspection, setSelectedInspection] = useState(null);
    const [inspectionLoading, setInspectionLoading] = useState(false);
    const [acknowledgeLoading, setAcknowledgeLoading] = useState(false);
    const [acknowledgeSuccess, setAcknowledgeSuccess] = useState('');

    // Report Incident Modal state
    const [showIncidentModal, setShowIncidentModal] = useState(false);
    const [selectedParcelForIncident, setSelectedParcelForIncident] = useState(null);
    const [incidentCategory, setIncidentCategory] = useState('DAMAGED');
    const [incidentDescription, setIncidentDescription] = useState('');
    const [incidentPhoto, setIncidentPhoto] = useState(null);
    const [incidentPhotoPreview, setIncidentPhotoPreview] = useState(null);
    const [incidentSubmitting, setIncidentSubmitting] = useState(false);
    const [incidentError, setIncidentError] = useState('');
    const [incidentSuccess, setIncidentSuccess] = useState('');

    // Incident History / Detail Modal state
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedIncidentForHistory, setSelectedIncidentForHistory] = useState(null);

    // QR Pass Modal state
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedParcelForQr, setSelectedParcelForQr] = useState(null);
    const [qrPassData, setQrPassData] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrRefreshing, setQrRefreshing] = useState(false);
    const [qrRevoking, setQrRevoking] = useState(false);
    const [qrError, setQrError] = useState('');
    const [qrSuccess, setQrSuccess] = useState('');

    // Guest Pickup Authorization state
    const [guestAuthorizations, setGuestAuthorizations] = useState([]);
    const [showGuestAuthModal, setShowGuestAuthModal] = useState(false);
    const [selectedParcelForGuest, setSelectedParcelForGuest] = useState(null);
    const [guestName, setGuestName] = useState('');
    const [guestMobile, setGuestMobile] = useState('');
    const [guestRelationship, setGuestRelationship] = useState('FRIEND');
    const [guestExpiresAt, setGuestExpiresAt] = useState('');
    const [guestInstructions, setGuestInstructions] = useState('');
    const [guestSubmitting, setGuestSubmitting] = useState(false);
    const [guestAuthError, setGuestAuthError] = useState('');
    const [createdGuestPass, setCreatedGuestPass] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedShare, setCopiedShare] = useState(false);
    const [revokingGuestId, setRevokingGuestId] = useState(null);

    const handleOpenGuestAuth = (parcel) => {
        setSelectedParcelForGuest(parcel);
        setGuestName('');
        setGuestMobile('');
        setGuestRelationship('FRIEND');
        const defaultExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const tzOffset = defaultExp.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(defaultExp - tzOffset)).toISOString().slice(0, 16);
        setGuestExpiresAt(localISOTime);
        setGuestInstructions('');
        setGuestAuthError('');
        setCreatedGuestPass(null);
        setCopiedCode(false);
        setCopiedShare(false);
        setShowGuestAuthModal(true);
    };

    const handleCreateGuestAuth = async (e) => {
        e.preventDefault();
        if (!guestName.trim() || !guestMobile.trim() || !guestExpiresAt) {
            setGuestAuthError('Please fill in all required fields.');
            return;
        }

        setGuestSubmitting(true);
        setGuestAuthError('');

        try {
            const expDate = new Date(guestExpiresAt);
            if (expDate <= new Date()) {
                setGuestAuthError('Expiry date and time must be in the future.');
                setGuestSubmitting(false);
                return;
            }

            const pid = selectedParcelForGuest.id || selectedParcelForGuest.parcel_id;
            const res = await axiosInstance.post(`parcels/${pid}/guest-authorization/`, {
                guest_name: guestName.trim(),
                guest_mobile: guestMobile.trim(),
                relationship: guestRelationship,
                expires_at: expDate.toISOString(),
                instructions: guestInstructions.trim()
            });

            setCreatedGuestPass(res.data);
            fetchDashboardData();
        } catch (err) {
            const errData = err.response?.data;
            let errMsg = 'Failed to create guest authorization.';
            if (typeof errData === 'object' && errData !== null) {
                const msgs = Object.values(errData).flat();
                if (msgs.length > 0) errMsg = msgs.join(' ');
            }
            setGuestAuthError(errMsg);
        } finally {
            setGuestSubmitting(false);
        }
    };

    const handleRevokeGuestAuth = async (authId, name) => {
        if (!window.confirm(`Are you sure you want to revoke the pickup authorization for ${name}?`)) {
            return;
        }
        setRevokingGuestId(authId);
        try {
            await axiosInstance.post(`guest-authorizations/${authId}/revoke/`);
            fetchDashboardData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to revoke guest pass.');
        } finally {
            setRevokingGuestId(null);
        }
    };

    const handleCopy = (text, type) => {
        navigator.clipboard.writeText(text);
        if (type === 'code') {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } else {
            setCopiedShare(true);
            setTimeout(() => setCopiedShare(false), 2000);
        }
    };

    const handleOpenQrPass = async (parcel) => {
        setSelectedParcelForQr(parcel);
        setShowQrModal(true);
        setQrPassData(null);
        setQrError('');
        setQrSuccess('');
        setQrLoading(true);

        try {
            const pid = parcel.parcel_id || parcel.id;
            const res = await axiosInstance.post(`parcels/${pid}/qr-pass/`);
            setQrPassData(res.data);
        } catch (err) {
            setQrError(err.response?.data?.error || 'Failed to generate pickup QR pass.');
        } finally {
            setQrLoading(false);
        }
    };

    const handleRefreshQrPass = async () => {
        if (!selectedParcelForQr) return;
        setQrRefreshing(true);
        setQrError('');
        setQrSuccess('');

        try {
            const pid = selectedParcelForQr.parcel_id || selectedParcelForQr.id;
            const res = await axiosInstance.post(`parcels/${pid}/qr-pass/`);
            setQrPassData(res.data);
            setQrSuccess('Pickup QR pass refreshed successfully.');
        } catch (err) {
            setQrError(err.response?.data?.error || 'Failed to refresh QR pass.');
        } finally {
            setQrRefreshing(false);
        }
    };

    const handleRevokeQrPass = async () => {
        if (!selectedParcelForQr) return;
        setQrRevoking(true);
        setQrError('');

        try {
            const pid = selectedParcelForQr.parcel_id || selectedParcelForQr.id;
            await axiosInstance.post(`parcels/${pid}/qr-pass/revoke/`);
            setQrPassData(null);
            setQrSuccess('QR pass has been revoked. Security will not accept it for pickup.');
            setTimeout(() => {
                setShowQrModal(false);
                fetchDashboardData();
            }, 1200);
        } catch (err) {
            setQrError(err.response?.data?.error || 'Failed to revoke QR pass.');
        } finally {
            setQrRevoking(false);
        }
    };

    const openDelegateModal = async (parcel) => {
        setSelectedParcelForDelegate(parcel);
        setShowDelegateModal(true);
        setSelectedFlatmate('');
        setDelegateError('');
        
        try {
            setLoadingFlatmates(true);
            const res = await axiosInstance.get('residents/flatmates/');
            setFlatmates(res.data);
        } catch (err) {
            setDelegateError('Failed to load flatmates.');
        } finally {
            setLoadingFlatmates(false);
        }
    };

    const handleDelegate = async () => {
        if (!selectedFlatmate) {
            setDelegateError('Please select a flatmate.');
            return;
        }
        
        try {
            setDelegateLoading(true);
            setDelegateError('');
            await axiosInstance.post(`parcels/${selectedParcelForDelegate.parcel_id}/delegate/`, { flatmate_id: selectedFlatmate });
            setShowDelegateModal(false);
            fetchDashboardData();
        } catch (err) {
            setDelegateError(err.response?.data?.error || 'Failed to authorize pickup.');
        } finally {
            setDelegateLoading(false);
        }
    };

    const handleRevoke = async (parcelId) => {
        if (!window.confirm('Are you sure you want to revoke this pickup delegation?')) return;
        try {
            await axiosInstance.post(`parcels/${parcelId}/revoke-delegation/`);
            fetchDashboardData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to revoke delegation.');
        }
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(false);
            const results = await Promise.allSettled([
                axiosInstance.get('resident/parcels/'),
                axiosInstance.get('expected-deliveries/'),
                axiosInstance.get('resident/incidents/'),
                axiosInstance.get('resident/household/'),
                axiosInstance.get('resident/guest-authorizations/'),
                axiosInstance.get('resident/feedback/?eligible_only=true')
            ]);

            const [parcelResult, expectedResult, incidentResult, householdResult, guestResult, feedbackResult] = results;

            if (parcelResult.status === 'fulfilled') {
                setParcels(Array.isArray(parcelResult.value?.data) ? parcelResult.value.data : []);
            } else {
                console.error("Failed to load resident parcels:", parcelResult.reason);
            }

            if (expectedResult.status === 'fulfilled') {
                setExpectedDeliveries(Array.isArray(expectedResult.value?.data) ? expectedResult.value.data : []);
            } else {
                console.error("Failed to load expected deliveries:", expectedResult.reason);
            }

            if (incidentResult.status === 'fulfilled') {
                setIncidents(Array.isArray(incidentResult.value?.data) ? incidentResult.value.data : []);
            } else {
                console.error("Failed to load resident incidents:", incidentResult.reason);
            }

            if (householdResult && householdResult.status === 'fulfilled') {
                setHouseholdMembers(Array.isArray(householdResult.value?.data) ? householdResult.value.data : []);
            }

            if (guestResult && guestResult.status === 'fulfilled') {
                setGuestAuthorizations(Array.isArray(guestResult.value?.data) ? guestResult.value.data : []);
            }

            if (feedbackResult && feedbackResult.status === 'fulfilled') {
                setEligibleFeedbackParcels(Array.isArray(feedbackResult.value?.data) ? feedbackResult.value.data : []);
            }

            if (parcelResult.status === 'rejected' && expectedResult.status === 'rejected') {
                setError(true);
            }
        } catch (err) {
            console.error("Unexpected error in fetchDashboardData:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Inspection Handlers
    const handleOpenInspection = async (parcel) => {
        setSelectedParcelForInspection(parcel);
        setShowInspectionModal(true);
        setInspectionLoading(true);
        setAcknowledgeSuccess('');
        try {
            const pid = parcel.parcel_id || parcel.id;
            const res = await axiosInstance.get(`parcels/${pid}/inspection/`);
            setSelectedInspection(res.data);
        } catch (err) {
            if (parcel.inspection) {
                setSelectedInspection(parcel.inspection);
            } else {
                setSelectedInspection({
                    condition: parcel.condition || 'INTACT',
                    remarks: 'No specific remarks recorded.',
                    inspected_at: parcel.received_at,
                    guard_name: 'Security Guard',
                    courier_confirmed: false,
                    is_acknowledged: false
                });
            }
        } finally {
            setInspectionLoading(false);
        }
    };

    const handleAcknowledgeCondition = async () => {
        if (!selectedParcelForInspection) return;
        try {
            setAcknowledgeLoading(true);
            const pid = selectedParcelForInspection.parcel_id || selectedParcelForInspection.id;
            const res = await axiosInstance.post(`parcels/${pid}/inspection/acknowledge/`);
            setAcknowledgeSuccess('Condition inspection acknowledged successfully.');
            if (res.data?.inspection) {
                setSelectedInspection(res.data.inspection);
            } else {
                setSelectedInspection(prev => ({
                    ...prev,
                    is_acknowledged: true,
                    acknowledged_by: 'You',
                    acknowledged_at: new Date().toISOString()
                }));
            }
            fetchDashboardData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to acknowledge inspection.');
        } finally {
            setAcknowledgeLoading(false);
        }
    };

    // Incident Handlers
    const handleOpenReportIncident = (parcel) => {
        setShowInspectionModal(false);
        setSelectedParcelForIncident(parcel);
        setIncidentCategory('DAMAGED');
        setIncidentDescription('');
        setIncidentPhoto(null);
        setIncidentPhotoPreview(null);
        setIncidentError('');
        setIncidentSuccess('');
        setShowIncidentModal(true);
    };

    const handleIncidentPhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            setIncidentError('Please select a JPG, JPEG, or PNG photograph.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setIncidentError('Photograph size must be under 5MB.');
            return;
        }
        setIncidentError('');
        setIncidentPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setIncidentPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleSubmitIncident = async (e) => {
        e.preventDefault();
        if (!incidentDescription.trim()) {
            setIncidentError('Please describe the problem.');
            return;
        }

        try {
            setIncidentSubmitting(true);
            setIncidentError('');
            const payload = new FormData();
            payload.append('category', incidentCategory);
            payload.append('description', incidentDescription.trim());
            if (incidentPhoto) {
                payload.append('evidence_photo', incidentPhoto);
            }

            const pid = selectedParcelForIncident.parcel_id || selectedParcelForIncident.id;
            await axiosInstance.post(`parcels/${pid}/report-incident/`, payload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setIncidentSuccess('Incident reported successfully. Community management has been notified.');
            setTimeout(() => {
                setShowIncidentModal(false);
                setIncidentSuccess('');
                fetchDashboardData();
            }, 1200);
        } catch (err) {
            setIncidentError(err.response?.data?.error || err.response?.data?.detail || 'Failed to report incident.');
        } finally {
            setIncidentSubmitting(false);
        }
    };

    const handleOpenHistoryModal = (incident) => {
        setSelectedIncidentForHistory(incident);
        setShowHistoryModal(true);
    };

    if (loading) return <LoadingSpinner message="Loading your dashboard..." />;
    if (error) return <ErrorState message="Unable to load dashboard information." onRetry={fetchDashboardData} />;

    const pendingParcels = parcels.filter(p => p.status === 'AWAITING_PICKUP' || p.is_overdue);

    return (
        <div className="container-fluid px-0">
            <div className="mb-4">
                <h2 className="fw-bold text-dark mb-1">Good evening, Resident</h2>
                <p className="text-muted">Your parcels and gatehouse activity at a glance.</p>
            </div>
            
            {/* METRICS ROW */}
            <div className="row g-3 mb-5">
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-warning bg-opacity-10 text-warning rounded p-3 me-3">
                            <i className="bi bi-box-seam fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{pendingParcels.filter(p => !p.is_overdue).length}</h4>
                            <span className="text-muted small text-uppercase">Pending</span>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-danger bg-opacity-10 text-danger rounded p-3 me-3">
                            <i className="bi bi-exclamation-triangle fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{pendingParcels.filter(p => p.is_overdue).length}</h4>
                            <span className="text-muted small text-uppercase">Overdue</span>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-success bg-opacity-10 text-success rounded p-3 me-3">
                            <i className="bi bi-check2-circle fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{parcels.filter(p => p.status === 'HANDED_OVER').length}</h4>
                            <span className="text-muted small text-uppercase">Collected</span>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 border-0 bg-white shadow-sm d-flex align-items-center">
                        <div className="bg-info bg-opacity-10 text-info rounded p-3 me-3">
                            <i className="bi bi-shield-exclamation fs-4"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold mb-0">{incidents.length}</h4>
                            <span className="text-muted small text-uppercase">Reported Issues</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* UNREVIEWED DELIVERIES INVITATION BANNER */}
            {eligibleFeedbackParcels.length > 0 && (
                <div className="alert alert-warning border-warning border-2 p-3 mb-4 rounded-3 shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <i className="bi bi-star-half fs-2 text-warning"></i>
                        <div>
                            <h6 className="fw-bold text-dark mb-1">
                                Rate Your Experience ({eligibleFeedbackParcels.length} collected {eligibleFeedbackParcels.length === 1 ? 'parcel' : 'parcels'} awaiting review)
                            </h6>
                            <p className="mb-0 text-muted small">
                                Help us maintain security standards and improve guard handover operations by leaving a quick star rating.
                            </p>
                        </div>
                    </div>
                    <Link to="/resident/feedback" className="btn btn-warning text-dark fw-bold btn-sm px-3 py-2 flex-shrink-0">
                        <i className="bi bi-star-fill me-1"></i> Rate Experience Now
                    </Link>
                </div>
            )}

            {/* PENDING PARCELS SECTION */}
            <div className="d-flex justify-content-between align-items-center mb-4 mt-5">
                <h5 className="fw-bold mb-0">Your Pending Parcels</h5>
                <Link to="/resident/send-delivery" className="gv-btn-primary d-flex align-items-center gap-2 text-decoration-none">
                    <i className="bi bi-calendar-plus"></i>
                    <span className="d-none d-sm-inline">Send Delivery Details</span>
                    <span className="d-sm-none">Pre-register</span>
                </Link>
            </div>
            
            {pendingParcels.length === 0 ? (
                <EmptyState 
                    icon="bi-box2-heart" 
                    title="You're all caught up." 
                    message="No parcels are currently waiting for pickup at the gatehouse." 
                />
            ) : (
                <div className="row g-4">
                    {pendingParcels.map(parcel => (
                        <div className="col-12 col-md-6 col-xl-4" key={parcel.id}>
                            <div className={`gv-card overflow-hidden h-100 position-relative ${parcel.is_overdue ? 'border-danger' : 'border-primary border-opacity-50'}`} style={{ borderWidth: parcel.is_overdue ? '2px' : '1px' }}>
                                {parcel.is_overdue && (
                                    <div className="bg-danger text-white text-center py-2 px-3 small fw-bold text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                        <i className="bi bi-exclamation-triangle-fill me-2 pulse"></i> Overdue {'>'}48 hrs - Please collect immediately
                                    </div>
                                )}
                                <div className="p-4 bg-light border-bottom d-flex justify-content-between align-items-start">
                                    <div>
                                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                            <span className="badge bg-primary px-2 py-1"><i className="bi bi-box-seam me-1"></i>{parcel.carrier_name}</span>
                                            <ConditionBadge condition={parcel.condition} />
                                            {parcel.has_incident && (
                                                <span className="badge bg-danger px-2 py-1">
                                                    <i className="bi bi-flag-fill me-1"></i>Issue: {parcel.incident_status}
                                                </span>
                                            )}
                                        </div>
                                        {parcel.payment_type === 'COD' && (
                                            <span className="badge bg-success mb-2 px-2 py-1 d-inline-block">
                                                <i className="bi bi-cash me-1"></i> COD Paid via {parcel.payment_method} (₹{parcel.cod_amount})
                                            </span>
                                        )}
                                        <div className="fw-bold text-dark mb-1">{parcel.parcel_id}</div>
                                        <div className="text-muted small">Arrived: {new Date(parcel.received_at).toLocaleDateString('en-GB')} {new Date(parcel.received_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                </div>
                                {parcel.is_delegated && !parcel.is_delegated_to_me && (
                                    <div className="px-4 py-2 bg-info bg-opacity-10 text-info border-bottom border-info border-opacity-25 small fw-medium d-flex align-items-center justify-content-between">
                                        <div><i className="bi bi-person-check me-2"></i>Delegated to: {parcel.delegated_to_name}</div>
                                        <button onClick={() => handleRevoke(parcel.parcel_id)} className="btn btn-sm btn-outline-info py-0">Revoke</button>
                                    </div>
                                )}
                                {parcel.is_delegated_to_me && (
                                    <div className="px-4 py-2 bg-success bg-opacity-10 text-success border-bottom border-success border-opacity-25 small fw-medium d-flex align-items-center gap-2">
                                        <i className="bi bi-person-check-fill"></i>
                                        Authorized by {parcel.resident_name} (Flat {parcel.flat_details?.number})
                                    </div>
                                )}
                                <div className="p-4 text-center">
                                    <div className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>SHOW THIS PIN AT GATEHOUSE</div>
                                    <div className="d-inline-block bg-white border border-2 border-primary rounded p-3 mb-3 mx-auto shadow-sm">
                                        <div className="display-5 fw-bold text-dark pin-display tracking-widest px-2 lh-1" style={{ letterSpacing: '0.3em', fontFamily: 'monospace' }}>
                                            [ {(parcel.pickup_pin || '----').split('').join('  ')} ]
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-center gap-2 text-primary bg-primary bg-opacity-10 py-2 px-3 rounded mx-auto mb-2" style={{ width: 'fit-content' }}>
                                        <i className="bi bi-geo-alt-fill"></i>
                                        <span className="fw-bold small text-uppercase">Assigned Slot: {parcel.shelf_name}</span>
                                    </div>
                                    {parcel.payment_type === 'COD' && (
                                        <div className="alert alert-success mt-3 mb-0 py-2 px-3 small border-0 d-flex align-items-center justify-content-center rounded-3 text-start mx-auto" style={{ maxWidth: '350px' }}>
                                            <i className="bi bi-shield-check me-2 fs-4"></i>
                                            <span>Payment confirmed by gatehouse staff. No further payment required on pickup.</span>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="mt-3 border-top pt-3 d-flex flex-column gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => handleOpenQrPass(parcel)} 
                                            className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-2 fw-semibold shadow-xs"
                                        >
                                            <i className="bi bi-qr-code"></i> Generate Pickup QR Pass
                                        </button>
                                        {!parcel.is_delegated_to_me && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleOpenGuestAuth(parcel)} 
                                                className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                                            >
                                                <i className="bi bi-person-badge"></i> Authorize Guest Pickup
                                            </button>
                                        )}
                                        <button 
                                            type="button" 
                                            onClick={() => handleOpenInspection(parcel)} 
                                            className="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                                        >
                                            <i className="bi bi-search"></i> View Inspection Details
                                        </button>
                                        {!parcel.is_delegated && !parcel.is_delegated_to_me && (
                                            <button onClick={() => openDelegateModal(parcel)} className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-2">
                                                <i className="bi bi-people"></i> Delegate Pickup
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* REPORTED INCIDENTS SECTION */}
            <div className="mt-5 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="fw-bold mb-0">
                        <i className="bi bi-shield-exclamation text-danger me-2"></i>My Reported Issues & Incidents
                    </h5>
                    <span className="badge bg-light text-secondary border">{incidents.length} Reported</span>
                </div>

                {incidents.length === 0 ? (
                    <div className="bg-light border rounded-3 p-4 text-center text-muted small">
                        <i className="bi bi-check-circle text-success fs-3 d-block mb-2"></i>
                        No reported incidents. If your parcel is damaged, unsealed, or has missing items, click <strong>View Inspection Details</strong> on any parcel card to report an issue.
                    </div>
                ) : (
                    <div className="row g-3">
                        {incidents.map(inc => (
                            <div className="col-12 col-lg-6" key={inc.id}>
                                <div className="gv-card border shadow-sm bg-white p-3 d-flex flex-column h-100">
                                    <div className="d-flex justify-content-between align-items-start mb-2 border-bottom pb-2">
                                        <div>
                                            <span className="fw-bold text-dark fs-6 me-2">Parcel: {inc.parcel_id_str}</span>
                                            <span className="badge bg-light text-dark border me-1">{inc.carrier_name}</span>
                                        </div>
                                        {getIncidentStatusBadge(inc.status)}
                                    </div>

                                    <div className="mb-2">
                                        <div className="d-flex align-items-center justify-content-between">
                                            <span className="badge bg-secondary bg-opacity-25 text-dark small fw-semibold">
                                                Category: {getIncidentCategoryLabel(inc.category)}
                                            </span>
                                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                {new Date(inc.reported_at).toLocaleDateString('en-GB')} {new Date(inc.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </small>
                                        </div>
                                    </div>

                                    <div className="bg-light p-2 rounded mb-3 small text-dark">
                                        <strong>Description:</strong> {inc.description}
                                    </div>

                                    {/* Photographs comparison preview */}
                                    <div className="row g-2 mb-3">
                                        {inc.evidence_photo && (
                                            <div className="col-6">
                                                <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Your Evidence Photo</small>
                                                <a href={resolveMediaUrl(inc.evidence_photo)} target="_blank" rel="noopener noreferrer">
                                                    <img src={resolveMediaUrl(inc.evidence_photo)} alt="Evidence" className="img-thumbnail" style={{ maxHeight: '80px', objectFit: 'cover' }} />
                                                </a>
                                            </div>
                                        )}
                                        {inc.inspection_photo && (
                                            <div className="col-6">
                                                <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Guard Intake Photo</small>
                                                <a href={resolveMediaUrl(inc.inspection_photo)} target="_blank" rel="noopener noreferrer">
                                                    <img src={resolveMediaUrl(inc.inspection_photo)} alt="Guard Inspection" className="img-thumbnail" style={{ maxHeight: '80px', objectFit: 'cover' }} />
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Resolution Note if available */}
                                    {inc.resolution_note && (
                                        <div className="alert alert-info py-2 px-3 small mb-3 border-0">
                                            <div className="fw-bold text-primary mb-1">
                                                <i className="bi bi-shield-check me-1"></i>Resolution Note from Community Admin:
                                            </div>
                                            <p className="mb-1">{inc.resolution_note}</p>
                                            {inc.resolved_by_name && (
                                                <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>
                                                    By {inc.resolved_by_name} on {inc.resolved_at ? new Date(inc.resolved_at).toLocaleDateString('en-GB') : ''}
                                                </small>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-auto pt-2 border-top d-flex justify-content-between align-items-center">
                                        <span className="text-muted small">Incident #{inc.id}</span>
                                        <button 
                                            type="button" 
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => handleOpenHistoryModal(inc)}
                                        >
                                            <i className="bi bi-clock-history me-1"></i> View Audit History
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MY HOUSEHOLD SECTION */}
            <div className="mt-5 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h5 className="fw-bold mb-0">
                            <i className="bi bi-people-fill text-primary me-2"></i>My Household & Authorized Receivers
                        </h5>
                        <small className="text-muted">Family members authorized to receive parcels and food deliveries</small>
                    </div>
                    <Link to="/resident/household" className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1">
                        <i className="bi bi-sliders"></i> Manage Household
                    </Link>
                </div>

                {householdMembers.length === 0 ? (
                    <div className="bg-light border rounded-3 p-4 text-center text-muted small d-flex flex-column align-items-center">
                        <i className="bi bi-people text-secondary fs-2 mb-2"></i>
                        <div>No household members added yet. Authorize family members (wife, husband, parents, siblings) to accept deliveries when you're away.</div>
                        <Link to="/resident/household" className="btn btn-sm btn-primary mt-2">
                            <i className="bi bi-person-plus-fill me-1"></i> Add Household Member
                        </Link>
                    </div>
                ) : (
                    <div className="row g-3">
                        {householdMembers.map(member => (
                            <div className="col-12 col-md-6 col-xl-4" key={member.id}>
                                <div className="gv-card p-3 border bg-white shadow-sm h-100 d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                                                {member.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="fw-bold text-dark">{member.full_name}</div>
                                                <span className="badge bg-light text-primary border" style={{ fontSize: '0.65rem' }}>
                                                    {member.relationship_display}
                                                </span>
                                            </div>
                                        </div>
                                        {member.is_active ? (
                                            <span className="badge bg-success bg-opacity-10 text-success" style={{ fontSize: '0.65rem' }}>Active</span>
                                        ) : (
                                            <span className="badge bg-secondary bg-opacity-10 text-secondary" style={{ fontSize: '0.65rem' }}>Inactive</span>
                                        )}
                                    </div>
                                    <div className="small text-muted mb-2">
                                        <i className="bi bi-telephone me-1"></i>{member.mobile_number}
                                    </div>
                                    <div className="d-flex flex-wrap gap-1 mt-auto pt-2 border-top">
                                        {member.can_receive_parcels && (
                                            <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>
                                                <i className="bi bi-box-seam me-1"></i>Parcels
                                            </span>
                                        )}
                                        {member.can_receive_food && (
                                            <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>
                                                <i className="bi bi-cup-hot me-1"></i>Food
                                            </span>
                                        )}
                                        {member.can_collect_gatehouse_parcels && (
                                            <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>
                                                <i className="bi bi-qr-code me-1"></i>Pickup
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* GUEST PICKUP PASSES SECTION */}
            <div className="mt-5 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h5 className="fw-bold mb-0">
                            <i className="bi bi-person-badge-fill text-info me-2"></i>Temporary Guest Pickup Passes
                        </h5>
                        <small className="text-muted">Single-use passes issued to friends and visitors for gatehouse parcel collection</small>
                    </div>
                    <span className="badge bg-light text-secondary border">
                        {guestAuthorizations.filter(g => g.status === 'ACTIVE').length} Active
                    </span>
                </div>

                {guestAuthorizations.length === 0 ? (
                    <div className="bg-light border rounded-3 p-4 text-center text-muted small">
                        <i className="bi bi-person-badge text-secondary fs-3 d-block mb-2"></i>
                        No guest pickup passes issued yet. To allow a visitor, friend, or relative to pick up a parcel, click <strong>Authorize Guest Pickup</strong> on any pending parcel card above.
                    </div>
                ) : (
                    <div className="row g-3">
                        {guestAuthorizations.map(auth => (
                            <div className="col-12 col-md-6 col-xl-4" key={auth.id}>
                                <div className="gv-card p-3 border bg-white shadow-sm h-100 d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-2 border-bottom pb-2">
                                        <div>
                                            <span className="fw-bold text-dark fs-6 d-block">{auth.guest_name}</span>
                                            <span className="text-muted small">
                                                <i className="bi bi-telephone me-1"></i>{auth.guest_mobile}
                                            </span>
                                        </div>
                                        <div>
                                            {auth.status === 'ACTIVE' && (
                                                <span className="badge bg-success">
                                                    <i className="bi bi-check-circle-fill me-1"></i>Active
                                                </span>
                                            )}
                                            {auth.status === 'USED' && (
                                                <span className="badge bg-secondary">
                                                    <i className="bi bi-check2-all me-1"></i>Collected
                                                </span>
                                            )}
                                            {auth.status === 'REVOKED' && (
                                                <span className="badge bg-danger">
                                                    <i className="bi bi-x-circle me-1"></i>Revoked
                                                </span>
                                            )}
                                            {auth.status === 'EXPIRED' && (
                                                <span className="badge bg-warning text-dark">
                                                    <i className="bi bi-clock-history me-1"></i>Expired
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="row g-2 small mb-3">
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Relationship</span>
                                            <span className="fw-medium text-dark">{auth.relationship_display}</span>
                                        </div>
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Parcel ID</span>
                                            <span className="fw-bold text-primary">{auth.parcel_id_str || `Parcel #${auth.parcel}`}</span>
                                        </div>
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Carrier</span>
                                            <span className="fw-medium text-dark">{auth.carrier_name}</span>
                                        </div>
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Expires</span>
                                            <span className={`fw-medium ${auth.is_expired ? 'text-danger' : 'text-dark'}`}>
                                                {new Date(auth.expires_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Display Pass Code Box */}
                                    <div className="bg-light border rounded p-2 text-center mb-3">
                                        <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Pass Code</small>
                                        <span className="font-monospace fw-bold fs-5 text-dark tracking-wide">{auth.pass_code}</span>
                                    </div>

                                    {auth.instructions && (
                                        <div className="small text-muted bg-light p-2 rounded mb-3 border">
                                            <i className="bi bi-info-circle me-1 text-primary"></i>
                                            {auth.instructions}
                                        </div>
                                    )}

                                    {auth.status === 'USED' && (
                                        <div className="small text-success bg-success bg-opacity-10 p-2 rounded mb-2 border border-success border-opacity-25">
                                            <i className="bi bi-check-circle-fill me-1"></i>
                                            Collected by {auth.actual_collector_name || auth.guest_name} at {new Date(auth.used_at).toLocaleString()}
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="mt-auto pt-2 border-top d-flex gap-2">
                                        {auth.status === 'ACTIVE' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(auth.pass_code, 'code')}
                                                    className="btn btn-sm btn-outline-primary flex-grow-1"
                                                    title="Copy pass code"
                                                >
                                                    <i className="bi bi-clipboard me-1"></i>Copy Code
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRevokeGuestAuth(auth.id, auth.guest_name)}
                                                    className="btn btn-sm btn-outline-danger"
                                                    disabled={revokingGuestId === auth.id}
                                                    title="Revoke pass"
                                                >
                                                    {revokingGuestId === auth.id ? (
                                                        <span className="spinner-border spinner-border-sm"></span>
                                                    ) : (
                                                        <><i className="bi bi-trash me-1"></i>Revoke</>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* EXPECTED DELIVERIES SECTION */}
            <div className="mt-5 mb-4">
                <h5 className="fw-bold mb-3">My Expected Deliveries</h5>
                {expectedDeliveries.length === 0 ? (
                    <div className="bg-light border rounded-3 p-4 text-center text-muted small">
                        You have no expected deliveries registered.
                    </div>
                ) : (
                    <div className="row g-3">
                        {expectedDeliveries.map(exp => (
                            <div className="col-12 col-xl-6" key={exp.id}>
                                <div className="gv-card border-0 shadow-sm bg-white p-3 d-flex flex-column h-100">
                                    <div className="d-flex justify-content-between align-items-start mb-2 border-bottom pb-2">
                                        <div>
                                            <span className="fw-bold text-dark fs-5">{exp.courier_name}</span>
                                            {exp.delivery_type === 'FOOD' && <span className="badge bg-warning ms-2"><i className="bi bi-cup-straw"></i> Food</span>}
                                        </div>
                                        <span className={`badge ${
                                            exp.status === 'RECEIVED' ? 'bg-success' :
                                            exp.status === 'CANCELLED' ? 'bg-secondary' :
                                            exp.status === 'RESCHEDULED' ? 'bg-info text-dark' :
                                            exp.is_missed_or_delayed ? 'bg-warning text-dark' :
                                            'bg-primary'
                                        }`}>
                                            {exp.status === 'RESCHEDULED' ? 'Rescheduled' :
                                             exp.is_missed_or_delayed ? 'Window Passed' :
                                             exp.status === 'EXPECTED' ? 'Scheduled' : exp.status}
                                        </span>
                                    </div>
                                    <div className="row g-2 small mt-1">
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Tracking ID</span>
                                            <span className="fw-medium text-dark">{exp.tracking_id}</span>
                                        </div>
                                        {exp.order_id && (
                                            <div className="col-6">
                                                <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Order ID</span>
                                                <span className="fw-medium text-dark">{exp.order_id}</span>
                                            </div>
                                        )}
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Expected Date</span>
                                            <span className="fw-medium text-dark">{new Date(exp.expected_delivery_date).toLocaleDateString('en-GB')}</span>
                                        </div>
                                        {exp.time_window_label && (
                                            <div className="col-6">
                                                <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Estimated Window</span>
                                                <span className="fw-medium text-dark"><i className="bi bi-clock me-1 text-primary"></i>{exp.time_window_label}</span>
                                            </div>
                                        )}
                                        <div className="col-6">
                                            <span className="text-muted d-block" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Payment</span>
                                            <span className={`fw-medium ${exp.payment_type === 'COD' ? 'text-danger' : 'text-success'}`}>
                                                {exp.payment_type === 'COD' ? `COD (₹${exp.cod_amount})` : 'Prepaid'}
                                            </span>
                                        </div>
                                    </div>
                                    {exp.delivery_photo && (
                                        <div className="mt-3 pt-2 border-top">
                                            <a href={resolveMediaUrl(exp.delivery_photo)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary py-1">
                                                <i className="bi bi-image me-1"></i> View Screenshot
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* INSPECTION DETAILS MODAL */}
            {showInspectionModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark mb-0">Parcel Condition Inspection Details</h5>
                                    <small className="text-muted">Recorded upon gatehouse delivery intake</small>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowInspectionModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {inspectionLoading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status"></div>
                                        <div className="text-muted mt-2 small">Loading inspection record...</div>
                                    </div>
                                ) : (
                                    <>
                                        {acknowledgeSuccess && (
                                            <div className="alert alert-success d-flex align-items-center mb-3">
                                                <i className="bi bi-check-circle-fill fs-5 me-2"></i>
                                                {acknowledgeSuccess}
                                            </div>
                                        )}

                                        <div className="row g-3 mb-4 bg-light p-3 rounded-3 border">
                                            <div className="col-sm-6">
                                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Parcel ID</small>
                                                <div className="fw-bold text-dark">{selectedParcelForInspection?.parcel_id}</div>
                                            </div>
                                            <div className="col-sm-6">
                                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Reported Condition</small>
                                                <div>
                                                    <ConditionBadge condition={selectedInspection?.condition} />
                                                </div>
                                            </div>
                                            <div className="col-sm-6">
                                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Receiving Guard</small>
                                                <div className="fw-medium text-dark">{selectedInspection?.guard_name || 'Security Guard'}</div>
                                            </div>
                                            <div className="col-sm-6">
                                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Inspection Timestamp</small>
                                                <div className="fw-medium text-dark">
                                                    {(selectedInspection?.inspected_at || selectedInspection?.timestamp) ? new Date(selectedInspection.inspected_at || selectedInspection.timestamp).toLocaleString('en-GB') : 'N/A'}
                                                </div>
                                            </div>
                                            <div className="col-12">
                                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Courier Confirmation</small>
                                                <div className="fw-medium text-dark">
                                                    {selectedInspection?.courier_confirmed ? (
                                                        <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i>Courier acknowledged condition at gatehouse</span>
                                                    ) : (
                                                        <span className="text-muted"><i className="bi bi-dash-circle me-1"></i>Not confirmed by courier</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="col-12 border-top pt-2 mt-2">
                                                <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Guard's Remarks</small>
                                                <div className="p-2 bg-white rounded border text-dark mt-1">
                                                    {selectedInspection?.remarks || <span className="text-muted italic">No remarks provided.</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Photograph */}
                                        <div className="mb-4">
                                            <label className="fw-bold text-dark small text-uppercase mb-2 d-block" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
                                                Parcel Inspection Photograph
                                            </label>
                                            {(selectedInspection?.photograph || selectedInspection?.photo) ? (
                                                <div className="text-center bg-light p-3 rounded-3 border">
                                                    <a href={resolveMediaUrl(selectedInspection.photograph || selectedInspection.photo)} target="_blank" rel="noopener noreferrer">
                                                        <img 
                                                            src={resolveMediaUrl(selectedInspection.photograph || selectedInspection.photo)} 
                                                            alt="Parcel Condition" 
                                                            className="img-fluid rounded border shadow-sm" 
                                                            style={{ maxHeight: '280px', objectFit: 'contain' }} 
                                                        />
                                                    </a>
                                                    <div className="text-muted small mt-2">
                                                        <i className="bi bi-zoom-in me-1"></i>Click photograph to open high-resolution view
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-light rounded text-center text-muted small border">
                                                    <i className="bi bi-camera-slash fs-3 d-block mb-1"></i>
                                                    No photograph was attached during intake.
                                                </div>
                                            )}
                                        </div>

                                        {/* Acknowledgement Status */}
                                        <div className="mb-3">
                                            {(selectedInspection?.is_acknowledged || selectedInspection?.acknowledged_at) ? (
                                                <div className="alert alert-success d-flex align-items-center mb-0 py-2 px-3 small border-0">
                                                    <i className="bi bi-shield-check text-success fs-4 me-2"></i>
                                                    <div>
                                                        <strong>Condition Acknowledged</strong><br />
                                                        Acknowledged by {selectedInspection.acknowledged_by_name || selectedInspection.acknowledged_by || 'Resident'} on {selectedInspection.acknowledged_at ? new Date(selectedInspection.acknowledged_at).toLocaleString('en-GB') : ''}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-light border rounded-3 d-flex align-items-center justify-content-between">
                                                    <div>
                                                        <div className="fw-semibold text-dark small">Have you inspected this parcel's condition?</div>
                                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Acknowledge that you have seen the guard's intake condition report.</div>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        className="btn btn-success btn-sm px-3 fw-medium"
                                                        onClick={handleAcknowledgeCondition}
                                                        disabled={acknowledgeLoading}
                                                    >
                                                        {acknowledgeLoading ? 'Saving...' : <><i className="bi bi-check2 me-1"></i>Acknowledge Condition</>}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer border-top d-flex justify-content-between">
                                <div>
                                    {selectedParcelForInspection?.has_incident ? (
                                        <span className="badge bg-warning text-dark px-3 py-2">
                                            <i className="bi bi-info-circle me-1"></i>Incident is {selectedParcelForInspection.incident_status}
                                        </span>
                                    ) : (
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-danger fw-medium d-flex align-items-center gap-2"
                                            onClick={() => handleOpenReportIncident(selectedParcelForInspection)}
                                        >
                                            <i className="bi bi-exclamation-octagon"></i> Report an Issue
                                        </button>
                                    )}
                                </div>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowInspectionModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* REPORT INCIDENT MODAL */}
            {showIncidentModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleSubmitIncident}>
                                <div className="modal-header border-bottom">
                                    <div>
                                        <h5 className="modal-title fw-bold text-dark mb-0">Report Issue with Parcel</h5>
                                        <small className="text-muted">Parcel ID: {selectedParcelForIncident?.parcel_id}</small>
                                    </div>
                                    <button type="button" className="btn-close" onClick={() => setShowIncidentModal(false)}></button>
                                </div>
                                <div className="modal-body p-4">
                                    {incidentError && (
                                        <div className="alert alert-danger py-2 small mb-3 border-0">
                                            <i className="bi bi-exclamation-circle-fill me-2"></i>{incidentError}
                                        </div>
                                    )}
                                    {incidentSuccess && (
                                        <div className="alert alert-success py-2 small mb-3 border-0">
                                            <i className="bi bi-check-circle-fill me-2"></i>{incidentSuccess}
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label text-dark small fw-semibold">Incident Category <span className="text-danger">*</span></label>
                                        <select 
                                            className="form-select bg-light"
                                            value={incidentCategory}
                                            onChange={(e) => setIncidentCategory(e.target.value)}
                                            required
                                        >
                                            {INCIDENT_CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label text-dark small fw-semibold">Issue Description <span className="text-danger">*</span></label>
                                        <textarea 
                                            className="form-control bg-light"
                                            rows="3"
                                            value={incidentDescription}
                                            onChange={(e) => setIncidentDescription(e.target.value)}
                                            placeholder="Explain what is wrong (e.g. broken seals, missing contents, package crushed, incorrect recipient)..."
                                            required
                                        ></textarea>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label text-dark small fw-semibold">Upload Supporting Photograph (Optional)</label>
                                        <input 
                                            type="file" 
                                            className="form-control bg-light"
                                            accept="image/jpeg,image/jpg,image/png"
                                            onChange={handleIncidentPhotoChange}
                                        />
                                        {incidentPhotoPreview && (
                                            <div className="mt-2 position-relative d-inline-block">
                                                <img src={incidentPhotoPreview} alt="Incident Preview" className="img-thumbnail" style={{ maxHeight: '130px', maxWidth: '100%' }} />
                                                <button 
                                                    type="button" 
                                                    className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1"
                                                    onClick={() => { setIncidentPhoto(null); setIncidentPhotoPreview(null); }}
                                                    style={{ lineHeight: 1 }}
                                                    title="Remove photo"
                                                >
                                                    <i className="bi bi-x"></i>
                                                </button>
                                            </div>
                                        )}
                                        <div className="form-text small">Accepted formats: JPG, JPEG, PNG (Max 5MB).</div>
                                    </div>
                                </div>
                                <div className="modal-footer border-top">
                                    <button type="button" className="btn btn-light" onClick={() => setShowIncidentModal(false)}>Cancel</button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-danger fw-bold d-flex align-items-center gap-2"
                                        disabled={incidentSubmitting}
                                    >
                                        {incidentSubmitting ? (
                                            <><span className="spinner-border spinner-border-sm"></span> Submitting...</>
                                        ) : (
                                            <><i className="bi bi-send-fill"></i> Submit Incident Report</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* INCIDENT AUDIT HISTORY MODAL */}
            {showHistoryModal && selectedIncidentForHistory && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark mb-0">Incident History & Audit Log</h5>
                                    <small className="text-muted">Incident #{selectedIncidentForHistory.id} – Parcel: {selectedIncidentForHistory.parcel_id_str}</small>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowHistoryModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                    <div>
                                        <span className="text-muted small text-uppercase d-block" style={{ fontSize: '0.7rem' }}>Current Status</span>
                                        {getIncidentStatusBadge(selectedIncidentForHistory.status)}
                                    </div>
                                    <div className="text-end">
                                        <span className="text-muted small text-uppercase d-block" style={{ fontSize: '0.7rem' }}>Category</span>
                                        <span className="fw-bold">{getIncidentCategoryLabel(selectedIncidentForHistory.category)}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h6 className="fw-bold text-dark small text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Timeline & Updates</h6>
                                    {(!selectedIncidentForHistory.history || selectedIncidentForHistory.history.length === 0) ? (
                                        <div className="p-3 bg-light rounded text-muted text-center small">
                                            No status transitions recorded yet. The incident is currently <strong>{selectedIncidentForHistory.status}</strong>.
                                        </div>
                                    ) : (
                                        <div className="timeline ps-2 border-start border-2 border-primary ms-2 my-3">
                                            {selectedIncidentForHistory.history.map((h, idx) => (
                                                <div className="position-relative mb-3 ps-3" key={h.id || idx}>
                                                    <div className="position-absolute rounded-circle bg-primary" style={{ width: '10px', height: '10px', left: '-6px', top: '5px' }}></div>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <span className="badge bg-secondary">{h.old_status}</span>
                                                        <i className="bi bi-arrow-right text-muted"></i>
                                                        <span className="badge bg-primary">{h.new_status}</span>
                                                        <span className="text-muted small ms-2">
                                                            {new Date(h.timestamp || h.changed_at).toLocaleString('en-GB')}
                                                        </span>
                                                    </div>
                                                    <div className="small text-dark">
                                                        Updated by: <strong>{h.action_by_name || h.changed_by_name || 'Admin'}</strong>
                                                    </div>
                                                    {h.notes && (
                                                        <div className="p-2 bg-light rounded border text-muted small mt-1">
                                                            "{h.notes}"
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedIncidentForHistory.resolution_note && (
                                    <div className="alert alert-info py-2 px-3 small border-0">
                                        <div className="fw-bold text-primary mb-1">
                                            <i className="bi bi-shield-check me-1"></i>Administrative Resolution Note:
                                        </div>
                                        <p className="mb-0">{selectedIncidentForHistory.resolution_note}</p>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer border-top">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DELEGATE MODAL */}
            {showDelegateModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">Delegate Parcel Pickup</h5>
                                <button type="button" className="btn-close" onClick={() => setShowDelegateModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                {selectedParcelForDelegate && (
                                    <div className="mb-3 p-3 bg-light rounded text-sm">
                                        <div className="fw-bold">{selectedParcelForDelegate.carrier_name}</div>
                                        <div className="text-muted">ID: {selectedParcelForDelegate.parcel_id}</div>
                                    </div>
                                )}
                                
                                <p className="text-muted mb-2">Select a registered flatmate to authorize pickup:</p>
                                
                                {loadingFlatmates ? (
                                    <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
                                ) : flatmates.length === 0 ? (
                                    <div className="alert alert-warning">No other registered residents are available in your flat.</div>
                                ) : (
                                    <select 
                                        className="form-select mb-3" 
                                        value={selectedFlatmate} 
                                        onChange={(e) => setSelectedFlatmate(e.target.value)}
                                    >
                                        <option value="">-- Select Flatmate --</option>
                                        {flatmates.map(f => (
                                            <option key={f.id} value={f.id}>{f.first_name} {f.last_name}</option>
                                        ))}
                                    </select>
                                )}
                                
                                {delegateError && <div className="alert alert-danger py-2">{delegateError}</div>}
                            </div>
                            <div className="modal-footer border-top-0 pt-0">
                                <button type="button" className="btn btn-light" onClick={() => setShowDelegateModal(false)}>Cancel</button>
                                <button 
                                    type="button" 
                                    className="gv-btn-primary" 
                                    onClick={handleDelegate}
                                    disabled={!selectedFlatmate || delegateLoading}
                                >
                                    {delegateLoading ? 'Authorizing...' : 'Authorize Pickup'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECURE QR PICKUP MODAL */}
            {showQrModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-bottom pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark mb-0">
                                        <i className="bi bi-qr-code text-primary me-2"></i>Secure Pickup QR Pass
                                    </h5>
                                    {selectedParcelForQr && (
                                        <small className="text-muted">
                                            Parcel {selectedParcelForQr.parcel_id} • {selectedParcelForQr.carrier_name}
                                        </small>
                                    )}
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowQrModal(false)}></button>
                            </div>
                            <div className="modal-body px-4 py-3">
                                {qrLoading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary mb-3" role="status"></div>
                                        <div className="text-muted small">Generating cryptographically secure QR pass...</div>
                                    </div>
                                ) : qrError ? (
                                    <div className="text-center py-4">
                                        <div className="alert alert-danger mb-3">{qrError}</div>
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => handleOpenQrPass(selectedParcelForQr)}
                                        >
                                            <i className="bi bi-arrow-repeat me-1"></i> Try Again
                                        </button>
                                    </div>
                                ) : qrPassData ? (
                                    <>
                                        {qrSuccess && (
                                            <div className="alert alert-success py-2 px-3 small mb-3">
                                                <i className="bi bi-check-circle me-1"></i> {qrSuccess}
                                            </div>
                                        )}
                                        <QRCodeDisplay 
                                            qrData={qrPassData} 
                                            onRefresh={handleRefreshQrPass}
                                            onRevoke={handleRevokeQrPass}
                                            refreshing={qrRefreshing}
                                            revoking={qrRevoking}
                                        />
                                    </>
                                ) : null}
                            </div>
                            <div className="modal-footer border-top bg-light py-2">
                                <button type="button" className="btn btn-secondary btn-sm px-4" onClick={() => setShowQrModal(false)}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TEMPORARY GUEST PICKUP AUTHORIZATION MODAL */}
            {showGuestAuthModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-bottom pb-3">
                                <div>
                                    <h5 className="modal-title fw-bold text-dark mb-0">
                                        <i className="bi bi-person-badge text-primary me-2"></i>Authorize Guest Pickup
                                    </h5>
                                    {selectedParcelForGuest && (
                                        <small className="text-muted">
                                            Parcel {selectedParcelForGuest.parcel_id} • {selectedParcelForGuest.carrier_name}
                                        </small>
                                    )}
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowGuestAuthModal(false)}></button>
                            </div>

                            {!createdGuestPass ? (
                                <form onSubmit={handleCreateGuestAuth}>
                                    <div className="modal-body px-4 py-3">
                                        <p className="text-muted small mb-3">
                                            Generate a secure one-time pickup pass for a friend, relative, or visitor to collect your delivery from the gatehouse.
                                        </p>

                                        {guestAuthError && (
                                            <div className="alert alert-danger py-2 small mb-3">
                                                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                                {guestAuthError}
                                            </div>
                                        )}

                                        <div className="mb-3">
                                            <label className="form-label small fw-bold text-dark">Guest Full Name <span className="text-danger">*</span></label>
                                            <input 
                                                type="text" 
                                                className="form-control"
                                                placeholder="e.g. Ramesh Kumar"
                                                value={guestName}
                                                onChange={(e) => setGuestName(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="row g-2 mb-3">
                                            <div className="col-12 col-sm-6">
                                                <label className="form-label small fw-bold text-dark">Guest Mobile Number <span className="text-danger">*</span></label>
                                                <input 
                                                    type="tel" 
                                                    className="form-control"
                                                    placeholder="e.g. +91 9876543210"
                                                    value={guestMobile}
                                                    onChange={(e) => setGuestMobile(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="col-12 col-sm-6">
                                                <label className="form-label small fw-bold text-dark">Relationship <span className="text-danger">*</span></label>
                                                <select 
                                                    className="form-select"
                                                    value={guestRelationship}
                                                    onChange={(e) => setGuestRelationship(e.target.value)}
                                                >
                                                    <option value="FRIEND">Friend</option>
                                                    <option value="RELATIVE">Relative</option>
                                                    <option value="OTHER">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label small fw-bold text-dark">Pass Expiration (Date & Time) <span className="text-danger">*</span></label>
                                            <input 
                                                type="datetime-local" 
                                                className="form-control"
                                                value={guestExpiresAt}
                                                onChange={(e) => setGuestExpiresAt(e.target.value)}
                                                required
                                            />
                                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>Pass automatically expires after this timestamp.</small>
                                        </div>

                                        <div className="mb-2">
                                            <label className="form-label small fw-bold text-dark">Special Instructions / Gatehouse Notes (Optional)</label>
                                            <textarea 
                                                className="form-control"
                                                rows="2"
                                                placeholder="e.g. Call my number if any clarification is needed"
                                                value={guestInstructions}
                                                onChange={(e) => setGuestInstructions(e.target.value)}
                                            ></textarea>
                                        </div>
                                    </div>
                                    <div className="modal-footer border-top bg-light py-2">
                                        <button type="button" className="btn btn-light btn-sm" onClick={() => setShowGuestAuthModal(false)}>
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="gv-btn-primary py-2 px-3 btn-sm d-flex align-items-center gap-1"
                                            disabled={guestSubmitting}
                                        >
                                            {guestSubmitting ? (
                                                <><span className="spinner-border spinner-border-sm me-1"></span> Generating Pass...</>
                                            ) : (
                                                <><i className="bi bi-shield-lock-fill me-1"></i> Generate Guest Pass</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div>
                                    <div className="modal-body px-4 py-4 text-center">
                                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success mb-3" style={{ width: '64px', height: '64px' }}>
                                            <i className="bi bi-check2-circle fs-1"></i>
                                        </div>
                                        <h5 className="fw-bold text-dark mb-1">Guest Pass Generated!</h5>
                                        <p className="text-muted small mb-3">Share this pass code with {createdGuestPass.authorization?.guest_name}.</p>

                                        <div className="bg-light border border-2 border-primary rounded-3 p-3 mb-3">
                                            <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                                                GATEHOUSE PASS CODE
                                            </div>
                                            <div className="display-6 fw-bold text-dark font-monospace tracking-wide">
                                                {createdGuestPass.pass_code}
                                            </div>
                                            <small className="text-muted d-block mt-1">
                                                Expires: {new Date(createdGuestPass.authorization?.expires_at).toLocaleString()}
                                            </small>
                                        </div>

                                        <div className="alert alert-info border-0 py-2 px-3 small text-start mb-3">
                                            <i className="bi bi-info-circle-fill text-primary me-2"></i>
                                            <strong>Single-Use Security:</strong> This pass can only be used once to collect Parcel <strong>{createdGuestPass.authorization?.parcel_id_str}</strong>. It will be invalidated immediately after pickup.
                                        </div>

                                        {/* Share preview */}
                                        <div className="text-start bg-light rounded p-3 border mb-3">
                                            <label className="text-muted fw-bold d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Shareable Message Preview</label>
                                            <pre className="mb-0 text-dark small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.8rem' }}>
                                                {createdGuestPass.share_text}
                                            </pre>
                                        </div>

                                        <div className="d-flex gap-2 justify-content-center">
                                            <button 
                                                type="button" 
                                                className="btn btn-outline-primary btn-sm flex-grow-1"
                                                onClick={() => handleCopy(createdGuestPass.pass_code, 'code')}
                                            >
                                                <i className={`bi ${copiedCode ? 'bi-check-lg text-success' : 'bi-clipboard'} me-1`}></i>
                                                {copiedCode ? 'Code Copied!' : 'Copy Pass Code'}
                                            </button>
                                            <button 
                                                type="button" 
                                                className="btn btn-primary btn-sm flex-grow-1"
                                                onClick={() => handleCopy(createdGuestPass.share_text, 'share')}
                                            >
                                                <i className={`bi ${copiedShare ? 'bi-check-lg' : 'bi-share-fill'} me-1`}></i>
                                                {copiedShare ? 'Message Copied!' : 'Copy Full Message'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="modal-footer border-top bg-light py-2">
                                        <button type="button" className="btn btn-secondary btn-sm px-4" onClick={() => setShowGuestAuthModal(false)}>
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResidentDashboard;
