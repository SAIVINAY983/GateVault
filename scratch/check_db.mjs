import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('backend/db.sqlite3');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
const migrations = db.prepare('SELECT app, name FROM django_migrations ORDER BY id DESC LIMIT 5').all();
console.log('Recent migrations:', migrations);

