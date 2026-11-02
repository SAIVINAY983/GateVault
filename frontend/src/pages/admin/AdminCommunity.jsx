import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { LoadingSpinner, ErrorState } from '../../components/ui/StateComponents';

const AdminCommunity = () => {
    const [communityData, setCommunityData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedTowerId, setSelectedTowerId] = useState(null);
    const [selectedFloorNum, setSelectedFloorNum] = useState(0);
    const [facilityCategoryFilter, setFacilityCategoryFilter] = useState('ALL');
    const [activeView, setActiveView] = useState('TOWERS'); // 'TOWERS' or 'FACILITIES'

    const fetchCommunityOverview = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await axiosInstance.get('admin/community/overview/');
            setCommunityData(res.data);
            if (res.data.towers && res.data.towers.length > 0) {
                setSelectedTowerId(res.data.towers[0].id);
                if (res.data.towers[0].floors && res.data.towers[0].floors.length > 0) {
                    setSelectedFloorNum(res.data.towers[0].floors[0].floor_number);
                }
            }
        } catch (err) {
            console.error("Failed to fetch community overview", err);
            setError("Failed to load community configuration from server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCommunityOverview();
    }, []);

    if (loading) return <LoadingSpinner message="Loading GateVault Residency community structure..." />;
    if (error) return <ErrorState message={error} onRetry={fetchCommunityOverview} />;
    if (!communityData) return null;

    const currentTower = communityData.towers.find(t => t.id === selectedTowerId) || communityData.towers[0];
    const currentFloor = currentTower?.floors.find(f => f.floor_number === selectedFloorNum) || currentTower?.floors[0];

    // Filter facilities
    const categories = ['ALL', ...new Set(communityData.facilities.map(f => f.category))];
    const filteredFacilities = facilityCategoryFilter === 'ALL'
        ? communityData.facilities
        : communityData.facilities.filter(f => f.category === facilityCategoryFilter);

    const getOccupancyBadge = (status) => {
        switch (status) {
            case 'OCCUPIED':
                return (
                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
                        <i className="bi bi-person-check-fill me-1"></i> OCCUPIED
                    </span>
                );
            case 'PENDING_VERIFICATION':
                return (
                    <span className="badge bg-warning bg-opacity-10 text-warning-emphasis border border-warning px-2 py-1">
                        <i className="bi bi-hourglass-split me-1"></i> PENDING VERIFICATION
                    </span>
                );
            case 'VACANT':
            default:
                return (
                    <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1">
                        <i className="bi bi-door-open me-1"></i> VACANT
                    </span>
                );
        }
    };

    return (
        <div className="container-fluid px-0">
            {/* Header & Overview Stats */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                        <h2 className="fw-bold text-dark mb-0">{communityData.community_name}</h2>
                        <span className="badge bg-primary rounded-pill px-3 py-1">Gated Community</span>
                    </div>
                    <p className="text-muted mb-0">
                        Complete residential architecture: {communityData.total_towers} Towers &bull; 15 Floors per Tower &bull; {communityData.total_flats} Flats
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        className={`btn btn-sm rounded-pill px-3 ${activeView === 'TOWERS' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveView('TOWERS')}
                    >
                        <i className="bi bi-buildings-fill me-1"></i> Tower & Flat Architecture
                    </button>
                    <button
                        className={`btn btn-sm rounded-pill px-3 ${activeView === 'FACILITIES' ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => setActiveView('FACILITIES')}
                    >
                        <i className="bi bi-shield-check me-1"></i> Facilities & Amenities
                    </button>
                </div>
            </div>

            {/* Global Community Occupancy Summary Cards */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="gv-card p-3 border-0 shadow-sm bg-white rounded-3">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.05em' }}>Total Community Flats</div>
                                <div className="fs-3 fw-bold text-dark mt-1">{communityData.total_flats}</div>
                                <div className="text-muted small">Across {communityData.total_towers} towers</div>
                            </div>
                            <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                <i className="bi bi-building fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="gv-card p-3 border-0 shadow-sm bg-white rounded-3">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.05em' }}>Occupied Flats</div>
                                <div className="fs-3 fw-bold text-success mt-1">{communityData.occupancy_summary.occupied}</div>
                                <div className="text-success small fw-medium">{communityData.occupancy_summary.occupancy_percentage}% occupancy rate</div>
                            </div>
                            <div className="bg-success bg-opacity-10 text-success rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                <i className="bi bi-people-fill fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="gv-card p-3 border-0 shadow-sm bg-white rounded-3">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.05em' }}>Pending Verification</div>
                                <div className="fs-3 fw-bold text-warning-emphasis mt-1">{communityData.occupancy_summary.pending_verification}</div>
                                <div className="text-muted small">Registrations awaiting approval</div>
                            </div>
                            <div className="bg-warning bg-opacity-10 text-warning rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                <i className="bi bi-hourglass-split fs-4 text-warning-emphasis"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                    <div className="gv-card p-3 border-0 shadow-sm bg-white rounded-3">
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <div className="text-muted small fw-semibold text-uppercase" style={{ letterSpacing: '0.05em' }}>Vacant Flats</div>
                                <div className="fs-3 fw-bold text-secondary mt-1">{communityData.occupancy_summary.vacant}</div>
                                <div className="text-muted small">Available for new residents</div>
                            </div>
                            <div className="bg-secondary bg-opacity-10 text-secondary rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                                <i className="bi bi-door-closed fs-4"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* VIEW 1: RESIDENTIAL TOWERS & FLAT ARCHITECTURE */}
            {activeView === 'TOWERS' && (
                <>
                    {/* Tower Selection Cards */}
                    <div className="row g-3 mb-4">
                        {communityData.towers.map(tower => {
                            const isSelected = tower.id === selectedTowerId;
                            return (
                                <div key={tower.id} className="col-12 col-sm-6 col-xl-3">
                                    <div
                                        className={`gv-card p-3 rounded-4 cursor-pointer transition-all ${
                                            isSelected ? 'border-primary border-2 shadow-sm bg-light' : 'border bg-white shadow-none'
                                        }`}
                                        style={{ cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
                                        onClick={() => {
                                            setSelectedTowerId(tower.id);
                                            if (tower.floors && tower.floors.length > 0) {
                                                setSelectedFloorNum(tower.floors[0].floor_number);
                                            }
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className={`rounded-circle p-2 d-flex align-items-center justify-content-center ${isSelected ? 'bg-primary text-white' : 'bg-light text-muted'}`} style={{ width: 36, height: 36 }}>
                                                    <i className="bi bi-building"></i>
                                                </div>
                                                <h5 className="fw-bold mb-0 text-dark">{tower.name}</h5>
                                            </div>
                                            {isSelected && (
                                                <span className="badge bg-primary rounded-pill px-2 py-1">Active</span>
                                            )}
                                        </div>

                                        <div className="small text-muted mb-3">
                                            {tower.floors_count} Floors &bull; {tower.flats_count} Flats (4 per floor)
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center pt-2 border-top small">
                                            <span className="text-success fw-medium">
                                                <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
                                                {tower.occupied_count} Occupied
                                            </span>
                                            {tower.pending_count > 0 && (
                                                <span className="text-warning-emphasis fw-medium">
                                                    <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i>
                                                    {tower.pending_count} Pending
                                                </span>
                                            )}
                                            <span className="text-muted">
                                                {tower.vacant_count} Vacant
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Drill-down Interactive Section: Floors & 4 Flats per Floor */}
                    {currentTower && (
                        <div className="gv-card bg-white rounded-4 p-4 border shadow-sm mb-4">
                            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3 pb-3 border-bottom">
                                <div>
                                    <h4 className="fw-bold text-dark mb-1">
                                        <i className="bi bi-diagram-3-fill text-primary me-2"></i>
                                        {currentTower.name} &bull; Floor & Flat Drill-down
                                    </h4>
                                    <p className="text-muted small mb-0">
                                        Select a floor to view its 4 flats, occupancy state, and resident allocation.
                                    </p>
                                </div>
                                <div className="small text-muted">
                                    Showing: <strong className="text-dark">{currentFloor?.floor_name || 'Floor'}</strong> of {currentTower.name}
                                </div>
                            </div>

                            {/* Floor Pills Selector (15 Floors: Ground Floor + Floors 1-14) */}
                            <div className="mb-4">
                                <label className="form-label small fw-semibold text-muted text-uppercase" style={{ letterSpacing: '0.05em' }}>
                                    Select Floor (15 Floors):
                                </label>
                                <div className="d-flex flex-wrap gap-2">
                                    {currentTower.floors.map(fl => {
                                        const isFloorActive = fl.floor_number === selectedFloorNum;
                                        const hasOccupied = fl.flats.some(f => f.occupancy_status === 'OCCUPIED');
                                        const hasPending = fl.flats.some(f => f.occupancy_status === 'PENDING_VERIFICATION');

                                        return (
                                            <button
                                                key={fl.floor_number}
                                                className={`btn btn-sm rounded-pill px-3 py-1 position-relative ${
                                                    isFloorActive ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
                                                }`}
                                                onClick={() => setSelectedFloorNum(fl.floor_number)}
                                            >
                                                {fl.floor_name}
                                                {hasPending && (
                                                    <span className="position-absolute top-0 start-100 translate-middle p-1 bg-warning border border-light rounded-circle"></span>
                                                )}
                                                {!hasPending && hasOccupied && (
                                                    <span className="position-absolute top-0 start-100 translate-middle p-1 bg-success border border-light rounded-circle"></span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* The 4 Flats of the selected Floor */}
                            <div>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h6 className="fw-bold text-dark mb-0">
                                        <i className="bi bi-door-closed text-primary me-2"></i>
                                        Flats on {currentFloor?.floor_name} ({currentTower.name})
                                    </h6>
                                    <span className="text-muted small">4 units per floor</span>
                                </div>

                                <div className="row g-3">
                                    {currentFloor?.flats.map(flat => (
                                        <div key={flat.id} className="col-12 col-sm-6 col-lg-3">
                                            <div className="p-3 bg-light rounded-3 border h-100 d-flex flex-column justify-content-between">
                                                <div>
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <h5 className="fw-bold text-dark mb-0">Flat {flat.number}</h5>
                                                        {getOccupancyBadge(flat.occupancy_status)}
                                                    </div>
                                                    <div className="small text-muted mb-2">
                                                        {flat.tower_name} &bull; {flat.floor_name}
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-top mt-2">
                                                    <div className="d-flex justify-content-between small text-muted mb-1">
                                                        <span>Approved Residents:</span>
                                                        <strong className={flat.approved_residents_count > 0 ? 'text-success' : 'text-dark'}>
                                                            {flat.approved_residents_count}
                                                        </strong>
                                                    </div>
                                                    <div className="d-flex justify-content-between small text-muted">
                                                        <span>Pending Registrations:</span>
                                                        <strong className={flat.pending_residents_count > 0 ? 'text-warning-emphasis' : 'text-dark'}>
                                                            {flat.pending_residents_count}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* VIEW 2: COMMUNITY FACILITIES & AMENITIES */}
            {activeView === 'FACILITIES' && (
                <div className="gv-card bg-white rounded-4 p-4 border shadow-sm">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-3 border-bottom">
                        <div>
                            <h4 className="fw-bold text-dark mb-1">
                                <i className="bi bi-shield-check text-primary me-2"></i>
                                GateVault Residency Facilities & Amenities
                            </h4>
                            <p className="text-muted small mb-0">
                                16 dedicated infrastructure checkpoints, security features, and resident amenities.
                            </p>
                        </div>
                        {/* Category Filter Pills */}
                        <div className="d-flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className={`btn btn-sm rounded-pill px-3 ${facilityCategoryFilter === cat ? 'btn-primary' : 'btn-outline-secondary'}`}
                                    onClick={() => setFacilityCategoryFilter(cat)}
                                >
                                    {cat === 'ALL' ? 'All Amenities' : cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="row g-3">
                        {filteredFacilities.map(fac => (
                            <div key={fac.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                                <div className="p-3 rounded-3 border bg-light h-100 d-flex flex-column">
                                    <div className="d-flex align-items-center gap-3 mb-2">
                                        <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                                            <i className={`bi ${fac.icon} fs-5`}></i>
                                        </div>
                                        <div>
                                            <h6 className="fw-bold text-dark mb-0">{fac.name}</h6>
                                            <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-0" style={{ fontSize: '0.7rem' }}>
                                                {fac.category}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-muted small mb-0 flex-grow-1 mt-2">
                                        {fac.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCommunity;

