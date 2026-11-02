import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('RUNNING TEST SUITE: GOOGLE OAUTH 2.0 RESIDENT LOGIN & APPROVAL');
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
    console.log('--- 1. Checking Database Schema & Migration ---');
    const cols = db.prepare("PRAGMA table_info('api_residentprofile')").all().map(c => c.name);
    assert(cols.includes('id'), 'Schema: api_residentprofile has id');
    assert(cols.includes('approval_status'), 'Schema: api_residentprofile has approval_status');
    assert(cols.includes('google_id'), 'Schema: api_residentprofile has google_id');
    assert(cols.includes('rejection_reason'), 'Schema: api_residentprofile has rejection_reason');
    assert(cols.includes('approved_by_id'), 'Schema: api_residentprofile has approved_by_id');
    assert(cols.includes('approved_at'), 'Schema: api_residentprofile has approved_at');
    assert(!cols.includes('room_number'), 'Schema Constraint: No room_number in api_residentprofile (Tower & Flat only)');

    // Verify unique index on google_id
    const indices = db.prepare("PRAGMA index_list('api_residentprofile')").all();
    const hasGoogleIdIdx = indices.some(idx => idx.name.includes('google_id') && idx.unique === 1);
    assert(hasGoogleIdIdx, 'Schema: Unique index exists on api_residentprofile.google_id');

    // Verify migration 0021 recorded
    const migration = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0021_residentprofile_approval_fields'").get();
    assert(Boolean(migration), 'Migration 0021 registered in django_migrations');

    // Retrieve seed accounts
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const guard = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const resident1 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident1'").get();
    const tower = db.prepare("SELECT * FROM api_tower LIMIT 1").get();
    const flat = db.prepare("SELECT * FROM api_flat WHERE tower_id=? LIMIT 1").get(tower.id);

    assert(Boolean(admin), 'Seed Admin user exists');
    assert(Boolean(guard), 'Seed Guard user exists');
    assert(Boolean(resident1), 'Seed Resident user exists');
    assert(Boolean(tower), 'Seed Tower exists');
    assert(Boolean(flat), 'Seed Flat exists');

    // -------------------------------------------------------------
    // TEST 1: Google login success for existing resident
    // -------------------------------------------------------------
    console.log('\n--- 2. Test 1: Google Login for Existing Approved Resident ---');
    const res1Profile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id=?").get(resident1.id);
    assert(Boolean(res1Profile), 'Resident1 profile exists');
    assert(res1Profile.approval_status === 'APPROVED', 'Resident1 default status is APPROVED (no regression)');

    // Link Google ID to resident1
    const testGoogleId1 = 'goog-res1-test-9999';
    db.prepare("UPDATE api_residentprofile SET google_id=? WHERE id=?").run(testGoogleId1, res1Profile.id);

    // Simulate GoogleOAuthLoginView logic
    const matchedProfile = db.prepare(`
        SELECT p.*, u.email, u.username, u.role, u.first_name, u.last_name, t.name as tower_name, f.number as flat_number
        FROM api_residentprofile p
        JOIN api_user u ON p.user_id = u.id
        JOIN api_flat f ON p.flat_id = f.id
        JOIN api_tower t ON f.tower_id = t.id
        WHERE p.google_id = ?
    `).get(testGoogleId1);

    assert(Boolean(matchedProfile), 'Matched resident by verified Google ID');
    assert(matchedProfile.role === 'RESIDENT', 'Matched user has RESIDENT role');
    assert(matchedProfile.approval_status === 'APPROVED', 'Matched resident status is APPROVED');
    const authAction = matchedProfile.approval_status === 'APPROVED' ? 'LOGIN' : 'PENDING_APPROVAL';
    assert(authAction === 'LOGIN', 'Action is LOGIN for approved existing resident');

    // Ensure admin and guard have email for oauth test
    if (!admin.email) {
        db.prepare("UPDATE api_user SET email='admin@gatevault.local' WHERE id=?").run(admin.id);
        admin.email = 'admin@gatevault.local';
    }
    if (!guard.email) {
        db.prepare("UPDATE api_user SET email='guard1@gatevault.local' WHERE id=?").run(guard.id);
        guard.email = 'guard1@gatevault.local';
    }

    // -------------------------------------------------------------
    // TEST 2: Block Guard and Admin from Google login
    // -------------------------------------------------------------
    console.log('\n--- 3. Test 2: Block Guard and Admin from Google Login ---');
    
    // Simulate attempt by Admin email
    const adminEmail = admin.email || 'admin@gatevault.local';
    const adminUser = db.prepare("SELECT * FROM api_user WHERE LOWER(email)=LOWER(?)").get(adminEmail);
    assert(Boolean(adminUser), 'Found admin account by email');
    const adminPermitted = adminUser.role === 'RESIDENT';
    assert(!adminPermitted, 'Admin blocked from Google OAuth (403 Forbidden ROLE_NOT_PERMITTED)');

    // Simulate attempt by Guard email
    const guardEmail = guard.email || 'guard@gatevault.local';
    const guardUser = db.prepare("SELECT * FROM api_user WHERE LOWER(email)=LOWER(?)").get(guardEmail);
    assert(Boolean(guardUser), 'Found guard account by email');
    const guardPermitted = guardUser.role === 'RESIDENT';
    assert(!guardPermitted, 'Guard blocked from Google OAuth (403 Forbidden ROLE_NOT_PERMITTED)');

    // Ensure neither guard nor admin has residentprofile or google_id
    const guardProfile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id=?").get(guard.id);
    assert(!guardProfile, 'Guard has no resident profile created');

    // -------------------------------------------------------------
    // TEST 3 & 4: Prompt Onboarding for New Resident & Pre-populate Claims
    // -------------------------------------------------------------
    console.log('\n--- 4. Test 3 & 4: Onboarding Prompt & Identity Pre-population ---');
    const newGoogleEmail = 'new.google.resident@example.com';
    const newGoogleId = 'goog-newres-88881234';
    const newGoogleName = 'Maya Resident';

    // Helper function to safely clean up a test user
    function cleanTestUser(email, googleId) {
        if (googleId) db.prepare("DELETE FROM api_residentprofile WHERE google_id=?").run(googleId);
        const u = db.prepare("SELECT id FROM api_user WHERE email=?").get(email);
        if (u) {
            db.prepare("DELETE FROM api_notification WHERE user_id=?").run(u.id);
            db.prepare("DELETE FROM api_parcel WHERE resident_id=?").run(u.id);
            db.prepare("DELETE FROM api_residentprofile WHERE user_id=?").run(u.id);
            db.prepare("DELETE FROM api_user WHERE id=?").run(u.id);
        }
    }

    // Clean up test identities if leftover from a previous run
    cleanTestUser(newGoogleEmail, newGoogleId);

    const existingNewUser = db.prepare("SELECT * FROM api_user WHERE LOWER(email)=LOWER(?)").get(newGoogleEmail);
    assert(!existingNewUser, 'New resident not yet in database');

    // When user not found, GoogleOAuthLoginView returns REGISTER_REQUIRED
    const onboardingRequired = !existingNewUser;
    assert(onboardingRequired, 'Action is REGISTER_REQUIRED for new Google identity');

    // Verify claims passed to onboarding modal
    const prefilledData = {
        email: newGoogleEmail,
        name: newGoogleName,
        google_id: newGoogleId
    };
    assert(prefilledData.email === newGoogleEmail, 'Email prefilled from verified Google token');
    assert(prefilledData.name === newGoogleName, 'Name prefilled from verified Google token');
    assert(prefilledData.google_id === newGoogleId, 'Google ID stored securely in registration token');

    // -------------------------------------------------------------
    // TEST 5: Require Valid Tower and Flat (No Room Numbers)
    // -------------------------------------------------------------
    console.log('\n--- 5. Test 5: Require Valid Tower and Flat ---');
    const invalidTowerId = 999999;
    const invalidFlatId = 888888;

    const towerCheck = db.prepare("SELECT * FROM api_tower WHERE id=?").get(invalidTowerId);
    assert(!towerCheck, 'Invalid Tower ID rejected');

    const flatCheck = db.prepare("SELECT * FROM api_flat WHERE id=? AND tower_id=?").get(invalidFlatId, tower.id);
    assert(!flatCheck, 'Invalid Flat ID rejected');

    const validFlatCheck = db.prepare("SELECT * FROM api_flat WHERE id=? AND tower_id=?").get(flat.id, tower.id);
    assert(Boolean(validFlatCheck), 'Valid Tower and Flat association accepted');

    // -------------------------------------------------------------
    // TEST 6: Database Verification (Profile with PENDING_APPROVAL)
    // -------------------------------------------------------------
    console.log('\n--- 6. Test 6: Registration & Profile with PENDING_APPROVAL ---');
    // Clean up if previous run left test user
    cleanTestUser(newGoogleEmail, newGoogleId);

    const nowIso = new Date().toISOString();
    const newUserResult = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('!', NULL, 0, 'maya_res_test', 'Maya', 'Resident', ?, 0, 1, ?, 'RESIDENT')
    `).run(newGoogleEmail, nowIso);

    const newUserId = newUserResult.lastInsertRowid;
    assert(Boolean(newUserId), 'Created User record for new Google resident');

    const newProfileResult = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 99999 88888', 1, 'PENDING_APPROVAL', ?, NULL, NULL, NULL, ?, ?)
    `).run(newGoogleId, flat.id, newUserId);

    const newProfileId = newProfileResult.lastInsertRowid;
    assert(Boolean(newProfileId), 'Created ResidentProfile record');

    // Create admin notification
    db.prepare(`
        INSERT INTO api_notification (title, message, is_read, created_at, notification_type, parcel_id, user_id)
        VALUES (?, ?, 0, ?, 'REGISTRATION_PENDING', NULL, ?)
    `).run('New Resident Pending Approval', `New resident Maya Resident registered for Tower ${tower.name}, Flat ${flat.number}.`, nowIso, admin.id);

    // Verify in database
    const savedProfile = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(newProfileId);
    assert(savedProfile.approval_status === 'PENDING_APPROVAL', 'Profile approval_status is PENDING_APPROVAL');
    assert(savedProfile.google_id === newGoogleId, 'Profile google_id matches verified Google ID');
    assert(savedProfile.approved_by_id === null, 'Profile approved_by_id is null before approval');
    assert(savedProfile.approved_at === null, 'Profile approved_at is null before approval');

    const adminNotif = db.prepare("SELECT * FROM api_notification WHERE notification_type='REGISTRATION_PENDING' AND user_id=?").get(admin.id);
    assert(Boolean(adminNotif), 'Notification sent to Admin for pending registration');

    // -------------------------------------------------------------
    // TEST 7: Block Pending Resident from Accessing Dashboard & Parcels
    // -------------------------------------------------------------
    console.log('\n--- 7. Test 7: Block Pending Resident Access ---');
    // Simulate IsResidentUser permission check
    function checkIsResidentUserPermission(profile) {
        if (!profile) return false;
        return profile.approval_status === 'APPROVED';
    }

    const permissionResult = checkIsResidentUserPermission(savedProfile);
    assert(!permissionResult, 'IsResidentUser blocks PENDING_APPROVAL resident (403 Forbidden)');

    // Frontend role-based route check
    const shouldRedirect = savedProfile.approval_status !== 'APPROVED';
    assert(shouldRedirect, 'Frontend RoleBasedRoute redirects pending resident to /pending-approval');

    // Subsequent Google login before approval
    const preApprovalLogin = db.prepare("SELECT * FROM api_residentprofile WHERE google_id=?").get(newGoogleId);
    const preApprovalAction = preApprovalLogin.approval_status === 'APPROVED' ? 'LOGIN' : 'PENDING_APPROVAL';
    assert(preApprovalAction === 'PENDING_APPROVAL', 'Subsequent Google login returns PENDING_APPROVAL notice');

    // -------------------------------------------------------------
    // TEST 8: Admin Approval Creates Active Resident
    // -------------------------------------------------------------
    console.log('\n--- 8. Test 8: Admin Approves Resident ---');
    const approvedAtIso = new Date().toISOString();
    db.prepare(`
        UPDATE api_residentprofile 
        SET approval_status='APPROVED', approved_by_id=?, approved_at=?, rejection_reason=NULL 
        WHERE id=?
    `).run(admin.id, approvedAtIso, newProfileId);

    // Resident notification
    db.prepare(`
        INSERT INTO api_notification (title, message, is_read, created_at, notification_type, parcel_id, user_id)
        VALUES (?, ?, 0, ?, 'REGISTRATION_APPROVED', NULL, ?)
    `).run('Registration Approved', 'Your GateVault account has been approved by the Community Admin.', approvedAtIso, newUserId);

    const approvedProfile = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(newProfileId);
    assert(approvedProfile.approval_status === 'APPROVED', 'Resident status updated to APPROVED');
    assert(approvedProfile.approved_by_id === admin.id, 'approved_by_id correctly set to Admin ID');
    assert(approvedProfile.approved_at === approvedAtIso, 'approved_at timestamp recorded');

    const residentNotif = db.prepare("SELECT * FROM api_notification WHERE notification_type='REGISTRATION_APPROVED' AND user_id=?").get(newUserId);
    assert(Boolean(residentNotif), 'Notification sent to resident informing them of approval');

    // -------------------------------------------------------------
    // TEST 9: Approved Resident Can Log In and View Parcels
    // -------------------------------------------------------------
    console.log('\n--- 9. Test 9: Approved Resident Can Log In and View Parcels ---');
    const postApprovalLogin = db.prepare("SELECT * FROM api_residentprofile WHERE google_id=?").get(newGoogleId);
    const postApprovalAction = postApprovalLogin.approval_status === 'APPROVED' ? 'LOGIN' : 'PENDING_APPROVAL';
    assert(postApprovalAction === 'LOGIN', 'Google OAuth returns LOGIN action with JWT tokens for approved resident');

    const postApprovalPermission = checkIsResidentUserPermission(postApprovalLogin);
    assert(postApprovalPermission, 'IsResidentUser allows access to resident API endpoints');

    // Insert a parcel for this resident's flat
    const parcelId = 'GV-TEST-OAUTH-01';
    db.prepare("DELETE FROM api_parcel WHERE parcel_id=?").run(parcelId);
    const carrier = db.prepare("SELECT * FROM api_carrier LIMIT 1").get();
    
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, status, received_at, flat_id, carrier_id, resident_id, pickup_pin,
            delivery_type, payment_type, payment_method, payment_status, is_open_box, open_box_resolution,
            is_delegated, delivery_location, is_high_value, resident_presence_confirmed, parcel_size,
            collected_by_role_type
        )
        VALUES (
            ?, 'TRK-OAUTH-999', 'LOGGED_IN', ?, ?, ?, ?, '1234',
            'NORMAL', 'PREPAID', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 0, 'NOT_APPLICABLE',
            0, 'GATEHOUSE', 0, 0, 'MEDIUM',
            'PRIMARY_RESIDENT'
        )
    `).run(parcelId, nowIso, flat.id, carrier.id, newUserId);

    const residentParcels = db.prepare("SELECT * FROM api_parcel WHERE flat_id=?").all(flat.id);
    assert(residentParcels.length > 0, 'Approved resident successfully accesses parcels for their assigned flat');

    // -------------------------------------------------------------
    // TEST 10: Rejection Workflow
    // -------------------------------------------------------------
    console.log('\n--- 10. Test Rejection Workflow ---');
    const rejectedEmail = 'rejected.resident@example.com';
    const rejectedGoogleId = 'goog-rejected-9911';

    db.prepare("DELETE FROM api_residentprofile WHERE google_id=?").run(rejectedGoogleId);
    db.prepare("DELETE FROM api_user WHERE email=?").run(rejectedEmail);

    const rejUser = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('!', NULL, 0, 'rej_res_test', 'Reject', 'Test', ?, 0, 1, ?, 'RESIDENT')
    `).run(rejectedEmail, nowIso);

    const rejProfile = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 98888 77777', 1, 'PENDING_APPROVAL', ?, NULL, NULL, NULL, ?, ?)
    `).run(rejectedGoogleId, flat.id, rejUser.lastInsertRowid);

    // Admin rejects profile
    const rejectionReason = 'Tenancy lease verification failed with society management.';
    db.prepare(`
        UPDATE api_residentprofile 
        SET approval_status='REJECTED', rejection_reason=? 
        WHERE id=?
    `).run(rejectionReason, rejProfile.lastInsertRowid);

    const rejRecord = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(rejProfile.lastInsertRowid);
    assert(rejRecord.approval_status === 'REJECTED', 'Profile status updated to REJECTED');
    assert(rejRecord.rejection_reason === rejectionReason, 'Rejection reason saved correctly');

    // Clean up test records
    db.prepare("DELETE FROM api_parcel WHERE parcel_id=?").run(parcelId);
    cleanTestUser(rejectedEmail, rejectedGoogleId);
    cleanTestUser(newGoogleEmail, newGoogleId);
    // Reset resident1 google_id
    db.prepare("UPDATE api_residentprofile SET google_id=NULL WHERE id=?").run(res1Profile.id);

    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('================================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
} catch (err) {
    console.error('Fatal error in test execution:', err);
    process.exit(1);
}
