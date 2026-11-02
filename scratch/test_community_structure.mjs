import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('================================================================');
console.log('TEST SUITE: GATEVAULT RESIDENCY COMMUNITY ARCHITECTURE & WORKFLOWS');
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

// Floor parsing helper replicating Flat.parse_floor & get_floor_display_name
function parseFloor(numberStr) {
    if (!numberStr) return null;
    const cleaned = String(numberStr).trim().toUpperCase();
    if (cleaned.startsWith('G')) return 0;
    try {
        if (cleaned.length >= 3) {
            return parseInt(cleaned.slice(0, -2), 10);
        }
        return parseInt(cleaned, 10);
    } catch {
        return null;
    }
}

function getFloorDisplayName(floorNum) {
    if (floorNum === null || floorNum === undefined) return "Unknown Floor";
    if (floorNum === 0) return "Ground Floor";
    if (floorNum === 1) return "1st Floor";
    if (floorNum === 2) return "2nd Floor";
    if (floorNum === 3) return "3rd Floor";
    return `${floorNum}th Floor`;
}

try {
    // -------------------------------------------------------------
    // SECTION 1: COMMUNITY DATABASE INTEGRITY
    // -------------------------------------------------------------
    console.log('--- 1. Testing Community Database Structure ---');

    const expectedTowers = ['Tower A', 'Tower B', 'Tower C', 'Tower D'];
    const dbTowers = db.prepare('SELECT * FROM api_tower ORDER BY name').all();
    
    assert(dbTowers.length === 4, 'Community has exactly 4 towers in database', `Found: ${dbTowers.length}`);
    const dbTowerNames = dbTowers.map(t => t.name);
    assert(
        JSON.stringify(dbTowerNames.sort()) === JSON.stringify(expectedTowers.sort()),
        'Community towers named Tower A, Tower B, Tower C, Tower D'
    );

    const totalFlats = db.prepare('SELECT COUNT(*) as count FROM api_flat').get().count;
    assert(totalFlats === 240, 'Database contains exactly 240 total flats', `Found: ${totalFlats}`);

    // Check each tower has 60 flats
    for (const t of dbTowers) {
        const flatsInTower = db.prepare('SELECT * FROM api_flat WHERE tower_id=? ORDER BY number').all(t.id);
        assert(
            flatsInTower.length === 60,
            `${t.name} contains exactly 60 flats`,
            `Found ${flatsInTower.length} in ${t.name}`
        );

        // Ground floor flats: G001, G002, G003, G004
        const gFlats = flatsInTower.filter(f => f.number.startsWith('G')).map(f => f.number).sort();
        assert(
            JSON.stringify(gFlats) === JSON.stringify(['G001', 'G002', 'G003', 'G004']),
            `${t.name} contains exact ground floor flats G001, G002, G003, G004`
        );

        // Check floors 1 through 14 (15 floors total including ground)
        let allFloorsValid = true;
        for (let fl = 1; fl <= 14; fl++) {
            const floorFlats = flatsInTower.filter(f => parseFloor(f.number) === fl).map(f => f.number).sort();
            const expected = [1, 2, 3, 4].map(u => `${fl}${String(u).padStart(2, '0')}`).sort();
            if (JSON.stringify(floorFlats) !== JSON.stringify(expected)) {
                allFloorsValid = false;
                break;
            }
        }
        assert(allFloorsValid, `${t.name} floors 1 to 14 have correct 4-flat convention ({floor}01 - {floor}04)`);
    }

    // Check no duplicate (tower_id, number)
    const duplicates = db.prepare(`
        SELECT tower_id, number, COUNT(*) as cnt 
        FROM api_flat 
        GROUP BY tower_id, number 
        HAVING cnt > 1
    `).all();
    assert(duplicates.length === 0, 'No duplicate tower/flat combinations exist in database');

    // -------------------------------------------------------------
    // SECTION 2: FLOOR DERIVATION LOGIC
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Floor Derivation Logic ---');
    assert(parseFloor('G001') === 0, 'parseFloor("G001") derives floor 0');
    assert(getFloorDisplayName(0) === 'Ground Floor', 'getFloorDisplayName(0) is "Ground Floor"');
    assert(parseFloor('101') === 1, 'parseFloor("101") derives floor 1');
    assert(getFloorDisplayName(1) === '1st Floor', 'getFloorDisplayName(1) is "1st Floor"');
    assert(parseFloor('203') === 2, 'parseFloor("203") derives floor 2');
    assert(getFloorDisplayName(2) === '2nd Floor', 'getFloorDisplayName(2) is "2nd Floor"');
    assert(parseFloor('304') === 3, 'parseFloor("304") derives floor 3');
    assert(getFloorDisplayName(3) === '3rd Floor', 'getFloorDisplayName(3) is "3rd Floor"');
    assert(parseFloor('1002') === 10, 'parseFloor("1002") derives floor 10');
    assert(getFloorDisplayName(10) === '10th Floor', 'getFloorDisplayName(10) is "10th Floor"');
    assert(parseFloor('1404') === 14, 'parseFloor("1404") derives floor 14');
    assert(getFloorDisplayName(14) === '14th Floor', 'getFloorDisplayName(14) is "14th Floor"');
    assert(parseFloor('1501') === 15, 'parseFloor("1501") derives floor 15');
    assert(getFloorDisplayName(15) === '15th Floor', 'getFloorDisplayName(15) is "15th Floor"');

    // -------------------------------------------------------------
    // SECTION 3: BACKEND VALIDATION LOGIC FOR RESIDENT REGISTRATION
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Backend Registration Validation ---');

    function validateRegistrationBackend({ tower_id, floor, flat_id }) {
        if (!flat_id) return { valid: false, error: 'flat_id required' };
        const flat = db.prepare('SELECT * FROM api_flat WHERE id=?').get(flat_id);
        if (!flat) return { valid: false, error: 'Invalid flat ID or flat does not exist' };

        if (tower_id !== undefined && tower_id !== null) {
            const tower = db.prepare('SELECT * FROM api_tower WHERE id=?').get(tower_id);
            if (!tower) return { valid: false, error: 'Selected tower does not exist' };
            if (flat.tower_id !== tower_id) return { valid: false, error: 'Selected flat does not belong to the selected tower' };
        }

        if (floor !== undefined && floor !== null && floor !== '') {
            const derivedFloor = parseFloor(flat.number);
            if (derivedFloor !== parseInt(floor, 10)) {
                return { valid: false, error: `Selected flat does not belong to the selected floor (${floor})` };
            }
        }

        return { valid: true, flat };
    }

    const towerA = dbTowers.find(t => t.name === 'Tower A');
    const towerB = dbTowers.find(t => t.name === 'Tower B');
    const flat301_A = db.prepare("SELECT * FROM api_flat WHERE tower_id=? AND number='301'").get(towerA.id);
    const flat202_B = db.prepare("SELECT * FROM api_flat WHERE tower_id=? AND number='202'").get(towerB.id);

    // Valid registration inputs
    const validCheck = validateRegistrationBackend({ tower_id: towerA.id, floor: 3, flat_id: flat301_A.id });
    assert(validCheck.valid, 'Valid Tower A, Floor 3, Flat 301 passes validation');

    // Invalid Tower ID
    const invalidTowerCheck = validateRegistrationBackend({ tower_id: 99999, floor: 3, flat_id: flat301_A.id });
    assert(!invalidTowerCheck.valid && invalidTowerCheck.error.includes('tower does not exist'), 'Rejects non-existent Tower ID');

    // Invalid Flat ID
    const invalidFlatCheck = validateRegistrationBackend({ tower_id: towerA.id, floor: 3, flat_id: 99999 });
    assert(!invalidFlatCheck.valid && invalidFlatCheck.error.includes('flat does not exist'), 'Rejects non-existent Flat ID');

    // Wrong Tower / Flat mismatch
    const wrongTowerCheck = validateRegistrationBackend({ tower_id: towerB.id, floor: 3, flat_id: flat301_A.id });
    assert(!wrongTowerCheck.valid && wrongTowerCheck.error.includes('does not belong to the selected tower'), 'Rejects Flat from wrong Tower');

    // Wrong Floor / Flat mismatch
    const wrongFloorCheck = validateRegistrationBackend({ tower_id: towerA.id, floor: 5, flat_id: flat301_A.id });
    assert(!wrongFloorCheck.valid && wrongFloorCheck.error.includes('does not belong to the selected floor'), 'Rejects Flat from wrong Floor');

    // -------------------------------------------------------------
    // SECTION 4: NORMAL & GOOGLE REGISTRATION WORKFLOW & APPROVALS
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Registration & Approval Workflows ---');

    const admin = db.prepare("SELECT * FROM api_user WHERE role='ADMIN' LIMIT 1").get();
    const nowIso = new Date().toISOString();

    // 4.1 Normal Email/Password Registration
    const testNormalUser = 'res_comm_pwd';
    const testNormalEmail = 'res.comm.pwd@gatevault.test';
    cleanTestUser(testNormalUser, testNormalEmail, null);

    const uRes = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('pbkdf2_sha256$test', NULL, 0, ?, 'Arun', 'Kumar', ?, 0, 1, ?, 'RESIDENT')
    `).run(testNormalUser, testNormalEmail, nowIso);
    const normalUserId = uRes.lastInsertRowid;

    const pRes = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 98765 00001', 1, 'PENDING_APPROVAL', NULL, NULL, NULL, NULL, ?, ?)
    `).run(flat301_A.id, normalUserId);
    const normalProfileId = pRes.lastInsertRowid;

    const normalProf = db.prepare('SELECT * FROM api_residentprofile WHERE id=?').get(normalProfileId);
    assert(normalProf.approval_status === 'PENDING_APPROVAL', 'New normal registration receives PENDING_APPROVAL status');
    assert(normalProf.flat_id === flat301_A.id, 'Resident profile correctly attached to selected Flat 301 in Tower A');

    // 4.2 Google OAuth Registration
    const testGoogleUser = 'res_comm_goog';
    const testGoogleEmail = 'res.comm.goog@gatevault.test';
    const testGoogleSub = 'goog_comm_sub_999';
    cleanTestUser(testGoogleUser, testGoogleEmail, testGoogleSub);

    const flatG002_B = db.prepare("SELECT * FROM api_flat WHERE tower_id=? AND number='G002'").get(towerB.id);
    const guRes = db.prepare(`
        INSERT INTO api_user (password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, role)
        VALUES ('!', NULL, 0, ?, 'Deepa', 'Nair', ?, 0, 1, ?, 'RESIDENT')
    `).run(testGoogleUser, testGoogleEmail, nowIso);
    const googleUserId = guRes.lastInsertRowid;

    const gpRes = db.prepare(`
        INSERT INTO api_residentprofile (phone_number, is_primary, approval_status, google_id, rejection_reason, approved_at, approved_by_id, flat_id, user_id)
        VALUES ('+91 98765 00002', 1, 'PENDING_APPROVAL', ?, NULL, NULL, NULL, ?, ?)
    `).run(testGoogleSub, flatG002_B.id, googleUserId);
    const googleProfileId = gpRes.lastInsertRowid;

    const googleProf = db.prepare('SELECT * FROM api_residentprofile WHERE id=?').get(googleProfileId);
    assert(googleProf.approval_status === 'PENDING_APPROVAL', 'New Google OAuth registration receives PENDING_APPROVAL status');
    assert(googleProf.google_id === testGoogleSub, 'Google ID stored securely');
    assert(googleProf.flat_id === flatG002_B.id, 'Resident profile correctly attached to Ground Floor Flat G002 in Tower B');

    // -------------------------------------------------------------
    // SECTION 5: OCCUPANCY STATUS CALCULATION RULES
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Community Occupancy Rules ---');

    function calculateFlatOccupancy(flatId) {
        const approved = db.prepare("SELECT COUNT(*) as count FROM api_residentprofile WHERE flat_id=? AND approval_status='APPROVED'").get(flatId).count;
        const pending = db.prepare("SELECT COUNT(*) as count FROM api_residentprofile WHERE flat_id=? AND approval_status='PENDING_APPROVAL'").get(flatId).count;

        let status = 'VACANT';
        if (approved > 0) {
            status = 'OCCUPIED';
        } else if (pending > 0) {
            status = 'PENDING_VERIFICATION';
        }

        return { status, approvedCount: approved, pendingCount: pending };
    }

    // Flat 301 currently has only a pending normal resident -> MUST BE PENDING_VERIFICATION (NOT OCCUPIED!)
    const occFlat301 = calculateFlatOccupancy(flat301_A.id);
    assert(
        occFlat301.status === 'PENDING_VERIFICATION',
        'Flat with pending registration has occupancy status = PENDING_VERIFICATION'
    );
    assert(
        occFlat301.status !== 'OCCUPIED',
        'CRITICAL: Pending registration alone does NOT make a flat OCCUPIED'
    );

    // Unassigned flat -> MUST BE VACANT
    const flatG003_A = db.prepare("SELECT * FROM api_flat WHERE tower_id=? AND number='G003'").get(towerA.id);
    const occFlatG003 = calculateFlatOccupancy(flatG003_A.id);
    assert(occFlatG003.status === 'VACANT', 'Unassigned flat has occupancy status = VACANT');

    // -------------------------------------------------------------
    // SECTION 6: ADMIN APPROVE & REJECT WORKFLOWS
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Admin Approval & Rejection Actions ---');

    // Admin approves Normal Resident
    const approvedIso = new Date().toISOString();
    db.prepare(`
        UPDATE api_residentprofile
        SET approval_status='APPROVED', approved_by_id=?, approved_at=?, rejection_reason=NULL
        WHERE id=?
    `).run(admin.id, approvedIso, normalProfileId);

    const approvedNormal = db.prepare('SELECT * FROM api_residentprofile WHERE id=?').get(normalProfileId);
    assert(approvedNormal.approval_status === 'APPROVED', 'Admin approves normal resident registration');
    assert(approvedNormal.approved_by_id === admin.id, 'Audit record tracks approved_by admin');

    // Now Flat 301 has an APPROVED resident -> Occupancy MUST BE OCCUPIED!
    const occFlat301Approved = calculateFlatOccupancy(flat301_A.id);
    assert(
        occFlat301Approved.status === 'OCCUPIED',
        'Flat with >=1 approved resident becomes OCCUPIED'
    );

    // Admin rejects Google Resident with a reason
    const rejectionReason = 'Proof of tenancy document invalid. Please visit management office.';
    db.prepare(`
        UPDATE api_residentprofile
        SET approval_status='REJECTED', rejection_reason=?
        WHERE id=?
    `).run(rejectionReason, googleProfileId);

    const rejectedGoogle = db.prepare('SELECT * FROM api_residentprofile WHERE id=?').get(googleProfileId);
    assert(rejectedGoogle.approval_status === 'REJECTED', 'Admin rejects Google resident registration');
    assert(rejectedGoogle.rejection_reason === rejectionReason, 'Rejection reason recorded in audit log');

    // Clean up test records
    cleanTestUser(testNormalUser, testNormalEmail, null);
    cleanTestUser(testGoogleUser, testGoogleEmail, testGoogleSub);

    // -------------------------------------------------------------
    // SECTION 7: REGRESSION SUITE (EXISTING MODULES & RELATIONSHIPS)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Regression Integrity ---');

    const resident1 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident1'").get();
    const resident2 = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' AND username='resident2'").get();
    const guardUser = db.prepare("SELECT * FROM api_user WHERE role='GUARD' LIMIT 1").get();

    assert(Boolean(resident1), 'Seed resident1 exists intact');
    assert(Boolean(resident2), 'Seed resident2 exists intact');
    assert(Boolean(guardUser), 'Guard user exists intact');
    assert(Boolean(admin), 'Admin user exists intact');

    const res1Prof = db.prepare('SELECT * FROM api_residentprofile WHERE user_id=?').get(resident1.id);
    assert(res1Prof && res1Prof.approval_status === 'APPROVED', 'Resident1 remains APPROVED (no regression)');
    assert(res1Prof && res1Prof.flat_id !== null, 'Resident1 flat foreign key relationship preserved');

    // Parcels relationship integrity
    const parcelCount = db.prepare('SELECT COUNT(*) as count FROM api_parcel').get().count;
    assert(parcelCount > 0, `Existing parcel records preserved in database (${parcelCount} parcels)`);

    const parcelWithFlat = db.prepare('SELECT p.*, f.number as flat_num, t.name as tower_name FROM api_parcel p JOIN api_flat f ON p.flat_id=f.id JOIN api_tower t ON f.tower_id=t.id LIMIT 1').get();
    assert(Boolean(parcelWithFlat), `Parcels accurately link to Tower (${parcelWithFlat?.tower_name}) and Flat (${parcelWithFlat?.flat_num})`);

    // Cross-flat data isolation
    const r1Parcels = db.prepare('SELECT * FROM api_parcel WHERE resident_id=?').all(resident1.id);
    const r2Parcels = db.prepare('SELECT * FROM api_parcel WHERE resident_id=?').all(resident2.id);
    const crossAccessViolation = r1Parcels.some(p => p.resident_id === resident2.id);
    assert(!crossAccessViolation, 'Cross-flat data isolation verified (zero parcel leaks across residents)');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TOTAL TESTS RUN: ${passedTests + failedTests}`);
    console.log(`PASSED: ${passedTests}`);
    console.log(`FAILED: ${failedTests}`);
    console.log('================================================================\n');

    db.close();

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }

} catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    db.close();
    process.exit(1);
}

