#!/usr/bin/env python3
"""
GateVault Standalone Database Restoration Utility
=================================================
Safely restores GateVault from a verified backup (.sql.gz, .sql, or .sqlite3).
Requires explicit confirmation (--confirm) to prevent accidental data loss.

Usage:
    python backend/scripts/restore_db.py <path_to_backup> [--confirm]
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
    from api.reports import restore_database
except Exception as e:
    print(f"[ERROR] Failed to initialize GateVault Django environment: {e}", file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="GateVault Standalone Database Restoration")
    parser.add_argument('backup_path', help="Path to verified database backup file")
    parser.add_argument('--confirm', action='store_true', help="Explicit confirmation to overwrite existing database")
    args = parser.parse_args()

    backup_path = os.path.abspath(args.backup_path)

    if not args.confirm:
        print("=" * 70)
        print("WARNING: RESTORATION WILL OVERWRITE CURRENT COMMUNITY DATABASE RECORDS")
        print("=" * 70)
        confirm_input = input("Type 'RESTORE' to proceed with database overwrite: ")
        if confirm_input.strip() != 'RESTORE':
            print("Restoration cancelled by user.", file=sys.stderr)
            sys.exit(0)

    print(f"[*] Restoring database from: {backup_path}...")
    success, msg = restore_database(backup_path, confirm=True)

    if not success:
        print(f"[FAIL] Database restoration failed: {msg}", file=sys.stderr)
        sys.exit(1)

    print(f"[SUCCESS] {msg}")


if __name__ == '__main__':
    main()

