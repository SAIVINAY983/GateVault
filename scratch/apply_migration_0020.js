import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('--- Applying migration 0020 to SQLite database ---');

// 1. Create api_databasebackup table
db.exec(`
CREATE TABLE IF NOT EXISTS api_databasebackup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_name VARCHAR(200) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    backup_type VARCHAR(20) NOT NULL,
    checksum VARCHAR(64) NOT NULL DEFAULT '',
    failure_reason TEXT NOT NULL DEFAULT '',
    created_by_id BIGINT NULL REFERENCES api_user(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL
);
`);
console.log('Table api_databasebackup created/verified.');

// 2. Register in django_migrations
const existingMig = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0020_databasebackup'").get();
if (!existingMig) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)").run(
        'api',
        '0020_databasebackup',
        now
    );
    console.log('Recorded 0020_databasebackup in django_migrations.');
} else {
    console.log('Migration 0020 already recorded in django_migrations.');
}

console.log('Verification:');
console.log('api_databasebackup columns:', db.prepare("PRAGMA table_info('api_databasebackup')").all().map(c => c.name));
console.log('--- Migration 0020 applied successfully ---');

