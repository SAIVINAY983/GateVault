import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import (
    User, Tower, Flat, ResidentProfile, GuardProfile, 
    Carrier, StorageShelf, Parcel
)

class Command(BaseCommand):
    help = 'Generates demo data for GateVault'

    def handle(self, *args, **kwargs):
        self.stdout.write('Generating demo data...')
        
        # 1. Clear existing data (optional, but good for reset)
        User.objects.all().delete()
        Tower.objects.all().delete()
        Carrier.objects.all().delete()
        StorageShelf.objects.all().delete()
        
        # 2. Create Carriers
        carriers = ['Amazon', 'Flipkart', 'Delhivery', 'Blue Dart', 'DTDC', 'Swiggy', 'Zomato', 'Other']
        carrier_objs = []
        for name in carriers:
            c = Carrier.objects.create(name=name)
            carrier_objs.append(c)
            
        # 3. Create Shelves
        shelf_objs = []
        for i in range(1, 21):
            s = StorageShelf.objects.create(name=f'S-{i:02d}', capacity=20)
            shelf_objs.append(s)
            
        # 4. Create Towers and Flats
        towers = ['A', 'B', 'C']
        flat_objs = []
        for t_name in towers:
            tower = Tower.objects.create(name=t_name)
            for f in range(1, 11):
                flat = Flat.objects.create(tower=tower, number=f'{t_name}-{100 + f}')
                flat_objs.append(flat)

        # 5. Create Admin
        admin = User.objects.create_superuser('admin', 'admin@example.com', 'adminpass', first_name='Super', last_name='Admin')
        admin.role = 'ADMIN'
        admin.save()
        
        # 6. Create Guards
        guards = []
        guard_names = [('Ramesh', 'Kumar'), ('Suresh', 'Singh')]
        for i, names in enumerate(guard_names, start=1):
            guard = User.objects.create_user(f'guard{i}', f'guard{i}@example.com', 'guardpass', first_name=names[0], last_name=names[1])
            guard.role = 'GUARD'
            guard.save()
            GuardProfile.objects.create(user=guard, shift='Morning')
            guards.append(guard)

        # 7. Create Residents
        residents = []
        resident_names = [('Arjun', 'Reddy'), ('Priya', 'Sharma'), ('Rahul', 'Verma'), ('Neha', 'Gupta'), ('Vikram', 'Singh')]
        for i, names in enumerate(resident_names, start=1):
            res = User.objects.create_user(f'resident{i}', f'resident{i}@example.com', 'respass', first_name=names[0], last_name=names[1])
            res.role = 'RESIDENT'
            res.save()
            flat = random.choice(flat_objs)
            ResidentProfile.objects.create(user=res, flat=flat, phone_number=f'987654321{i}')
            residents.append(res)
            
        # 8. Create Parcels
        self.stdout.write('Creating parcels...')
        now = timezone.now()
        
        scenarios = [
            # (status, received_delta, handed_over_delta)
            ('HANDED_OVER', timedelta(hours=10), timedelta(hours=2)), # Handed over today
            ('HANDED_OVER', timedelta(hours=8), timedelta(hours=1)),  # Handed over today
            ('HANDED_OVER', timedelta(days=5), timedelta(days=3)),    # Handed over past
            ('OVERDUE', timedelta(days=3), None),                     # Overdue
            ('OVERDUE', timedelta(days=4), None),                     # Overdue
            ('AWAITING_PICKUP', timedelta(hours=5), None),            # Pending
            ('AWAITING_PICKUP', timedelta(hours=12), None),           # Pending
            ('AWAITING_PICKUP', timedelta(hours=2), None),            # Pending
        ]
        
        # Generate 16 parcels using scenarios (repeat 2x)
        scenarios = scenarios * 2

        for status, rec_delta, hand_delta in scenarios:
            resident = random.choice(residents)
            guard = random.choice(guards)
            carrier = random.choice(carrier_objs)
            shelf = random.choice(shelf_objs)
            
            p = Parcel.objects.create(
                flat=resident.resident_profile.flat,
                resident=resident,
                carrier=carrier,
                shelf=shelf,
                received_by=guard,
                status=status,
                handed_over_at=(now - hand_delta) if hand_delta else None,
                handed_over_by=guard if status == 'HANDED_OVER' else None
            )
            
            # Use .update() to bypass auto_now_add on received_at
            Parcel.objects.filter(id=p.id).update(received_at=now - rec_delta)

        self.stdout.write(self.style.SUCCESS('Successfully generated demo data!'))
