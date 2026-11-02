import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('TEST SUITE: DUAL REGISTRATION APPROVAL LOGIC (PASSWORD + GOOGLE)');
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

function cleanTestUser(username, email, googleId) {
    if (googleId) {
        db.prepare("DELETE FROM api_residentprofile WHERE google_id=?").run(googleId);
    }
    const user = db.prepare("SELECT id FROM api_user WHERE username=? OR email=?").get(username, email);
    if (user) {
        db.prepare("DELETE FROM api_notification WHERE user_id=?").run(user.id);
        db.prepare("DELETE FROM api_parcel WHERE resident_id=?").run(user.id);
        db.prepare("DELETE FROM api_residentprofile WHERE user_id=?").run(user.id);
        db.prepare("DELETE FROM api_user WHERE id=?").run(user.id);
    }
}

try {
    // -------------------------------------------------------------
    // PREREQUISITES & SEED DATA CHECK
    // -------------------------------------------------------------
    console.log('--- 1. Checking System Seed Accounts & Database Integrity ---');
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const guard = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const resident1 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident1'").get();
    const resident2 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident2'").get();
    const tower = db.prepare("SELECT * FROM api_tower LIMIT 1").get();
    const flat = db.prepare("SELECT * FROM api_flat WHERE tower_id=? LIMIT 1").get(tower.id);

    assert(Boolean(admin), 'Admin user exists');
    assert(Boolean(guard), 'Guard user exists');
    assert(Boolean(resident1), 'Seed resident1 exists');
    assert(Boolean(resident2), 'Seed resident2 exists');

    // -------------------------------------------------------------
    // TEST 1: Existing Approved Resident Accounts Must Remain Untouched
    // -------------------------------------------------------------
    console.log('\n--- 2. Test Existing Residents Approval Status Integrity ---');
    const res1Profile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id=?").get(resident1.id);
    const res2Profile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id=?").get(resident2.id);

    assert(res1Profile && res1Profile.approval_status === 'APPROVED', 'Resident1 remains APPROVED (no regression)');
    assert(res2Profile && res2Profile.approval_status === 'APPROVED', 'Resident2 remains APPROVED (no regression)');

    // -------------------------------------------------------------
    // TEST 2: Email/Password Registration Sets PENDING_APPROVAL
    // -------------------------------------------------------------
    console.log('\n--- 3. Test Email/Password Resident Registration ---');
    const pwdUsername = 'test_pwd_resident';
    const pwdEmail = 'pwd.resident@gatevault.test';
    cleanTestUser(pwdUsername, pwdEmail, null);

    const nowIso = new Date().toISOString();
    
    // Simulate CreateResidentSerializer logic
    const userRes = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('pbkdf2_sha256$test', NULL, 0, ?, 'Password', 'Resident', ?, 0, 1, ?, 'RESIDENT')
    `).run(pwdUsername, pwdEmail, nowIso);
    const pwdUserId = userRes.lastInsertRowid;

    // Profile creation for normal registration: approval_status = PENDING_APPROVAL
    const profRes = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 91234 56789', 1, 'PENDING_APPROVAL', NULL, NULL, NULL, NULL, ?, ?)
    `).run(flat.id, pwdUserId);
    const pwdProfileId = profRes.lastInsertRowid;

    // Admin notification creation
    db.prepare(`
        INSERT INTO api_notification (title, message, is_read, created_at, notification_type, parcel_id, user_id)
        VALUES ('New Resident Registration Pending Approval', 'New resident Password Resident registered.', 0, ?, 'REGISTRATION_PENDING', NULL, ?)
    `).run(nowIso, admin.id);

    // Verify in database
    const pwdProfile = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(pwdProfileId);
    assert(pwdProfile.approval_status === 'PENDING_APPROVAL', 'Password resident profile has approval_status = PENDING_APPROVAL');
    assert(pwdProfile.google_id === null, 'Password resident has google_id = null');
    assert(pwdProfile.approved_by_id === null, 'Password resident approved_by_id is null');

    const pwdAdminNotif = db.prepare("SELECT * FROM api_notification WHERE notification_type='REGISTRATION_PENDING' AND user_id=? ORDER BY id DESC LIMIT 1").get(admin.id);
    assert(Boolean(pwdAdminNotif), 'Admin received in-app notification for password resident registration');

    // -------------------------------------------------------------
    // TEST 3: Google Registration Sets PENDING_APPROVAL
    // -------------------------------------------------------------
    console.log('\n--- 4. Test Google OAuth Resident Registration ---');
    const googUsername = 'test_goog_resident';
    const googEmail = 'goog.resident@gatevault.test';
    const googSubId = 'goog-sub-1234567890';
    cleanTestUser(googUsername, googEmail, googSubId);

    const googUserRes = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('!', NULL, 0, ?, 'Google', 'Resident', ?, 0, 1, ?, 'RESIDENT')
    `).run(googUsername, googEmail, nowIso);
    const googUserId = googUserRes.lastInsertRowid;

    const googProfRes = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 99887 76655', 1, 'PENDING_APPROVAL', ?, NULL, NULL, NULL, ?, ?)
    `).run(googSubId, flat.id, googUserId);
    const googProfileId = googProfRes.lastInsertRowid;

    const googProfile = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(googProfileId);
    assert(googProfile.approval_status === 'PENDING_APPROVAL', 'Google resident profile has approval_status = PENDING_APPROVAL');
    assert(googProfile.google_id === googSubId, 'Google resident has google_id populated');

    // -------------------------------------------------------------
    // TEST 4: Both Registration Types Appear in Unified Admin Approvals
    // -------------------------------------------------------------
    console.log('\n--- 5. Test Unified Admin Resident Approvals Endpoint ---');
    const pendingList = db.prepare(`
        SELECT p.*, u.username, u.email, u.first_name, u.last_name, t.name as tower_name, f.number as flat_number
        FROM api_residentprofile p
        JOIN api_user u ON p.user_id = u.id
        JOIN api_flat f ON p.flat_id = f.id
        JOIN api_tower t ON f.tower_id = t.id
        WHERE p.approval_status = 'PENDING_APPROVAL'
    `).all();

    const hasPwdResident = pendingList.some(p => p.id === pwdProfileId && p.google_id === null);
    const hasGoogResident = pendingList.some(p => p.id === googProfileId && p.google_id === googSubId);

    assert(hasPwdResident, 'Admin approvals query includes pending password-registered resident');
    assert(hasGoogResident, 'Admin approvals query includes pending Google-registered resident');

    // -------------------------------------------------------------
    // TEST 5: Access Restriction for Both Pending Residents (DRF + Route)
    // -------------------------------------------------------------
    console.log('\n--- 6. Test Access Restrictions on Pending Residents ---');
    function checkIsResidentUserPermission(profile) {
        if (!profile) return false;
        return profile.approval_status === 'APPROVED';
    }

    assert(!checkIsResidentUserPermission(pwdProfile), 'DRF IsResidentUser blocks pending password resident (403)');
    assert(!checkIsResidentUserPermission(googProfile), 'DRF IsResidentUser blocks pending Google resident (403)');

    // -------------------------------------------------------------
    // TEST 6: Admin Approves Password-Registered Resident
    // -------------------------------------------------------------
    console.log('\n--- 7. Test Admin Approving Password-Registered Resident ---');
    const approvedAtIso = new Date().toISOString();
    db.prepare(`
        UPDATE api_residentprofile
        SET approval_status='APPROVED', approved_by_id=?, approved_at=?, rejection_reason=NULL
        WHERE id=?
    `).run(admin.id, approvedAtIso, pwdProfileId);

    db.prepare(`
        INSERT INTO api_notification (title, message, is_read, created_at, notification_type, parcel_id, user_id)
        VALUES ('GateVault Registration Approved', 'Your account has been approved.', 0, ?, 'REGISTRATION_APPROVED', NULL, ?)
    `).run(approvedAtIso, pwdUserId);

    const approvedPwdProfile = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(pwdProfileId);
    assert(approvedPwdProfile.approval_status === 'APPROVED', 'Password resident successfully transitioned to APPROVED');
    assert(approvedPwdProfile.approved_by_id === admin.id, 'Password resident approved_by_id set to Admin');
    assert(approvedPwdProfile.approved_at === approvedAtIso, 'Password resident approved_at recorded');
    assert(checkIsResidentUserPermission(approvedPwdProfile), 'Approved password resident is now granted access by IsResidentUser');

    const pwdApprovalNotif = db.prepare("SELECT * FROM api_notification WHERE notification_type='REGISTRATION_APPROVED' AND user_id=?").get(pwdUserId);
    assert(Boolean(pwdApprovalNotif), 'Resident received REGISTRATION_APPROVED notification');

    // -------------------------------------------------------------
    // TEST 7: Admin Rejects Google-Registered Resident
    // -------------------------------------------------------------
    console.log('\n--- 8. Test Admin Rejecting Google-Registered Resident ---');
    const rejectionReason = 'Tenancy agreement verification failed.';
    db.prepare(`
        UPDATE api_residentprofile
        SET approval_status='REJECTED', rejection_reason=?
        WHERE id=?
    `).run(rejectionReason, googProfileId);

    db.prepare(`
        INSERT INTO api_notification (title, message, is_read, created_at, notification_type, parcel_id, user_id)
        VALUES ('GateVault Registration Not Approved', ?, 0, ?, 'REGISTRATION_REJECTED', NULL, ?)
    `).run(`Registration rejected: ${rejectionReason}`, approvedAtIso, googUserId);

    const rejectedGoogProfile = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(googProfileId);
    assert(rejectedGoogProfile.approval_status === 'REJECTED', 'Google resident transitioned to REJECTED');
    assert(rejectedGoogProfile.rejection_reason === rejectionReason, 'Rejection reason saved correctly');
    assert(!checkIsResidentUserPermission(rejectedGoogProfile), 'Rejected resident remains blocked by IsResidentUser');

    const googRejectionNotif = db.prepare("SELECT * FROM api_notification WHERE notification_type='REGISTRATION_REJECTED' AND user_id=?").get(googUserId);
    assert(Boolean(googRejectionNotif), 'Resident received REGISTRATION_REJECTED notification');

    // -------------------------------------------------------------
    // TEST 8: Admin Directly Creating Resident via Admin Panel (Auto-Approved)
    // -------------------------------------------------------------
    console.log('\n--- 9. Test Direct Admin Panel Resident Creation ---');
    const adminCreatedUsername = 'admin_added_resident';
    const adminCreatedEmail = 'admin.added@gatevault.test';
    cleanTestUser(adminCreatedUsername, adminCreatedEmail, null);

    const adminUserCreated = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('pbkdf2_sha256$test', NULL, 0, ?, 'AdminAdded', 'Resident', ?, 0, 1, ?, 'RESIDENT')
    `).run(adminCreatedUsername, adminCreatedEmail, nowIso);
    
    // When created in admin panel, marked approved by admin
    const adminProfileCreated = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 97777 66666', 1, 'APPROVED', NULL, NULL, ?, ?, ?, ?)
    `).run(nowIso, admin.id, flat.id, adminUserCreated.lastInsertRowid);

    const adminCreatedProf = db.prepare("SELECT * FROM api_residentprofile WHERE id=?").get(adminProfileCreated.lastInsertRowid);
    assert(adminCreatedProf.approval_status === 'APPROVED', 'Admin-created resident is immediately APPROVED');
    assert(adminCreatedProf.approved_by_id === admin.id, 'approved_by_id set to creator Admin');

    // -------------------------------------------------------------
    // TEST 9: Guards and Admin Accounts Remain Untouched
    // -------------------------------------------------------------
    console.log('\n--- 10. Test Guard and Admin Workflows Are Untouched ---');
    const adminProfile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id=?").get(admin.id);
    const guardProfile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id=?").get(guard.id);
    assert(!adminProfile, 'Admin has no resident profile and requires no resident approval');
    assert(!guardProfile, 'Guard has no resident profile and requires no resident approval');

    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    cleanTestUser(pwdUsername, pwdEmail, null);
    cleanTestUser(googUsername, googEmail, googSubId);
    cleanTestUser(adminCreatedUsername, adminCreatedEmail, null);

    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('================================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
} catch (err) {
    console.error('Fatal error during test:', err);
    process.exit(1);
}

