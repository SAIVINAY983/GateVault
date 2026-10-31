import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import StarRating from '../../components/ui/StarRating';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';
import { resolveMediaUrl } from '../../utils/mediaUtils';

const CATEGORY_CHOICES = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'OVERALL_EXPERIENCE', label: 'Overall Experience' },
    { value: 'GUARD_SERVICE', label: 'Guard Service' },
    { value: 'PARCEL_HANDLING', label: 'Parcel Handling' },
    { value: 'DELIVERY_EXPERIENCE', label: 'Delivery Experience' },
    { value: 'GATEHOUSE_MANAGEMENT', label: 'Gatehouse Management' },
    { value: 'FOOD_DELIVERY', label: 'Food Delivery' },
];

const MyFeedback = () => {
    const location = useLocation();
    const [feedbacks, setFeedbacks] = useState([]);
    const [eligibleParcels, setEligibleParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterRating, setFilterRating] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Submission Modal State
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [selectedParcelId, setSelectedParcelId] = useState('');
    const [submitRating, setSubmitRating] = useState(5);
    const [submitCategory, setSubmitCategory] = useState('OVERALL_EXPERIENCE');
    const [submitReview, setSubmitReview] = useState('');
    const [submitPhoto, setSubmitPhoto] = useState(null);
    const [submitPhotoPreview, setSubmitPhotoPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingFeedback, setEditingFeedback] = useState(null);
    const [editRating, setEditRating] = useState(5);
    const [editCategory, setEditCategory] = useState('OVERALL_EXPERIENCE');
    const [editReview, setEditReview] = useState('');
    const [editPhoto, setEditPhoto] = useState(null);
    const [editPhotoPreview, setEditPhotoPreview] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editError, setEditError] = useState('');

    // Photo Preview Modal
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');
            const [feedbacksRes, eligibleRes] = await Promise.all([
                axiosInstance.get('resident/feedback/'),
                axiosInstance.get('resident/feedback/?eligible_only=true')
            ]);
            setFeedbacks(Array.isArray(feedbacksRes.data) ? feedbacksRes.data : []);
            setEligibleParcels(Array.isArray(eligibleRes.data) ? eligibleRes.data : []);
        } catch (err) {
            setError('Failed to load feedback records. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Check if redirected from ResidentDashboard or ResidentHistory with a pre-selected parcel
    useEffect(() => {
        if (location.state?.rateParcelId && eligibleParcels.length > 0) {
            const found = eligibleParcels.find(p => p.id === location.state.rateParcelId);
            if (found) {
                openSubmitModal(found.id);
            }
        }
    }, [location.state, eligibleParcels]);

    const handlePhotoSelect = (e, setPhoto, setPreview) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Photo file size cannot exceed 5MB.');
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            alert('Only JPG, JPEG, PNG, and WebP images are allowed.');
            return;
        }

        setPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const openSubmitModal = (preselectedParcelId = '') => {
        setSelectedParcelId(preselectedParcelId || (eligibleParcels.length > 0 ? eligibleParcels[0].id : ''));
        setSubmitRating(5);
        setSubmitCategory('OVERALL_EXPERIENCE');
        setSubmitReview('');
        setSubmitPhoto(null);
        setSubmitPhotoPreview(null);
        setSubmitError('');
        setShowSubmitModal(true);
    };

    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        if (!selectedParcelId) {
            setSubmitError('Please select a collected parcel to review.');
            return;
        }

        try {
            setSubmitting(true);
            setSubmitError('');

            const formData = new FormData();
            formData.append('parcel_id', selectedParcelId);
            formData.append('rating', submitRating);
            formData.append('category', submitCategory);
            formData.append('review', submitReview.trim());
            if (submitPhoto) {
                formData.append('photo', submitPhoto);
            }

            await axiosInstance.post('resident/feedback/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setShowSubmitModal(false);
            setSuccessMsg('Thank you! Your feedback has been submitted successfully.');
            await fetchData();
            setTimeout(() => setSuccessMsg(''), 5000);
        } catch (err) {
            setSubmitError(err.response?.data?.error || err.response?.data?.parcel_id || 'Failed to submit feedback. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (fb) => {
        if (!fb.can_edit) {
            alert('This feedback can no longer be edited because more than 24 hours have passed since submission.');
            return;
        }
        setEditingFeedback(fb);
        setEditRating(fb.rating);
        setEditCategory(fb.category);
        setEditReview(fb.review || '');
        setEditPhoto(null);
        setEditPhotoPreview(fb.photo ? resolveMediaUrl(fb.photo) : null);
        setEditError('');
        setShowEditModal(true);
    };

    const handleUpdateFeedback = async (e) => {
        e.preventDefault();
        if (!editingFeedback) return;

        try {
            setEditing(true);
            setEditError('');

            const formData = new FormData();
            formData.append('rating', editRating);
            formData.append('category', editCategory);
            formData.append('review', editReview.trim());
            if (editPhoto) {
                formData.append('photo', editPhoto);
            }

            await axiosInstance.patch(`resident/feedback/${editingFeedback.id}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setShowEditModal(false);
            setSuccessMsg('Your feedback has been updated successfully.');
            await fetchData();
            setTimeout(() => setSuccessMsg(''), 5000);
        } catch (err) {
            setEditError(err.response?.data?.error || 'Failed to update feedback.');
        } finally {
            setEditing(false);
        }
    };

    // Filter feedbacks
    const filteredFeedbacks = feedbacks.filter((fb) => {
        if (filterCategory !== 'ALL' && fb.category !== filterCategory) return false;
        if (filterRating !== 'ALL' && fb.rating !== parseInt(filterRating, 10)) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchParcel = fb.parcel_id_display?.toLowerCase().includes(q) || fb.tracking_number?.toLowerCase().includes(q);
            const matchReview = fb.review?.toLowerCase().includes(q);
            const matchCarrier = fb.carrier_name?.toLowerCase().includes(q);
            if (!matchParcel && !matchReview && !matchCarrier) return false;
        }
        return true;
    });

    const formatRemainingTime = (seconds) => {
        if (!seconds || seconds <= 0) return 'Editing locked';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `Editable for ${hours}h ${mins}m`;
        }
        return `Editable for ${mins}m`;
    };

    if (loading) return <LoadingSpinner message="Loading your community feedback..." />;
    if (error) return <ErrorState message={error} onRetry={fetchData} />;

    const avgRating = feedbacks.length > 0 
        ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
        : null;

    return (
        <div className="container-fluid px-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h3 className="fw-bold text-dark mb-1">My Community Feedback</h3>
                    <p className="text-muted mb-0">Share ratings and service reviews for your collected deliveries to maintain gatehouse quality.</p>
                </div>
                {eligibleParcels.length > 0 && (
                    <button
                        onClick={() => openSubmitModal()}
                        className="btn btn-warning text-dark fw-bold d-flex align-items-center gap-2 shadow-sm"
                    >
                        <i className="bi bi-star-fill"></i>
                        Rate Delivered Parcel ({eligibleParcels.length} unrated)
                    </button>
                )}
            </div>

            {/* Success Notification */}
            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill fs-5 text-success"></i>
                    <div>{successMsg}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setSuccessMsg('')}></button>
                </div>
            )}

            {/* Unreviewed Parcels Banner Invitation */}
            {eligibleParcels.length > 0 && (
                <div className="alert alert-warning border-warning border-2 p-3 mb-4 rounded-3 shadow-sm d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div className="d-flex align-items-center gap-3">
                        <div className="bg-warning text-dark p-2 rounded-circle fs-4">
                            <i className="bi bi-chat-square-quote-fill"></i>
                        </div>
                        <div>
                            <h6 className="fw-bold text-dark mb-1">
                                You have {eligibleParcels.length} collected {eligibleParcels.length === 1 ? 'parcel' : 'parcels'} waiting for your review!
                            </h6>
                            <p className="mb-0 text-muted small">
                                Rate your delivery experience, guard handover, and parcel handling condition.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => openSubmitModal()}
                        className="btn btn-dark btn-sm fw-semibold px-3 py-2 flex-shrink-0"
                    >
                        Rate Experience Now
                    </button>
                </div>
            )}

            {/* Metrics Row */}
            <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 text-center h-100 shadow-sm border-0">
                        <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Submissions</small>
                        <h3 className="fw-bold text-dark mt-1 mb-0">{feedbacks.length}</h3>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 text-center h-100 shadow-sm border-0">
                        <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Average Rating</small>
                        <div className="d-flex align-items-center justify-content-center gap-1 mt-1">
                            <h3 className="fw-bold text-warning mb-0">{avgRating ? avgRating : 'N/A'}</h3>
                            {avgRating && <i className="bi bi-star-fill text-warning fs-5"></i>}
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 text-center h-100 shadow-sm border-0">
                        <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Reviewed by Admin</small>
                        <h3 className="fw-bold text-primary mt-1 mb-0">
                            {feedbacks.filter(f => f.is_reviewed).length}
                        </h3>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="gv-card p-3 text-center h-100 shadow-sm border-0">
                        <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Admin Responses</small>
                        <h3 className="fw-bold text-success mt-1 mb-0">
                            {feedbacks.filter(f => f.admin_response).length}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="gv-card p-3 mb-4 shadow-sm">
                <div className="row g-2 align-items-center">
                    <div className="col-12 col-md-4">
                        <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                                <i className="bi bi-search text-muted"></i>
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Search by parcel ID, carrier, keywords..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <select
                            className="form-select"
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                        >
                            {CATEGORY_CHOICES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-6 col-md-3">
                        <select
                            className="form-select"
                            value={filterRating}
                            onChange={(e) => setFilterRating(e.target.value)}
                        >
                            <option value="ALL">All Ratings (1–5 ★)</option>
                            <option value="5">5 Stars (Excellent)</option>
                            <option value="4">4 Stars (Very Good)</option>
                            <option value="3">3 Stars (Good)</option>
                            <option value="2">2 Stars (Fair)</option>
                            <option value="1">1 Star (Poor)</option>
                        </select>
                    </div>
                    <div className="col-12 col-md-2 text-end">
                        <button
                            className="btn btn-outline-secondary w-100"
                            onClick={() => {
                                setFilterCategory('ALL');
                                setFilterRating('ALL');
                                setSearchQuery('');
                            }}
                        >
                            <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Feedback List */}
            {filteredFeedbacks.length === 0 ? (
                <EmptyState
                    icon="bi-chat-left-dots"
                    title={feedbacks.length === 0 ? "No Feedback Submitted Yet" : "No Matching Reviews"}
                    message={feedbacks.length === 0 
                        ? "When you collect parcels from the gatehouse, you can rate your service experience and leave reviews here."
                        : "Try adjusting your category, star rating, or search filter."
                    }
                />
            ) : (
                <div className="row g-3">
                    {filteredFeedbacks.map((fb) => (
                        <div key={fb.id} className="col-12">
                            <div className="gv-card p-4 shadow-sm border position-relative">
                                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 pb-3 border-bottom mb-3">
                                    <div>
                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                            <StarRating value={fb.rating} readOnly size="md" showLabel />
                                            <span className="badge bg-light text-dark border">
                                                {fb.category_display}
                                            </span>
                                            {fb.is_reviewed ? (
                                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                                    <i className="bi bi-check-circle me-1"></i> Reviewed by Management
                                                </span>
                                            ) : (
                                                <span className="badge bg-secondary bg-opacity-10 text-secondary border">
                                                    <i className="bi bi-hourglass me-1"></i> Pending Review
                                                </span>
                                            )}
                                        </div>
                                        <h5 className="fw-bold text-dark mb-1">
                                            Parcel {fb.parcel_id_display} ({fb.carrier_name})
                                        </h5>
                                        <div className="text-muted small">
                                            <span>Tracking: <code>{fb.tracking_number}</code></span>
                                            <span className="mx-2">•</span>
                                            <span>Submitted: {new Date(fb.created_at).toLocaleDateString()} at {new Date(fb.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>

                                    <div className="d-flex flex-column align-items-md-end gap-2 flex-shrink-0">
                                        {fb.can_edit ? (
                                            <button
                                                onClick={() => openEditModal(fb)}
                                                className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                                            >
                                                <i className="bi bi-pencil-square"></i>
                                                Edit Review
                                            </button>
                                        ) : (
                                            <span className="badge bg-light text-muted border small" title="Feedback can only be edited within 24 hours of submission">
                                                <i className="bi bi-lock-fill me-1"></i> Editing Closed
                                            </span>
                                        )}
                                        {fb.can_edit && (
                                            <span className="text-success small fw-semibold" style={{ fontSize: '0.75rem' }}>
                                                <i className="bi bi-clock-history me-1"></i>
                                                {formatRemainingTime(fb.time_remaining_seconds)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Review Content */}
                                <div className="mb-3">
                                    <p className="text-dark mb-0" style={{ whiteSpace: 'pre-line' }}>
                                        {fb.review || <em className="text-muted">No written review provided.</em>}
                                    </p>
                                </div>

                                {/* Optional Photo Thumbnail */}
                                {fb.photo && (
                                    <div className="mb-3">
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-decoration-none"
                                            onClick={() => setPreviewPhotoUrl(resolveMediaUrl(fb.photo))}
                                        >
                                            <img
                                                src={resolveMediaUrl(fb.photo)}
                                                alt="Review proof"
                                                className="rounded border"
                                                style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                                            />
                                            <div className="small text-primary mt-1">
                                                <i className="bi bi-zoom-in me-1"></i> View Photo
                                            </div>
                                        </button>
                                    </div>
                                )}

                                {/* Admin Response Box (if management responded) */}
                                {fb.admin_response && (
                                    <div className="bg-light p-3 rounded-3 border-start border-primary border-4 mt-3">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <i className="bi bi-shield-check text-primary fs-5"></i>
                                                <span className="fw-bold text-dark small">Management Response</span>
                                                <span className="badge bg-primary bg-opacity-10 text-primary small">Official</span>
                                            </div>
                                            {fb.responded_at && (
                                                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                    {new Date(fb.responded_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mb-0 text-dark small" style={{ whiteSpace: 'pre-line' }}>
                                            {fb.admin_response}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SUBMIT FEEDBACK MODAL */}
            {showSubmitModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-warning text-dark">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-star-fill me-2"></i>
                                    Rate Your Experience
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => !submitting && setShowSubmitModal(false)}
                                    disabled={submitting}
                                ></button>
                            </div>
                            <form onSubmit={handleSubmitFeedback}>
                                <div className="modal-body p-4">
                                    {submitError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                            {submitError}
                                        </div>
                                    )}

                                    {/* Parcel Selection */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Delivered Parcel
                                        </label>
                                        <select
                                            className="form-select"
                                            value={selectedParcelId}
                                            onChange={(e) => setSelectedParcelId(e.target.value)}
                                            required
                                            disabled={submitting}
                                        >
                                            <option value="">Select collected parcel...</option>
                                            {eligibleParcels.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.parcel_id} — {p.carrier_name} (Delivered {p.handed_over_at ? new Date(p.handed_over_at).toLocaleDateString() : 'Recently'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Star Rating Selection */}
                                    <div className="mb-3 text-center py-2 bg-light rounded">
                                        <label className="form-label fw-semibold small text-muted text-uppercase d-block mb-2">
                                            Service Rating
                                        </label>
                                        <StarRating
                                            value={submitRating}
                                            onChange={setSubmitRating}
                                            size="lg"
                                            showLabel
                                        />
                                    </div>

                                    {/* Category Selection */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Feedback Category
                                        </label>
                                        <select
                                            className="form-select"
                                            value={submitCategory}
                                            onChange={(e) => setSubmitCategory(e.target.value)}
                                            disabled={submitting}
                                        >
                                            <option value="OVERALL_EXPERIENCE">Overall Experience</option>
                                            <option value="GUARD_SERVICE">Guard Service</option>
                                            <option value="PARCEL_HANDLING">Parcel Handling</option>
                                            <option value="DELIVERY_EXPERIENCE">Delivery Experience</option>
                                            <option value="GATEHOUSE_MANAGEMENT">Gatehouse Management</option>
                                            <option value="FOOD_DELIVERY">Food Delivery</option>
                                        </select>
                                    </div>

                                    {/* Written Review */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Written Review (Optional)
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            placeholder="Tell us what went well or how we can improve delivery and security..."
                                            value={submitReview}
                                            onChange={(e) => setSubmitReview(e.target.value)}
                                            disabled={submitting}
                                        ></textarea>
                                    </div>

                                    {/* Optional Photo Attachment */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Supporting Photo (Optional, Max 5MB)
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/jpeg,image/png,image/jpg,image/webp"
                                            onChange={(e) => handlePhotoSelect(e, setSubmitPhoto, setSubmitPhotoPreview)}
                                            disabled={submitting}
                                        />
                                        {submitPhotoPreview && (
                                            <div className="mt-2 text-center position-relative">
                                                <img
                                                    src={submitPhotoPreview}
                                                    alt="Upload preview"
                                                    className="img-thumbnail"
                                                    style={{ maxHeight: '120px' }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1"
                                                    onClick={() => {
                                                        setSubmitPhoto(null);
                                                        setSubmitPhotoPreview(null);
                                                    }}
                                                >
                                                    <i className="bi bi-x"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-footer bg-light">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowSubmitModal(false)}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-warning text-dark fw-bold px-4"
                                        disabled={submitting}
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT FEEDBACK MODAL */}
            {showEditModal && editingFeedback && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-pencil-square me-2"></i>
                                    Edit Review: Parcel {editingFeedback.parcel_id_display}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => !editing && setShowEditModal(false)}
                                    disabled={editing}
                                ></button>
                            </div>
                            <form onSubmit={handleUpdateFeedback}>
                                <div className="modal-body p-4">
                                    {editError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                            {editError}
                                        </div>
                                    )}

                                    <div className="alert alert-info py-2 small mb-3 d-flex align-items-center gap-2">
                                        <i className="bi bi-info-circle-fill"></i>
                                        <span>Feedback can be edited within 24 hours of submission ({formatRemainingTime(editingFeedback.time_remaining_seconds)}).</span>
                                    </div>

                                    {/* Star Rating */}
                                    <div className="mb-3 text-center py-2 bg-light rounded">
                                        <label className="form-label fw-semibold small text-muted text-uppercase d-block mb-2">
                                            Update Rating
                                        </label>
                                        <StarRating
                                            value={editRating}
                                            onChange={setEditRating}
                                            size="lg"
                                            showLabel
                                        />
                                    </div>

                                    {/* Category Selection */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Category
                                        </label>
                                        <select
                                            className="form-select"
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                            disabled={editing}
                                        >
                                            <option value="OVERALL_EXPERIENCE">Overall Experience</option>
                                            <option value="GUARD_SERVICE">Guard Service</option>
                                            <option value="PARCEL_HANDLING">Parcel Handling</option>
                                            <option value="DELIVERY_EXPERIENCE">Delivery Experience</option>
                                            <option value="GATEHOUSE_MANAGEMENT">Gatehouse Management</option>
                                            <option value="FOOD_DELIVERY">Food Delivery</option>
                                        </select>
                                    </div>

                                    {/* Written Review */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Written Review
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            value={editReview}
                                            onChange={(e) => setEditReview(e.target.value)}
                                            disabled={editing}
                                        ></textarea>
                                    </div>

                                    {/* Optional Photo Attachment */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Replace Photo (Optional)
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/jpeg,image/png,image/jpg,image/webp"
                                            onChange={(e) => handlePhotoSelect(e, setEditPhoto, setEditPhotoPreview)}
                                            disabled={editing}
                                        />
                                        {editPhotoPreview && (
                                            <div className="mt-2 text-center position-relative">
                                                <img
                                                    src={editPhotoPreview}
                                                    alt="Preview"
                                                    className="img-thumbnail"
                                                    style={{ maxHeight: '120px' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="modal-footer bg-light">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowEditModal(false)}
                                        disabled={editing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary fw-bold px-4"
                                        disabled={editing}
                                    >
                                        {editing ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* PHOTO VIEWER MODAL */}
            {previewPhotoUrl && (
                <div
                    className="modal show d-block"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
                    onClick={() => setPreviewPhotoUrl(null)}
                >
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content bg-transparent border-0 text-center">
                            <div className="position-relative d-inline-block">
                                <img
                                    src={previewPhotoUrl}
                                    alt="Feedback full preview"
                                    className="img-fluid rounded shadow"
                                    style={{ maxHeight: '80vh' }}
                                />
                                <button
                                    className="btn btn-dark position-absolute top-0 end-0 m-2 rounded-circle"
                                    onClick={() => setPreviewPhotoUrl(null)}
                                >
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyFeedback;

