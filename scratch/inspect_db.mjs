import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('backend/db.sqlite3');
const parcelCols = db.prepare("PRAGMA table_info('api_parcel')").all();
console.log(parcelCols.filter(c => c.notnull && c.dflt_value === null && !c.pk).map(c => c.name));
