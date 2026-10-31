import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('backend/db.sqlite3');
console.log('ResidentProfiles:', db.prepare("SELECT * FROM api_residentprofile").all());
console.log('Towers:', db.prepare("SELECT * FROM api_tower").all());
