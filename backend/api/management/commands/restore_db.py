"""
GateVault Database Restoration Management Command
Usage:
    python manage.py restore_db <path_to_backup_file> [--confirm]
"""

from django.core.management.base import BaseCommand, CommandError
from api.reports import restore_database


class Command(BaseCommand):
    help = "Restores the GateVault database from a verified backup file (.sql.gz, .sql, or .sqlite3)."

    def add_arguments(self, parser):
        parser.add_argument(
            'backup_path',
            type=str,
            help='Path to the database backup file to restore'
        )
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Explicit confirmation to overwrite existing database contents'
        )

    def handle(self, *args, **options):
        backup_path = options['backup_path']
        confirm = options['confirm']

        if not confirm:
            self.stdout.write(self.style.WARNING(
                "=====================================================================\n"
                "WARNING: DATABASE RESTORATION WILL OVERWRITE ACTIVE COMMUNITY RECORDS\n"
                "====================================================================="
            ))
            user_input = input("Type 'RESTORE' to confirm overwriting the database: ")
            if user_input.strip() != 'RESTORE':
                self.stdout.write(self.style.ERROR("Restoration cancelled by user."))
                return
            confirm = True

        self.stdout.write(self.style.NOTICE(f"Restoring database from: {backup_path}..."))

        success, msg = restore_database(backup_path, confirm=confirm)

        if not success:
            raise CommandError(f"Database restoration failed: {msg}")

        self.stdout.write(self.style.SUCCESS(f"Restoration complete: {msg}"))

