import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import StarRating from '../../components/ui/StarRating';
import { LoadingSpinner, EmptyState, ErrorState } from '../../components/ui/StateComponents';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import {
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CATEGORY_CHOICES = [
    { value: 'ALL', label: 'All Categories' },
    { value: 'OVERALL_EXPERIENCE', label: 'Overall Experience' },
    { value: 'GUARD_SERVICE', label: 'Guard Service' },
    { value: 'PARCEL_HANDLING', label: 'Parcel Handling' },
    { value: 'DELIVERY_EXPERIENCE', label: 'Delivery Experience' },
    { value: 'GATEHOUSE_MANAGEMENT', label: 'Gatehouse Management' },
    { value: 'FOOD_DELIVERY', label: 'Food Delivery' },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const RATING_COLORS = {
    5: '#10b981', // green
    4: '#3b82f6', // blue
    3: '#f59e0b', // amber
    2: '#f97316', // orange
    1: '#ef4444'  // red
};

const AdminFeedback = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterRating, setFilterRating] = useState('ALL');
    const [filterReviewed, setFilterReviewed] = useState('ALL');
    const [filterResponse, setFilterResponse] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Response Modal State
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [selectedFeedbackForResponse, setSelectedFeedbackForResponse] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [responding, setResponding] = useState(false);
    const [responseError, setResponseError] = useState('');

    // Detail Modal State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedFeedbackDetail, setSelectedFeedbackDetail] = useState(null);

    // Photo Preview Modal
    const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');

            const params = {};
            if (filterCategory !== 'ALL') params.category = filterCategory;
            if (filterRating !== 'ALL') params.rating = filterRating;
            if (filterReviewed !== 'ALL') params.is_reviewed = filterReviewed;
            if (filterResponse !== 'ALL') params.has_response = filterResponse;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const [feedbacksRes, analyticsRes] = await Promise.all([
                axiosInstance.get('admin/feedback/', { params }),
                axiosInstance.get('admin/feedback/analytics/')
            ]);

            setFeedbacks(Array.isArray(feedbacksRes.data) ? feedbacksRes.data : []);
            setAnalytics(analyticsRes.data);
        } catch (err) {
            setError('Failed to load community feedback records. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterCategory, filterRating, filterReviewed, filterResponse, dateFrom, dateTo]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchData();
    };

    const handleMarkReviewed = async (feedbackId) => {
        try {
            await axiosInstance.patch(`admin/feedback/${feedbackId}/review/`);
            setSuccessMsg('Feedback marked as reviewed. Resident notified.');
            fetchData();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            alert('Failed to mark review as reviewed.');
        }
    };

    const openResponseModal = (fb) => {
        setSelectedFeedbackForResponse(fb);
        setResponseText(fb.admin_response || '');
        setResponseError('');
        setShowResponseModal(true);
    };

    const handleSendResponse = async (e) => {
        e.preventDefault();
        if (!selectedFeedbackForResponse) return;
        if (!responseText.trim()) {
            setResponseError('Response text cannot be empty.');
            return;
        }

        try {
            setResponding(true);
            setResponseError('');

            await axiosInstance.post(`admin/feedback/${selectedFeedbackForResponse.id}/respond/`, {
                response: responseText.trim()
            });

            setShowResponseModal(false);
            setSuccessMsg('Official response recorded and sent to resident in-app.');
            fetchData();
            setTimeout(() => setSuccessMsg(''), 5000);
        } catch (err) {
            setResponseError(err.response?.data?.error || 'Failed to submit response.');
        } finally {
            setResponding(false);
        }
    };

    const openDetailModal = (fb) => {
        setSelectedFeedbackDetail(fb);
        setShowDetailModal(true);
    };

    if (loading && !analytics) return <LoadingSpinner message="Loading community feedback & analytics..." />;
    if (error && !analytics) return <ErrorState message={error} onRetry={fetchData} />;

    return (
        <div className="container-fluid px-0">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h3 className="fw-bold text-dark mb-1">Community Feedback & Ratings</h3>
                    <p className="text-muted mb-0">Monitor resident satisfaction, review delivery experience ratings, and resolve gatehouse service feedback.</p>
                </div>
            </div>

            {/* Notification Alert */}
            {successMsg && (
                <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4" role="alert">
                    <i className="bi bi-check-circle-fill fs-5 text-success"></i>
                    <div>{successMsg}</div>
                    <button type="button" className="btn-close ms-auto" onClick={() => setSuccessMsg('')}></button>
                </div>
            )}

            {/* KPI Analytics Cards */}
            {analytics && (
                <div className="row g-3 mb-4">
                    <div className="col-6 col-md-3">
                        <div className="gv-card p-3 h-100 shadow-sm border-0">
                            <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Average Rating</small>
                            <div className="d-flex align-items-center gap-2 mt-1">
                                <h2 className="fw-bold text-warning mb-0">{analytics.average_rating}</h2>
                                <div>
                                    <StarRating value={Math.round(analytics.average_rating)} readOnly size="sm" />
                                    <div className="text-muted small">out of 5.0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="gv-card p-3 h-100 shadow-sm border-0">
                            <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Total Reviews</small>
                            <h2 className="fw-bold text-dark mt-1 mb-0">{analytics.total_feedbacks}</h2>
                            <div className="text-muted small mt-1">
                                {analytics.responded_count} with official response
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="gv-card p-3 h-100 shadow-sm border-0">
                            <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Review Coverage</small>
                            <h2 className="fw-bold text-primary mt-1 mb-0">
                                {analytics.total_feedbacks > 0 
                                    ? Math.round((analytics.reviewed_count / analytics.total_feedbacks) * 100) 
                                    : 100}%
                            </h2>
                            <div className="text-muted small mt-1">
                                {analytics.unreviewed_count} pending inspection
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="gv-card p-3 h-100 shadow-sm border-0">
                            <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>Issues Flagged (≤ 2★)</small>
                            <h2 className={`fw-bold mt-1 mb-0 ${analytics.sentiment.negative > 0 ? 'text-danger' : 'text-success'}`}>
                                {analytics.sentiment.negative}
                            </h2>
                            <div className="text-muted small mt-1">
                                {analytics.sentiment.positive} positive reviews (4-5★)
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Visual Analytics Charts Section */}
            {analytics && analytics.total_feedbacks > 0 && (
                <div className="row g-3 mb-4">
                    {/* Rating Distribution Bar Chart */}
                    <div className="col-12 col-lg-4">
                        <div className="gv-card p-3 shadow-sm h-100">
                            <h6 className="fw-bold text-dark mb-3">Rating Distribution (1–5 Stars)</h6>
                            <div style={{ height: '220px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.rating_distribution}>
                                        <XAxis dataKey="rating" tickFormatter={(r) => `${r}★`} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip formatter={(value) => [`${value} reviews`, 'Count']} />
                                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                            {analytics.rating_distribution.map((entry) => (
                                                <Cell key={`cell-${entry.rating}`} fill={RATING_COLORS[entry.rating] || '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Category Breakdown Pie Chart */}
                    <div className="col-12 col-lg-4">
                        <div className="gv-card p-3 shadow-sm h-100">
                            <h6 className="fw-bold text-dark mb-3">Feedback by Category</h6>
                            <div style={{ height: '220px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.category_distribution}
                                            dataKey="count"
                                            nameKey="label"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={75}
                                            innerRadius={40}
                                            paddingAngle={3}
                                        >
                                            {analytics.category_distribution.map((entry, index) => (
                                                <Cell key={`cat-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value, name) => [`${value} reviews`, name]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Trends or Frequent Issues */}
                    <div className="col-12 col-lg-4">
                        <div className="gv-card p-3 shadow-sm h-100">
                            <h6 className="fw-bold text-dark mb-2">Frequently Reported Issues (≤ 2★)</h6>
                            {analytics.frequent_complaints && analytics.frequent_complaints.length > 0 ? (
                                <div className="mt-3">
                                    {analytics.frequent_complaints.map((item, idx) => (
                                        <div key={idx} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                            <span className="text-dark small fw-semibold">
                                                <i className="bi bi-exclamation-circle text-danger me-2"></i>
                                                {item.label}
                                            </span>
                                            <span className="badge bg-danger rounded-pill">
                                                {item.count} complaint{item.count > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="d-flex flex-column align-items-center justify-content-center h-75 text-center text-muted">
                                    <i className="bi bi-emoji-smile fs-2 text-success mb-2"></i>
                                    <span className="small">No severe complaints (≤ 2 stars) recorded.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter & Search Bar */}
            <div className="gv-card p-3 mb-4 shadow-sm">
                <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
                    <div className="col-12 col-md-3">
                        <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">
                                <i className="bi bi-search text-muted"></i>
                            </span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Resident, flat, parcel ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="col-6 col-md-2">
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
                    <div className="col-6 col-md-2">
                        <select
                            className="form-select"
                            value={filterRating}
                            onChange={(e) => setFilterRating(e.target.value)}
                        >
                            <option value="ALL">All Ratings</option>
                            <option value="5">5 Stars</option>
                            <option value="4">4 Stars</option>
                            <option value="3">3 Stars</option>
                            <option value="2">2 Stars</option>
                            <option value="1">1 Star</option>
                            <option value="low">Low (≤ 2 Stars)</option>
                            <option value="high">High (≥ 4 Stars)</option>
                        </select>
                    </div>
                    <div className="col-6 col-md-2">
                        <select
                            className="form-select"
                            value={filterReviewed}
                            onChange={(e) => setFilterReviewed(e.target.value)}
                        >
                            <option value="ALL">All Review Statuses</option>
                            <option value="false">Pending Review</option>
                            <option value="true">Reviewed</option>
                        </select>
                    </div>
                    <div className="col-6 col-md-2">
                        <select
                            className="form-select"
                            value={filterResponse}
                            onChange={(e) => setFilterResponse(e.target.value)}
                        >
                            <option value="ALL">All Response Statuses</option>
                            <option value="true">With Response</option>
                            <option value="false">Without Response</option>
                        </select>
                    </div>
                    <div className="col-12 col-md-1 text-end">
                        <button
                            type="button"
                            className="btn btn-outline-secondary w-100"
                            onClick={() => {
                                setFilterCategory('ALL');
                                setFilterRating('ALL');
                                setFilterReviewed('ALL');
                                setFilterResponse('ALL');
                                setDateFrom('');
                                setDateTo('');
                                setSearchQuery('');
                            }}
                            title="Reset filters"
                        >
                            <i className="bi bi-arrow-counterclockwise"></i>
                        </button>
                    </div>
                </form>
            </div>

            {/* Feedback Data Table */}
            {feedbacks.length === 0 ? (
                <EmptyState
                    icon="bi-chat-left-text"
                    title="No Community Feedback Found"
                    message="There are no feedback submissions matching your current filter criteria."
                />
            ) : (
                <div className="gv-card overflow-hidden shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted small text-uppercase">
                                <tr>
                                    <th className="ps-3 py-3 fw-semibold">Resident & Flat</th>
                                    <th className="py-3 fw-semibold">Parcel</th>
                                    <th className="py-3 fw-semibold">Rating & Category</th>
                                    <th className="py-3 fw-semibold" style={{ minWidth: '220px' }}>Review</th>
                                    <th className="py-3 fw-semibold">Submitted</th>
                                    <th className="py-3 fw-semibold">Status</th>
                                    <th className="pe-3 py-3 fw-semibold text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbacks.map((fb) => (
                                    <tr key={fb.id}>
                                        <td className="ps-3 py-3">
                                            <div className="fw-semibold text-dark">{fb.resident_name}</div>
                                            <div className="small text-muted">
                                                Flat {fb.flat_number || 'N/A'}{fb.tower_name ? ` (${fb.tower_name})` : ''}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <div className="fw-semibold text-primary">{fb.parcel_id_display}</div>
                                            <div className="small text-muted">{fb.carrier_name}</div>
                                        </td>
                                        <td className="py-3">
                                            <StarRating value={fb.rating} readOnly size="sm" />
                                            <div className="small text-muted mt-1">{fb.category_display}</div>
                                        </td>
                                        <td className="py-3">
                                            <div className="text-dark small text-truncate" style={{ maxWidth: '280px' }}>
                                                {fb.review || <span className="text-muted fst-italic">No comment</span>}
                                            </div>
                                            {fb.photo && (
                                                <button
                                                    type="button"
                                                    className="btn btn-link p-0 text-decoration-none small text-primary mt-1"
                                                    onClick={() => setPreviewPhotoUrl(resolveMediaUrl(fb.photo))}
                                                >
                                                    <i className="bi bi-image me-1"></i> View Photo Attachment
                                                </button>
                                            )}
                                            {fb.admin_response && (
                                                <div className="small text-success mt-1 text-truncate" style={{ maxWidth: '280px' }}>
                                                    <i className="bi bi-reply-fill me-1"></i> Responded
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 text-muted small">
                                            {new Date(fb.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3">
                                            {fb.is_reviewed ? (
                                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                                    Reviewed
                                                </span>
                                            ) : (
                                                <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-25">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="pe-3 py-3 text-end">
                                            <div className="d-flex justify-content-end gap-1">
                                                {!fb.is_reviewed && (
                                                    <button
                                                        onClick={() => handleMarkReviewed(fb.id)}
                                                        className="btn btn-outline-success btn-sm"
                                                        title="Mark Reviewed"
                                                    >
                                                        <i className="bi bi-check2"></i>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openResponseModal(fb)}
                                                    className="btn btn-outline-primary btn-sm"
                                                    title={fb.admin_response ? "Edit Response" : "Respond to Resident"}
                                                >
                                                    <i className="bi bi-reply"></i>
                                                </button>
                                                <button
                                                    onClick={() => openDetailModal(fb)}
                                                    className="btn btn-light border btn-sm text-muted"
                                                    title="View Details"
                                                >
                                                    <i className="bi bi-eye"></i>
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

            {/* ADMIN RESPONSE MODAL */}
            {showResponseModal && selectedFeedbackForResponse && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-primary text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-reply-fill me-2"></i>
                                    Respond to Community Feedback
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => !responding && setShowResponseModal(false)}
                                    disabled={responding}
                                ></button>
                            </div>
                            <form onSubmit={handleSendResponse}>
                                <div className="modal-body p-4">
                                    {responseError && (
                                        <div className="alert alert-danger py-2 small mb-3">
                                            {responseError}
                                        </div>
                                    )}

                                    {/* Resident Feedback Snapshot */}
                                    <div className="bg-light p-3 rounded mb-3 border">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span className="fw-semibold text-dark">
                                                {selectedFeedbackForResponse.resident_name} (Flat {selectedFeedbackForResponse.flat_number})
                                            </span>
                                            <StarRating value={selectedFeedbackForResponse.rating} readOnly size="sm" />
                                        </div>
                                        <div className="small text-muted mb-2">
                                            Parcel {selectedFeedbackForResponse.parcel_id_display} ({selectedFeedbackForResponse.carrier_name}) • {selectedFeedbackForResponse.category_display}
                                        </div>
                                        <p className="mb-0 text-dark small fst-italic">
                                            "{selectedFeedbackForResponse.review || 'No written comment'}"
                                        </p>
                                    </div>

                                    {/* Response Textarea */}
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small text-muted text-uppercase">
                                            Official Administrative Response
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows="4"
                                            placeholder="Write a professional response explaining actions taken, thanking resident, or offering resolution..."
                                            value={responseText}
                                            onChange={(e) => setResponseText(e.target.value)}
                                            required
                                            disabled={responding}
                                        ></textarea>
                                        <div className="form-text small text-muted">
                                            The resident will immediately receive an in-app notification with this response.
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowResponseModal(false)}
                                        disabled={responding}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary fw-bold px-4"
                                        disabled={responding}
                                    >
                                        {responding ? 'Sending...' : 'Send Official Response'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {showDetailModal && selectedFeedbackDetail && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-light">
                                <h5 className="modal-title fw-bold text-dark">
                                    Feedback Details: Parcel {selectedFeedbackDetail.parcel_id_display}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowDetailModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <StarRating value={selectedFeedbackDetail.rating} readOnly size="md" showLabel />
                                    </div>
                                    <span className="badge bg-light text-dark border">
                                        {selectedFeedbackDetail.category_display}
                                    </span>
                                </div>

                                <div className="row g-2 mb-3 small text-muted">
                                    <div className="col-6">
                                        <strong>Resident:</strong> {selectedFeedbackDetail.resident_name} (@{selectedFeedbackDetail.resident_username})
                                    </div>
                                    <div className="col-6">
                                        <strong>Flat:</strong> Flat {selectedFeedbackDetail.flat_number} ({selectedFeedbackDetail.tower_name})
                                    </div>
                                    <div className="col-6">
                                        <strong>Carrier:</strong> {selectedFeedbackDetail.carrier_name}
                                    </div>
                                    <div className="col-6">
                                        <strong>Submitted:</strong> {new Date(selectedFeedbackDetail.created_at).toLocaleString()}
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="fw-semibold small text-muted text-uppercase d-block mb-1">Resident Review</label>
                                    <p className="p-3 bg-light rounded text-dark mb-0" style={{ whiteSpace: 'pre-line' }}>
                                        {selectedFeedbackDetail.review || <em className="text-muted">No comment provided.</em>}
                                    </p>
                                </div>

                                {selectedFeedbackDetail.photo && (
                                    <div className="mb-3">
                                        <label className="fw-semibold small text-muted text-uppercase d-block mb-1">Supporting Photo</label>
                                        <img
                                            src={resolveMediaUrl(selectedFeedbackDetail.photo)}
                                            alt="Review Attachment"
                                            className="img-fluid rounded border cursor-pointer"
                                            style={{ maxHeight: '180px', objectFit: 'cover' }}
                                            onClick={() => setPreviewPhotoUrl(resolveMediaUrl(selectedFeedbackDetail.photo))}
                                        />
                                    </div>
                                )}

                                {selectedFeedbackDetail.admin_response && (
                                    <div className="p-3 bg-primary bg-opacity-10 rounded border border-primary border-opacity-25 mt-3">
                                        <div className="d-flex align-items-center justify-content-between mb-1">
                                            <span className="fw-bold text-primary small">
                                                <i className="bi bi-shield-check me-1"></i> Management Response
                                            </span>
                                            {selectedFeedbackDetail.responded_at && (
                                                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                                    {new Date(selectedFeedbackDetail.responded_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mb-0 text-dark small" style={{ whiteSpace: 'pre-line' }}>
                                            {selectedFeedbackDetail.admin_response}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer bg-light">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowDetailModal(false)}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        openResponseModal(selectedFeedbackDetail);
                                    }}
                                >
                                    {selectedFeedbackDetail.admin_response ? "Update Response" : "Respond"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* FULL PHOTO VIEWER MODAL */}
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
                                    alt="Review photo full preview"
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

export default AdminFeedback;

