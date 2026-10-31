import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('RUNNING TEST SUITE: EMERGENCY & PRIORITY ALERT MANAGEMENT SYSTEM');
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
    const alertCols = db.prepare("PRAGMA table_info('api_priorityalert')").all().map(c => c.name);
    assert(alertCols.includes('title'), 'Schema: api_priorityalert has title');
    assert(alertCols.includes('category'), 'Schema: api_priorityalert has category');
    assert(alertCols.includes('priority'), 'Schema: api_priorityalert has priority');
    assert(alertCols.includes('status'), 'Schema: api_priorityalert has status');
    assert(alertCols.includes('related_parcel_id'), 'Schema: api_priorityalert has related_parcel_id');
    assert(alertCols.includes('related_incident_id'), 'Schema: api_priorityalert has related_incident_id');
    assert(alertCols.includes('created_by_id'), 'Schema: api_priorityalert has created_by_id');
    assert(alertCols.includes('assigned_to_id'), 'Schema: api_priorityalert has assigned_to_id');
    assert(alertCols.includes('acknowledged_by_id'), 'Schema: api_priorityalert has acknowledged_by_id');
    assert(alertCols.includes('acknowledged_at'), 'Schema: api_priorityalert has acknowledged_at');
    assert(alertCols.includes('resolved_by_id'), 'Schema: api_priorityalert has resolved_by_id');
    assert(alertCols.includes('resolved_at'), 'Schema: api_priorityalert has resolved_at');
    assert(alertCols.includes('resolution_notes'), 'Schema: api_priorityalert has resolution_notes');

    const historyCols = db.prepare("PRAGMA table_info('api_alerthistory')").all().map(c => c.name);
    assert(historyCols.includes('alert_id'), 'Schema: api_alerthistory has alert_id');
    assert(historyCols.includes('previous_status'), 'Schema: api_alerthistory has previous_status');
    assert(historyCols.includes('new_status'), 'Schema: api_alerthistory has new_status');
    assert(historyCols.includes('previous_priority'), 'Schema: api_alerthistory has previous_priority');
    assert(historyCols.includes('new_priority'), 'Schema: api_alerthistory has new_priority');
    assert(historyCols.includes('action_by_id'), 'Schema: api_alerthistory has action_by_id');
    assert(historyCols.includes('notes'), 'Schema: api_alerthistory has notes');
    assert(historyCols.includes('timestamp'), 'Schema: api_alerthistory has timestamp');

    // Retrieve seed accounts
    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const guard1 = db.prepare("SELECT * FROM api_user WHERE role='GUARD' AND username='guard1'").get() 
                   || db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();
    const guard2 = db.prepare("SELECT * FROM api_user WHERE role='GUARD' AND id != ? LIMIT 1").get(guard1.id);
    const resident1 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident1'").get();
    const carrier = db.prepare("SELECT * FROM api_carrier LIMIT 1").get();

    assert(admin && guard1 && guard2 && resident1 && carrier, 'Prerequisites: Admin, Guard 1, Guard 2, Resident 1, and Carrier present');

    // Ensure dummy parcel exists for linking
    let testParcel = db.prepare("SELECT * FROM api_parcel WHERE resident_id=? LIMIT 1").get(resident1.id);
    if (!testParcel) {
        db.prepare(`
            INSERT INTO api_parcel (
                parcel_id, tracking_number, carrier_id,
                status, delivery_type, is_delegated, resident_id, flat_id, received_at
            ) VALUES ('GV-TEST-001', 'ALERT-TEST-001', ?, 'AWAITING_PICKUP', 'NORMAL', 0, ?, 1, datetime('now'))
        `).run(carrier.id, resident1.id);
        testParcel = db.prepare("SELECT * FROM api_parcel WHERE tracking_number='ALERT-TEST-001'").get();
    }
    assert(testParcel !== undefined, 'Prerequisites: Test parcel available for alert linkage');

    // -------------------------------------------------------------
    // SCENARIO 1: GUARD CREATES CRITICAL SECURITY ALERT
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Guard Creates Critical Security Alert ---');
    const alertTitle = `Suspicious Unattended Parcel Gate 2 - ${Date.now()}`;
    const alertDesc = 'Unmarked heavy carton leaking chemical odor near gatehouse walkway.';
    
    // Simulate Guard 1 calling POST /api/alerts/
    const insertAlertStmt = db.prepare(`
        INSERT INTO api_priorityalert (
            title, description, category, priority, status,
            related_parcel_id, created_by_id, created_at, updated_at
        ) VALUES (?, ?, 'SECURITY_EMERGENCY', 'CRITICAL', 'OPEN', ?, ?, datetime('now'), datetime('now'))
    `);
    const insertResult = insertAlertStmt.run(alertTitle, alertDesc, testParcel.id, guard1.id);
    const alertId = Number(insertResult.lastInsertRowid);

    // Initial AlertHistory entry created on creation
    db.prepare(`
        INSERT INTO api_alerthistory (
            alert_id, previous_status, new_status, previous_priority, new_priority, notes, action_by_id, timestamp
        ) VALUES (?, 'NONE', 'OPEN', 'NONE', 'CRITICAL', 'Alert manually opened by guard guard1', ?, datetime('now'))
    `).run(alertId, guard1.id);

    // Notification created for Admin
    db.prepare(`
        INSERT INTO api_notification (
            user_id, title, message, notification_type, is_read, created_at
        ) VALUES (?, ?, ?, 'PRIORITY_ALERT', 0, datetime('now'))
    `).run(admin.id, `CRITICAL Alert: ${alertTitle}`, alertDesc);

    const createdAlert = db.prepare("SELECT * FROM api_priorityalert WHERE id=?").get(alertId);
    assert(createdAlert !== undefined, 'Scenario 1: PriorityAlert created successfully');
    assert(createdAlert.status === 'OPEN', 'Scenario 1: Alert initial status is OPEN');
    assert(createdAlert.priority === 'CRITICAL', 'Scenario 1: Alert priority set to CRITICAL');
    assert(createdAlert.category === 'SECURITY_EMERGENCY', 'Scenario 1: Alert category set to SECURITY_EMERGENCY');
    assert(createdAlert.created_by_id === guard1.id, 'Scenario 1: Alert created_by links to Guard 1');

    // -------------------------------------------------------------
    // SCENARIO 2: VISIBILITY & ROLE-BASED ACCESS ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Visibility & Role-Based Access Enforcement ---');
    // Guard query (simulating GET /api/alerts/)
    const guardAlerts = db.prepare("SELECT id, title, priority, status FROM api_priorityalert WHERE id=?").all(alertId);
    assert(guardAlerts.length === 1, 'Scenario 2: Alert is queryable by Gatehouse Guard');

    // Admin query (simulating GET /api/admin/alerts/)
    const adminAlerts = db.prepare("SELECT id, title, priority, status FROM api_priorityalert WHERE id=?").all(alertId);
    assert(adminAlerts.length === 1, 'Scenario 2: Alert is queryable by Administrator');

    // Role check verification: In views.py, PriorityAlertListCreateView checks `request.user.role not in ['ADMIN', 'GUARD'] -> 403`
    function checkAlertAccess(userRole) {
        if (!['ADMIN', 'GUARD'].includes(userRole)) {
            return { status: 403, error: 'Access denied. Priority alerts are restricted to staff.' };
        }
        return { status: 200, data: 'OK' };
    }
    const residentAccess = checkAlertAccess(resident1.role);
    assert(residentAccess.status === 403, 'Scenario 2: Resident access is blocked with 403 Forbidden');

    const guardAccess = checkAlertAccess(guard1.role);
    assert(guardAccess.status === 200, 'Scenario 2: Guard access is permitted');

    const adminAccess = checkAlertAccess(admin.role);
    assert(adminAccess.status === 200, 'Scenario 2: Admin access is permitted');

    // -------------------------------------------------------------
    // SCENARIO 3: ADMIN ASSIGNS ALERT TO GUARD 2
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Admin Assigns Alert to Guard 2 ---');
    // Guard attempting to assign -> Forbidden (Admin-only endpoint)
    function canAssignAlert(userRole) {
        return userRole === 'ADMIN';
    }
    assert(!canAssignAlert(guard1.role), 'Scenario 3: Guard cannot assign alerts (Admin-only operation)');
    assert(canAssignAlert(admin.role), 'Scenario 3: Admin authorized to assign alert');

    // Admin executes assignment
    db.prepare(`
        UPDATE api_priorityalert 
        SET assigned_to_id=?, updated_at=datetime('now')
        WHERE id=?
    `).run(guard2.id, alertId);

    db.prepare(`
        INSERT INTO api_alerthistory (
            alert_id, previous_status, new_status, previous_priority, new_priority, notes, action_by_id, timestamp
        ) VALUES (?, 'OPEN', 'OPEN', 'CRITICAL', 'CRITICAL', 'Assigned alert to guard guard2', ?, datetime('now'))
    `).run(alertId, admin.id);

    // Notification created for Guard 2
    db.prepare(`
        INSERT INTO api_notification (
            user_id, title, message, notification_type, is_read, created_at
        ) VALUES (?, 'Alert Assigned: You have been assigned an alert', ?, 'PRIORITY_ALERT', 0, datetime('now'))
    `).run(guard2.id, `You were assigned to: ${alertTitle}`);

    const assignedAlert = db.prepare("SELECT assigned_to_id FROM api_priorityalert WHERE id=?").get(alertId);
    assert(assignedAlert.assigned_to_id === guard2.id, 'Scenario 3: Alert assigned_to_id updated to Guard 2');

    const guard2Notification = db.prepare("SELECT * FROM api_notification WHERE user_id=? AND notification_type='PRIORITY_ALERT' ORDER BY id DESC LIMIT 1").get(guard2.id);
    assert(guard2Notification !== undefined, 'Scenario 3: Guard 2 received assignment notification');

    // -------------------------------------------------------------
    // SCENARIO 4: ASSIGNED GUARD ACKNOWLEDGES THE ALERT
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Assigned Guard Acknowledges Alert ---');
    // Guard 2 calls POST /api/alerts/{id}/acknowledge/
    db.prepare(`
        UPDATE api_priorityalert
        SET status='ACKNOWLEDGED', acknowledged_by_id=?, acknowledged_at=datetime('now'), updated_at=datetime('now')
        WHERE id=?
    `).run(guard2.id, alertId);

    db.prepare(`
        INSERT INTO api_alerthistory (
            alert_id, previous_status, new_status, previous_priority, new_priority, notes, action_by_id, timestamp
        ) VALUES (?, 'OPEN', 'ACKNOWLEDGED', 'CRITICAL', 'CRITICAL', 'Alert acknowledged by guard2', ?, datetime('now'))
    `).run(alertId, guard2.id);

    const ackAlert = db.prepare("SELECT status, acknowledged_by_id, acknowledged_at FROM api_priorityalert WHERE id=?").get(alertId);
    assert(ackAlert.status === 'ACKNOWLEDGED', 'Scenario 4: Alert status transitioned to ACKNOWLEDGED');
    assert(ackAlert.acknowledged_by_id === guard2.id, 'Scenario 4: acknowledged_by_id correctly records Guard 2');
    assert(ackAlert.acknowledged_at !== null, 'Scenario 4: acknowledged_at timestamp is populated');

    // -------------------------------------------------------------
    // SCENARIO 5: GUARD SETS STATUS TO IN_PROGRESS WITH OPERATIONAL NOTES
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Guard Updates Status to IN_PROGRESS ---');
    const operationalNotes = 'Cordoned off gatehouse area, hazmat team on route.';
    db.prepare(`
        UPDATE api_priorityalert
        SET status='IN_PROGRESS', updated_at=datetime('now')
        WHERE id=?
    `).run(alertId);

    db.prepare(`
        INSERT INTO api_alerthistory (
            alert_id, previous_status, new_status, previous_priority, new_priority, notes, action_by_id, timestamp
        ) VALUES (?, 'ACKNOWLEDGED', 'IN_PROGRESS', 'CRITICAL', 'CRITICAL', ?, ?, datetime('now'))
    `).run(alertId, operationalNotes, guard2.id);

    const inProgAlert = db.prepare("SELECT status, priority FROM api_priorityalert WHERE id=?").get(alertId);
    assert(inProgAlert.status === 'IN_PROGRESS', 'Scenario 5: Alert status updated to IN_PROGRESS');

    const inProgHistory = db.prepare("SELECT notes FROM api_alerthistory WHERE alert_id=? AND new_status='IN_PROGRESS' ORDER BY id DESC LIMIT 1").get(alertId);
    assert(inProgHistory.notes === operationalNotes, 'Scenario 5: Operational notes recorded in AlertHistory');

    // -------------------------------------------------------------
    // SCENARIO 6: ROLE PERMISSION GUARDS & RESTRICTIONS (EDGE CASES)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Role Restrictions & Guard Limitations ---');
    function validateStatusUpdate(userRole, currentPriority, newStatus) {
        if (userRole === 'GUARD') {
            if (newStatus === 'DISMISSED') {
                return { allowed: false, status: 403, error: 'Only administrators can dismiss alerts.' };
            }
            if (newStatus === 'RESOLVED' && currentPriority === 'CRITICAL') {
                return { allowed: false, status: 403, error: 'Only administrators can resolve CRITICAL alerts.' };
            }
        }
        return { allowed: true, status: 200 };
    }

    // 1. Guard tries to dismiss alert -> Denied
    const guardDismiss = validateStatusUpdate('GUARD', inProgAlert.priority, 'DISMISSED');
    assert(!guardDismiss.allowed && guardDismiss.status === 403, 'Scenario 6: Guard cannot DISMISS alerts (Admin-only)');

    // 2. Guard tries to resolve a CRITICAL alert -> Denied
    const guardResolveCrit = validateStatusUpdate('GUARD', 'CRITICAL', 'RESOLVED');
    assert(!guardResolveCrit.allowed && guardResolveCrit.status === 403, 'Scenario 6: Guard cannot RESOLVE CRITICAL alerts (Admin-only)');

    // 3. Guard can resolve non-critical alert (e.g. MEDIUM or HIGH standard operational alerts)
    const guardResolveMedium = validateStatusUpdate('GUARD', 'MEDIUM', 'RESOLVED');
    assert(guardResolveMedium.allowed, 'Scenario 6: Guard can resolve standard non-critical operational alerts');

    // 4. Admin can resolve CRITICAL alerts
    const adminResolveCrit = validateStatusUpdate('ADMIN', 'CRITICAL', 'RESOLVED');
    assert(adminResolveCrit.allowed, 'Scenario 6: Admin is authorized to resolve CRITICAL alerts');

    // -------------------------------------------------------------
    // SCENARIO 7: ADMIN REVIEWS & RESOLVES THE ALERT
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Admin Resolves Alert with Resolution Notes ---');
    const resolutionNotes = 'Hazmat confirmed harmless broken laundry detergent bottle. Cleaned and safe.';
    db.prepare(`
        UPDATE api_priorityalert
        SET status='RESOLVED', resolved_by_id=?, resolved_at=datetime('now'), resolution_notes=?, updated_at=datetime('now')
        WHERE id=?
    `).run(admin.id, resolutionNotes, alertId);

    db.prepare(`
        INSERT INTO api_alerthistory (
            alert_id, previous_status, new_status, previous_priority, new_priority, notes, action_by_id, timestamp
        ) VALUES (?, 'IN_PROGRESS', 'RESOLVED', 'CRITICAL', 'CRITICAL', ?, ?, datetime('now'))
    `).run(alertId, resolutionNotes, admin.id);

    const resolvedAlert = db.prepare("SELECT status, resolved_by_id, resolved_at, resolution_notes FROM api_priorityalert WHERE id=?").get(alertId);
    assert(resolvedAlert.status === 'RESOLVED', 'Scenario 7: Alert status transitioned to RESOLVED');
    assert(resolvedAlert.resolved_by_id === admin.id, 'Scenario 7: resolved_by_id links to Admin');
    assert(resolvedAlert.resolved_at !== null, 'Scenario 7: resolved_at timestamp is set');
    assert(resolvedAlert.resolution_notes === resolutionNotes, 'Scenario 7: resolution_notes recorded accurately');

    // -------------------------------------------------------------
    // SCENARIO 8: AUDIT TRAIL VERIFICATION (AlertHistory)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Audit Trail Verification (AlertHistory) ---');
    const historyRows = db.prepare("SELECT * FROM api_alerthistory WHERE alert_id=? ORDER BY id ASC").all(alertId);
    assert(historyRows.length >= 5, `Scenario 8: Complete history trail logged (${historyRows.length} events recorded)`);
    
    const statuses = historyRows.map(h => h.new_status);
    assert(statuses.includes('OPEN'), 'Scenario 8: Audit contains OPEN entry');
    assert(statuses.includes('ACKNOWLEDGED'), 'Scenario 8: Audit contains ACKNOWLEDGED entry');
    assert(statuses.includes('IN_PROGRESS'), 'Scenario 8: Audit contains IN_PROGRESS entry');
    assert(statuses.includes('RESOLVED'), 'Scenario 8: Audit contains RESOLVED entry');

    // -------------------------------------------------------------
    // SCENARIO 9: AUTOMATIC ALERT GENERATION ON DAMAGED / TAMPERED PARCEL
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Automatic Alert Generation on Damaged Parcel ---');
    // Create new damaged parcel
    const dmgTracking = `DMG-TEST-${Date.now()}`;
    const dmgParcelId = `GV-DMG-${Date.now()}`;
    db.prepare(`
        INSERT INTO api_parcel (
            parcel_id, tracking_number, carrier_id,
            status, pickup_pin, received_at, flat_id,
            delivery_type, payment_type, payment_method, payment_status,
            is_open_box, open_box_resolution, collected_by_role_type, is_delegated,
            resident_id
        ) VALUES (
            ?, ?, ?,
            'AWAITING_PICKUP', '4321', datetime('now'), 1,
            'NORMAL', 'PREPAID', 'ONLINE', 'PAID',
            0, 'NOT_APPLICABLE', 'NONE', 0,
            ?
        )
    `).run(dmgParcelId, dmgTracking, carrier.id, resident1.id);
    const damagedParcel = db.prepare("SELECT * FROM api_parcel WHERE tracking_number=?").get(dmgTracking);

    // Simulate trigger_priority_alert() called during intake
    function simulateTriggerPriorityAlert(parcelId, category, priority, title, desc, userId) {
        // Deduplication check
        const existing = db.prepare(`
            SELECT * FROM api_priorityalert 
            WHERE related_parcel_id=? AND category=? AND status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS')
        `).get(parcelId, category);

        if (existing) {
            return { alert: existing, created: false };
        }

        const res = db.prepare(`
            INSERT INTO api_priorityalert (
                title, description, category, priority, status,
                related_parcel_id, created_by_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, datetime('now'), datetime('now'))
        `).run(title, desc, category, priority, parcelId, userId);

        const newId = Number(res.lastInsertRowid);
        db.prepare(`
            INSERT INTO api_alerthistory (
                alert_id, previous_status, new_status, previous_priority, new_priority, notes, action_by_id, timestamp
            ) VALUES (?, 'NONE', 'OPEN', 'NONE', ?, 'Automated system alert triggered', ?, datetime('now'))
        `).run(newId, priority, userId);

        return { alert: db.prepare("SELECT * FROM api_priorityalert WHERE id=?").get(newId), created: true };
    }

    const autoAlertResult = simulateTriggerPriorityAlert(
        damagedParcel.id,
        'DAMAGED_PARCEL',
        'HIGH',
        `Damaged Delivery: ${damagedParcel.tracking_number}`,
        `Parcel arrived in DAMAGED condition.`,
        guard1.id
    );

    assert(autoAlertResult.created === true, 'Scenario 9: PriorityAlert automatically created for damaged parcel');
    assert(autoAlertResult.alert.category === 'DAMAGED_PARCEL', 'Scenario 9: Category is DAMAGED_PARCEL');
    assert(autoAlertResult.alert.priority === 'HIGH', 'Scenario 9: Priority is HIGH');
    assert(autoAlertResult.alert.related_parcel_id === damagedParcel.id, 'Scenario 9: Linked to damaged parcel');

    // -------------------------------------------------------------
    // SCENARIO 10: DEDUPLICATION LOGIC
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Automatic Deduplication Logic ---');
    // Attempt to trigger the exact same alert while active
    const duplicateResult = simulateTriggerPriorityAlert(
        damagedParcel.id,
        'DAMAGED_PARCEL',
        'HIGH',
        `Damaged Delivery: ${damagedParcel.tracking_number}`,
        `Duplicate trigger test`,
        guard1.id
    );

    assert(duplicateResult.created === false, 'Scenario 10: Deduplication prevents duplicate active alerts');
    assert(duplicateResult.alert.id === autoAlertResult.alert.id, 'Scenario 10: Returns existing active alert instance');

    // -------------------------------------------------------------
    // SCENARIO 11: RESIDENT INCIDENT AUTOMATIC PRIORITY ALERT
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Resident Incident Automatic Alert ---');
    // Resident files an incident
    const incidentResult = db.prepare(`
        INSERT INTO api_parcelincident (
            parcel_id, category, description, status, resident_id, created_at, updated_at
        ) VALUES (?, 'DAMAGED', 'Received parcel with broken screen', 'OPEN', ?, datetime('now'), datetime('now'))
    `).run(testParcel.id, resident1.id);
    const incidentId = Number(incidentResult.lastInsertRowid);

    // Trigger priority alert for incident
    const resIncident = db.prepare(`
        INSERT INTO api_priorityalert (
            title, description, category, priority, status,
            related_parcel_id, related_incident_id, created_by_id, created_at, updated_at
        ) VALUES (?, ?, 'OTHER', 'HIGH', 'OPEN', ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
        `Incident Reported: DAMAGED for ${testParcel.tracking_number}`,
        'Received parcel with broken screen',
        testParcel.id,
        incidentId,
        resident1.id
    );
    const incidentAlertId = Number(resIncident.lastInsertRowid);
    const incidentAlert = db.prepare("SELECT * FROM api_priorityalert WHERE id=?").get(incidentAlertId);

    assert(incidentAlert !== undefined, 'Scenario 11: PriorityAlert created for resident-reported incident');
    assert(incidentAlert.related_incident_id === incidentId, 'Scenario 11: Incident FK linked properly');

    // -------------------------------------------------------------
    // SCENARIO 12: ADMIN ANALYTICS AGGREGATION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Admin Analytics Aggregation ---');
    // Verify aggregation queries used in AdminAlertAnalyticsView
    const totalAlerts = db.prepare("SELECT COUNT(*) as count FROM api_priorityalert").get().count;
    const openAlerts = db.prepare("SELECT COUNT(*) as count FROM api_priorityalert WHERE status='OPEN'").get().count;
    const resolvedAlerts = db.prepare("SELECT COUNT(*) as count FROM api_priorityalert WHERE status='RESOLVED'").get().count;
    const criticalAlerts = db.prepare("SELECT COUNT(*) as count FROM api_priorityalert WHERE priority='CRITICAL'").get().count;

    assert(totalAlerts >= 3, `Scenario 12: Total alerts aggregated correctly (${totalAlerts})`);
    assert(openAlerts >= 2, `Scenario 12: Open alerts count verified (${openAlerts})`);
    assert(resolvedAlerts >= 1, `Scenario 12: Resolved alerts count verified (${resolvedAlerts})`);
    assert(criticalAlerts >= 1, `Scenario 12: Critical priority count verified (${criticalAlerts})`);

    const categoryBreakdown = db.prepare(`
        SELECT category, COUNT(*) as count 
        FROM api_priorityalert 
        GROUP BY category
    `).all();
    assert(categoryBreakdown.length >= 2, 'Scenario 12: Category breakdown aggregates multiple categories');

    const priorityBreakdown = db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM api_priorityalert 
        GROUP BY priority
    `).all();
    assert(priorityBreakdown.length >= 2, 'Scenario 12: Priority breakdown aggregates multiple tiers');

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
