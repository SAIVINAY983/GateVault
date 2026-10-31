import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

db.exec(`
CREATE TABLE IF NOT EXISTS "api_guestpickupauthorization" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guest_name" varchar(150) NOT NULL,
    "guest_mobile" varchar(20) NOT NULL,
    "relationship" varchar(20) NOT NULL,
    "instructions" text NULL,
    "pass_code" varchar(30) NULL,
    "token_hash" varchar(64) NOT NULL UNIQUE,
    "expires_at" datetime NOT NULL,
    "status" varchar(20) NOT NULL,
    "created_at" datetime NOT NULL,
    "used_at" datetime NULL,
    "revoked_at" datetime NULL,
    "verified_at" datetime NULL,
    "actual_collector_name" varchar(150) NULL,
    "parcel_id" bigint NOT NULL REFERENCES "api_parcel" ("id") DEFERRABLE INITIALLY DEFERRED,
    "resident_id" bigint NOT NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED,
    "revoked_by_id" bigint NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED,
    "verified_by_guard_id" bigint NULL REFERENCES "api_user" ("id") DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS "api_guestpickupauthorization_parcel_id_idx" ON "api_guestpickupauthorization" ("parcel_id");
CREATE INDEX IF NOT EXISTS "api_guestpickupauthorization_resident_id_idx" ON "api_guestpickupauthorization" ("resident_id");
CREATE INDEX IF NOT EXISTS "api_guestpickupauthorization_token_hash_idx" ON "api_guestpickupauthorization" ("token_hash");
`);

// Add column guest_authorization_id to api_pickupverification if not present
const cols = db.prepare("PRAGMA table_info('api_pickupverification')").all();
if (!cols.some(c => c.name === 'guest_authorization_id')) {
    db.exec(`ALTER TABLE "api_pickupverification" ADD COLUMN "guest_authorization_id" bigint NULL REFERENCES "api_guestpickupauthorization" ("id") DEFERRABLE INITIALLY DEFERRED;`);
    console.log('Added guest_authorization_id column to api_pickupverification');
}

// Insert into django_migrations
const checkMig = db.prepare("SELECT * FROM django_migrations WHERE app='api' AND name='0014_guestpickupauthorization_and_more'").all();
if (checkMig.length === 0) {
    db.prepare("INSERT INTO django_migrations (app, name, applied) VALUES (?, ?, datetime('now'))").run(
        'api',
        '0014_guestpickupauthorization_and_more'
    );
    console.log('Recorded migration 0014 in django_migrations');
} else {
    console.log('Migration 0014 was already recorded in django_migrations');
}

console.log('Migration 0014 applied successfully.');

