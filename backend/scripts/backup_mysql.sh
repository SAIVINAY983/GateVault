#!/usr/bin/env bash
# ==============================================================================
# GateVault MySQL Automated Backup Script (Linux / Docker / Cron)
# ==============================================================================
# Performs a non-blocking, transactionally consistent mysqldump compressed with gzip.
# Password is passed via MYSQL_PWD to prevent exposure on process tables (ps aux).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if present and variables not already exported
if [ -f "${BACKEND_DIR}/.env" ]; then
    set -a
    source "${BACKEND_DIR}/.env"
    set +a
fi

DB_NAME="${DB_NAME:-gatevault}"
DB_USER="${DB_USER:-gatevault_app}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-${BACKEND_DIR}/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/gatevault_backup_${TIMESTAMP}.sql.gz"

echo "[*] Starting consistent MySQL dump for '${DB_NAME}'..."

# Stream dump directly into gzip without writing plaintext SQL to unencrypted disk
export MYSQL_PWD="${DB_PASSWORD}"
mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --hex-blob \
    --set-gtid-purged=OFF \
    "${DB_NAME}" | gzip -c > "${BACKUP_FILE}"
unset MYSQL_PWD

chmod 600 "${BACKUP_FILE}"

# Compute SHA-256 Checksum
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[SUCCESS] Backup created: ${BACKUP_FILE} (${FILE_SIZE})"

# Retention Management: Prune backups older than $RETENTION_DAYS while NEVER deleting the sole backup
TOTAL_BACKUPS=$(ls -1 "${BACKUP_DIR}"/gatevault_backup_*.sql.gz 2>/dev/null | wc -l)
if [ "${TOTAL_BACKUPS}" -gt 1 ]; then
    find "${BACKUP_DIR}" -name "gatevault_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -print | while read -r old_file; do
        REMAINING=$(ls -1 "${BACKUP_DIR}"/gatevault_backup_*.sql.gz 2>/dev/null | wc -l)
        if [ "${REMAINING}" -gt 1 ]; then
            rm -f "${old_file}" "${old_file}.sha256"
            echo "[*] Pruned expired backup: ${old_file}"
        fi
    done
fi

