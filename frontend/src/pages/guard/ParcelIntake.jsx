import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ParcelIntake = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [towers, setTowers] = useState([]);
    const [flats, setFlats] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [shelves, setShelves] = useState([]);
    
    // Workflow state
    const [step, setStep] = useState('LOOKUP'); // 'LOOKUP' | 'VERIFY' | 'MANUAL'
    const [lookupTracking, setLookupTracking] = useState('');
    const [lookupMessage, setLookupMessage] = useState('');
    const [expectedMatch, setExpectedMatch] = useState(null);

    // Form data for manual intake and final submission
    const [formData, setFormData] = useState({
        tower: '',
        flat: '',
        carrier: '',
        tracking_number: '',
        shelf: '',
        delivery_type: 'NORMAL',
        expected_delivery_id: '',
        payment_status: 'NOT_APPLICABLE',
        payment_method: 'NOT_APPLICABLE',
        status: 'AWAITING_PICKUP'
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successData, setSuccessData] = useState(null);
    const [codVerified, setCodVerified] = useState(false);

    // Parcel Condition Inspection state
    const [condition, setCondition] = useState('INTACT');
    const [conditionRemarks, setConditionRemarks] = useState('');
    const [conditionPhoto, setConditionPhoto] = useState(null);
    const [conditionPhotoPreview, setConditionPhotoPreview] = useState(null);
    const [courierConfirmed, setCourierConfirmed] = useState(false);

    // Alternate Receiver & Direct Delivery state
    const [authorizedReceivers, setAuthorizedReceivers] = useState([]);
    const [receiverType, setReceiverType] = useState('PRIMARY_RESIDENT');
    const [householdMemberId, setHouseholdMemberId] = useState('');
    const [deliveryLocation, setDeliveryLocation] = useState('GATEHOUSE');
    const [directVerificationMethod, setDirectVerificationMethod] = useState('DOORSTEP_VERIFICATION');
    const [directPhoto, setDirectPhoto] = useState(null);
    const [directPhotoPreview, setDirectPhotoPreview] = useState(null);

    // Smart Community Delivery Policy State
    const [effectivePolicies, setEffectivePolicies] = useState({});
    const [isHighValue, setIsHighValue] = useState(false);
    const [declaredValue, setDeclaredValue] = useState('');
    const [residentPresenceConfirmed, setResidentPresenceConfirmed] = useState(false);
    const [extraVerificationNotes, setExtraVerificationNotes] = useState('');

    // Smart Shelf Management State
    const [parcelSize, setParcelSize] = useState('MEDIUM');
    const [dimensions, setDimensions] = useState('');
    const [handlingInstructions, setHandlingInstructions] = useState('');
    const [reservationToken, setReservationToken] = useState(null);
    const [reservedShelfName, setReservedShelfName] = useState('');
    const [reservationExpiry, setReservationExpiry] = useState(null);
    const [reservationSuccessMsg, setReservationSuccessMsg] = useState('');
    const [recommendedShelf, setRecommendedShelf] = useState(null);
    const [isRecommending, setIsRecommending] = useState(false);
    const [isReserving, setIsReserving] = useState(false);

    // Courier Visit Linking State
    const [activeCourierVisits, setActiveCourierVisits] = useState([]);
    const [courierVisitId, setCourierVisitId] = useState('');

    const trackingInputRef = useRef(null);

    useEffect(() => {
        if (step === 'LOOKUP' && trackingInputRef.current) {
            trackingInputRef.current.focus();
        }
    }, [step]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [towerRes, carrierRes, shelfRes, courierRes] = await Promise.all([
                    axiosInstance.get('towers/'),
                    axiosInstance.get('carriers/'),
                    axiosInstance.get('shelves/'),
                    axiosInstance.get('courier-visits/active/').catch(() => ({ data: [] }))
                ]);
                setTowers(towerRes.data);
                setCarriers(carrierRes.data);
                setShelves(shelfRes.data.filter(s => (s.status === 'ACTIVE' || !s.status) && !s.is_full));
                setActiveCourierVisits(courierRes.data || []);
            } catch (err) {
                console.error("Failed to load form data", err);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const trackingParam = searchParams.get('tracking');
        if (trackingParam && carriers.length > 0) {
            setLookupTracking(trackingParam);
            const runAutoLookup = async () => {
                setLoading(true);
                setLookupMessage('');
                try {
                    const res = await axiosInstance.get(`expected-deliveries/lookup/?tracking=${trackingParam.trim()}`);
                    const match = res.data;
                    setExpectedMatch(match);
                    let mappedCarrierId = '';
                    const matchingCarrier = carriers.find(c => c.name.toLowerCase() === match.courier_name.toLowerCase());
                    if (matchingCarrier) {
                        mappedCarrierId = matchingCarrier.id;
                    } else if (carriers.length > 0) {
                        mappedCarrierId = carriers[0].id;
                    }
                    setFormData(prev => ({
                        ...prev,
                        tracking_number: match.tracking_id,
                        delivery_type: match.delivery_type,
                        tower: match.tower_id || '',
                        flat: match.flat_id || '',
                        carrier: mappedCarrierId,
                        expected_delivery_id: match.id,
                        payment_status: match.payment_type === 'COD' ? 'PENDING' : 'NOT_APPLICABLE',
                        payment_method: match.payment_type === 'COD' ? '' : 'NOT_APPLICABLE'
                    }));
                    setCodVerified(false);
                    setStep('VERIFY');
                } catch (err) {
                    console.error("Auto-lookup error:", err);
                    if (err.response?.data?.error) {
                        setLookupMessage(err.response.data.error);
                    }
                } finally {
                    setLoading(false);
                }
            };
            runAutoLookup();
        }
    }, [searchParams, carriers]);

    const fetchRecommendation = async (sizeToUse) => {
        const sz = sizeToUse || parcelSize;
        setIsRecommending(true);
        try {
            const res = await axiosInstance.get('shelves/recommend/', {
                params: { parcel_size: sz }
            });
            if (res.data.recommended_shelf) {
                setRecommendedShelf(res.data.recommended_shelf);
                setFormData(prev => {
                    if (!prev.shelf || !shelves.some(s => s.id.toString() === prev.shelf.toString())) {
                        return { ...prev, shelf: res.data.recommended_shelf.id };
                    }
                    return prev;
                });
            } else {
                setRecommendedShelf(null);
            }
        } catch (err) {
            console.error("Failed to fetch recommendation", err);
        } finally {
            setIsRecommending(false);
        }
    };

    const handleReserveSlot = async (shelfId) => {
        const targetShelfId = shelfId || formData.shelf;
        if (!targetShelfId) {
            setError("Please select a shelf before reserving a slot.");
            return;
        }
        setIsReserving(true);
        setError("");
        try {
            const res = await axiosInstance.post('shelves/reserve/', {
                shelf_id: targetShelfId,
                parcel_size: parcelSize,
                duration_minutes: 15
            });
            setReservationToken(res.data.reservation_token);
            setReservedShelfName(res.data.shelf_name);
            setReservationExpiry(res.data.expires_at);
            setFormData(prev => ({ ...prev, shelf: targetShelfId }));
            setReservationSuccessMsg(`Slot reserved on ${res.data.shelf_name}! Valid for 15 minutes.`);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to reserve shelf slot.");
        } finally {
            setIsReserving(false);
        }
    };

    const handleReleaseReservation = async () => {
        if (!reservationToken) return;
        try {
            await axiosInstance.post('shelves/release-reservation/', {
                reservation_token: reservationToken
            });
        } catch (err) {
            console.error("Failed to release reservation", err);
        } finally {
            setReservationToken(null);
            setReservedShelfName('');
            setReservationExpiry(null);
            setReservationSuccessMsg('');
        }
    };

    useEffect(() => {
        if (deliveryLocation === 'GATEHOUSE') {
            fetchRecommendation(parcelSize);
        }
    }, [parcelSize, deliveryLocation]);

    useEffect(() => {
        return () => {
            if (reservationToken) {
                axiosInstance.post('shelves/release-reservation/', {
                    reservation_token: reservationToken
                }).catch(() => {});
            }
        };
    }, [reservationToken]);

    useEffect(() => {
        if (formData.tower) {
            axiosInstance.get(`flats/?tower=${formData.tower}`)
                .then(res => setFlats(res.data))
                .catch(err => console.error("Failed to fetch flats", err));
        } else {
            setFlats([]);
        }
    }, [formData.tower]);

    useEffect(() => {
        if (formData.flat) {
            axiosInstance.get(`resident/household/authorized-receivers/?flat_id=${formData.flat}&delivery_type=${formData.delivery_type}`)
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    setAuthorizedReceivers(list);
                    if (receiverType === 'HOUSEHOLD_MEMBER') {
                        const exists = list.find(r => r.id === householdMemberId && !r.is_primary);
                        if (!exists) {
                            setReceiverType('PRIMARY_RESIDENT');
                            setHouseholdMemberId('');
                        }
                    }
                })
                .catch(err => {
                    console.error("Failed to load authorized receivers", err);
                    setAuthorizedReceivers([]);
                });
        } else {
            setAuthorizedReceivers([]);
            setReceiverType('PRIMARY_RESIDENT');
            setHouseholdMemberId('');
        }
    }, [formData.flat, formData.delivery_type]);

    // Fetch effective delivery policies for current tower/flat
    useEffect(() => {
        const fetchPolicies = async () => {
            try {
                const params = {};
                if (formData.tower) params.tower_id = formData.tower;
                if (formData.flat) params.flat_id = formData.flat;
                const res = await axiosInstance.get('delivery-policies/effective/', { params });
                setEffectivePolicies(res.data.policies || {});
            } catch (err) {
                console.error("Failed to load effective delivery policies", err);
            }
        };
        fetchPolicies();
    }, [formData.tower, formData.flat]);

    // Determine current active delivery category
    const determineCategory = () => {
        if (isHighValue) return 'HIGH_VALUE';
        if (expectedMatch?.is_open_box) return 'OPEN_BOX';
        if (expectedMatch?.payment_type === 'COD' || formData.delivery_type === 'COD') return 'COD';
        if (expectedMatch?.delivery_type === 'FOOD' || formData.delivery_type === 'FOOD') return 'FOOD';
        return 'NORMAL';
    };

    const currentCategory = determineCategory();
    const activePolicy = effectivePolicies[currentCategory] || null;

    // Enforce policy constraints on location & receiver selection
    useEffect(() => {
        if (!activePolicy) return;

        // If direct to flat is not allowed by policy or mode is GATEHOUSE_ONLY
        if (!activePolicy.allow_direct_to_flat || activePolicy.delivery_mode === 'GATEHOUSE_ONLY') {
            if (deliveryLocation !== 'GATEHOUSE') {
                setDeliveryLocation('GATEHOUSE');
            }
        }

        // If policy requires resident presence or forbids household receivers
        if (activePolicy.require_resident_presence || !activePolicy.allow_household_receiver) {
            if (receiverType !== 'PRIMARY_RESIDENT') {
                setReceiverType('PRIMARY_RESIDENT');
                setHouseholdMemberId('');
            }
        }
    }, [activePolicy]);

    const handleLookup = async (e) => {
        e?.preventDefault();
        if (!lookupTracking.trim()) return;
        
        setLoading(true);
        setLookupMessage('');
        
        try {
            const res = await axiosInstance.get(`expected-deliveries/lookup/?tracking=${lookupTracking.trim()}`);
            const match = res.data;
            setExpectedMatch(match);
            
            // Map courier name to carrier ID
            let mappedCarrierId = '';
            const matchingCarrier = carriers.find(c => c.name.toLowerCase() === match.courier_name.toLowerCase());
            if (matchingCarrier) {
                mappedCarrierId = matchingCarrier.id;
            } else if (carriers.length > 0) {
                // Fallback to first carrier if exact name doesn't match
                mappedCarrierId = carriers[0].id;
            }

            setFormData({
                ...formData,
                tracking_number: match.tracking_id,
                delivery_type: match.delivery_type,
                tower: match.tower_id || '',
                flat: match.flat_id || '',
                carrier: mappedCarrierId,
                expected_delivery_id: match.id,
                payment_status: match.payment_type === 'COD' ? 'PENDING' : 'NOT_APPLICABLE',
                payment_method: match.payment_type === 'COD' ? '' : 'NOT_APPLICABLE'
            });
            
            setCodVerified(false);
            setStep('VERIFY');
            
        } catch (err) {
            if (err.response?.data?.error) {
                setLookupMessage(err.response.data.error);
            } else {
                setLookupMessage("No expected delivery found. You can receive this parcel manually.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLookupKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLookup();
        }
    };

    const handleChange = (e) => {
        setFormData({...formData, [e.target.name]: e.target.value});
    };

    const handleConditionPhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            setError('Please upload a valid JPG, JPEG, or PNG photograph.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Photograph size must be under 5MB.');
            return;
        }
        setError('');
        setConditionPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setConditionPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleDirectPhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
            setError('Please upload a valid JPG, JPEG, or PNG photograph for direct delivery.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Photograph size must be under 5MB.');
            return;
        }
        setError('');
        setDirectPhoto(file);
        const reader = new FileReader();
        reader.onloadend = () => setDirectPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e, action = 'RECEIVE') => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const dataToSubmit = { ...formData, courier_payment_confirmed: codVerified };
            if (action === 'ATTEMPTED') {
                dataToSubmit.status = 'DELIVERY_ATTEMPTED';
                dataToSubmit.payment_status = 'FAILED';
                dataToSubmit.shelf = null;
            } else if (expectedMatch && expectedMatch.payment_type === 'COD') {
                dataToSubmit.payment_status = 'PAID';
            }

            // Append condition inspection data
            dataToSubmit.condition = condition;
            dataToSubmit.condition_remarks = conditionRemarks;
            dataToSubmit.courier_confirmed = courierConfirmed;

            // Receiver & Delivery Location data
            dataToSubmit.receiver_type = receiverType;
            if (receiverType === 'HOUSEHOLD_MEMBER') {
                dataToSubmit.household_member_id = householdMemberId;
            }
            dataToSubmit.delivery_location = deliveryLocation;
            if (deliveryLocation === 'DIRECT_TO_FLAT') {
                dataToSubmit.shelf = '';
                dataToSubmit.direct_delivery_verification = directVerificationMethod;
            }

            // Append Smart Community Delivery Policy fields
            dataToSubmit.is_high_value = isHighValue;
            if (declaredValue) {
                dataToSubmit.declared_value = declaredValue;
            }
            dataToSubmit.resident_presence_confirmed = residentPresenceConfirmed;
            if (extraVerificationNotes) {
                dataToSubmit.extra_verification_notes = extraVerificationNotes;
            }

            // Append Smart Shelf fields
            dataToSubmit.parcel_size = parcelSize;
            if (dimensions) {
                dataToSubmit.dimensions = dimensions;
            }
            if (handlingInstructions) {
                dataToSubmit.handling_instructions = handlingInstructions;
            }
            if (reservationToken) {
                dataToSubmit.reservation_token = reservationToken;
            }

            // Append Courier Visit linking
            if (courierVisitId) {
                dataToSubmit.courier_visit = courierVisitId;
            }

            const formPayload = new FormData();
            Object.keys(dataToSubmit).forEach(key => {
                if (dataToSubmit[key] !== null && dataToSubmit[key] !== undefined && dataToSubmit[key] !== '') {
                    formPayload.append(key, dataToSubmit[key]);
                }
            });

            if (conditionPhoto) {
                formPayload.append('condition_photo', conditionPhoto);
            }
            if (deliveryLocation === 'DIRECT_TO_FLAT' && directPhoto) {
                formPayload.append('direct_delivery_photo', directPhoto);
            }

            const res = await axiosInstance.post('parcels/intake/', formPayload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            // Clear temporary reservation & courier link on success
            setReservationToken(null);
            setReservedShelfName('');
            setReservationExpiry(null);
            setReservationSuccessMsg('');
            setCourierVisitId('');

            // Re-fetch shelves in background to update capacity
            axiosInstance.get('shelves/').then(shelfRes => {
                setShelves(shelfRes.data.filter(s => (s.status === 'ACTIVE' || !s.status) && !s.is_full));
            });

            if (action === 'ATTEMPTED') {
                setSuccessData({ attempted: true });
                return;
            } else if (action === 'OPEN_BOX_RETURNED') {
                setSuccessData({ openBoxReturned: true });
                return;
            } else if (action === 'OPEN_BOX_COMPLETED') {
                setSuccessData({ openBoxCompleted: true });
                return;
            }

            // Find flat and shelf names for success screen
            let selectedFlat = flats.find(f => f.id.toString() === formData.flat.toString());
            // If using expected match and flats array isn't populated for that tower yet, use expectedMatch display
            const flatDisplay = selectedFlat ? selectedFlat.number : (expectedMatch ? expectedMatch.flat_display : '');
            
            const selectedShelf = shelves.find(s => s.id.toString() === formData.shelf.toString());
            
            const receiverObj = authorizedReceivers.find(r => (receiverType === 'HOUSEHOLD_MEMBER' ? r.id === householdMemberId : r.is_primary));
            const receiverName = receiverObj ? `${receiverObj.name} (${receiverObj.relationship_display})` : (res.data.actual_receiver_name || res.data.resident_name);

            setSuccessData({
                parcel_id: res.data.parcel_id,
                pickup_pin: res.data.pickup_pin,
                resident_name: res.data.resident_name || (expectedMatch ? expectedMatch.resident_name : 'Resident'),
                actual_receiver_name: receiverName,
                flat_number: flatDisplay,
                shelf_name: deliveryLocation === 'DIRECT_TO_FLAT' ? 'Direct to Flat (Handed Over)' : (selectedShelf?.name || 'Assigned Shelf'),
                condition: condition,
                delivery_location: deliveryLocation,
                direct_delivery_verification: directVerificationMethod,
                courier_visit_display: res.data.courier_visit_display
            });
            
        } catch (err) {
            const data = err.response?.data;
            const msg = (
                data?.delivery_location ||
                data?.receiver_type ||
                data?.resident_presence_confirmed ||
                data?.extra_verification_notes ||
                data?.shelf ||
                data?.payment_type ||
                data?.payment_method ||
                data?.expected_delivery_id ||
                data?.error ||
                (typeof data === 'object' ? Object.values(data).flat().join(' ') : null) ||
                'Failed to register parcel. Please check all fields.'
            );
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterAnother = () => {
        setSuccessData(null);
        setStep('LOOKUP');
        setLookupTracking('');
        setLookupMessage('');
        setExpectedMatch(null);
        setCodVerified(false);
        setCondition('INTACT');
        setConditionRemarks('');
        setConditionPhoto(null);
        setConditionPhotoPreview(null);
        setCourierConfirmed(false);
        setReceiverType('PRIMARY_RESIDENT');
        setHouseholdMemberId('');
        setDeliveryLocation('GATEHOUSE');
        setDirectVerificationMethod('DOORSTEP_VERIFICATION');
        setDirectPhoto(null);
        setDirectPhotoPreview(null);
        setIsHighValue(false);
        setDeclaredValue('');
        setResidentPresenceConfirmed(false);
        setExtraVerificationNotes('');
        setFormData({
            tower: '',
            flat: '',
            carrier: '',
            tracking_number: '',
            shelf: '',
            delivery_type: 'NORMAL',
            expected_delivery_id: '',
            payment_status: 'NOT_APPLICABLE',
            payment_method: 'NOT_APPLICABLE',
            status: 'AWAITING_PICKUP'
        });
    };

    const renderInspectionSection = () => (
        <div className="mb-4 pt-3 border-top">
            <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="text-uppercase fw-bold text-primary mb-0" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                    Parcel Condition Inspection <span className="text-danger">*</span>
                </h6>
                <span className="badge bg-light text-secondary border">Mandatory Check</span>
            </div>
            <p className="text-muted small mb-3">Inspect physical packaging before intake. If damaged or opened, photograph and log remarks.</p>
            
            <div className="row g-2 mb-3">
                {[
                    { val: 'INTACT', label: 'Intact', color: 'success', icon: 'bi-shield-check', desc: 'Secure & sealed' },
                    { val: 'DAMAGED', label: 'Damaged', color: 'danger', icon: 'bi-exclamation-triangle-fill', desc: 'Crushed or torn' },
                    { val: 'TAMPERED', label: 'Tampered', color: 'danger', icon: 'bi-shield-slash-fill', desc: 'Broken seal / tape' },
                    { val: 'OPENED', label: 'Opened', color: 'warning', icon: 'bi-box-seam', desc: 'Open / unsealed' }
                ].map(item => (
                    <div className="col-6 col-sm-3" key={item.val}>
                        <div 
                            onClick={() => setCondition(item.val)}
                            className={`card p-2 text-center h-100 cursor-pointer border ${condition === item.val ? `border-2 border-${item.color} bg-${item.color} bg-opacity-10 shadow-sm` : 'border-light bg-light'}`}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <i className={`bi ${item.icon} text-${item.color} fs-4 mb-1`}></i>
                            <div className="fw-bold small text-dark">{item.label}</div>
                            <span className="text-muted" style={{ fontSize: '0.65rem' }}>{item.desc}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mb-3">
                <label className="form-label text-muted small fw-semibold">Condition Description / Remarks</label>
                <textarea 
                    className="form-control bg-light"
                    rows="2"
                    value={conditionRemarks}
                    onChange={(e) => setConditionRemarks(e.target.value)}
                    placeholder={condition === 'INTACT' ? 'Optional remarks (e.g. good condition)' : 'Describe specific damage, torn edges, or tampering details...'}
                ></textarea>
            </div>

            <div className="mb-3">
                <label className="form-label text-muted small fw-semibold">
                    Upload Parcel Photograph {condition !== 'INTACT' && <span className="text-danger">(Recommended for evidence)</span>}
                </label>
                <input 
                    type="file" 
                    className="form-control bg-light" 
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleConditionPhotoChange}
                />
                {conditionPhotoPreview && (
                    <div className="mt-2 position-relative d-inline-block">
                        <img src={conditionPhotoPreview} alt="Inspection Preview" className="img-thumbnail" style={{ maxHeight: '130px', maxWidth: '100%' }} />
                        <button 
                            type="button" 
                            className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1"
                            onClick={() => { setConditionPhoto(null); setConditionPhotoPreview(null); }}
                            style={{ lineHeight: 1 }}
                            title="Remove photo"
                        >
                            <i className="bi bi-x"></i>
                        </button>
                    </div>
                )}
                <div className="form-text small">Accepted formats: JPG, JPEG, PNG (Max 5MB).</div>
            </div>

            <div className="form-check bg-light border rounded-3 p-3 ms-0 d-flex align-items-center">
                <input 
                    className="form-check-input ms-2 me-3" 
                    type="checkbox" 
                    id="courierConditionConfirmed" 
                    style={{ width: '1.3em', height: '1.3em' }}
                    checked={courierConfirmed}
                    onChange={(e) => setCourierConfirmed(e.target.checked)}
                />
                <label className="form-check-label text-dark small fw-medium" htmlFor="courierConditionConfirmed">
                    Courier acknowledges and confirms parcel condition at gatehouse
                </label>
            </div>
        </div>
    );

    const renderReceiverAndLocationSection = () => {
        const eligibleHouseholdMembers = authorizedReceivers.filter(r => !r.is_primary);
        const isDirectDisabled = activePolicy && (!activePolicy.allow_direct_to_flat || activePolicy.delivery_mode === 'GATEHOUSE_ONLY');
        const isHouseholdDisabled = (
            eligibleHouseholdMembers.length === 0 ||
            (activePolicy && (activePolicy.require_resident_presence || !activePolicy.allow_household_receiver))
        );

        return (
            <div className="mb-4 pt-3 border-top">
                {renderPolicyBanner()}

                <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="text-uppercase fw-bold text-primary mb-0" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                        Delivery Receiver & Handover Location
                    </h6>
                    <span className="badge bg-light text-secondary border">Authorized Receivers</span>
                </div>

                {/* Receiver selection */}
                <div className="mb-3">
                    <label className="form-label text-dark small fw-semibold">Delivery Handed To</label>
                    <div className="row g-2">
                        <div className="col-12 col-sm-6">
                            <div 
                                onClick={() => { setReceiverType('PRIMARY_RESIDENT'); setHouseholdMemberId(''); }}
                                className={`card p-3 h-100 cursor-pointer border ${receiverType === 'PRIMARY_RESIDENT' ? 'border-2 border-primary bg-primary bg-opacity-10' : 'border-light bg-light'}`}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <input 
                                        type="radio" 
                                        name="receiver_type" 
                                        checked={receiverType === 'PRIMARY_RESIDENT'} 
                                        onChange={() => { setReceiverType('PRIMARY_RESIDENT'); setHouseholdMemberId(''); }}
                                        className="form-check-input mt-0"
                                    />
                                    <div>
                                        <div className="fw-bold small text-dark">Primary Resident</div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Default flat owner/resident</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6">
                            <div 
                                onClick={() => {
                                    if (!isHouseholdDisabled) {
                                        setReceiverType('HOUSEHOLD_MEMBER');
                                        if (!householdMemberId) setHouseholdMemberId(eligibleHouseholdMembers[0].id);
                                    }
                                }}
                                className={`card p-3 h-100 border ${receiverType === 'HOUSEHOLD_MEMBER' ? 'border-2 border-info bg-info bg-opacity-10' : 'border-light bg-light'} ${isHouseholdDisabled ? 'opacity-50' : 'cursor-pointer'}`}
                                style={{ cursor: isHouseholdDisabled ? 'not-allowed' : 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <input 
                                        type="radio" 
                                        name="receiver_type" 
                                        checked={receiverType === 'HOUSEHOLD_MEMBER'} 
                                        disabled={isHouseholdDisabled}
                                        onChange={() => {
                                            if (!isHouseholdDisabled) {
                                                setReceiverType('HOUSEHOLD_MEMBER');
                                                if (!householdMemberId) setHouseholdMemberId(eligibleHouseholdMembers[0].id);
                                            }
                                        }}
                                        className="form-check-input mt-0"
                                    />
                                    <div>
                                        <div className="fw-bold small text-dark">
                                            Authorized Household Member
                                            {eligibleHouseholdMembers.length > 0 && !isHouseholdDisabled && (
                                                <span className="badge bg-info text-white ms-2" style={{ fontSize: '0.65rem' }}>
                                                    {eligibleHouseholdMembers.length} Available
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                            {activePolicy && activePolicy.require_resident_presence ? (
                                                <span className="text-danger fw-semibold">Disabled by Policy (Resident Presence Mandatory)</span>
                                            ) : (activePolicy && !activePolicy.allow_household_receiver ? (
                                                <span className="text-danger fw-semibold">Disabled by Policy (No Alternate Receivers)</span>
                                            ) : (eligibleHouseholdMembers.length > 0 
                                                ? 'Wife, husband, or authorized family'
                                                : `No members authorized for ${formData.delivery_type === 'FOOD' ? 'food' : 'parcels'}`))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {receiverType === 'HOUSEHOLD_MEMBER' && eligibleHouseholdMembers.length > 0 && (
                        <div className="mt-2 p-3 bg-white border border-info rounded-3">
                            <label className="form-label text-muted small fw-semibold">Select Household Member</label>
                            <select 
                                className="form-select bg-light"
                                value={householdMemberId}
                                onChange={(e) => setHouseholdMemberId(e.target.value)}
                                required={receiverType === 'HOUSEHOLD_MEMBER'}
                            >
                                {eligibleHouseholdMembers.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name} ({m.relationship_display}) - Tel: {m.mobile_number}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Delivery Location Selection */}
                <div className="mb-3">
                    <label className="form-label text-dark small fw-semibold">Delivery Location Policy</label>
                    <div className="row g-2">
                        <div className="col-12 col-sm-6">
                            <div 
                                onClick={() => setDeliveryLocation('GATEHOUSE')}
                                className={`card p-3 h-100 cursor-pointer border ${deliveryLocation === 'GATEHOUSE' ? 'border-2 border-primary bg-primary bg-opacity-10' : 'border-light bg-light'}`}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <input 
                                        type="radio" 
                                        name="delivery_location" 
                                        checked={deliveryLocation === 'GATEHOUSE'} 
                                        onChange={() => setDeliveryLocation('GATEHOUSE')}
                                        className="form-check-input mt-0"
                                    />
                                    <div>
                                        <div className="fw-bold small text-dark"><i className="bi bi-building me-1"></i> Received at Gatehouse</div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>Store on shelf, resident collects with PIN / QR</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6">
                            <div 
                                onClick={() => {
                                    if (!isDirectDisabled) {
                                        setDeliveryLocation('DIRECT_TO_FLAT');
                                    }
                                }}
                                className={`card p-3 h-100 border ${deliveryLocation === 'DIRECT_TO_FLAT' ? 'border-2 border-success bg-success bg-opacity-10' : 'border-light bg-light'} ${isDirectDisabled ? 'opacity-50' : 'cursor-pointer'}`}
                                style={{ cursor: isDirectDisabled ? 'not-allowed' : 'pointer' }}
                            >
                                <div className="d-flex align-items-center gap-2">
                                    <input 
                                        type="radio" 
                                        name="delivery_location" 
                                        checked={deliveryLocation === 'DIRECT_TO_FLAT'} 
                                        disabled={isDirectDisabled}
                                        onChange={() => {
                                            if (!isDirectDisabled) setDeliveryLocation('DIRECT_TO_FLAT');
                                        }}
                                        className="form-check-input mt-0"
                                    />
                                    <div>
                                        <div className="fw-bold small text-dark"><i className="bi bi-door-closed-fill me-1"></i> Direct-to-Flat Handover</div>
                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                            {isDirectDisabled ? (
                                                <span className="text-danger fw-semibold">Disabled by Community Policy (Gatehouse Only)</span>
                                            ) : (
                                                'Handed directly to flat / doorstep (no shelf stored)'
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {deliveryLocation === 'DIRECT_TO_FLAT' && (
                        <div className="mt-3 p-3 bg-white border border-success rounded-3">
                            <div className="alert alert-success py-2 small mb-3 border-0 d-flex align-items-center gap-2">
                                <i className="bi bi-info-circle-fill fs-5"></i>
                                <span>Direct delivery to flat selected. Gatehouse shelf storage is bypassed. Record receiver verification below.</span>
                            </div>

                            <div className="row g-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label text-muted small fw-semibold">Doorstep Verification Method <span className="text-danger">*</span></label>
                                    <select
                                        className="form-select bg-light"
                                        value={directVerificationMethod}
                                        onChange={(e) => setDirectVerificationMethod(e.target.value)}
                                        required={deliveryLocation === 'DIRECT_TO_FLAT'}
                                    >
                                        <option value="DOORSTEP_VERIFICATION">Doorstep Physical Verification</option>
                                        <option value="RESIDENT_SIGNATURE">Resident Signature / In-Person Confirmation</option>
                                        <option value="DOORSTEP_DROP_PHOTO">Doorstep Drop-off with Photo</option>
                                        <option value="PHONE_CONFIRMATION">Phone Call Confirmation with Resident</option>
                                    </select>
                                </div>

                                <div className="col-12 col-md-6">
                                    <label className="form-label text-muted small fw-semibold">Upload Handover Photo (Optional)</label>
                                    <input 
                                        type="file" 
                                        className="form-control bg-light" 
                                        accept="image/jpeg,image/png,image/jpg" 
                                        onChange={handleDirectPhotoChange} 
                                    />
                                    {directPhotoPreview && (
                                        <div className="mt-2 position-relative d-inline-block">
                                            <img src={directPhotoPreview} alt="Direct Handover Preview" className="img-thumbnail" style={{ maxHeight: '100px' }} />
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1"
                                                onClick={() => { setDirectPhoto(null); setDirectPhotoPreview(null); }}
                                                style={{ lineHeight: 1 }}
                                            >
                                                <i className="bi bi-x"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {renderHighValueAndExtraVerificationSection()}
            </div>
        );
    };

    const renderCourierVisitSelector = () => (
        <div className="mb-3 pt-3 border-top">
            <label className="form-label text-dark small fw-semibold d-flex justify-content-between align-items-center mb-1">
                <span><i className="bi bi-truck me-1 text-primary"></i> Courier Visit Link (Optional)</span>
                <Link to="/guard/couriers" className="text-decoration-none small" style={{ fontSize: '0.75rem' }}>
                    Courier Log <i className="bi bi-arrow-right"></i>
                </Link>
            </label>
            <select 
                className="form-select bg-light"
                value={courierVisitId}
                onChange={(e) => {
                    const val = e.target.value;
                    setCourierVisitId(val);
                    if (val) {
                        const matchVisit = activeCourierVisits.find(v => v.id.toString() === val.toString());
                        if (matchVisit && matchVisit.carrier) {
                            setFormData(prev => ({ ...prev, carrier: matchVisit.carrier }));
                        }
                    }
                }}
            >
                <option value="">-- No Courier Visit Linked --</option>
                {activeCourierVisits.map(v => (
                    <option key={v.id} value={v.id}>
                        {v.courier_name} ({v.carrier_display} &bull; Inside {v.duration_display})
                    </option>
                ))}
            </select>
            {activeCourierVisits.length > 0 && courierVisitId && (
                <div className="text-success small mt-1" style={{ fontSize: '0.75rem' }}>
                    <i className="bi bi-check2-circle me-1"></i> Parcel will be linked to courier visit #{courierVisitId}.
                </div>
            )}
            {activeCourierVisits.length === 0 && (
                <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                    No couriers are currently checked in. You can log courier arrivals in the <Link to="/guard/couriers">Courier Log</Link>.
                </div>
            )}
        </div>
    );

    const renderSmartShelfSection = () => {
        if (deliveryLocation !== 'GATEHOUSE') {
            return (
                <div className="alert alert-info py-3 mb-4 d-flex align-items-center gap-2">
                    <i className="bi bi-door-closed-fill fs-4 text-info"></i>
                    <div>
                        <div className="fw-bold">Direct Handover to Flat</div>
                        <div className="small text-muted">Parcel is handed directly to the flat resident/authorized member. No storage shelf required.</div>
                    </div>
                </div>
            );
        }

        const selectedShelfObj = shelves.find(s => s.id.toString() === formData.shelf?.toString());
        const isNearCap = selectedShelfObj?.is_near_capacity || (selectedShelfObj && (selectedShelfObj.occupied / selectedShelfObj.capacity) >= 0.85);

        return (
            <div className="mb-4 pt-3 border-top">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="text-uppercase fw-bold text-primary mb-0" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                        <i className="bi bi-bookshelf me-1"></i> Smart Shelf Allocation & Sizing
                    </h6>
                    <button 
                        type="button" 
                        onClick={() => fetchRecommendation(parcelSize)} 
                        disabled={isRecommending}
                        className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 py-1 px-2"
                        style={{ fontSize: '0.75rem' }}
                    >
                        {isRecommending ? (
                            <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Scanning...</>
                        ) : (
                            <><i className="bi bi-magic"></i> Auto-Recommend</>
                        )}
                    </button>
                </div>
                <p className="text-muted small mb-3">Select the package size category to automatically allocate the most optimal shelf slot.</p>

                {/* Parcel Size Classification */}
                <label className="form-label text-dark small fw-semibold mb-2">Parcel Size Category <span className="text-danger">*</span></label>
                <div className="row g-2 mb-3">
                    {[
                        { id: 'SMALL', label: 'Small', desc: 'Envelopes, pouches, accessories', icon: 'bi-envelope' },
                        { id: 'MEDIUM', label: 'Medium', desc: 'Shoeboxes, apparel, electronics', icon: 'bi-box' },
                        { id: 'LARGE', label: 'Large', desc: 'Appliances, heavy cartons', icon: 'bi-boxes' }
                    ].map(sz => (
                        <div key={sz.id} className="col-4">
                            <div 
                                onClick={() => {
                                    setParcelSize(sz.id);
                                    fetchRecommendation(sz.id);
                                }}
                                className={`p-2 rounded border text-center cursor-pointer transition-all ${parcelSize === sz.id ? 'border-primary bg-primary bg-opacity-10 text-primary shadow-sm' : 'border-light-subtle bg-light text-muted'}`}
                                style={{ cursor: 'pointer', minHeight: '80px' }}
                            >
                                <i className={`bi ${sz.icon} fs-4 d-block mb-1`}></i>
                                <div className="fw-bold small">{sz.label}</div>
                                <div style={{ fontSize: '0.65rem' }} className="d-none d-md-block text-truncate">{sz.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Optional Dimensions & Handling Instructions */}
                <div className="row g-2 mb-3">
                    <div className="col-12 col-md-6">
                        <label className="form-label text-muted small fw-medium">Dimensions (Optional)</label>
                        <input 
                            type="text" 
                            className="form-control form-control-sm bg-light" 
                            placeholder="e.g., 30 x 20 x 15 cm" 
                            value={dimensions} 
                            onChange={(e) => setDimensions(e.target.value)} 
                        />
                    </div>
                    <div className="col-12 col-md-6">
                        <label className="form-label text-muted small fw-medium">Handling Instructions (Optional)</label>
                        <input 
                            type="text" 
                            className="form-control form-control-sm bg-light" 
                            placeholder="e.g., Fragile, Keep Upright" 
                            value={handlingInstructions} 
                            onChange={(e) => setHandlingInstructions(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Smart Shelf Recommendation Card */}
                {recommendedShelf && (
                    <div className="alert alert-light border border-primary border-opacity-50 p-3 mb-3 rounded-3 shadow-sm">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-primary text-white"><i className="bi bi-stars me-1"></i>Best Fit Recommendation</span>
                                <span className="badge bg-secondary">{recommendedShelf.max_parcel_size} Tier</span>
                            </div>
                            <span className="small text-success fw-bold">
                                <i className="bi bi-check-circle-fill me-1"></i>{recommendedShelf.available} / {recommendedShelf.capacity} Available
                            </span>
                        </div>
                        <div className="d-flex align-items-center justify-content-between">
                            <div>
                                <h6 className="fw-bold mb-0 text-dark">{recommendedShelf.name}</h6>
                                <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
                                    Optimal allocation for {parcelSize} parcel.
                                </div>
                            </div>
                            <div className="d-flex gap-2">
                                {formData.shelf?.toString() !== recommendedShelf.id.toString() && (
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData(prev => ({ ...prev, shelf: recommendedShelf.id }))} 
                                        className="btn btn-sm btn-outline-primary py-1 px-3"
                                    >
                                        Select Shelf
                                    </button>
                                )}
                                {!reservationToken && (
                                    <button 
                                        type="button" 
                                        onClick={() => handleReserveSlot(recommendedShelf.id)} 
                                        disabled={isReserving}
                                        className="btn btn-sm btn-primary py-1 px-3"
                                    >
                                        {isReserving ? 'Reserving...' : 'Reserve Slot (15m)'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Temporary Slot Reservation Banner */}
                {reservationToken && (
                    <div className="alert alert-success py-2 px-3 mb-3 d-flex align-items-center justify-content-between shadow-sm">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-shield-lock-fill fs-5 text-success"></i>
                            <div>
                                <div className="fw-bold small text-success">
                                    Slot Reserved on {reservedShelfName}
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                    Token: <code>{reservationToken.slice(-10)}</code> &bull; Safe from concurrent guard allocations
                                </div>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={handleReleaseReservation} 
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            style={{ fontSize: '0.75rem' }}
                        >
                            Release Hold
                        </button>
                    </div>
                )}

                {reservationSuccessMsg && !reservationToken && (
                    <div className="alert alert-info py-2 px-3 small mb-3">
                        <i className="bi bi-info-circle me-1"></i> {reservationSuccessMsg}
                    </div>
                )}

                {/* Manual Shelf Selection Dropdown */}
                <div className="mb-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                        <label className="form-label text-dark small fw-semibold mb-0">
                            Storage Shelf Assignment <span className="text-danger">*</span>
                        </label>
                        {isNearCap && (
                            <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>
                                <i className="bi bi-exclamation-triangle-fill me-1"></i> Near Capacity (&gt;85% full)
                            </span>
                        )}
                    </div>
                    <div className="input-group">
                        <select 
                            className="form-select bg-light form-select-lg fs-6" 
                            name="shelf" 
                            value={formData.shelf} 
                            onChange={handleChange} 
                            required={deliveryLocation === 'GATEHOUSE' && !loading}
                        >
                            <option value="">Select Available Shelf...</option>
                            {shelves.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} [{s.max_parcel_size || 'LARGE'}] &mdash; {s.available} / {s.capacity} available {s.is_near_capacity ? '(Near Capacity)' : ''}
                                </option>
                            ))}
                        </select>
                        {formData.shelf && !reservationToken && (
                            <button 
                                type="button" 
                                onClick={() => handleReserveSlot(formData.shelf)} 
                                disabled={isReserving}
                                className="btn btn-outline-primary"
                                title="Reserve this slot to avoid concurrency collisions"
                            >
                                <i className="bi bi-bookmark-check me-1"></i> Reserve Slot
                            </button>
                        )}
                    </div>
                    {shelves.length === 0 && (
                        <div className="text-danger small mt-2 fw-medium">
                            <i className="bi bi-x-circle me-1"></i> No available active shelves! Please relocate or process pending pickups.
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPolicyBanner = () => {
        if (!activePolicy) return null;

        const isGatehouseOnly = activePolicy.delivery_mode === 'GATEHOUSE_ONLY';
        const isDirect = activePolicy.delivery_mode === 'DIRECT_TO_FLAT';

        return (
            <div className={`p-3 rounded-3 mb-4 border ${isGatehouseOnly ? 'bg-primary bg-opacity-10 border-primary' : (isDirect ? 'bg-success bg-opacity-10 border-success' : 'bg-info bg-opacity-10 border-info')}`}>
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-2">
                    <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-shield-check fs-5 text-primary"></i>
                        <span className="fw-bold text-dark">
                            Active Delivery Policy: {activePolicy.delivery_type_display || currentCategory}
                        </span>
                        {activePolicy.is_tower_override && (
                            <span className="badge bg-warning text-dark">
                                <i className="bi bi-building me-1"></i>Tower Override ({activePolicy.tower_name})
                            </span>
                        )}
                    </div>
                    <span className="badge bg-white text-dark border px-2 py-1 fw-bold">
                        {activePolicy.delivery_mode_display || activePolicy.delivery_mode}
                    </span>
                </div>

                <p className="small text-muted mb-2">
                    {activePolicy.description || 'Community delivery workflow policy active for this parcel category.'}
                </p>

                <div className="d-flex flex-wrap gap-2 small">
                    {isGatehouseOnly && (
                        <span className="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25">
                            <i className="bi bi-box-seam me-1"></i>Gatehouse Intake Required
                        </span>
                    )}
                    {activePolicy.allow_direct_to_flat && (
                        <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25">
                            <i className="bi bi-door-open me-1"></i>Direct Handover Permitted
                        </span>
                    )}
                    {activePolicy.require_resident_presence && (
                        <span className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25">
                            <i className="bi bi-person-fill-exclamation me-1"></i>Resident Presence Mandatory
                        </span>
                    )}
                    {activePolicy.require_extra_verification && (
                        <span className="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25">
                            <i className="bi bi-card-checklist me-1"></i>Identity Verification Required
                        </span>
                    )}
                    {activePolicy.bypass_storage_shelf && (
                        <span className="badge bg-warning bg-opacity-25 text-dark border border-warning border-opacity-25">
                            <i className="bi bi-skip-forward me-1"></i>Storage Shelf Bypassed
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const renderHighValueAndExtraVerificationSection = () => {
        return (
            <div className="mb-4 pt-3 border-top">
                <div className="d-flex align-items-center justify-content-between mb-2">
                    <h6 className="text-uppercase fw-bold text-primary mb-0" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                        High-Value Parcel & Extra Verification
                    </h6>
                    <span className="badge bg-light text-dark border">Security Verification</span>
                </div>

                <div className="row g-3">
                    <div className="col-12 col-md-6">
                        <div className="form-check form-switch p-2 border rounded bg-light">
                            <input
                                className="form-check-input ms-0 me-2"
                                type="checkbox"
                                id="highValueToggle"
                                checked={isHighValue}
                                onChange={(e) => setIsHighValue(e.target.checked)}
                            />
                            <label className="form-check-label fw-bold text-dark small" htmlFor="highValueToggle">
                                Flag as High-Value Parcel
                            </label>
                            <small className="text-muted d-block ps-4">
                                Applies high-security community verification protocols.
                            </small>
                        </div>
                    </div>

                    {isHighValue && (
                        <div className="col-12 col-md-6">
                            <label className="form-label text-dark small fw-semibold">Declared Value (₹)</label>
                            <input
                                type="number"
                                className="form-control form-control-sm bg-light"
                                placeholder="e.g. 15000"
                                value={declaredValue}
                                onChange={(e) => setDeclaredValue(e.target.value)}
                            />
                        </div>
                    )}

                    {(isHighValue || activePolicy?.require_extra_verification) && (
                        <div className="col-12">
                            <div className="p-3 bg-white border border-info rounded-3">
                                <label className="form-label fw-bold small text-dark">
                                    Extra Identity Verification Notes {activePolicy?.require_extra_verification && <span className="text-danger">*</span>}
                                </label>
                                <textarea
                                    rows="2"
                                    className="form-control form-control-sm"
                                    placeholder="Log recipient government ID, contact verification, or serial confirmation..."
                                    value={extraVerificationNotes}
                                    onChange={(e) => setExtraVerificationNotes(e.target.value)}
                                    required={activePolicy?.require_extra_verification}
                                ></textarea>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (successData) {
        if (successData.delivery_location === 'DIRECT_TO_FLAT') {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '520px' }}>
                        <div className="bg-success text-white text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-door-closed-fill fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-1">Direct-to-Flat Handover Recorded</h3>
                            <div className="opacity-75 small text-uppercase tracking-wide">Delivered Directly to Flat</div>
                        </div>
                        
                        <div className="p-4">
                            <div className="row g-3 mb-4">
                                <div className="col-6">
                                    <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Parcel ID</small>
                                    <div className="fw-medium text-dark">{successData.parcel_id}</div>
                                </div>
                                <div className="col-6">
                                    <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Flat Destination</small>
                                    <div className="fw-medium text-dark">{successData.flat_number}</div>
                                </div>
                                <div className="col-6">
                                    <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Actual Receiver</small>
                                    <div className="fw-bold text-primary">{successData.actual_receiver_name || successData.resident_name}</div>
                                </div>
                                <div className="col-6">
                                    <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Verification Method</small>
                                    <span className="badge bg-light text-dark border">{successData.direct_delivery_verification}</span>
                                </div>
                                <div className="col-12 border-top pt-2 mt-2">
                                    <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Status</small>
                                    <span className="badge bg-success px-3 py-1 fs-6">
                                        <i className="bi bi-check-circle-fill me-1"></i> DELIVERED DIRECTLY TO FLAT
                                    </span>
                                </div>
                            </div>

                            <div className="d-flex flex-column gap-2">
                                <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                    Receive Another Parcel
                                </button>
                                <button onClick={() => navigate('/guard')} className="btn btn-light py-2 w-100 fw-medium border">
                                    Return to Guard Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        if (successData.attempted) {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                        <div className="bg-warning text-dark text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-warning mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-arrow-return-left fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-0">Delivery Attempted</h3>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-muted mb-4">The delivery was marked as attempted (returned to courier). No shelf was assigned.</p>
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Return to Intake
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        if (successData.openBoxReturned) {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                        <div className="bg-danger text-white text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-danger mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-x-circle fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-0">Delivery Returned</h3>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-muted mb-4">Open-box delivery was rescheduled and returned with the courier because the resident was unavailable.</p>
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Return to Intake
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        if (successData.openBoxCompleted) {
            return (
                <div className="container-fluid px-0 d-flex justify-content-center">
                    <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                        <div className="bg-success text-white text-center p-5">
                            <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                                <i className="bi bi-check-circle-fill fs-1"></i>
                            </div>
                            <h3 className="fw-bold mb-0">Open-Box Completed</h3>
                        </div>
                        <div className="p-4 text-center">
                            <p className="text-muted mb-4">The delivery was successfully handed over to the resident at the gate. No shelf was occupied.</p>
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Return to Intake
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="container-fluid px-0 d-flex justify-content-center">
                <div className="gv-card w-100 overflow-hidden" style={{ maxWidth: '500px' }}>
                    <div className="bg-success text-white text-center p-5">
                        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-success mb-3" style={{ width: '64px', height: '64px' }}>
                            <i className="bi bi-check-lg fs-1"></i>
                        </div>
                        <h3 className="fw-bold mb-0">Parcel Received & Stored</h3>
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
                                <div className="fw-medium text-dark">{successData.flat_number}</div>
                            </div>
                            <div className="col-6">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Storage</small>
                                <div className="fw-medium text-dark">{successData.shelf_name}</div>
                            </div>
                            {successData.courier_visit_display && (
                                <div className="col-12 border-top pt-2 mt-2">
                                    <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Delivered by Courier</small>
                                    <div className="fw-medium text-primary"><i className="bi bi-truck me-1"></i>{successData.courier_visit_display}</div>
                                </div>
                            )}
                            <div className="col-12 border-top pt-2 mt-2">
                                <small className="text-muted text-uppercase d-block mb-1" style={{ fontSize: '0.7rem' }}>Condition Inspected</small>
                                <span className={`badge ${successData.condition === 'INTACT' ? 'bg-success' : successData.condition === 'OPENED' ? 'bg-warning text-dark' : 'bg-danger'} px-3 py-1 fs-6`}>
                                    <i className={`bi ${successData.condition === 'INTACT' ? 'bi-shield-check' : 'bi-exclamation-triangle-fill'} me-1`}></i>
                                    {successData.condition}
                                </span>
                            </div>
                        </div>

                        <div className="d-flex flex-column gap-2">
                            <button onClick={handleRegisterAnother} className="gv-btn-primary py-2 w-100">
                                Receive Another Parcel
                            </button>
                            <button onClick={() => navigate('/guard/verify')} className="btn btn-light py-2 w-100 fw-medium border">
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
                        <div className="alert alert-danger d-flex align-items-center mb-4 border-0 shadow-sm rounded-3">
                            <i className="bi bi-exclamation-circle-fill fs-5 me-3"></i>
                            {error}
                        </div>
                    )}
                    
                    {step === 'LOOKUP' && (
                        <div>
                            <h6 className="text-uppercase fw-bold text-primary mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Search Expected Delivery</h6>
                            
                            <div className="mb-4">
                                <label className="form-label text-dark small fw-semibold">Enter or Scan Tracking ID</label>
                                <input 
                                    type="text" 
                                    ref={trackingInputRef}
                                    className="form-control form-control-lg bg-light fw-bold" 
                                    value={lookupTracking}
                                    onChange={(e) => setLookupTracking(e.target.value)}
                                    onKeyDown={handleLookupKeyDown}
                                    placeholder="e.g. AMZ123456789" 
                                />
                                {lookupMessage && (
                                    <div className="alert alert-warning mt-3 py-2 px-3 small border-0 d-flex align-items-center">
                                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                        {lookupMessage}
                                    </div>
                                )}
                            </div>
                            
                            <div className="d-flex flex-column gap-3">
                                <button onClick={handleLookup} disabled={loading || !lookupTracking.trim()} className="gv-btn-primary py-3 fs-6 fw-bold">
                                    {loading ? <span className="spinner-border spinner-border-sm"></span> : 'Search Delivery'}
                                </button>
                                
                                <div className="position-relative text-center my-2">
                                    <hr className="text-muted" />
                                    <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small fw-medium">OR</span>
                                </div>
                                
                                <button onClick={() => setStep('MANUAL')} className="btn btn-outline-secondary py-2 fw-medium">
                                    Receive Parcel Manually (No Expected Record)
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'VERIFY' && expectedMatch && (
                        <form onSubmit={handleSubmit}>
                            <div className="d-flex align-items-center justify-content-between mb-4 pb-3 border-bottom">
                                <h5 className="fw-bold text-success mb-0">
                                    <i className="bi bi-check-circle-fill me-2"></i> Expected Delivery Found
                                </h5>
                                <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-sm btn-light">Change</button>
                            </div>

                            <div className="row g-3 mb-4 bg-light p-3 rounded-3 border">
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Resident</small>
                                    <div className="fw-medium text-dark">{expectedMatch.resident_name}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Destination</small>
                                    <div className="fw-medium text-dark">{expectedMatch.flat_display}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Tracking ID</small>
                                    <div className="fw-bold text-dark">{expectedMatch.tracking_id}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Courier</small>
                                    <div className="fw-medium text-dark">{expectedMatch.courier_name}</div>
                                </div>
                                {expectedMatch.order_id && (
                                    <div className="col-sm-6">
                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Order ID</small>
                                        <div className="fw-medium text-dark">{expectedMatch.order_id}</div>
                                    </div>
                                )}
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Payment</small>
                                    <div className={`fw-bold ${expectedMatch.payment_type === 'COD' ? 'text-danger' : 'text-success'}`}>
                                        {expectedMatch.payment_type === 'COD' ? `COD (₹${expectedMatch.cod_amount})` : 'Prepaid'}
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Delivery Type</small>
                                    <div className="fw-medium text-dark">{expectedMatch.delivery_type === 'FOOD' ? 'Food Delivery' : 'Parcel'}</div>
                                </div>
                                <div className="col-sm-6">
                                    <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Expected Date</small>
                                    <div className="fw-medium text-dark">{new Date(expectedMatch.expected_delivery_date).toLocaleDateString('en-GB')}</div>
                                </div>
                            </div>
                            
                            {expectedMatch.note && (
                                <div className="mb-4">
                                    <small className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Resident Note</small>
                                    <div className="p-3 bg-white border border-warning rounded-3 border-opacity-50 text-dark">
                                        <i className="bi bi-chat-left-text text-warning me-2"></i>"{expectedMatch.note}"
                                    </div>
                                </div>
                            )}

                            {expectedMatch.delivery_photo && (
                                <div className="mb-4">
                                    <a href={expectedMatch.delivery_photo} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary w-100 py-2">
                                        <i className="bi bi-image me-2"></i> View Delivery Photo/Screenshot
                                    </a>
                                </div>
                            )}

                            {expectedMatch.payment_type === 'COD' && (
                                <div className="mb-4">
                                    <div className="alert alert-warning border-0 shadow-sm rounded-3 p-4 mb-3">
                                        <div className="d-flex align-items-center mb-2">
                                            <i className="bi bi-exclamation-triangle-fill fs-4 text-warning me-2"></i>
                                            <h5 className="fw-bold text-dark mb-0">COD Parcel - Amount Due to Courier: ₹{expectedMatch.cod_amount}</h5>
                                        </div>
                                        <p className="text-dark small mb-0 ms-4">
                                            This is a Cash on Delivery parcel. Ensure the resident has paid the courier directly before receiving the parcel.
                                        </p>
                                    </div>
                                    <div className="bg-white border rounded-3 p-3 ms-0 mb-3 shadow-sm">
                                        <div className="fw-bold text-dark small mb-2 text-uppercase">Courier Payment Method <span className="text-danger">*</span></div>
                                        <div className="d-flex flex-column gap-2">
                                            <div className="form-check">
                                                <input className="form-check-input" type="radio" name="payment_method" id="pay_cash" value="CASH" checked={formData.payment_method === 'CASH'} onChange={handleChange} />
                                                <label className="form-check-label" htmlFor="pay_cash">
                                                    <i className="bi bi-cash-stack me-1 text-success"></i> Cash (Paid in person to courier)
                                                </label>
                                            </div>
                                            <div className="form-check">
                                                <input className="form-check-input" type="radio" name="payment_method" id="pay_upi" value="UPI" checked={formData.payment_method === 'UPI'} onChange={handleChange} />
                                                <label className="form-check-label" htmlFor="pay_upi">
                                                    <i className="bi bi-phone me-1 text-primary"></i> UPI / Remote Payment Link (Paid by resident from office)
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-check bg-white border rounded-3 p-3 ms-0 d-flex align-items-center shadow-sm">
                                        <input 
                                            className="form-check-input ms-2 me-3" 
                                            type="checkbox" 
                                            id="codConfirmCheck" 
                                            style={{ width: '1.5em', height: '1.5em' }}
                                            checked={codVerified}
                                            onChange={(e) => setCodVerified(e.target.checked)}
                                        />
                                        <label className="form-check-label fw-bold text-dark" htmlFor="codConfirmCheck">
                                            Courier confirms direct payment received from resident (Cash/UPI)
                                        </label>
                                    </div>
                                </div>
                            )}

                            {expectedMatch.is_open_box ? (
                                <div className="mb-4">
                                    <div className="alert alert-danger border-0 shadow-sm rounded-3 p-4 mb-3">
                                        <div className="d-flex align-items-center mb-2">
                                            <i className="bi bi-shield-exclamation fs-3 text-danger me-2"></i>
                                            <h5 className="fw-bold text-dark mb-0">OPEN-BOX DELIVERY DETECTED</h5>
                                        </div>
                                        <p className="text-dark fw-medium mb-0 ms-5">
                                            Guards are not permitted to unbox or store unsealed items on shelves.<br/>
                                            Community policy mandates primary resident presence for open-box content inspection before acceptance.
                                        </p>
                                    </div>

                                    <div className="form-check bg-white border border-danger rounded-3 p-3 ms-0 mb-4 shadow-sm d-flex align-items-center">
                                        <input 
                                            className="form-check-input ms-2 me-3" 
                                            type="checkbox" 
                                            id="openBoxResidentPresentCheck" 
                                            style={{ width: '1.4em', height: '1.4em' }}
                                            checked={residentPresenceConfirmed}
                                            onChange={(e) => setResidentPresenceConfirmed(e.target.checked)}
                                        />
                                        <label className="form-check-label fw-bold text-dark small" htmlFor="openBoxResidentPresentCheck">
                                            Primary resident ({expectedMatch.resident_name}) is physically present at the gatehouse for inspection
                                        </label>
                                    </div>
                                    
                                    <div className="d-flex flex-column gap-3">
                                        <button 
                                            type="button" 
                                            onClick={(e) => handleSubmit(e, 'OPEN_BOX_COMPLETED')}
                                            className="btn btn-success w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2 fw-bold shadow-sm" 
                                            disabled={loading || (activePolicy?.require_resident_presence && !residentPresenceConfirmed)}
                                        >
                                            {loading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : <><i className="bi bi-check-circle-fill"></i> Resident Present - Complete Handover</>}
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={(e) => handleSubmit(e, 'ATTEMPTED')}
                                            className="btn btn-outline-danger w-100 py-3 fw-medium"
                                            disabled={loading}
                                        >
                                            {loading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : 'Resident Unavailable - Record Delivery Attempted'}
                                        </button>
                                        <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-light py-2 fw-medium border mt-2">
                                            Cancel Lookup
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Verify Incoming Delivery</h6>
                                    <p className="text-muted small mb-3">Confirm that the physical parcel matches the expected delivery details above. Assign a storage shelf to complete the receiving process.</p>
                                    
                                    {renderInspectionSection()}
                                    {renderReceiverAndLocationSection()}
                                    {renderCourierVisitSelector()}
                                    {renderSmartShelfSection()}

                                    <div className="d-flex flex-column gap-3">
                                        <div className="d-flex gap-3">
                                            <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-light py-3 px-4 fw-medium border">
                                                Cancel
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={(e) => handleSubmit(e, 'RECEIVE')}
                                                className="gv-btn-primary w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2" 
                                                disabled={loading || (deliveryLocation === 'GATEHOUSE' && !formData.shelf) || (expectedMatch.payment_type === 'COD' && (!codVerified || !['CASH', 'UPI'].includes(formData.payment_method)))}
                                            >
                                                {loading ? (
                                                    <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...</>
                                                ) : (
                                                    <><i className="bi bi-box-seam"></i> {deliveryLocation === 'DIRECT_TO_FLAT' ? 'Confirm Direct Handover' : 'Confirm & Receive Parcel'}</>
                                                )}
                                            </button>
                                        </div>
                                        
                                        {expectedMatch.payment_type === 'COD' && (
                                            <button 
                                                type="button" 
                                                onClick={(e) => handleSubmit(e, 'ATTEMPTED')}
                                                className="btn btn-outline-danger w-100 py-2 fw-medium"
                                                disabled={loading}
                                            >
                                                Mark Delivery Attempted (Resident Unreachable / Unpaid)
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </form>
                    )}

                    {step === 'MANUAL' && (
                        <form onSubmit={handleSubmit}>
                            <div className="d-flex align-items-center justify-content-between mb-4">
                                <h6 className="text-uppercase fw-bold text-secondary mb-0" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Manual Parcel Intake</h6>
                                <button type="button" onClick={() => setStep('LOOKUP')} className="btn btn-sm btn-outline-secondary">Back to Search</button>
                            </div>

                            <div className="row g-3 mb-3">
                                <div className="col-md-12">
                                    <label className="form-label text-muted small fw-semibold">Tracking Number</label>
                                    <input 
                                        type="text" 
                                        className="form-control bg-light" 
                                        name="tracking_number" 
                                        value={formData.tracking_number} 
                                        onChange={handleChange} 
                                        placeholder="Optional" 
                                    />
                                </div>
                                <div className="col-md-12">
                                    <label className="form-label text-muted small fw-semibold mt-2">Carrier / Courier <span className="text-danger">*</span></label>
                                    <select className="form-select bg-light" name="carrier" value={formData.carrier} onChange={handleChange} required>
                                        <option value="">Select Carrier...</option>
                                        {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-12">
                                    <div className="btn-group w-100" role="group">
                                        <input type="radio" className="btn-check" name="delivery_type" id="type_normal" value="NORMAL" checked={formData.delivery_type === 'NORMAL'} onChange={handleChange} />
                                        <label className="btn btn-outline-primary py-2 fw-medium" htmlFor="type_normal">
                                            <i className="bi bi-box me-2"></i>Normal
                                        </label>
                                        
                                        <input type="radio" className="btn-check" name="delivery_type" id="type_food" value="FOOD" checked={formData.delivery_type === 'FOOD'} onChange={handleChange} />
                                        <label className="btn btn-outline-primary py-2 fw-medium" htmlFor="type_food">
                                            <i className="bi bi-cup-straw me-2"></i>Food
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <h6 className="text-uppercase fw-bold text-primary mb-3 pt-2 border-top mt-2" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>Destination Details</h6>
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-semibold">Tower <span className="text-danger">*</span></label>
                                    <select className="form-select bg-light" name="tower" value={formData.tower} onChange={handleChange} required>
                                        <option value="">Select Tower...</option>
                                        {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-semibold">Flat Number <span className="text-danger">*</span></label>
                                    <select className="form-select bg-light" name="flat" value={formData.flat} onChange={handleChange} required disabled={!formData.tower}>
                                        <option value="">Select Flat...</option>
                                        {flats.map(f => <option key={f.id} value={f.id}>{f.number} {f.residents && f.residents.length > 0 ? `(${f.residents[0].user.first_name || f.residents[0].user.username})` : ''}</option>)}
                                    </select>
                                </div>
                            </div>

                            {renderInspectionSection()}
                            {formData.flat && renderReceiverAndLocationSection()}
                            {renderCourierVisitSelector()}
                            {renderSmartShelfSection()}

                            <button type="submit" className="gv-btn-primary w-100 py-3 fs-6 d-flex align-items-center justify-content-center gap-2" disabled={loading || !formData.carrier || !formData.flat || (deliveryLocation === 'GATEHOUSE' && (!formData.shelf || shelves.length === 0))}>
                                {loading ? (
                                    <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...</>
                                ) : (
                                    <><i className="bi bi-box-seam"></i> {deliveryLocation === 'DIRECT_TO_FLAT' ? 'Confirm Direct Handover' : 'Register Parcel Manually'}</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ParcelIntake;
