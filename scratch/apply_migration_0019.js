import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('--- Applying migration 0019 to SQLite database ---');

// 1. Create api_communityfeedback table
db.exec(`
CREATE TABLE IF NOT EXISTS api_communityfeedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category VARCHAR(30) NOT NULL,
    rating INTEGER NOT NULL,
    review TEXT NOT NULL DEFAULT '',
    photo VARCHAR(100) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    is_reviewed BOOL NOT NULL DEFAULT 0,
    reviewed_at DATETIME NULL,
    admin_response TEXT NOT NULL DEFAULT '',
    responded_at DATETIME NULL,
    parcel_id BIGINT NOT NULL REFERENCES api_parcel(id) ON DELETE CASCADE,
    resident_id BIGINT NOT NULL REFERENCES api_user(id) ON DELETE CASCADE,
    responded_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    reviewed_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_resident_parcel_feedback 
ON api_communityfeedback(resident_id, parcel_id);
`);
console.log('Table api_communityfeedback created/verified.');

// 2. Register in django_migrations
const existingMig = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0019_communityfeedback'").get();
if (!existingMig) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)").run(
        'api',
        '0019_communityfeedback',
        now
    );
    console.log('Recorded 0019_communityfeedback in django_migrations.');
} else {
    console.log('Migration 0019 already recorded in django_migrations.');
}

console.log('Verification:');
console.log('api_communityfeedback columns:', db.prepare("PRAGMA table_info('api_communityfeedback')").all().map(c => c.name));
console.log('--- Migration 0019 applied successfully ---');

