const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve('backend/db.sqlite3');
const db = new DatabaseSync(dbPath);

console.log('Applying Migration 0021: ResidentProfile approval and Google OAuth fields...');

// Check columns of api_residentprofile
const existingCols = db.prepare("PRAGMA table_info(api_residentprofile)").all().map(c => c.name);
console.log('Existing columns in api_residentprofile:', existingCols);

if (!existingCols.includes('approval_status')) {
    db.exec(`ALTER TABLE api_residentprofile ADD COLUMN approval_status varchar(20) NOT NULL DEFAULT 'APPROVED';`);
    console.log('Added column: approval_status');
}

if (!existingCols.includes('google_id')) {
    db.exec(`ALTER TABLE api_residentprofile ADD COLUMN google_id varchar(255) NULL;`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS api_residentprofile_google_id_uniq ON api_residentprofile (google_id);`);
    console.log('Added column: google_id and unique index');
}

if (!existingCols.includes('rejection_reason')) {
    db.exec(`ALTER TABLE api_residentprofile ADD COLUMN rejection_reason text NULL;`);
    console.log('Added column: rejection_reason');
}

if (!existingCols.includes('approved_by_id')) {
    db.exec(`ALTER TABLE api_residentprofile ADD COLUMN approved_by_id bigint NULL REFERENCES api_user (id);`);
    console.log('Added column: approved_by_id');
}

if (!existingCols.includes('approved_at')) {
    db.exec(`ALTER TABLE api_residentprofile ADD COLUMN approved_at datetime NULL;`);
    console.log('Added column: approved_at');
}

// Ensure all existing residents have approval_status = 'APPROVED'
db.exec(`UPDATE api_residentprofile SET approval_status = 'APPROVED' WHERE approval_status IS NULL OR approval_status = '';`);
console.log('Updated existing resident profiles to APPROVED');

// Check django_migrations
const migration = db.prepare("SELECT * FROM django_migrations WHERE app = 'api' AND name = '0021_residentprofile_approval_fields'").get();
if (!migration) {
    db.prepare(`
        INSERT INTO django_migrations (app, name, applied)
        VALUES ('api', '0021_residentprofile_approval_fields', datetime('now'))
    `).run();
    console.log('Registered migration 0021_residentprofile_approval_fields in django_migrations');
} else {
    console.log('Migration 0021 already registered in django_migrations');
}

const updatedCols = db.prepare("PRAGMA table_info(api_residentprofile)").all().map(c => c.name);
console.log('Updated columns in api_residentprofile:', updatedCols);
console.log('Migration 0021 successfully completed.');
