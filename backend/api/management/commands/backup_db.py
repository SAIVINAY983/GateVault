"""
GateVault Database Backup Management Command
Usage:
    python manage.py backup_db [--type MANUAL|AUTOMATIC]
"""

from django.core.management.base import BaseCommand, CommandError
from api.reports import execute_database_backup


class Command(BaseCommand):
    help = "Triggers a verified, consistent GateVault database backup (MySQL or SQLite) and applies retention policy."

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            default='MANUAL',
            choices=['MANUAL', 'AUTOMATIC', 'SCHEDULED'],
            help='Backup type identifier (default: MANUAL)'
        )

    def handle(self, *args, **options):
        backup_type = options['type'].upper()
        if backup_type == 'SCHEDULED':
            backup_type = 'AUTOMATIC'

        self.stdout.write(self.style.NOTICE(f"Initiating GateVault database backup ({backup_type})..."))

        success, error, backup_record = execute_database_backup(user=None, backup_type=backup_type)

        if not success:
            raise CommandError(f"Database backup failed: {error}")

        self.stdout.write(self.style.SUCCESS(
            f"Successfully created backup: {backup_record.backup_name}\n"
            f"  Location: {backup_record.file_path}\n"
            f"  Size: {round(backup_record.file_size / 1024, 2)} KB\n"
            f"  SHA-256: {backup_record.checksum}"
        ))

