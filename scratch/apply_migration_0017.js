import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('--- Applying migration 0017 to SQLite database ---');

// Check current columns
const tableInfo = db.prepare("PRAGMA table_info('api_expecteddelivery')").all();
const existingCols = new Set(tableInfo.map(c => c.name));

const colsToAdd = [
    { name: 'expected_start_time', type: 'time' },
    { name: 'expected_end_time', type: 'time' },
    { name: 'time_window_label', type: 'varchar(50)' },
    { name: 'actual_received_at', type: 'datetime' },
    { name: 'rescheduled_at', type: 'datetime' },
];

for (const col of colsToAdd) {
    if (!existingCols.has(col.name)) {
        console.log(`Adding column ${col.name} (${col.type}) to api_expecteddelivery...`);
        db.exec(`ALTER TABLE api_expecteddelivery ADD COLUMN ${col.name} ${col.type} NULL;`);
    } else {
        console.log(`Column ${col.name} already exists in api_expecteddelivery.`);
    }
}

// Record in django_migrations
const existingMig = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0017_expecteddelivery_scheduling_fields'").get();
if (!existingMig) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, ?)").run(
        'api',
        '0017_expecteddelivery_scheduling_fields',
        now
    );
    console.log('Recorded 0017_expecteddelivery_scheduling_fields in django_migrations.');
} else {
    console.log('Migration already recorded in django_migrations.');
}

console.log('Verification:');
const updatedCols = db.prepare("PRAGMA table_info('api_expecteddelivery')").all();
console.log(updatedCols.map(c => c.name));
console.log('--- Migration 0017 applied successfully ---');

