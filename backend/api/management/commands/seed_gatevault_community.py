import sys
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import Tower, Flat

class Command(BaseCommand):
    help = 'Seeds GateVault Residency community structure: 4 towers, 15 floors per tower, 240 flats total (idempotent)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--include-15th',
            action='store_true',
            help='Optionally include 15th floor (flats 1501-1504) for 64 flats per tower (256 total).'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=" * 65))
        self.stdout.write(self.style.NOTICE("GATEVAULT RESIDENCY - COMMUNITY SEEDER"))
        self.stdout.write(self.style.NOTICE("=" * 65))

        include_15th = options.get('include_15th', False)

        tower_names = ['Tower A', 'Tower B', 'Tower C', 'Tower D']
        
        # Ground Floor: G001 - G004
        ground_flats = ['G001', 'G002', 'G003', 'G004']

        # Upper floors:
        # Floors 1 through 14 (default for 15 floors total = 60 flats per tower = 240 total)
        # Or through 15 if requested
        max_upper_floor = 15 if include_15th else 14
        upper_flats = []
        for floor in range(1, max_upper_floor + 1):
            for unit in range(1, 5):
                upper_flats.append(f"{floor}{unit:02d}")

        expected_flats = ground_flats + upper_flats

        towers_created = 0
        towers_existing = 0
        flats_created = 0
        flats_existing = 0

        with transaction.atomic():
            for t_name in tower_names:
                tower, created = Tower.objects.get_or_create(name=t_name)
                if created:
                    towers_created += 1
                else:
                    towers_existing += 1

                for flat_num in expected_flats:
                    flat, f_created = Flat.objects.get_or_create(tower=tower, number=flat_num)
                    if f_created:
                        flats_created += 1
                    else:
                        flats_existing += 1

        final_total_towers = Tower.objects.count()
        final_total_flats = Flat.objects.count()

        self.stdout.write(self.style.SUCCESS(f"Towers created: {towers_created}"))
        self.stdout.write(self.style.SUCCESS(f"Towers already existing: {towers_existing}"))
        self.stdout.write(self.style.SUCCESS(f"Flats created: {flats_created}"))
        self.stdout.write(self.style.SUCCESS(f"Flats already existing: {flats_existing}"))
        self.stdout.write(self.style.SUCCESS(f"Final total towers: {final_total_towers}"))
        self.stdout.write(self.style.SUCCESS(f"Final total flats: {final_total_flats}"))
        self.stdout.write(self.style.NOTICE("=" * 65))

