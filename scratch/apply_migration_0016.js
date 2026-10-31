const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.resolve('backend/db.sqlite3');
const db = new DatabaseSync(dbPath);

console.log('Applying Migration 0016 schema...');

// Create api_couriervisit table
db.exec(`
CREATE TABLE IF NOT EXISTS api_couriervisit (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    courier_name varchar(150) NOT NULL,
    carrier_name varchar(100) NULL,
    mobile_number varchar(20) NOT NULL,
    vehicle_number varchar(50) NULL,
    visit_purpose varchar(30) NOT NULL,
    entry_time datetime NOT NULL,
    exit_time datetime NULL,
    status varchar(15) NOT NULL,
    remarks text NULL,
    created_at datetime NOT NULL,
    carrier_id bigint NULL REFERENCES api_carrier(id) DEFERRABLE INITIALLY DEFERRED,
    entry_guard_id bigint NOT NULL REFERENCES api_user(id) DEFERRABLE INITIALLY DEFERRED,
    exit_guard_id bigint NULL REFERENCES api_user(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS api_couriervisit_carrier_id ON api_couriervisit(carrier_id);
CREATE INDEX IF NOT EXISTS api_couriervisit_entry_guard_id ON api_couriervisit(entry_guard_id);
CREATE INDEX IF NOT EXISTS api_couriervisit_exit_guard_id ON api_couriervisit(exit_guard_id);
CREATE INDEX IF NOT EXISTS api_couriervisit_status ON api_couriervisit(status);
CREATE INDEX IF NOT EXISTS api_couriervisit_entry_time ON api_couriervisit(entry_time);
`);

// Add courier_visit_id column to api_parcel if not exists
const parcelCols = db.prepare("PRAGMA table_info(api_parcel)").all();
const hasCourierVisitCol = parcelCols.some(c => c.name === 'courier_visit_id');

if (!hasCourierVisitCol) {
    console.log('Adding courier_visit_id column to api_parcel');
    db.exec(`
        ALTER TABLE api_parcel ADD COLUMN courier_visit_id bigint NULL REFERENCES api_couriervisit(id) DEFERRABLE INITIALLY DEFERRED;
        CREATE INDEX IF NOT EXISTS api_parcel_courier_visit_id ON api_parcel(courier_visit_id);
    `);
}

// Record migration 0016 in django_migrations
const checkMigration = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0016_couriervisit_and_more'").get();
if (!checkMigration) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES ('api', '0016_couriervisit_and_more', ?)").run(now);
    console.log('Recorded migration 0016_couriervisit_and_more in django_migrations.');
} else {
    console.log('Migration 0016 already recorded.');
}

console.log('Migration 0016 applied successfully!');

