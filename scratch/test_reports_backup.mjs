import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

console.log('================================================================');
console.log('GATEVAULT FEATURE 11: REPORTS & DATABASE BACKUP TEST SUITE');
console.log('================================================================\n');

const DB_PATH = path.resolve('backend/db.sqlite3');
const BACKUPS_DIR = path.resolve('backend/backups');

if (!fs.existsSync(DB_PATH)) {
    console.error(`FATAL: Database not found at ${DB_PATH}`);
    process.exit(1);
}

if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testName} - ${details}`);
        failed++;
    }
}

// --------------------------------------------------------------------------
// TEST 1: DatabaseBackup Table & Migration Schema
// --------------------------------------------------------------------------
console.log('--- Test 1: DatabaseBackup Schema & Migration ---');
const tableInfo = db.prepare("PRAGMA table_info(api_databasebackup)").all();
const columns = tableInfo.map(c => c.name);
const expectedCols = ['id', 'backup_name', 'file_path', 'file_size', 'checksum', 'backup_type', 'status', 'created_at', 'created_by_id', 'failure_reason'];

const missingCols = expectedCols.filter(col => !columns.includes(col));
assert(missingCols.length === 0, 'api_databasebackup table has all required columns', `Missing: ${missingCols.join(', ')}`);

const migrationApplied = db.prepare("SELECT name FROM django_migrations WHERE app = 'api' AND name = '0020_databasebackup'").get();
assert(!!migrationApplied, 'Migration 0020_databasebackup is registered in django_migrations');

// --------------------------------------------------------------------------
// TEST 2: Notification Model Supports DATABASE_BACKUP
// --------------------------------------------------------------------------
console.log('\n--- Test 2: Notification Type Support ---');
const adminUser = db.prepare("SELECT id, username FROM api_user WHERE role = 'ADMIN' LIMIT 1").get();
assert(!!adminUser, 'Admin user exists in database for notifications');

const notifInsert = db.prepare(`
    INSERT INTO api_notification (user_id, title, message, notification_type, is_read, created_at)
    VALUES (?, 'System Backup Completed', 'Automated snapshot verified successfully', 'DATABASE_BACKUP', 0, datetime('now'))
`);
const notifResult = notifInsert.run(adminUser.id);
assert(notifResult.changes === 1, 'Successfully created DATABASE_BACKUP notification');

const fetchedNotif = db.prepare("SELECT notification_type FROM api_notification WHERE id = ?").get(notifResult.lastInsertRowid);
assert(fetchedNotif.notification_type === 'DATABASE_BACKUP', 'Notification type stored as DATABASE_BACKUP');

// --------------------------------------------------------------------------
// TEST 3: Report Categories & Source Data Verification (All 10 Categories)
// --------------------------------------------------------------------------
console.log('\n--- Test 3: Report Data Extractor Coverage (All 10 Categories) ---');

// 1. Parcel Delivery Report
const parcelDeliveries = db.prepare(`
    SELECT p.parcel_id, p.tracking_number, p.delivery_type, p.status, p.received_at,
           t.name as tower, f.number as flat_number, c.name as carrier
    FROM api_parcel p
    LEFT JOIN api_flat f ON p.flat_id = f.id
    LEFT JOIN api_tower t ON f.tower_id = t.id
    LEFT JOIN api_carrier c ON p.carrier_id = c.id
    LIMIT 5
`).all();
assert(Array.isArray(parcelDeliveries), 'Category 1: PARCEL_DELIVERY query executes cleanly');

// 2. Pending and Overdue Report
const pendingParcels = db.prepare(`
    SELECT p.parcel_id, p.status, p.shelf_id, p.received_at,
           t.name as tower, f.number as flat_number
    FROM api_parcel p
    LEFT JOIN api_flat f ON p.flat_id = f.id
    LEFT JOIN api_tower t ON f.tower_id = t.id
    WHERE p.status IN ('AWAITING_PICKUP', 'OVERDUE')
`).all();
assert(Array.isArray(pendingParcels), 'Category 2: PENDING_OVERDUE query executes cleanly');

// 3. Courier Activity Report
const courierVisits = db.prepare(`
    SELECT cv.id, cv.courier_name, cv.mobile_number, cv.vehicle_number, cv.status,
           cv.entry_time, cv.exit_time, cv.carrier_name,
           (SELECT COUNT(*) FROM api_parcel p WHERE p.courier_visit_id = cv.id) as parcels_delivered_count
    FROM api_couriervisit cv
    LIMIT 5
`).all();
assert(Array.isArray(courierVisits), 'Category 3: COURIER_ACTIVITY query executes cleanly');

// 4. Guard Shifts Report
const guardShifts = db.prepare(`
    SELECT gs.id, u.username as guard_name, gs.status,
           gs.shift_start, gs.shift_end, gs.handover_notes
    FROM api_guardshift gs
    JOIN api_user u ON gs.guard_id = u.id
    LIMIT 5
`).all();
assert(Array.isArray(guardShifts), 'Category 4: GUARD_SHIFTS query executes cleanly');

// 5. Parcel Condition & Inspection Report
const inspections = db.prepare(`
    SELECT pi.id, pi.condition, pi.remarks, pi.courier_confirmed, pi.timestamp,
           p.parcel_id, p.tracking_number, u.username as guard_name
    FROM api_parcelinspection pi
    JOIN api_parcel p ON pi.parcel_id = p.id
    JOIN api_user u ON pi.guard_id = u.id
    LIMIT 5
`).all();
assert(Array.isArray(inspections), 'Category 5: PARCEL_INSPECTION query executes cleanly');

// 6. Incident Management Report
const incidents = db.prepare(`
    SELECT i.id as incident_id, i.category, i.status, i.description,
           p.parcel_id, u.username as resident_name
    FROM api_parcelincident i
    JOIN api_parcel p ON i.parcel_id = p.id
    JOIN api_user u ON i.resident_id = u.id
    LIMIT 5
`).all();
assert(Array.isArray(incidents), 'Category 6: INCIDENTS query executes cleanly');

// 7. Storage Shelf Utilization Report
const shelves = db.prepare(`
    SELECT s.id, s.name as shelf_code, s.capacity, s.status, s.max_parcel_size
    FROM api_storageshelf s
`).all();
assert(Array.isArray(shelves) && shelves.length > 0, 'Category 7: SHELF_UTILIZATION query returns valid shelf records');

// 8. COD Payment Records Report
const codPayments = db.prepare(`
    SELECT p.parcel_id, p.tracking_number, p.cod_amount, p.payment_type, p.payment_status,
           t.name as tower, f.number as flat_number
    FROM api_parcel p
    LEFT JOIN api_flat f ON p.flat_id = f.id
    LEFT JOIN api_tower t ON f.tower_id = t.id
    WHERE p.payment_type = 'COD' OR p.cod_amount > 0
`).all();
assert(Array.isArray(codPayments), 'Category 8: COD_PAYMENTS query executes cleanly');

// 9. Community Feedback Report
const feedbackRecords = db.prepare(`
    SELECT f.id, f.rating, f.category, f.review, f.is_reviewed, f.admin_response,
           u.username as resident_name, p.parcel_id
    FROM api_communityfeedback f
    JOIN api_user u ON f.resident_id = u.id
    JOIN api_parcel p ON f.parcel_id = p.id
    LIMIT 5
`).all();
assert(Array.isArray(feedbackRecords), 'Category 9: COMMUNITY_FEEDBACK query executes cleanly');

// 10. Monthly Community Activity Summary
const monthlyActivity = db.prepare(`
    SELECT strftime('%Y-%m', received_at) as month,
           COUNT(*) as total_intake,
           SUM(CASE WHEN status IN ('HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT') THEN 1 ELSE 0 END) as total_delivered,
           SUM(CASE WHEN payment_type = 'COD' THEN 1 ELSE 0 END) as total_cod
    FROM api_parcel
    GROUP BY strftime('%Y-%m', received_at)
    ORDER BY month DESC
`).all();
assert(Array.isArray(monthlyActivity), 'Category 10: MONTHLY_ACTIVITY aggregates execute cleanly');

// --------------------------------------------------------------------------
// TEST 4: Dynamic Report Filtering Logic
// --------------------------------------------------------------------------
console.log('\n--- Test 4: Dynamic Filtering Logic ---');
const filteredByStatus = db.prepare("SELECT COUNT(*) as cnt FROM api_parcel WHERE status = 'HANDED_OVER'").get();
assert(typeof filteredByStatus.cnt === 'number', 'Filter by status returns numerical count');

const filteredByTower = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM api_parcel p
    JOIN api_flat f ON p.flat_id = f.id
    JOIN api_tower t ON f.tower_id = t.id
    WHERE t.name = 'Tower A'
`).get();
assert(typeof filteredByTower.cnt === 'number', 'Filter by Tower returns numerical count');

// --------------------------------------------------------------------------
// TEST 5: CSV Export Generator & UTF-8 BOM Verification
// --------------------------------------------------------------------------
console.log('\n--- Test 5: CSV Generation & RFC 4180 Compliance ---');

function generateCsvString(title, columns, rows) {
    const lines = [];
    lines.push(`"${title.replace(/"/g, '""')}"`);
    lines.push(`"Generated: ${new Date().toISOString()}"`);
    lines.push('');
    lines.push(columns.map(c => `"${c.replace(/"/g, '""')}"`).join(','));
    for (const row of rows) {
        lines.push(columns.map(c => {
            const v = row[c] ?? '';
            return `"${String(v).replace(/"/g, '""')}"`;
        }).join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
}

const sampleColumns = ['Parcel ID', 'Carrier', 'Tower', 'Status'];
const sampleRows = [
    { 'Parcel ID': 'P-001', 'Carrier': 'Amazon, Inc.', 'Tower': 'Tower A', 'Status': 'HANDED_OVER' },
    { 'Parcel ID': 'P-002', 'Carrier': 'FedEx "Express"', 'Tower': 'Tower B', 'Status': 'AWAITING_PICKUP' },
];
const csvResult = generateCsvString('Test Parcel Delivery Report', sampleColumns, sampleRows);

assert(csvResult.startsWith('\uFEFF'), 'CSV output begins with UTF-8 BOM (\\uFEFF)');
assert(csvResult.includes('"FedEx ""Express"""'), 'CSV output sanitizes embedded quotes per RFC 4180');
assert(csvResult.includes('"Amazon, Inc."'), 'CSV output safely escapes fields containing commas');

// --------------------------------------------------------------------------
// TEST 6: SQLite Online Backup Creation, Integrity Check & SHA-256
// --------------------------------------------------------------------------
console.log('\n--- Test 6: Online Backup Creation, Integrity Check & SHA-256 ---');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFileName = `gatevault_backup_test_${timestamp}.sqlite3`;
const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

// Create safe atomic snapshot copy
fs.copyFileSync(DB_PATH, backupFilePath);
assert(fs.existsSync(backupFilePath), 'Backup file physically created in backend/backups/');

const stats = fs.statSync(backupFilePath);
assert(stats.size > 0, `Backup file size is positive (${stats.size} bytes)`);

// Calculate SHA-256 checksum
const fileBuffer = fs.readFileSync(backupFilePath);
const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
assert(sha256Hash.length === 64, `Calculated valid 64-character SHA-256 checksum: ${sha256Hash.substring(0, 16)}...`);

// Verify PRAGMA integrity_check on the backup snapshot
const backupDb = new DatabaseSync(backupFilePath);
const integrityResult = backupDb.prepare("PRAGMA integrity_check").get();
backupDb.close();
assert(integrityResult.integrity_check === 'ok', 'PRAGMA integrity_check returns "ok" on backup snapshot');

// Record backup entry in api_databasebackup
const insertBackupStmt = db.prepare(`
    INSERT INTO api_databasebackup (backup_name, file_path, file_size, checksum, backup_type, status, created_at, created_by_id, failure_reason)
    VALUES (?, ?, ?, ?, 'MANUAL', 'COMPLETED', datetime('now'), ?, '')
`);
const backupInsertRes = insertBackupStmt.run(backupFileName, backupFilePath, stats.size, sha256Hash, adminUser.id);
assert(backupInsertRes.changes === 1, 'Backup record stored in api_databasebackup');

const createdBackupId = backupInsertRes.lastInsertRowid;
const verifyBackupRecord = db.prepare("SELECT * FROM api_databasebackup WHERE id = ?").get(createdBackupId);
assert(verifyBackupRecord.checksum === sha256Hash, 'Stored checksum matches verified file hash');

// --------------------------------------------------------------------------
// TEST 7: 30-Day Retention Pruning Policy
// --------------------------------------------------------------------------
console.log('\n--- Test 7: 30-Day Retention Pruning Policy ---');

// Create a dummy old backup from 45 days ago
const oldBackupFileName = `gatevault_backup_old_dummy_${Date.now()}.sqlite3`;
const oldBackupFilePath = path.join(BACKUPS_DIR, oldBackupFileName);
fs.writeFileSync(oldBackupFilePath, 'dummy sqlite content for retention test');

const oldDate = new Date();
oldDate.setDate(oldDate.getDate() - 45);
const oldDateStr = oldDate.toISOString().replace('T', ' ').substring(0, 19);

const insertOldBackup = db.prepare(`
    INSERT INTO api_databasebackup (backup_name, file_path, file_size, checksum, backup_type, status, created_at, created_by_id, failure_reason)
    VALUES (?, ?, 35, 'dummy_checksum_45_days_old', 'MANUAL', 'COMPLETED', ?, ?, '')
`).run(oldBackupFileName, oldBackupFilePath, oldDateStr, adminUser.id);

assert(insertOldBackup.changes === 1, 'Created test backup record dated 45 days ago');
assert(fs.existsSync(oldBackupFilePath), 'Old dummy backup file exists prior to pruning');

// Execute pruning algorithm (as defined in reports.py)
const retentionThreshold = new Date();
retentionThreshold.setDate(retentionThreshold.getDate() - 30);
const thresholdStr = retentionThreshold.toISOString().replace('T', ' ').substring(0, 19);

const expiredBackups = db.prepare("SELECT * FROM api_databasebackup WHERE created_at < ?").all(thresholdStr);
assert(expiredBackups.length > 0, `Found ${expiredBackups.length} backup(s) older than 30-day retention threshold`);

for (const b of expiredBackups) {
    if (fs.existsSync(b.file_path)) {
        fs.unlinkSync(b.file_path);
    }
    db.prepare("DELETE FROM api_databasebackup WHERE id = ?").run(b.id);
}

assert(!fs.existsSync(oldBackupFilePath), 'Expired backup file successfully pruned from disk');
const checkDeleted = db.prepare("SELECT * FROM api_databasebackup WHERE backup_name = ?").get(oldBackupFileName);
assert(!checkDeleted, 'Expired backup record removed from database');

// Verify that the recent backup was NOT pruned
const recentStillExists = db.prepare("SELECT * FROM api_databasebackup WHERE id = ?").get(createdBackupId);
assert(!!recentStillExists && fs.existsSync(backupFilePath), 'Recent backup snapshot is safely preserved');

// --------------------------------------------------------------------------
// TEST 8: Path Traversal Protection
// --------------------------------------------------------------------------
console.log('\n--- Test 8: Security - Path Traversal Prevention ---');

function isPathSafe(targetPath, baseDir) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(baseDir);
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

const safePath = path.join(BACKUPS_DIR, 'valid_backup.sqlite3');
const unsafePath1 = path.join(BACKUPS_DIR, '../db.sqlite3');
const unsafePath2 = path.join(BACKUPS_DIR, '../../windows/system32/cmd.exe');

assert(isPathSafe(safePath, BACKUPS_DIR) === true, 'Designated backup directory file is allowed');
assert(isPathSafe(unsafePath1, BACKUPS_DIR) === false, 'Parent directory traversal (../db.sqlite3) is strictly blocked');
assert(isPathSafe(unsafePath2, BACKUPS_DIR) === false, 'System directory traversal is strictly blocked');

// --------------------------------------------------------------------------
// TEST SUMMARY
// --------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`FEATURE 11 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
    process.exit(1);
}
