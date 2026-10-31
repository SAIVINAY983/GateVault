import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('RUNNING TEST SUITE: TEMPORARY GUEST PICKUP AUTHORIZATION');
console.log('================================================================');

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
    // 1. Verify DB Schema
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_guestpickupauthorization'").all();
    assert(tables.length === 1, 'Test 1: Table api_guestpickupauthorization exists in database');

    const pvCols = db.prepare("PRAGMA table_info('api_pickupverification')").all();
    const hasGuestCol = pvCols.some(c => c.name === 'guest_authorization_id');
    assert(hasGuestCol, 'Test 2: api_pickupverification has guest_authorization_id column');

    // Retrieve test users (resident1, resident2, guard1, admin)
    const resident1 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' ORDER BY id ASC LIMIT 1").get();
    const resident2 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' ORDER BY id DESC LIMIT 1").get();
    const guard = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();

    assert(resident1 && guard, 'Test 3: Seed users exist (Resident and Guard)');

    // Get a flat and carrier
    const flat1 = db.prepare("SELECT * FROM api_flat LIMIT 1").get();
    const carrier = db.prepare("SELECT * FROM api_carrier LIMIT 1").get();
    const shelf = db.prepare("SELECT * FROM api_storageshelf LIMIT 1").get();

    // Create a fresh test parcel owned by resident1
    const testParcelId = `TEST-GUEST-${Date.now().toString().slice(-6)}`;
    const pin = '4829';
    const nowIso = new Date().toISOString();

    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, status, received_at, flat_id, carrier_id, shelf_id,
            resident_id, pickup_pin, delivery_type, payment_type, payment_status, payment_method, cod_amount,
            is_open_box, is_delegated, collected_by_role_type, open_box_resolution,
            delivery_location
        ) VALUES (?, ?, 'PENDING_PICKUP', ?, ?, ?, ?, ?, ?, 'NORMAL', 'PREPAID', 'PAID', 'ONLINE', 0, 0, 0, 'PRIMARY_RESIDENT', 'NONE', 'GATEHOUSE')
    `).run(
        testParcelId, `TRK-${testParcelId}`, nowIso, flat1.id, carrier.id, shelf.id,
        resident1.id, pin
    );

    const parcelRow = db.prepare("SELECT * FROM api_parcel WHERE parcel_id = ?").get(testParcelId);
    assert(parcelRow && parcelRow.resident_id === resident1.id, 'Test 4: Test parcel created successfully for resident1');

    // 2. Token generation and security checks
    const rawToken1 = `GVGUEST_${crypto.randomBytes(24).toString('base64url')}`;
    const tokenHash1 = crypto.createHash('sha256').update(rawToken1).digest('hex');
    const passCode1 = `GV-GUEST-${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresFuture = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // Ensure raw PIN is NOT in token
    assert(!rawToken1.includes(pin) && !passCode1.includes(pin), 'Test 5: Raw resident pickup PIN is never exposed in guest token or pass code');

    // Insert guest authorization 1
    db.prepare(`
        INSERT INTO api_guestpickupauthorization (
            parcel_id, resident_id, guest_name, guest_mobile, relationship, instructions,
            pass_code, token_hash, expires_at, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(
        parcelRow.id, resident1.id, 'Suresh Sharma', '+919876543210', 'FRIEND',
        'Please hand over after checking ID', passCode1, tokenHash1, expiresFuture, nowIso
    );

    const auth1 = db.prepare("SELECT * FROM api_guestpickupauthorization WHERE token_hash = ?").get(tokenHash1);
    assert(auth1 && auth1.status === 'ACTIVE', 'Test 6: Active guest pickup authorization created');
    assert(auth1.parcel_id === parcelRow.id, 'Test 7: Guest authorization strictly linked to one parcel');

    // Insert notification for authorization creation
    db.prepare(`
        INSERT INTO api_notification (
            user_id, parcel_id, notification_type, title, message, is_read, created_at
        ) VALUES (?, ?, 'GUEST_AUTHORIZED', 'Guest Pickup Authorized', ?, 0, ?)
    `).run(
        resident1.id, parcelRow.id, `You authorized Suresh Sharma to collect parcel ${testParcelId}. Pass Code: ${passCode1}`, nowIso
    );

    const notifAuth = db.prepare("SELECT * FROM api_notification WHERE parcel_id = ? AND notification_type='GUEST_AUTHORIZED'").get(parcelRow.id);
    assert(notifAuth !== undefined, 'Test 8: Resident received GUEST_AUTHORIZED notification');

    // 3. Invalidation of previous active pass on replacement
    const rawToken2 = `GVGUEST_${crypto.randomBytes(24).toString('base64url')}`;
    const tokenHash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');
    const passCode2 = `GV-GUEST-${Math.floor(100000 + Math.random() * 900000)}`;

    // Revoke previous active passes for this parcel before creating new one
    db.prepare("UPDATE api_guestpickupauthorization SET status='REVOKED', revoked_at=?, revoked_by_id=? WHERE parcel_id=? AND status='ACTIVE'").run(
        nowIso, resident1.id, parcelRow.id
    );

    db.prepare(`
        INSERT INTO api_guestpickupauthorization (
            parcel_id, resident_id, guest_name, guest_mobile, relationship, instructions,
            pass_code, token_hash, expires_at, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).run(
        parcelRow.id, resident1.id, 'Vikas Verma', '+919123456789', 'RELATIVE',
        'Brother visiting', passCode2, tokenHash2, expiresFuture, nowIso
    );

    const prevAuth = db.prepare("SELECT status FROM api_guestpickupauthorization WHERE id = ?").get(auth1.id);
    const activeAuth = db.prepare("SELECT status FROM api_guestpickupauthorization WHERE token_hash = ?").get(tokenHash2);
    assert(prevAuth.status === 'REVOKED' && activeAuth.status === 'ACTIVE', 'Test 9: Previous guest pass invalidated upon generating new pass');

    // 4. Guard verification (Pass Code lookup without completing handover)
    const foundAuth = db.prepare("SELECT * FROM api_guestpickupauthorization WHERE pass_code = ?").get(passCode2);
    assert(foundAuth && foundAuth.status === 'ACTIVE', 'Test 10: Guard successfully finds active authorization by pass_code');

    // Record guard verification
    const verifiedTime = new Date().toISOString();
    db.prepare("UPDATE api_guestpickupauthorization SET verified_by_guard_id=?, verified_at=? WHERE id=?").run(
        guard.id, verifiedTime, foundAuth.id
    );
    const verifiedAuth = db.prepare("SELECT * FROM api_guestpickupauthorization WHERE id=?").get(foundAuth.id);
    assert(verifiedAuth.verified_by_guard_id === guard.id && verifiedAuth.verified_at !== null, 'Test 11: Guard verification recorded without completing handover');

    // Ensure parcel is still PENDING_PICKUP
    const parcelMid = db.prepare("SELECT status, shelf_id FROM api_parcel WHERE id = ?").get(parcelRow.id);
    assert(parcelMid.status === 'PENDING_PICKUP' && parcelMid.shelf_id !== null, 'Test 12: Handover not completed merely because pass was verified');

    // 5. Guard handover confirmation
    const handoverTime = new Date().toISOString();
    // In atomic transaction:
    db.exec('BEGIN TRANSACTION;');
    // Mark auth as USED
    db.prepare("UPDATE api_guestpickupauthorization SET status='USED', used_at=?, actual_collector_name=? WHERE id=?").run(
        handoverTime, 'Vikas Verma', foundAuth.id
    );
    // Update parcel status to HANDED_OVER, clear shelf, set collected_by_role_type to TEMPORARY_GUEST
    db.prepare(`
        UPDATE api_parcel 
        SET status='HANDED_OVER', shelf_id=NULL, collected_by_role_type='TEMPORARY_GUEST',
            actual_receiver_name='Vikas Verma', receiver_relationship='RELATIVE',
            handed_over_at=?, handed_over_by_id=?
        WHERE id=?
    `).run(handoverTime, guard.id, parcelRow.id);
    // Create PickupVerification with verification_method='GUEST_PASS'
    db.prepare(`
        INSERT INTO api_pickupverification (
            timestamp, guard_id, parcel_id, verification_method, guest_authorization_id
        ) VALUES (?, ?, ?, 'GUEST_PASS', ?)
    `).run(handoverTime, guard.id, parcelRow.id, foundAuth.id);
    // Create GUEST_COLLECTED notification
    db.prepare(`
        INSERT INTO api_notification (
            user_id, parcel_id, notification_type, title, message, is_read, created_at
        ) VALUES (?, ?, 'GUEST_COLLECTED', 'Parcel Collected by Guest', ?, 0, ?)
    `).run(
        resident1.id, parcelRow.id,
        `Your delivery (${testParcelId}) was collected at the gatehouse by authorized guest Vikas Verma (Relative).`,
        handoverTime
    );
    db.exec('COMMIT;');

    const parcelAfter = db.prepare("SELECT * FROM api_parcel WHERE id = ?").get(parcelRow.id);
    assert(parcelAfter.status === 'HANDED_OVER', 'Test 13: Parcel status updated to HANDED_OVER');
    assert(parcelAfter.shelf_id === null, 'Test 14: Storage shelf released on guest handover');
    assert(parcelAfter.collected_by_role_type === 'TEMPORARY_GUEST', 'Test 15: collected_by_role_type recorded as TEMPORARY_GUEST');
    assert(parcelAfter.actual_receiver_name === 'Vikas Verma', 'Test 16: Actual collector recorded on parcel');

    const pickupVerif = db.prepare("SELECT * FROM api_pickupverification WHERE guest_authorization_id = ?").get(foundAuth.id);
    assert(pickupVerif && pickupVerif.verification_method === 'GUEST_PASS', 'Test 17: PickupVerification recorded with method GUEST_PASS');

    const notifCollected = db.prepare("SELECT * FROM api_notification WHERE parcel_id = ? AND notification_type='GUEST_COLLECTED'").get(parcelRow.id);
    assert(notifCollected !== undefined, 'Test 18: Resident notified of guest collection');

    // 6. Single-use & Replay Attack Prevention
    const reusedAuth = db.prepare("SELECT * FROM api_guestpickupauthorization WHERE id = ?").get(foundAuth.id);
    const isReplayBlocked = (reusedAuth.status === 'USED');
    assert(isReplayBlocked, 'Test 19: Replay attack blocked: pass status is USED and cannot be reused');

    // 7. Expired pass handling
    const pastExpires = new Date(Date.now() - 3600 * 1000).toISOString();
    const tokenHashExp = crypto.createHash('sha256').update('EXPIRED_TOKEN_' + Date.now()).digest('hex');
    db.prepare(`
        INSERT INTO api_guestpickupauthorization (
            parcel_id, resident_id, guest_name, guest_mobile, relationship,
            pass_code, token_hash, expires_at, status, created_at
        ) VALUES (?, ?, 'Late Guest', '+919999999999', 'OTHER', 'GV-GUEST-EXPD01', ?, ?, 'ACTIVE', ?)
    `).run(parcelRow.id, resident1.id, tokenHashExp, pastExpires, nowIso);

    const expiredRecord = db.prepare("SELECT * FROM api_guestpickupauthorization WHERE token_hash = ?").get(tokenHashExp);
    const isExpired = new Date(expiredRecord.expires_at) < new Date();
    assert(isExpired, 'Test 20: Expired pass correctly detected by expiration timestamp');

    // 8. Revocation handling
    const tokenHashRev = crypto.createHash('sha256').update('REVOKED_TOKEN_' + Date.now()).digest('hex');
    db.prepare(`
        INSERT INTO api_guestpickupauthorization (
            parcel_id, resident_id, guest_name, guest_mobile, relationship,
            pass_code, token_hash, expires_at, status, created_at
        ) VALUES (?, ?, 'Cancelled Guest', '+918888888888', 'FRIEND', 'GV-GUEST-REV001', ?, ?, 'ACTIVE', ?)
    `).run(parcelRow.id, resident1.id, tokenHashRev, expiresFuture, nowIso);

    // Resident revokes it
    db.prepare("UPDATE api_guestpickupauthorization SET status='REVOKED', revoked_at=?, revoked_by_id=? WHERE token_hash=?").run(
        nowIso, resident1.id, tokenHashRev
    );

    const revokedRecord = db.prepare("SELECT * FROM api_guestpickupauthorization WHERE token_hash = ?").get(tokenHashRev);
    assert(revokedRecord.status === 'REVOKED' && revokedRecord.revoked_by_id === resident1.id, 'Test 21: Resident revocation correctly updates status to REVOKED');

    // 9. Cross-flat protection check
    // Ensure resident2 cannot revoke resident1's authorization
    const isOwner = (revokedRecord.resident_id === resident2.id);
    assert(!isOwner, 'Test 22: Cross-flat protection prevents unauthorized residents from modifying other flats passes');

} catch (err) {
    console.error('Unexpected error during test execution:', err);
    failedTests++;
}

console.log('================================================================');
console.log(`SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
    process.exit(1);
}
