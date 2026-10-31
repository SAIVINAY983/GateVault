import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');
const cols = db.prepare("PRAGMA table_info('api_parcel')").all();
console.log('api_parcel columns:', cols.map(c => c.name));

