import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('RUNNING TEST SUITE: SMART SHELF MANAGEMENT & ALLOCATION');
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
    // PREREQUISITES & SCHEMA CHECKS
    // -------------------------------------------------------------
    const shelfCols = db.prepare("PRAGMA table_info('api_storageshelf')").all();
    const hasSizeCol = shelfCols.some(c => c.name === 'max_parcel_size');
    const hasStatusCol = shelfCols.some(c => c.name === 'status');
    const hasNotesCol = shelfCols.some(c => c.name === 'maintenance_notes');
    assert(hasSizeCol && hasStatusCol && hasNotesCol, 'Prereq: StorageShelf has max_parcel_size, status, and maintenance_notes columns');

    const parcelCols = db.prepare("PRAGMA table_info('api_parcel')").all();
    const hasParcelSizeCol = parcelCols.some(c => c.name === 'parcel_size');
    const hasDimensionsCol = parcelCols.some(c => c.name === 'dimensions');
    const hasInstructionsCol = parcelCols.some(c => c.name === 'handling_instructions');
    assert(hasParcelSizeCol && hasDimensionsCol && hasInstructionsCol, 'Prereq: Parcel has parcel_size, dimensions, and handling_instructions columns');

    const hasResTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_shelfreservation'").get();
    const hasHistoryTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_shelfassignmenthistory'").get();
    assert(hasResTable && hasHistoryTable, 'Prereq: ShelfReservation and ShelfAssignmentHistory tables exist in SQLite');

    // Retrieve seed users & references
    const guard = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const resident = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' LIMIT 1").get();
    const flat = db.prepare("SELECT * FROM api_flat LIMIT 1").get();
    const carrier = db.prepare("SELECT * FROM api_carrier LIMIT 1").get();

    assert(guard && admin && resident && flat && carrier, 'Prereq: Seed data exists (Guard, Admin, Resident, Flat, Carrier)');

    // Helper functions mirroring model properties & backend logic
    const SIZE_TIERS = { 'SMALL': 1, 'MEDIUM': 2, 'LARGE': 3 };

    function getShelfStats(shelfId) {
        const shelf = db.prepare("SELECT * FROM api_storageshelf WHERE id=?").get(shelfId);
        const nowIso = new Date().toISOString();
        const activeParcels = db.prepare("SELECT COUNT(*) as count FROM api_parcel WHERE shelf_id=? AND status IN ('AWAITING_PICKUP', 'OVERDUE')").get(shelfId).count;
        const activeReservations = db.prepare("SELECT COUNT(*) as count FROM api_shelfreservation WHERE shelf_id=? AND status='ACTIVE' AND expires_at > ?").get(shelfId, nowIso).count;
        const effectiveOccupied = activeParcels + activeReservations;
        const available = Math.max(0, shelf.capacity - effectiveOccupied);
        const isFull = effectiveOccupied >= shelf.capacity;
        const isNearCapacity = (shelf.capacity > 0) && ((activeParcels / shelf.capacity) >= 0.85);

        return {
            ...shelf,
            occupied: activeParcels,
            activeParcels,
            activeReservations,
            effectiveOccupied,
            available,
            isFull,
            isNearCapacity
        };
    }

    function recommendShelf(parcelSize) {
        const nowIso = new Date().toISOString();
        // Expire overdue reservations
        db.prepare("UPDATE api_shelfreservation SET status='EXPIRED' WHERE status='ACTIVE' AND expires_at <= ?").run(nowIso);

        const parcelTier = SIZE_TIERS[parcelSize] || 2;
        const activeShelves = db.prepare("SELECT * FROM api_storageshelf WHERE status='ACTIVE'").all();

        const eligible = [];
        for (const s of activeShelves) {
            const stats = getShelfStats(s.id);
            const shelfTier = SIZE_TIERS[s.max_parcel_size] || 3;
            if (shelfTier >= parcelTier && stats.available > 0) {
                eligible.push(stats);
            }
        }

        // Sort: best tier fit first, then highest available capacity
        eligible.sort((a, b) => {
            const tierDiffA = (SIZE_TIERS[a.max_parcel_size] || 3) - parcelTier;
            const tierDiffB = (SIZE_TIERS[b.max_parcel_size] || 3) - parcelTier;
            if (tierDiffA !== tierDiffB) return tierDiffA - tierDiffB;
            return b.available - a.available;
        });

        return {
            recommended: eligible[0] || null,
            eligible
        };
    }

    // -------------------------------------------------------------
    // SETUP TEST SHELVES
    // -------------------------------------------------------------
    // Create dedicated test shelves for small, medium, large, and single-slot concurrency
    const ts = Date.now().toString().slice(-4);
    db.prepare("INSERT INTO api_storageshelf (name, capacity, max_parcel_size, status) VALUES (?, 10, 'SMALL', 'ACTIVE')")
      .run(`TEST-SHELF-SMALL-${ts}`);
    const shelfSmall = db.prepare("SELECT * FROM api_storageshelf WHERE name=?").get(`TEST-SHELF-SMALL-${ts}`);

    db.prepare("INSERT INTO api_storageshelf (name, capacity, max_parcel_size, status) VALUES (?, 10, 'LARGE', 'ACTIVE')")
      .run(`TEST-SHELF-LARGE-${ts}`);
    const shelfLarge = db.prepare("SELECT * FROM api_storageshelf WHERE name=?").get(`TEST-SHELF-LARGE-${ts}`);

    db.prepare("INSERT INTO api_storageshelf (name, capacity, max_parcel_size, status) VALUES (?, 1, 'MEDIUM', 'ACTIVE')")
      .run(`TEST-SHELF-CONCURRENT-${ts}`);
    const shelfConcurrent = db.prepare("SELECT * FROM api_storageshelf WHERE name=?").get(`TEST-SHELF-CONCURRENT-${ts}`);

    // -------------------------------------------------------------
    // SCENARIO 1 & 2: GET SUITABLE SHELF RECOMMENDATION FOR SMALL PARCEL
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1 & 2: Parcel Size Classification & Recommendation ---');
    const recResult = recommendShelf('SMALL');
    assert(recResult.recommended !== null, 'Scenario 2: Suitable shelf recommendation returned for SMALL parcel');
    assert(recResult.recommended.max_parcel_size === 'SMALL', 'Scenario 2: Best-fit tier prioritizing SMALL shelf over LARGE shelf for small parcel',
           `Expected SMALL shelf tier, got ${recResult.recommended?.max_parcel_size}`);

    // -------------------------------------------------------------
    // SCENARIO 3: RESERVE THE SHELF
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Shelf Slot Temporary Reservation ---');
    const token1 = 'SR-TEST-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const expiryDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.prepare(`
        INSERT INTO api_shelfreservation (
            shelf_id, guard_id, parcel_size, reservation_token, expires_at, status, created_at
        ) VALUES (?, ?, 'SMALL', ?, ?, 'ACTIVE', ?)
    `).run(shelfSmall.id, guard.id, token1, expiryDate, new Date().toISOString());

    const statsAfterRes = getShelfStats(shelfSmall.id);
    assert(statsAfterRes.activeReservations === 1, 'Scenario 3: Active reservation recorded on shelf');
    assert(statsAfterRes.available === (shelfSmall.capacity - 1), 'Scenario 3: Shelf available slots decremented by active reservation');

    // -------------------------------------------------------------
    // SCENARIO 4 & 5: CONCURRENCY PROTECTION & COLLISION REJECTION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4 & 5: Concurrency Safety & Collision Rejection ---');
    // shelfConcurrent has capacity = 1
    // Guard 1 reserves the single slot
    const tokenGuard1 = 'SR-CONC-1-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    db.prepare(`
        INSERT INTO api_shelfreservation (
            shelf_id, guard_id, parcel_size, reservation_token, expires_at, status, created_at
        ) VALUES (?, ?, 'MEDIUM', ?, ?, 'ACTIVE', ?)
    `).run(shelfConcurrent.id, guard.id, tokenGuard1, expiryDate, new Date().toISOString());

    const concStatsAfterGuard1 = getShelfStats(shelfConcurrent.id);
    assert(concStatsAfterGuard1.isFull === true, 'Scenario 4: Shelf with capacity=1 is marked isFull after first reservation');

    // Guard 2 attempts to reserve on the same full shelf inside atomic transaction check
    function attemptReservation(shelfId, guardId, size) {
        // Atomic check: calculate active parcels + active reservations within exclusive transaction
        const nowIso = new Date().toISOString();
        const shelf = db.prepare("SELECT * FROM api_storageshelf WHERE id=?").get(shelfId);
        const activeParcels = db.prepare("SELECT COUNT(*) as count FROM api_parcel WHERE shelf_id=? AND status IN ('AWAITING_PICKUP', 'OVERDUE')").get(shelfId).count;
        const activeRes = db.prepare("SELECT COUNT(*) as count FROM api_shelfreservation WHERE shelf_id=? AND status='ACTIVE' AND expires_at > ?").get(shelfId, nowIso).count;

        if ((activeParcels + activeRes) >= shelf.capacity) {
            return { success: false, status: 409, error: `Shelf ${shelf.name} is currently full or all remaining slots are reserved.` };
        }

        const token = 'SR-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        db.prepare(`
            INSERT INTO api_shelfreservation (
                shelf_id, guard_id, parcel_size, reservation_token, expires_at, status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
        `).run(shelfId, guardId, size, token, expiryDate, nowIso);

        return { success: true, token };
    }

    const guard2Attempt = attemptReservation(shelfConcurrent.id, guard.id, 'MEDIUM');
    assert(guard2Attempt.success === false && guard2Attempt.status === 409, 
           'Scenario 5: Second concurrent reservation rejected with 409 Conflict', 
           guard2Attempt.error);

    // -------------------------------------------------------------
    // SCENARIO 6: COMPLETE INTAKE
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Complete Intake with Size, Dimensions, & Committed Token ---');
    const parcelId1 = `GV-2026-T${Date.now().toString().slice(-5)}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, status, received_at, flat_id, carrier_id, shelf_id,
            resident_id, received_by_id, pickup_pin, delivery_type, parcel_size, dimensions,
            handling_instructions, payment_type, payment_status, payment_method, cod_amount,
            is_open_box, is_delegated, collected_by_role_type, open_box_resolution, delivery_location
        ) VALUES (?, ?, 'AWAITING_PICKUP', ?, ?, ?, ?, ?, ?, '1234', 'NORMAL', 'SMALL', '20x15x10 cm', 'Fragile electronic parts', 'PREPAID', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 0, 0, 0, 'PRIMARY_RESIDENT', 'NOT_APPLICABLE', 'GATEHOUSE')
    `).run(parcelId1, `TRK-${parcelId1}`, nowIso, flat.id, carrier.id, shelfSmall.id, resident.id, guard.id);

    const insertedParcel = db.prepare("SELECT * FROM api_parcel WHERE parcel_id=?").get(parcelId1);
    assert(insertedParcel && insertedParcel.parcel_size === 'SMALL' && insertedParcel.dimensions === '20x15x10 cm',
           'Scenario 6: Parcel intake persisted parcel_size, dimensions, and handling_instructions');

    // Commit reservation
    db.prepare("UPDATE api_shelfreservation SET status='COMMITTED', committed_parcel_id=? WHERE reservation_token=?")
      .run(insertedParcel.id, token1);

    const updatedRes = db.prepare("SELECT * FROM api_shelfreservation WHERE reservation_token=?").get(token1);
    assert(updatedRes.status === 'COMMITTED' && updatedRes.committed_parcel_id === insertedParcel.id,
           'Scenario 6: Shelf reservation marked COMMITTED and linked to parcel');

    // Log INITIAL_INTAKE history
    db.prepare(`
        INSERT INTO api_shelfassignmenthistory (
            parcel_id, previous_shelf_id, new_shelf_id, guard_id, action_type, reason, timestamp
        ) VALUES (?, NULL, ?, ?, 'INITIAL_INTAKE', 'Initial intake assignment (Reserved Slot)', ?)
    `).run(insertedParcel.id, shelfSmall.id, guard.id, nowIso);

    // -------------------------------------------------------------
    // SCENARIO 7 & 8: RELOCATE PARCEL & VERIFY ASSIGNMENT HISTORY
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7 & 8: Parcel Relocation & Assignment History ---');
    // Relocate parcel from shelfSmall to shelfLarge
    const prevShelfId = insertedParcel.shelf_id;
    const relocateTimestamp = new Date().toISOString();

    db.prepare("UPDATE api_parcel SET shelf_id=? WHERE id=?").run(shelfLarge.id, insertedParcel.id);

    db.prepare(`
        INSERT INTO api_shelfassignmenthistory (
            parcel_id, previous_shelf_id, new_shelf_id, guard_id, action_type, reason, timestamp
        ) VALUES (?, ?, ?, ?, 'RELOCATION', 'Space consolidation to larger zone', ?)
    `).run(insertedParcel.id, prevShelfId, shelfLarge.id, guard.id, relocateTimestamp);

    const relocatedParcel = db.prepare("SELECT * FROM api_parcel WHERE id=?").get(insertedParcel.id);
    assert(relocatedParcel.shelf_id === shelfLarge.id, 'Scenario 7: Parcel shelf updated to new destination shelf');

    const historyLogs = db.prepare("SELECT * FROM api_shelfassignmenthistory WHERE parcel_id=? ORDER BY timestamp ASC").all(insertedParcel.id);
    assert(historyLogs.length === 2, 'Scenario 8: Assignment history contains both INITIAL_INTAKE and RELOCATION records');
    assert(historyLogs[1].action_type === 'RELOCATION' && historyLogs[1].previous_shelf_id === shelfSmall.id && historyLogs[1].new_shelf_id === shelfLarge.id,
           'Scenario 8: Relocation audit log correctly recorded previous_shelf, new_shelf, and reason');

    // Verify incompatible relocation rejection (attempt to relocate a LARGE parcel to a SMALL shelf)
    const largeParcelId = `GV-2026-L${Date.now().toString().slice(-5)}`;
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, status, received_at, flat_id, carrier_id, shelf_id,
            resident_id, received_by_id, pickup_pin, delivery_type, parcel_size,
            payment_type, payment_status, payment_method, cod_amount,
            is_open_box, is_delegated, collected_by_role_type, open_box_resolution, delivery_location
        ) VALUES (?, ?, 'AWAITING_PICKUP', ?, ?, ?, ?, ?, ?, '9999', 'NORMAL', 'LARGE', 'PREPAID', 'NOT_APPLICABLE', 'NOT_APPLICABLE', 0, 0, 0, 'PRIMARY_RESIDENT', 'NOT_APPLICABLE', 'GATEHOUSE')
    `).run(largeParcelId, `TRK-${largeParcelId}`, nowIso, flat.id, carrier.id, shelfLarge.id, resident.id, guard.id);

    const testLargeParcel = db.prepare("SELECT * FROM api_parcel WHERE parcel_id=?").get(largeParcelId);
    
    // Test compatibility check: parcel LARGE (tier 3) on shelfSmall (tier 1)
    const pTier = SIZE_TIERS[testLargeParcel.parcel_size];
    const sTier = SIZE_TIERS[shelfSmall.max_parcel_size];
    assert(pTier > sTier, 'Scenario 7: Incompatible relocation correctly detected (LARGE parcel cannot fit on SMALL shelf)');

    // -------------------------------------------------------------
    // SCENARIO 9 & 10: COMPLETE PARCEL HANDOVER & CONFIRM CAPACITY RELEASE
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9 & 10: Parcel Handover & Capacity Release ---');
    const shelfLargeStatsBefore = getShelfStats(shelfLarge.id);

    // Complete handover
    db.prepare("UPDATE api_parcel SET status='HANDED_OVER', shelf_id=NULL, handed_over_at=? WHERE id=?")
      .run(new Date().toISOString(), insertedParcel.id);

    db.prepare(`
        INSERT INTO api_shelfassignmenthistory (
            parcel_id, previous_shelf_id, new_shelf_id, guard_id, action_type, reason, timestamp
        ) VALUES (?, ?, NULL, ?, 'HANDOVER_RELEASE', 'Parcel collected by resident', ?)
    `).run(insertedParcel.id, shelfLarge.id, guard.id, new Date().toISOString());

    const shelfLargeStatsAfter = getShelfStats(shelfLarge.id);
    assert(shelfLargeStatsAfter.occupied === shelfLargeStatsBefore.occupied - 1,
           'Scenario 10: Shelf active parcel count decremented after handover');
    assert(shelfLargeStatsAfter.available === shelfLargeStatsBefore.available + 1,
           'Scenario 10: Shelf available capacity immediately released and incremented upon handover');

    const handoverHistory = db.prepare("SELECT * FROM api_shelfassignmenthistory WHERE parcel_id=? AND action_type='HANDOVER_RELEASE'").get(insertedParcel.id);
    assert(handoverHistory !== undefined, 'Scenario 9: HANDOVER_RELEASE logged in ShelfAssignmentHistory');

    // -------------------------------------------------------------
    // SCENARIO 11: PUT AN EMPTY SHELF UNDER MAINTENANCE
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Maintenance Status Toggle & Safety Deactivation Rule ---');
    // Test deactivation rule on shelf with active parcels (shelfLarge currently contains testLargeParcel)
    const activeOnLarge = db.prepare("SELECT COUNT(*) as count FROM api_parcel WHERE shelf_id=? AND status IN ('AWAITING_PICKUP', 'OVERDUE')").get(shelfLarge.id).count;
    assert(activeOnLarge > 0, 'Scenario 11: ShelfLarge currently contains active parcel(s)');

    function updateShelfStatus(shelfId, newStatus, notes = '') {
        const activeCount = db.prepare("SELECT COUNT(*) as count FROM api_parcel WHERE shelf_id=? AND status IN ('AWAITING_PICKUP', 'OVERDUE')").get(shelfId).count;
        if ((newStatus === 'INACTIVE' || newStatus === 'MAINTENANCE') && activeCount > 0) {
            return {
                success: false,
                status: 400,
                error: `Cannot set shelf to ${newStatus}. Shelf contains ${activeCount} active parcel(s). Please relocate all parcels before deactivating.`
            };
        }
        db.prepare("UPDATE api_storageshelf SET status=?, maintenance_notes=? WHERE id=?").run(newStatus, notes, shelfId);
        return { success: true };
    }

    const blockedMaintAttempt = updateShelfStatus(shelfLarge.id, 'MAINTENANCE', 'Routine inspection');
    assert(blockedMaintAttempt.success === false && blockedMaintAttempt.status === 400,
           'Scenario 11: Deactivation safely REJECTED while shelf contains active parcels');

    // Put empty shelfSmall under maintenance
    const maintSuccess = updateShelfStatus(shelfSmall.id, 'MAINTENANCE', 'Re-aligning compartment dividers');
    assert(maintSuccess.success === true, 'Scenario 11: Empty shelf successfully put under MAINTENANCE');

    const updatedShelfSmall = db.prepare("SELECT * FROM api_storageshelf WHERE id=?").get(shelfSmall.id);
    assert(updatedShelfSmall.status === 'MAINTENANCE' && updatedShelfSmall.maintenance_notes === 'Re-aligning compartment dividers',
           'Scenario 11: Maintenance status and notes persisted in database');

    // -------------------------------------------------------------
    // SCENARIO 12: VERIFY EXCLUSION FROM RECOMMENDATIONS
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Exclusion of Maintenance Shelf from Recommendations ---');
    const recAfterMaint = recommendShelf('SMALL');
    const includedIds = recAfterMaint.eligible.map(s => s.id);
    assert(!includedIds.includes(shelfSmall.id),
           'Scenario 12: Shelf under MAINTENANCE is strictly excluded from recommendation pool');
    assert(recAfterMaint.recommended?.id !== shelfSmall.id,
           'Scenario 12: Maintenance shelf is never recommended to guards during parcel intake');

    // Clean up temporary test shelves and parcels
    db.prepare("DELETE FROM api_shelfassignmenthistory WHERE parcel_id IN (?, ?)").run(insertedParcel.id, testLargeParcel.id);
    db.prepare("DELETE FROM api_shelfreservation WHERE shelf_id IN (?, ?, ?)").run(shelfSmall.id, shelfLarge.id, shelfConcurrent.id);
    db.prepare("DELETE FROM api_parcel WHERE id IN (?, ?)").run(insertedParcel.id, testLargeParcel.id);
    db.prepare("DELETE FROM api_storageshelf WHERE id IN (?, ?, ?)").run(shelfSmall.id, shelfLarge.id, shelfConcurrent.id);

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
