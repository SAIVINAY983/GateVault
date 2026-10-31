const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.resolve('backend/db.sqlite3');
const db = new DatabaseSync(dbPath);

console.log('Checking current schema...');

// Check if columns exist in api_storageshelf
const shelfCols = db.prepare("PRAGMA table_info(api_storageshelf)").all();
const colNamesShelf = shelfCols.map(c => c.name);
console.log('StorageShelf columns:', colNamesShelf);

if (!colNamesShelf.includes('max_parcel_size')) {
  console.log('Adding max_parcel_size to api_storageshelf');
  db.exec("ALTER TABLE api_storageshelf ADD COLUMN max_parcel_size varchar(10) NOT NULL DEFAULT 'LARGE'");
}
if (!colNamesShelf.includes('status')) {
  console.log('Adding status to api_storageshelf');
  db.exec("ALTER TABLE api_storageshelf ADD COLUMN status varchar(20) NOT NULL DEFAULT 'ACTIVE'");
}
if (!colNamesShelf.includes('maintenance_notes')) {
  console.log('Adding maintenance_notes to api_storageshelf');
  db.exec("ALTER TABLE api_storageshelf ADD COLUMN maintenance_notes text NULL");
}

// Check if columns exist in api_parcel
const parcelCols = db.prepare("PRAGMA table_info(api_parcel)").all();
const colNamesParcel = parcelCols.map(c => c.name);
console.log('Parcel columns count:', colNamesParcel.length);

if (!colNamesParcel.includes('parcel_size')) {
  console.log('Adding parcel_size to api_parcel');
  db.exec("ALTER TABLE api_parcel ADD COLUMN parcel_size varchar(10) NOT NULL DEFAULT 'MEDIUM'");
}
if (!colNamesParcel.includes('dimensions')) {
  console.log('Adding dimensions to api_parcel');
  db.exec("ALTER TABLE api_parcel ADD COLUMN dimensions varchar(50) NULL");
}
if (!colNamesParcel.includes('handling_instructions')) {
  console.log('Adding handling_instructions to api_parcel');
  db.exec("ALTER TABLE api_parcel ADD COLUMN handling_instructions text NULL");
}

// Create api_shelfreservation table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS api_shelfreservation (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    parcel_size varchar(10) NOT NULL,
    reservation_token varchar(64) NOT NULL UNIQUE,
    expires_at datetime NOT NULL,
    status varchar(20) NOT NULL,
    created_at datetime NOT NULL,
    committed_parcel_id bigint NULL REFERENCES api_parcel(id) DEFERRABLE INITIALLY DEFERRED,
    guard_id bigint NOT NULL REFERENCES api_user(id) DEFERRABLE INITIALLY DEFERRED,
    shelf_id bigint NOT NULL REFERENCES api_storageshelf(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS api_shelfreservation_committed_parcel_id ON api_shelfreservation(committed_parcel_id);
CREATE INDEX IF NOT EXISTS api_shelfreservation_guard_id ON api_shelfreservation(guard_id);
CREATE INDEX IF NOT EXISTS api_shelfreservation_shelf_id ON api_shelfreservation(shelf_id);
`);

// Create api_shelfassignmenthistory table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS api_shelfassignmenthistory (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    action_type varchar(30) NOT NULL,
    reason text NULL,
    timestamp datetime NOT NULL,
    guard_id bigint NULL REFERENCES api_user(id) DEFERRABLE INITIALLY DEFERRED,
    new_shelf_id bigint NULL REFERENCES api_storageshelf(id) DEFERRABLE INITIALLY DEFERRED,
    parcel_id bigint NOT NULL REFERENCES api_parcel(id) DEFERRABLE INITIALLY DEFERRED,
    previous_shelf_id bigint NULL REFERENCES api_storageshelf(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS api_shelfassignmenthistory_guard_id ON api_shelfassignmenthistory(guard_id);
CREATE INDEX IF NOT EXISTS api_shelfassignmenthistory_new_shelf_id ON api_shelfassignmenthistory(new_shelf_id);
CREATE INDEX IF NOT EXISTS api_shelfassignmenthistory_parcel_id ON api_shelfassignmenthistory(parcel_id);
CREATE INDEX IF NOT EXISTS api_shelfassignmenthistory_previous_shelf_id ON api_shelfassignmenthistory(previous_shelf_id);
`);

// Record in django_migrations
const checkMigration = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0015_smartshelfmanagement_and_more'").get();
if (!checkMigration) {
  const now = new Date().toISOString();
  db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES ('api', '0015_smartshelfmanagement_and_more', ?)").run(now);
  console.log('Recorded migration 0015_smartshelfmanagement_and_more in django_migrations.');
} else {
  console.log('Migration 0015 already recorded.');
}

console.log('Migration 0015 applied successfully!');

