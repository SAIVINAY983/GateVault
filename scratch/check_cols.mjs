import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');
const cols = db.prepare("PRAGMA table_info('api_pickupverification')").all();
console.log('api_pickupverification columns:', cols);

