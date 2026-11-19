import { DatabaseSync } from 'node:sqlite';

try {
    const db = new DatabaseSync('backend/db.sqlite3');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log('Tables found (' + tables.length + '):');
    for (const t of tables) {
        console.log(' - ' + t.name);
    }

    const migrations = db.prepare("SELECT app, name, applied FROM django_migrations WHERE app='api' ORDER BY id").all();
    console.log('\nApplied migrations for api (' + migrations.length + '):');
    for (const m of migrations) {
        console.log(` - ${m.name} (${m.applied})`);
    }

    const unappliedCheck = ['api_auditlog', 'api_securityalert'];
    console.log('\nChecking special tables:');
    for (const tbl of unappliedCheck) {
        const found = tables.some(t => t.name === tbl);
        console.log(` - ${tbl}: ${found ? 'EXISTS' : 'MISSING'}`);
    }
} catch (e) {
    console.error('Error reading sqlite:', e);
}
