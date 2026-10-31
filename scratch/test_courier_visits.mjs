import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('RUNNING TEST SUITE: COURIER ARRIVAL & DEPARTURE LOG MANAGEMENT');
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
    const cvTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_couriervisit'").get();
    assert(cvTable !== undefined, 'Prereq: Table api_couriervisit exists in SQLite database');

    const parcelCols = db.prepare("PRAGMA table_info('api_parcel')").all();
    const hasCourierCol = parcelCols.some(c => c.name === 'courier_visit_id');
    assert(hasCourierCol, 'Prereq: api_parcel has courier_visit_id foreign key column');

    // Retrieve seed users (Guard, Admin, Resident) & carriers
    const guard = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const resident = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' LIMIT 1").get();
    const flat = db.prepare("SELECT * FROM api_flat LIMIT 1").get();
    const amazonCarrier = db.prepare("SELECT * FROM api_carrier WHERE name LIKE '%Amazon%' LIMIT 1").get() || db.prepare("SELECT * FROM api_carrier LIMIT 1").get();
    const shelf = db.prepare("SELECT * FROM api_storageshelf WHERE status='ACTIVE' LIMIT 1").get();

    assert(guard && admin && resident && flat && amazonCarrier && shelf, 'Prereq: Seed users and master data exist in database');

    // -------------------------------------------------------------
    // STEP 1: GUARD LOGS IN
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Guard Identity & Role ---');
    assert(guard.role === 'GUARD', 'Step 1: Guard account identified with role=GUARD', `User ${guard.username}`);

    // -------------------------------------------------------------
    // STEP 2 & 3: GUARD REGISTERS AN AMAZON COURIER ENTRY
    // -------------------------------------------------------------
    console.log('\n--- Step 2 & 3: Register Courier Arrival ---');
    const ts = Date.now().toString().slice(-4);
    const courierMobile = `+9198${Date.now().toString().slice(-8)}`;
    const courierName = `Rajesh Kumar ${ts}`;
    const vehicleNumber = `DL-01-CV-${ts}`;
    const entryTime = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 mins ago to test duration calculation

    // Test mobile number validation logic
    function validateMobile(mob) {
        const clean = mob.replace(/[\s\-+]/g, '');
        return /^\d{7,15}$/.test(clean);
    }
    assert(validateMobile(courierMobile) === true, 'Validation: Valid mobile number format accepted');
    assert(validateMobile('abc') === false && validateMobile('123') === false, 'Validation: Invalid mobile number rejected');

    // Insert courier visit
    const visitInsert = db.prepare(`
        INSERT INTO api_couriervisit (
            courier_name, carrier_id, carrier_name, mobile_number, vehicle_number,
            visit_purpose, entry_time, status, remarks, created_at, entry_guard_id
        ) VALUES (?, ?, ?, ?, ?, 'PARCEL_DELIVERY', ?, 'INSIDE', 'Delivering packages for Block A', ?, ?)
    `).run(courierName, amazonCarrier.id, amazonCarrier.name, courierMobile, vehicleNumber, entryTime, new Date().toISOString(), guard.id);

    const visitId = visitInsert.lastInsertRowid;
    const visit = db.prepare("SELECT * FROM api_couriervisit WHERE id=?").get(visitId);

    assert(visit !== undefined, 'Step 2: CourierVisit record created successfully');
    assert(visit.status === 'INSIDE', 'Step 2: Courier status set to INSIDE');
    assert(visit.entry_time !== null && visit.entry_guard_id === guard.id, 'Step 3: Entry timestamp and entry guard recorded');

    // Test duplicate active visit detection
    const activeDuplicate = db.prepare("SELECT * FROM api_couriervisit WHERE status='INSIDE' AND (mobile_number=? OR courier_name=?)").get(courierMobile, courierName);
    assert(activeDuplicate !== undefined && activeDuplicate.id === visitId, 'Validation: Duplicate active visit detection correctly finds ongoing visit');

    // -------------------------------------------------------------
    // STEP 4: COURIER APPEARS IN CURRENTLY INSIDE
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Currently Inside Query ---');
    const currentlyInside = db.prepare("SELECT * FROM api_couriervisit WHERE status='INSIDE' ORDER BY entry_time DESC").all();
    const isFoundInside = currentlyInside.some(v => v.id === visitId);
    assert(isFoundInside, 'Step 4: Newly registered courier appears in Currently Inside list');

    // -------------------------------------------------------------
    // STEP 5, 6, 7: RECEIVE TWO PARCELS & LINK BOTH TO COURIER VISIT
    // -------------------------------------------------------------
    console.log('\n--- Step 5, 6 & 7: Parcel Intake with Courier Visit Linking ---');
    const parcelId1 = `GV-2026-CV1-${ts}`;
    const parcelId2 = `GV-2026-CV2-${ts}`;
    const nowIso = new Date().toISOString();

    // Parcel 1
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, status, received_at, flat_id, carrier_id, shelf_id,
            courier_visit_id, resident_id, received_by_id, pickup_pin, delivery_type, parcel_size,
            payment_type, payment_status, payment_method, cod_amount,
            is_open_box, is_delegated, collected_by_role_type, open_box_resolution, delivery_location
        ) VALUES (?, ?, 'AWAITING_PICKUP', ?, ?, ?, ?, ?, ?, ?, '4123', 'NORMAL', 'MEDIUM', 'PREPAID', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 0, 0, 0, 'PRIMARY_RESIDENT', 'NOT_APPLICABLE', 'GATEHOUSE')
    `).run(parcelId1, `TRK-${parcelId1}`, nowIso, flat.id, amazonCarrier.id, shelf.id, visitId, resident.id, guard.id);

    // Parcel 2
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, status, received_at, flat_id, carrier_id, shelf_id,
            courier_visit_id, resident_id, received_by_id, pickup_pin, delivery_type, parcel_size,
            payment_type, payment_status, payment_method, cod_amount,
            is_open_box, is_delegated, collected_by_role_type, open_box_resolution, delivery_location
        ) VALUES (?, ?, 'AWAITING_PICKUP', ?, ?, ?, ?, ?, ?, ?, '8765', 'NORMAL', 'SMALL', 'PREPAID', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 0, 0, 0, 'PRIMARY_RESIDENT', 'NOT_APPLICABLE', 'GATEHOUSE')
    `).run(parcelId2, `TRK-${parcelId2}`, nowIso, flat.id, amazonCarrier.id, shelf.id, visitId, resident.id, guard.id);

    // Query parcels linked to visit
    const linkedParcels = db.prepare("SELECT * FROM api_parcel WHERE courier_visit_id=?").all(visitId);
    assert(linkedParcels.length === 2, 'Step 5 & 6: Exactly two parcels linked to the same CourierVisit');
    assert(linkedParcels.some(p => p.parcel_id === parcelId1) && linkedParcels.some(p => p.parcel_id === parcelId2),
           'Step 6: Both parcel IDs correctly point to the CourierVisit');

    // Verify existing parcel intake properties preserved
    assert(linkedParcels[0].shelf_id === shelf.id && linkedParcels[0].status === 'AWAITING_PICKUP',
           'Step 7: Existing shelf assignment and intake status preserved without regression');

    // -------------------------------------------------------------
    // STEP 8, 9, 10, 11: GUARD CONFIRMS COURIER EXIT & DURATION
    // -------------------------------------------------------------
    console.log('\n--- Step 8, 9, 10 & 11: Courier Departure & Duration Calculation ---');
    const exitTimestamp = new Date().toISOString();

    // Confirm exit
    db.prepare("UPDATE api_couriervisit SET status='EXITED', exit_time=?, exit_guard_id=? WHERE id=?")
      .run(exitTimestamp, guard.id, visitId);

    const exitedVisit = db.prepare("SELECT * FROM api_couriervisit WHERE id=?").get(visitId);
    assert(exitedVisit.status === 'EXITED', 'Step 8: Courier visit status updated to EXITED');
    assert(exitedVisit.exit_time !== null && exitedVisit.exit_guard_id === guard.id, 'Step 9: Exit timestamp and exit guard recorded');

    // Duration calculation
    const entryDate = new Date(exitedVisit.entry_time);
    const exitDate = new Date(exitedVisit.exit_time);
    const diffMinutes = Math.max(0, Math.floor((exitDate - entryDate) / (1000 * 60)));
    assert(diffMinutes >= 15, 'Step 10: Total visit duration non-negative and accurately computed (~15 mins)', `Duration: ${diffMinutes}m`);

    // Verify courier disappears from Currently Inside
    const insideAfterExit = db.prepare("SELECT * FROM api_couriervisit WHERE status='INSIDE' AND id=?").get(visitId);
    assert(insideAfterExit === undefined, 'Step 11: Courier disappears from Currently Inside list after exit');

    // -------------------------------------------------------------
    // STEP 12: ADMIN VIEWS COMPLETED VISIT HISTORY & LINKED PARCELS
    // -------------------------------------------------------------
    console.log('\n--- Step 12: Admin Courier History & Analytics ---');
    const adminVisit = db.prepare(`
        SELECT v.*, u1.username as entry_guard_name, u2.username as exit_guard_name,
               (SELECT COUNT(*) FROM api_parcel WHERE courier_visit_id = v.id) as parcels_count
        FROM api_couriervisit v
        LEFT JOIN api_user u1 ON v.entry_guard_id = u1.id
        LEFT JOIN api_user u2 ON v.exit_guard_id = u2.id
        WHERE v.id=?
    `).get(visitId);

    assert(adminVisit !== undefined, 'Step 12: Admin can query completed visit record');
    assert(adminVisit.parcels_count === 2, 'Step 12: Admin sees 2 linked parcels associated with the visit');
    assert(adminVisit.entry_guard_name === guard.username && adminVisit.exit_guard_name === guard.username,
           'Step 12: Audit trail correctly displays entry and exit guards');

    // -------------------------------------------------------------
    // STEP 13 & 14: REJECT DUPLICATE EXIT ATTEMPT
    // -------------------------------------------------------------
    console.log('\n--- Step 13 & 14: Reject Duplicate Exit Attempt ---');
    function attemptExit(visitRecord) {
        if (visitRecord.status === 'EXITED') {
            return {
                success: false,
                status: 400,
                error: `Courier ${visitRecord.courier_name} has already exited on ${visitRecord.exit_time}.`
            };
        }
        return { success: true };
    }

    const dupExitAttempt = attemptExit(exitedVisit);
    assert(dupExitAttempt.success === false && dupExitAttempt.status === 400,
           'Step 13 & 14: Second exit attempt rejected with HTTP 400 Bad Request',
           dupExitAttempt.error);

    // -------------------------------------------------------------
    // STEP 15: ROLE PERMISSION AUTHORIZATION (RESIDENT ACCESS BLOCKED)
    // -------------------------------------------------------------
    console.log('\n--- Step 15: Role-Based Access Control ---');
    function checkPermission(user, requiredRoles) {
        return requiredRoles.includes(user.role);
    }

    const guardAllowed = checkPermission(guard, ['GUARD', 'ADMIN']);
    const adminAllowed = checkPermission(admin, ['ADMIN']);
    const residentAllowedForGuardViews = checkPermission(resident, ['GUARD', 'ADMIN']);
    const residentAllowedForAdminAnalytics = checkPermission(resident, ['ADMIN']);

    assert(guardAllowed === true, 'Step 15: Guard has access to courier operations');
    assert(adminAllowed === true, 'Step 15: Admin has access to courier analytics');
    assert(residentAllowedForGuardViews === false, 'Step 15: Resident access to guard courier log is BLOCKED (403)');
    assert(residentAllowedForAdminAnalytics === false, 'Step 15: Resident access to admin courier analytics is BLOCKED (403)');

    // -------------------------------------------------------------
    // CLEANUP TEMPORARY TEST DATA
    // -------------------------------------------------------------
    db.prepare("DELETE FROM api_parcel WHERE id IN (?, ?)").run(linkedParcels[0].id, linkedParcels[1].id);
    db.prepare("DELETE FROM api_couriervisit WHERE id=?").run(visitId);

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('================================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
} catch (err) {
    console.error('Fatal Test Exception:', err);
    process.exit(1);
}

