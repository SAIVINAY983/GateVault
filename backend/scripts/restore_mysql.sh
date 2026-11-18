#!/usr/bin/env bash
# ==============================================================================
# GateVault MySQL Database Restoration Script
# ==============================================================================
# Restores database from a compressed .sql.gz or plain .sql dump file.
# Requires explicit confirmation (CONFIRM=yes or interactive YES).
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -f "${BACKEND_DIR}/.env" ]; then
    set -a
    source "${BACKEND_DIR}/.env"
    set +a
fi

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file> [--confirm]"
    exit 1
fi

BACKUP_FILE="$1"
CONFIRM_FLAG="${2:-}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "[ERROR] Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Verify SHA256 checksum if .sha256 file exists alongside backup
if [ -f "${BACKUP_FILE}.sha256" ] && command -v sha256sum >/dev/null 2>&1; then
    echo "[*] Verifying backup checksum..."
    sha256sum -c "${BACKUP_FILE}.sha256" || {
        echo "[ERROR] Checksum verification failed! File may be corrupt."
        exit 1
    }
fi

if [ "${CONFIRM_FLAG}" != "--confirm" ]; then
    echo "========================================================================"
    echo "WARNING: Restoring will completely overwrite the '${DB_NAME:-gatevault}' database!"
    echo "========================================================================"
    read -rp "Type 'RESTORE' to proceed: " CONFIRMATION
    if [ "${CONFIRMATION}" != "RESTORE" ]; then
        echo "Restoration cancelled."
        exit 0
    fi
fi

DB_NAME="${DB_NAME:-gatevault}"
DB_USER="${DB_USER:-gatevault_app}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_PASSWORD="${DB_PASSWORD:-}"

echo "[*] Restoring '${DB_NAME}' from ${BACKUP_FILE}..."

export MYSQL_PWD="${DB_PASSWORD}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -dc "${BACKUP_FILE}" | mysql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --user="${DB_USER}" \
        "${DB_NAME}"
else
    mysql \
        --host="${DB_HOST}" \
        --port="${DB_PORT}" \
        --user="${DB_USER}" \
        "${DB_NAME}" < "${BACKUP_FILE}"
fi
unset MYSQL_PWD

echo "[SUCCESS] Database restoration completed successfully."

