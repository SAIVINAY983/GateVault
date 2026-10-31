import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');

console.log('Testing Resident parcels query...');
const resident = db.prepare("SELECT * FROM api_user WHERE role='RESIDENT' LIMIT 1").get();
const profile = db.prepare("SELECT * FROM api_residentprofile WHERE user_id = ?").get(resident.id);

console.log('Resident:', resident.username, 'Flat ID:', profile ? profile.flat_id : 'none');

let parcels;
if (profile && profile.flat_id) {
    parcels = db.prepare(`
        SELECT p.*, f.number as flat_number, c.name as carrier_name, s.name as shelf_name
        FROM api_parcel p
        LEFT JOIN api_flat f ON p.flat_id = f.id
        LEFT JOIN api_carrier c ON p.carrier_id = c.id
        LEFT JOIN api_storageshelf s ON p.shelf_id = s.id
        WHERE p.resident_id = ? OR p.flat_id = ?
        ORDER BY p.received_at DESC
    `).all(resident.id, profile.flat_id);
} else {
    parcels = db.prepare("SELECT * FROM api_parcel WHERE resident_id = ?").all(resident.id);
}

console.log(`Found ${parcels.length} parcels for resident.`);
parcels.slice(0, 3).forEach(p => {
    console.log(`  Parcel: ${p.parcel_id}, Status: ${p.status}, Flat: ${p.flat_number}, Carrier: ${p.carrier_name}`);
});

console.log('Parcels query successful!');

