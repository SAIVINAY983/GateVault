import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('--- Applying migration 0018 to SQLite database ---');

// 1. Create api_priorityalert table
db.exec(`
CREATE TABLE IF NOT EXISTS api_priorityalert (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    related_parcel_id BIGINT NULL REFERENCES api_parcel(id) ON DELETE SET NULL,
    related_incident_id BIGINT NULL REFERENCES api_parcelincident(id) ON DELETE SET NULL,
    created_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    assigned_to_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    acknowledged_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    acknowledged_at DATETIME NULL,
    resolved_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    resolved_at DATETIME NULL,
    resolution_notes TEXT NULL,
    photo VARCHAR(100) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
`);
console.log('Table api_priorityalert created/verified.');

// 2. Create api_alerthistory table
db.exec(`
CREATE TABLE IF NOT EXISTS api_alerthistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id BIGINT NOT NULL REFERENCES api_priorityalert(id) ON DELETE CASCADE,
    previous_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    previous_priority VARCHAR(20) NULL,
    new_priority VARCHAR(20) NOT NULL,
    action_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    notes TEXT NULL,
    timestamp DATETIME NOT NULL
);
`);
console.log('Table api_alerthistory created/verified.');

// 3. Register in django_migrations
const existingMig = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0018_priorityalert_alerthistory'").get();
if (!existingMig) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)").run(
        'api',
        '0018_priorityalert_alerthistory',
        now
    );
    console.log('Recorded 0018_priorityalert_alerthistory in django_migrations.');
} else {
    console.log('Migration 0018 already recorded in django_migrations.');
}

console.log('Verification:');
console.log('api_priorityalert columns:', db.prepare("PRAGMA table_info('api_priorityalert')").all().map(c => c.name));
console.log('api_alerthistory columns:', db.prepare("PRAGMA table_info('api_alerthistory')").all().map(c => c.name));
console.log('--- Migration 0018 applied successfully ---');

