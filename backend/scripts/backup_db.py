#!/usr/bin/env python3
"""
GateVault Standalone Database Backup Utility
============================================
Executes consistent, verified database backups for MySQL (production/staging) or SQLite (dev).
Can be scheduled via cron, Task Scheduler, or CI/CD pipelines.

Usage:
    python backend/scripts/backup_db.py [--type MANUAL|AUTOMATIC] [--retention-days 14]
"""

import os
import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Setup Django standalone environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
try:
    import django
    django.setup()
    from api.reports import execute_database_backup, prune_old_backups
except Exception as e:
    print(f"[ERROR] Failed to initialize GateVault Django environment: {e}", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="GateVault Standalone Database Backup")
    parser.add_argument('--type', default='MANUAL', choices=['MANUAL', 'AUTOMATIC', 'SCHEDULED'], help="Backup type")
    parser.add_argument('--retention-days', type=int, default=None, help="Retention period in days (default: from settings)")
    args = parser.parse_args()

    backup_type = 'AUTOMATIC' if args.type.upper() == 'SCHEDULED' else args.type.upper()
    print(f"[*] Starting GateVault database backup ({backup_type})...")

    success, error_msg, backup_record = execute_database_backup(user=None, backup_type=backup_type)

    if not success:
        print(f"[FAIL] Backup failed: {error_msg}", file=sys.stderr)
        sys.exit(1)

    print(f"[SUCCESS] Backup created successfully:")
    print(f"  Name:     {backup_record.backup_name}")
    print(f"  Path:     {backup_record.file_path}")
    print(f"  Size:     {round(backup_record.file_size / 1024, 2)} KB")
    print(f"  SHA-256:  {backup_record.checksum}")

    if args.retention_days is not None:
        pruned = prune_old_backups(retention_days=args.retention_days)
        print(f"[*] Applied custom retention ({args.retention_days} days): pruned {pruned} expired backup(s).")


if __name__ == '__main__':
    main()

