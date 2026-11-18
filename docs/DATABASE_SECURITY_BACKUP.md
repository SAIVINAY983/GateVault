# GateVault – Database Security, Data Integrity & Backup/Recovery Guide

This guide details the security configuration, least-privilege database user setup, data integrity controls, backup automation, retention policies, and recovery procedures for the GateVault system.

---

## 1. Database Credentials Security

1. **Zero Hardcoded Secrets**:
   - All database credentials (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_ENGINE`, `DB_SSL`) are loaded exclusively from environment variables in `backend/.env`.
   - Default fallbacks avoid privileged names.

2. **Git Exclusion**:
   - Root `.gitignore` explicitly ignores `.env`, `.env.*` (preserving `.env.example`), `.sql`, `.sql.gz`, `db.sqlite3`, and the entire `backups/` directory.
   - Run `git status --ignored` to verify sensitive configuration files remain uncommitted.

3. **Frontend Isolation**:
   - The React + Vite client bundle contains only public runtime values (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`).
   - No database credentials, connection strings, or internal secrets are present in frontend source code.

4. **Error Sanitization**:
   - The centralized `gatevault_exception_handler` intercepts database exceptions (`IntegrityError`, `OperationalError`) and returns sanitized error messages, preventing stack traces and schema leakage.

---

## 2. Least Privilege Configuration (MySQL)

GateVault must **never** run under the MySQL `root` administrative account. A dedicated, non-root application user (`gatevault_app`) is used.

### Provisioning Least-Privilege MySQL User

Execute the following script located at `backend/database/setup_least_privilege.sql` using MySQL root:

```sql
-- Step 1: Create Database
CREATE DATABASE IF NOT EXISTS gatevault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Create Application User
CREATE USER IF NOT EXISTS 'gatevault_app'@'%' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';

-- Step 3: Grant Only Necessary DDL & DML Operations
-- DML: SELECT, INSERT, UPDATE, DELETE
-- DDL: CREATE, ALTER, INDEX, DROP, REFERENCES (for migrations)
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON gatevault.*
  TO 'gatevault_app'@'%';

-- Step 4: Optional Dedicated Backup User (Read-Only + Lock Tables for consistent mysqldump)
CREATE USER IF NOT EXISTS 'gatevault_backup'@'%' IDENTIFIED BY 'YOUR_BACKUP_PASSWORD';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER
  ON gatevault.*
  TO 'gatevault_backup'@'%';

FLUSH PRIVILEGES;
```

**Excluded Privileges**:
The application user does not possess `GRANT OPTION`, `SUPER`, `SHUTDOWN`, `PROCESS`, `FILE`, or access to MySQL system schemas (`mysql`, `information_schema`, `sys`).

---

## 3. Data Integrity & State Transitions

1. **Foreign Key Integrity**:
   - `Parcel.flat`: Foreign key to `Flat` with `on_delete=models.CASCADE`.
   - `Parcel.shelf`: `on_delete=models.SET_NULL` so shelf maintenance does not destroy parcel records.
   - `PickupVerification.parcel`: `OneToOneField` ensures exactly **one** pickup verification per parcel, preventing duplicate pickup records.
   - `Flat.unique_together`: `('tower', 'number')` prevents duplicate apartment allocations.
   - `HouseholdMember.unique_together`: `('flat', 'mobile_number')` prevents duplicate member entries in an apartment.

2. **Parcel Status Transition Protections**:
   - Terminal states: `HANDED_OVER`, `DELIVERED_DIRECTLY_TO_FLAT`, `CANCELLED`.
   - Once a parcel has been handed over or delivered, `Parcel.clean()` and `ParcelSerializer.validate_status()` strictly reject any attempt to revert the parcel back to `AWAITING_PICKUP` or `OVERDUE`.

3. **Concurrency Locking**:
   - Sensitive pickup verification and handover operations (`VerifyPickupView`, `ConfirmHandoverView`, `GuardConfirmQRHandoverView`) execute within `transaction.atomic()` using `select_for_update()` row locks, preventing race conditions and double-handover attacks.

---

## 4. Sensitive Data Protection

- **Passwords**: Managed using Django's PBKDF2 with SHA-256 password hashing. Plaintext passwords are never stored or logged.
- **Pickup PINs**: Protected via constant-time comparison (`secrets.compare_digest`), hidden from non-owner responses, and invalidated immediately upon parcel collection.
- **QR Secrets**: Passes store the cryptographic SHA-256 hash (`token_hash`) of the single-use token.
- **Log Sanitization**: `sanitize_metadata` in `backend/api/security.py` strips passwords, JWT tokens, PINs, and credentials before writing any event to audit logs.
- **Report Exports**: Admin report generators in `backend/api/reports.py` exclude authentication tokens, secrets, and PINs from exported CSV, Excel, and PDF files.

---

## 5. Database Backup Procedures

GateVault provides a unified backup engine supporting both **MySQL** (production) and **SQLite** (development).

### Manual Backup Commands

**Option A: Django Management Command**
```bash
python manage.py backup_db --type MANUAL
```

**Option B: Standalone Python Script**
```bash
python backend/scripts/backup_db.py --type MANUAL
```

**Option C: Shell Script (Linux / Docker)**
```bash
bash backend/scripts/backup_mysql.sh
```

**Option D: Community Admin UI**
Admins can trigger backups directly from the Admin Portal via `POST /api/admin/backups/create/`.

### MySQL Consistency & Options
Backups executed via `mysqldump` use:
- `--single-transaction`: Consistent InnoDB snapshot without locking reads/writes.
- `--quick`: Streams rows directly from server to reduce memory pressure.
- `--routines --triggers`: Includes all stored procedures and triggers.
- `--hex-blob`: Dumps binary fields in hexadecimal format to avoid character encoding corruption.
- Passwords are provided via `MYSQL_PWD` environment variable to prevent process-table exposure.

---

## 6. Backup Retention Policy

1. **Configurable Retention**:
   - Controlled by `BACKUP_RETENTION_DAYS` in `.env` (default: 14 days).
2. **Sole Backup Protection**:
   - Pruning algorithms (`prune_old_backups` in `backend/api/reports.py` and `backend/scripts/backup_mysql.sh`) verify that at least **one completed backup remains**. The latest backup is **never deleted**, even if it exceeds the retention threshold.
3. **Integrity Validation**:
   - Backups calculate and store SHA-256 checksums upon completion.

---

## 7. Disaster Recovery & Restoration Procedures

> [!WARNING]
> Database restoration is a destructive operation that replaces current database tables with the backup snapshot. Always verify the backup before restoring.

### Restoration Commands

**Option A: Django Management Command**
```bash
python manage.py restore_db backend/backups/gatevault_backup_YYYYMMDD_HHMMSS.sql.gz --confirm
```

**Option B: Standalone Python Script**
```bash
python backend/scripts/restore_db.py backend/backups/gatevault_backup_YYYYMMDD_HHMMSS.sql.gz --confirm
```

**Option C: Shell Script (MySQL)**
```bash
bash backend/scripts/restore_mysql.sh backend/backups/gatevault_backup_YYYYMMDD_HHMMSS.sql.gz --confirm
```

### Safety Features
- Validates backup file existence and format (`.sql.gz`, `.sql`, `.sqlite3`).
- Path-traversal protection restricts restoration to files within the designated `backups/` directory.
- For SQLite: Verifies `PRAGMA integrity_check` before copying.
- For MySQL: Validates `.sha256` checksum before streaming into the database.
- Explicit confirmation (`--confirm` or typing `RESTORE`) required to prevent accidental execution.
- Records a security audit event (`DATABASE_RESTORE_COMPLETED` or `DATABASE_RESTORE_FAILED`).

