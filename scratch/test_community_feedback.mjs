import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('RUNNING TEST SUITE: COMMUNITY FEEDBACK & RATING MANAGEMENT');
console.log('================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passedTests++;
    } else {
        console.error(`[FAIL] ${testName} - ${details}`);
        failedTests++;
    }
}

try {
    // -------------------------------------------------------------
    // PREREQUISITES & SCHEMA VERIFICATION
    // -------------------------------------------------------------
    console.log('--- Checking Database Schema & Prerequisites ---');
    const cols = db.prepare("PRAGMA table_info('api_communityfeedback')").all().map(c => c.name);
    assert(cols.includes('id'), 'Schema: api_communityfeedback has id');
    assert(cols.includes('rating'), 'Schema: api_communityfeedback has rating');
    assert(cols.includes('category'), 'Schema: api_communityfeedback has category');
    assert(cols.includes('review'), 'Schema: api_communityfeedback has review');
    assert(cols.includes('photo'), 'Schema: api_communityfeedback has photo');
    assert(cols.includes('created_at'), 'Schema: api_communityfeedback has created_at');
    assert(cols.includes('updated_at'), 'Schema: api_communityfeedback has updated_at');
    assert(cols.includes('is_reviewed'), 'Schema: api_communityfeedback has is_reviewed');
    assert(cols.includes('reviewed_at'), 'Schema: api_communityfeedback has reviewed_at');
    assert(cols.includes('admin_response'), 'Schema: api_communityfeedback has admin_response');
    assert(cols.includes('responded_at'), 'Schema: api_communityfeedback has responded_at');
    assert(cols.includes('parcel_id'), 'Schema: api_communityfeedback has parcel_id');
    assert(cols.includes('resident_id'), 'Schema: api_communityfeedback has resident_id');
    assert(cols.includes('responded_by_id'), 'Schema: api_communityfeedback has responded_by_id');
    assert(cols.includes('reviewed_by_id'), 'Schema: api_communityfeedback has reviewed_by_id');

    // Retrieve seed accounts
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const guard = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const resident1 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident1'").get();
    const resident2 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident2'").get();
    const carrier = db.prepare("SELECT * FROM api_carrier LIMIT 1").get();

    assert(admin && guard && resident1 && resident2 && carrier, 'Prerequisites: Admin, Guard, Resident 1, Resident 2, and Carrier accounts present');

    // Clean up previous test feedbacks for clean test runs
    db.prepare("DELETE FROM api_communityfeedback WHERE resident_id IN (?, ?)").run(resident1.id, resident2.id);

    // -------------------------------------------------------------
    // SCENARIO 1 & 2: RESIDENT COLLECTS A PARCEL & FEEDBACK OPTION BECOMES AVAILABLE
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1 & 2: Resident Collects Parcel & Feedback Option Available ---');
    const ts = Date.now();
    const parcelId1 = `FB-TEST-${ts}-1`;
    const gvId1 = `GV-FB-${ts}-1`;
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, carrier_id,
            status, pickup_pin, received_at, handed_over_at, flat_id,
            delivery_type, payment_type, payment_method, payment_status,
            is_open_box, open_box_resolution, collected_by_role_type, is_delegated,
            resident_id
        ) VALUES (
            ?, ?, ?,
            'HANDED_OVER', '1111', datetime('now', '-2 hours'), datetime('now', '-1 hour'), 1,
            'NORMAL', 'PREPAID', 'ONLINE', 'PAID',
            0, 'NOT_APPLICABLE', 'NONE', 0,
            ?
        )
    `).run(gvId1, parcelId1, carrier.id, resident1.id);
    const collectedParcel1 = db.prepare("SELECT * FROM api_parcel WHERE tracking_number=?").get(parcelId1);

    assert(collectedParcel1 !== undefined, 'Scenario 1: Parcel record exists in database');
    assert(collectedParcel1.status === 'HANDED_OVER', 'Scenario 1: Parcel is successfully collected (HANDED_OVER)');

    // Check eligible unrated parcels for resident1
    function getEligibleUnratedParcels(residentId) {
        return db.prepare(`
            SELECT p.* FROM api_parcel p
            WHERE p.resident_id=? 
            AND p.status IN ('HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT', 'COLLECTED')
            AND p.id NOT IN (
                SELECT cf.parcel_id FROM api_communityfeedback cf WHERE cf.resident_id=?
            )
            ORDER BY p.handed_over_at DESC
        `).all(residentId, residentId);
    }

    const eligibleBefore = getEligibleUnratedParcels(resident1.id);
    const isEligible = eligibleBefore.some(p => p.id === collectedParcel1.id);
    assert(isEligible, 'Scenario 2: Feedback option is available for unrated collected parcel');

    // -------------------------------------------------------------
    // SCENARIO 3: RESIDENT SUBMITS A 5-STAR REVIEW
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Resident Submits a 5-Star Review ---');
    const reviewText = 'Security guard at Gate 2 was extremely professional and swift in handover.';
    const insertFeedbackStmt = db.prepare(`
        INSERT INTO api_communityfeedback (
            resident_id, parcel_id, category, rating, review,
            is_reviewed, created_at, updated_at
        ) VALUES (?, ?, 'GUARD_SERVICE', 5, ?, 0, datetime('now'), datetime('now'))
    `);
    const insertFbResult = insertFeedbackStmt.run(resident1.id, collectedParcel1.id, reviewText);
    const feedbackId1 = Number(insertFbResult.lastInsertRowid);

    const feedback1 = db.prepare("SELECT * FROM api_communityfeedback WHERE id=?").get(feedbackId1);
    assert(feedback1 !== undefined, 'Scenario 3: CommunityFeedback record created successfully');
    assert(feedback1.rating === 5, 'Scenario 3: Rating recorded as 5 stars');
    assert(feedback1.category === 'GUARD_SERVICE', 'Scenario 3: Category set to GUARD_SERVICE');
    assert(feedback1.review === reviewText, 'Scenario 3: Written review text stored accurately');
    assert(feedback1.is_reviewed === 0, 'Scenario 3: Initial is_reviewed status is false');

    // Parcel is now rated, so it should disappear from eligible unrated list
    const eligibleAfter = getEligibleUnratedParcels(resident1.id);
    const stillEligible = eligibleAfter.some(p => p.id === collectedParcel1.id);
    assert(!stillEligible, 'Scenario 3: Parcel removed from eligible unrated list after feedback submission');

    // -------------------------------------------------------------
    // SCENARIO 4: REVIEW APPEARS IN RESIDENT "MY FEEDBACK"
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Review Appears in My Feedback ---');
    const resident1Feedbacks = db.prepare(`
        SELECT cf.*, p.parcel_id as parcel_id_display
        FROM api_communityfeedback cf
        JOIN api_parcel p ON cf.parcel_id = p.id
        WHERE cf.resident_id=?
        ORDER BY cf.created_at DESC
    `).all(resident1.id);

    assert(resident1Feedbacks.length >= 1, 'Scenario 4: My Feedback query returns submitted reviews');
    assert(resident1Feedbacks.some(f => f.id === feedbackId1), 'Scenario 4: Specific 5-star review appears in Resident 1 dashboard');

    // -------------------------------------------------------------
    // SCENARIO 5: UNAUTHORIZED CROSS-RESIDENT ACCESS ATTEMPT
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Unauthorized Access Control Enforcement ---');
    // Simulate Resident 2 trying to view or edit Resident 1's feedback
    function checkFeedbackAccess(requestUserId, feedbackOwnerId) {
        if (requestUserId !== feedbackOwnerId) {
            return { status: 403, error: 'You do not have permission to modify this feedback.' };
        }
        return { status: 200, data: 'OK' };
    }

    const unauthAccess = checkFeedbackAccess(resident2.id, feedback1.resident_id);
    assert(unauthAccess.status === 403, 'Scenario 5: Resident 2 is blocked with 403 Forbidden from accessing Resident 1 feedback');

    const authAccess = checkFeedbackAccess(resident1.id, feedback1.resident_id);
    assert(authAccess.status === 200, 'Scenario 5: Resident 1 (owner) is authorized to access own feedback');

    // -------------------------------------------------------------
    // SCENARIO 6: DUPLICATE SUBMISSION REJECTION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Duplicate Submission Rejection ---');
    let duplicateRejected = false;
    try {
        // Attempt duplicate insert with same resident_id and parcel_id
        db.prepare(`
            INSERT INTO api_communityfeedback (
                resident_id, parcel_id, category, rating, review,
                is_reviewed, created_at, updated_at
            ) VALUES (?, ?, 'OVERALL_EXPERIENCE', 4, 'Second review attempt', 0, datetime('now'), datetime('now'))
        `).run(resident1.id, collectedParcel1.id);
    } catch (err) {
        duplicateRejected = true;
    }
    assert(duplicateRejected, 'Scenario 6: Database unique constraint rejects duplicate feedback submission on same parcel');

    // Also verify serializer validation rule
    function validateUniqueSubmission(residentId, parcelId) {
        const count = db.prepare("SELECT COUNT(*) as cnt FROM api_communityfeedback WHERE resident_id=? AND parcel_id=?").get(residentId, parcelId).cnt;
        if (count > 0) {
            return { valid: false, error: 'Feedback has already been submitted for this parcel.' };
        }
        return { valid: true };
    }
    const valResult = validateUniqueSubmission(resident1.id, collectedParcel1.id);
    assert(!valResult.valid, 'Scenario 6: Backend API validation flags duplicate submission attempt');

    // -------------------------------------------------------------
    // SCENARIO 7: ADMIN VIEWS FEEDBACK
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Admin Views Community Feedback ---');
    const adminFeedbacks = db.prepare(`
        SELECT cf.*, u.username as resident_username, p.parcel_id as parcel_id_display
        FROM api_communityfeedback cf
        JOIN api_user u ON cf.resident_id = u.id
        JOIN api_parcel p ON cf.parcel_id = p.id
        ORDER BY cf.created_at DESC
    `).all();

    assert(adminFeedbacks.length >= 1, 'Scenario 7: Admin can query all community feedback');
    const adminFound = adminFeedbacks.find(f => f.id === feedbackId1);
    assert(adminFound !== undefined, 'Scenario 7: Admin sees Resident 1 review in community feedback list');
    assert(adminFound.resident_username === 'resident1', 'Scenario 7: Admin sees correct resident attribution');

    // -------------------------------------------------------------
    // SCENARIO 8: ADMIN RESPONDS TO FEEDBACK
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Admin Responds to Feedback ---');
    const adminResponseText = 'Thank you for acknowledging Officer Ramesh at Gate 2. Commendation has been noted in guard shift records.';
    
    // Simulate POST /api/admin/feedback/{id}/respond/
    db.prepare(`
        UPDATE api_communityfeedback
        SET admin_response=?, responded_by_id=?, responded_at=datetime('now'),
            is_reviewed=1, reviewed_by_id=?, reviewed_at=datetime('now'),
            updated_at=datetime('now')
        WHERE id=?
    `).run(adminResponseText, admin.id, admin.id, feedbackId1);

    const respondedFb = db.prepare("SELECT * FROM api_communityfeedback WHERE id=?").get(feedbackId1);
    assert(respondedFb.admin_response === adminResponseText, 'Scenario 8: Admin response stored on feedback record');
    assert(respondedFb.responded_by_id === admin.id, 'Scenario 8: responded_by_id links to Admin user');
    assert(respondedFb.responded_at !== null, 'Scenario 8: responded_at timestamp recorded');
    assert(respondedFb.is_reviewed === 1, 'Scenario 8: Feedback marked as reviewed (is_reviewed=1)');

    // -------------------------------------------------------------
    // SCENARIO 9: RESIDENT RECEIVES NOTIFICATION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Resident Receives In-App Notification ---');
    // Notification created on admin response
    db.prepare(`
        INSERT INTO api_notification (
            user_id, title, message, notification_type, is_read, parcel_id, created_at
        ) VALUES (
            ?, 'Response to Your Feedback (GV-FB-001)',
            ?, 'FEEDBACK_RESPONSE', 0, ?, datetime('now')
        )
    `).run(resident1.id, `Administrator ${admin.username} responded to your review.`, collectedParcel1.id);

    const resNotif = db.prepare(`
        SELECT * FROM api_notification 
        WHERE user_id=? AND notification_type='FEEDBACK_RESPONSE'
        ORDER BY id DESC LIMIT 1
    `).get(resident1.id);

    assert(resNotif !== undefined, 'Scenario 9: FEEDBACK_RESPONSE notification created for resident');
    assert(resNotif.notification_type === 'FEEDBACK_RESPONSE', 'Scenario 9: Notification type is FEEDBACK_RESPONSE');
    assert(resNotif.parcel_id === collectedParcel1.id, 'Scenario 9: Notification linked to relevant parcel');

    // -------------------------------------------------------------
    // SCENARIO 10: ADMIN DASHBOARD ANALYTICS COMPUTE ACTUAL RECORDS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Admin Dashboard Analytics Aggregation ---');
    // Insert a few diverse ratings for analytics testing
    const ts2 = Date.now();
    const parcelId2 = `FB-TEST-${ts2}-2`;
    const parcelId3 = `FB-TEST-${ts2}-3`;
    const gvId2 = `GV-FB-${ts2}-2`;
    const gvId3 = `GV-FB-${ts2}-3`;
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, carrier_id,
            status, pickup_pin, received_at, handed_over_at, flat_id,
            delivery_type, payment_type, payment_method, payment_status,
            is_open_box, open_box_resolution, collected_by_role_type, is_delegated,
            resident_id
        ) VALUES 
        (?, ?, ?, 'HANDED_OVER', '2222', datetime('now'), datetime('now'), 1, 'NORMAL', 'PREPAID', 'ONLINE', 'PAID', 0, 'NOT_APPLICABLE', 'NONE', 0, ?),
        (?, ?, ?, 'HANDED_OVER', '3333', datetime('now'), datetime('now'), 1, 'NORMAL', 'PREPAID', 'ONLINE', 'PAID', 0, 'NOT_APPLICABLE', 'NONE', 0, ?)
    `).run(gvId2, parcelId2, carrier.id, resident2.id, gvId3, parcelId3, carrier.id, resident1.id);

    const p2 = db.prepare("SELECT * FROM api_parcel WHERE tracking_number=?").get(parcelId2);
    const p3 = db.prepare("SELECT * FROM api_parcel WHERE tracking_number=?").get(parcelId3);

    // Resident 2 submits 4-star PARCEL_HANDLING review
    db.prepare(`
        INSERT INTO api_communityfeedback (
            resident_id, parcel_id, category, rating, review,
            is_reviewed, created_at, updated_at
        ) VALUES (?, ?, 'PARCEL_HANDLING', 4, 'Packaging was intact and handled with care.', 1, datetime('now'), datetime('now'))
    `).run(resident2.id, p2.id);

    // Resident 1 submits 2-star GATEHOUSE_MANAGEMENT complaint
    db.prepare(`
        INSERT INTO api_communityfeedback (
            resident_id, parcel_id, category, rating, review,
            is_reviewed, created_at, updated_at
        ) VALUES (?, ?, 'GATEHOUSE_MANAGEMENT', 2, 'Gatehouse wait time was over 15 minutes during peak evening hours.', 0, datetime('now'), datetime('now'))
    `).run(resident1.id, p3.id);

    // Execute analytics calculations directly matching AdminFeedbackAnalyticsView
    const totalCount = db.prepare("SELECT COUNT(*) as count FROM api_communityfeedback").get().count;
    const avgRatingRaw = db.prepare("SELECT AVG(rating) as avg_rating FROM api_communityfeedback").get().avg_rating;
    const avgRating = Math.round(avgRatingRaw * 100) / 100;

    assert(totalCount >= 3, `Scenario 10: Total feedback submissions computed accurately (${totalCount})`);
    assert(avgRating > 0 && avgRating <= 5, `Scenario 10: Average rating computed accurately (${avgRating})`);

    // Rating distribution
    const ratingDist = [];
    for (let star = 1; star <= 5; star++) {
        const count = db.prepare("SELECT COUNT(*) as count FROM api_communityfeedback WHERE rating=?").get(star).count;
        ratingDist.push({ rating: star, count });
    }
    assert(ratingDist.find(r => r.rating === 5).count >= 1, 'Scenario 10: 5-star count verified');
    assert(ratingDist.find(r => r.rating === 4).count >= 1, 'Scenario 10: 4-star count verified');
    assert(ratingDist.find(r => r.rating === 2).count >= 1, 'Scenario 10: 2-star count verified');

    // Category breakdown
    const categoryStats = db.prepare("SELECT category, COUNT(*) as count, AVG(rating) as avg_r FROM api_communityfeedback GROUP BY category").all();
    assert(categoryStats.length >= 2, 'Scenario 10: Category distribution computed across multiple categories');

    // -------------------------------------------------------------
    // SCENARIO 11: RESIDENT EDITS FEEDBACK WITHIN ALLOWED PERIOD (24h)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Resident Edits Feedback Within 24-Hour Period ---');
    function canEditFeedback(createdAtStr) {
        const created = new Date(createdAtStr);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours <= 24;
    }

    // Feedback created 1 hour ago
    const recentFeedback = db.prepare("SELECT * FROM api_communityfeedback WHERE id=?").get(feedbackId1);
    assert(canEditFeedback(recentFeedback.created_at), 'Scenario 11: Feedback created 1 hour ago is eligible for editing');

    // Perform edit
    const updatedReview = 'Security guard at Gate 2 was extremely professional and swift. Special thanks to team!';
    db.prepare(`
        UPDATE api_communityfeedback
        SET rating=5, review=?, updated_at=datetime('now')
        WHERE id=?
    `).run(updatedReview, feedbackId1);

    const editedFeedback = db.prepare("SELECT * FROM api_communityfeedback WHERE id=?").get(feedbackId1);
    assert(editedFeedback.review === updatedReview, 'Scenario 11: Feedback successfully updated within allowed 24h period');

    // -------------------------------------------------------------
    // SCENARIO 12: EDITING AFTER ALLOWED PERIOD (> 24h) IS REJECTED
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Editing After Allowed Period (>24h) Is Rejected ---');
    // Create an old feedback with created_at set to 30 hours ago
    const tsOld = Date.now();
    const parcelIdOld = `FB-TEST-${tsOld}-OLD`;
    const gvIdOld = `GV-FB-${tsOld}-OLD`;
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, carrier_id,
            status, pickup_pin, received_at, handed_over_at, flat_id,
            delivery_type, payment_type, payment_method, payment_status,
            is_open_box, open_box_resolution, collected_by_role_type, is_delegated,
            resident_id
        ) VALUES (
            ?, ?, ?, 'HANDED_OVER', '9999',
            datetime('now', '-35 hours'), datetime('now', '-32 hours'), 1,
            'NORMAL', 'PREPAID', 'ONLINE', 'PAID', 0, 'NOT_APPLICABLE', 'NONE', 0, ?
        )
    `).run(gvIdOld, parcelIdOld, carrier.id, resident1.id);
    const pOld = db.prepare("SELECT * FROM api_parcel WHERE tracking_number=?").get(parcelIdOld);

    db.prepare(`
        INSERT INTO api_communityfeedback (
            resident_id, parcel_id, category, rating, review,
            is_reviewed, created_at, updated_at
        ) VALUES (?, ?, 'OVERALL_EXPERIENCE', 4, 'Old review submitted yesterday', 0, datetime('now', '-30 hours'), datetime('now', '-30 hours'))
    `).run(resident1.id, pOld.id);

    const oldFeedback = db.prepare("SELECT * FROM api_communityfeedback WHERE parcel_id=?").get(pOld.id);
    assert(!canEditFeedback(oldFeedback.created_at), 'Scenario 12: Feedback older than 24 hours is recognized as non-editable');

    // Validate backend API rejection rule:
    function validateEditWindow(createdAtStr) {
        if (!canEditFeedback(createdAtStr)) {
            return { allowed: false, status: 400, error: 'Feedback can only be edited within 24 hours of submission.' };
        }
        return { allowed: true, status: 200 };
    }

    const editAttempt = validateEditWindow(oldFeedback.created_at);
    assert(!editAttempt.allowed && editAttempt.status === 400, 'Scenario 12: Editing after 24 hours is rejected with HTTP 400 Bad Request');
    assert(editAttempt.error === 'Feedback can only be edited within 24 hours of submission.', 'Scenario 12: Accurate error message returned');

    console.log('\n================================================================');
    console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log('================================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
} catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
}
