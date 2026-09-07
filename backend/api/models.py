from django.db import models
from django.contrib.auth.models import AbstractUser
import random
import string
from django.utils import timezone

class User(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('GUARD', 'Guard'),
        ('RESIDENT', 'Resident'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='RESIDENT')

    def __str__(self):
        return f"{self.username} ({self.role})"

class Tower(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name

class Flat(models.Model):
    tower = models.ForeignKey(Tower, on_delete=models.CASCADE, related_name='flats')
    number = models.CharField(max_length=20)

    class Meta:
        unique_together = ('tower', 'number')

    def __str__(self):
        return f"{self.tower.name}-{self.number}"

class ResidentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='resident_profile')
    flat = models.ForeignKey(Flat, on_delete=models.SET_NULL, null=True, related_name='residents')
    phone_number = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"Resident: {self.user.get_full_name() or self.user.username}"

class GuardProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='guard_profile')
    shift = models.CharField(max_length=50, blank=True, null=True)
    is_active_guard = models.BooleanField(default=True)

    def __str__(self):
        return f"Guard: {self.user.get_full_name() or self.user.username}"

class Carrier(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class StorageShelf(models.Model):
    name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField(default=20)

    def __str__(self):
        return f"{self.name} ({self.occupied}/{self.capacity})"

    @property
    def occupied(self):
        # Occupancy is derived directly from active parcel records, avoiding inconsistencies caused by manually maintained counts.
        return self.parcels.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).count()

    @property
    def is_full(self):
        return self.occupied >= self.capacity

    @property
    def available(self):
        return self.capacity - self.occupied

def generate_parcel_id():
    # Example GV-2026-000145
    year = timezone.now().year
    random_str = ''.join(random.choices(string.digits, k=6))
    return f"GV-{year}-{random_str}"

def generate_pickup_pin():
    return ''.join(random.choices(string.digits, k=4))

class Parcel(models.Model):
    STATUS_CHOICES = (
        ('AWAITING_PICKUP', 'Awaiting Pickup'),
        ('OVERDUE', 'Overdue'),
        ('HANDED_OVER', 'Handed Over'),
        ('CANCELLED', 'Cancelled'),
    )

    parcel_id = models.CharField(max_length=20, unique=True, default=generate_parcel_id)
    flat = models.ForeignKey(Flat, on_delete=models.CASCADE, related_name='parcels')
    resident = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='received_parcels', help_text="The resident receiving the parcel")
    carrier = models.ForeignKey(Carrier, on_delete=models.SET_NULL, null=True, related_name='parcels')
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    shelf = models.ForeignKey(StorageShelf, on_delete=models.SET_NULL, null=True, related_name='parcels')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AWAITING_PICKUP')
    pickup_pin = models.CharField(max_length=4, default=generate_pickup_pin)
    
    received_at = models.DateTimeField(auto_now_add=True)
    handed_over_at = models.DateTimeField(null=True, blank=True)
    
    received_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='registered_parcels', help_text="Guard who registered the parcel")
    handed_over_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='handed_over_parcels', help_text="Guard who handed over the parcel")

    def __str__(self):
        return f"Parcel {self.parcel_id} for {self.flat}"

    @property
    def is_overdue(self):
        if self.status == 'AWAITING_PICKUP':
            time_diff = timezone.now() - self.received_at
            if time_diff.total_seconds() > 48 * 3600:
                return True
        return False

class PickupVerification(models.Model):
    parcel = models.OneToOneField(Parcel, on_delete=models.CASCADE, related_name='verification')
    guard = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='verifications')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Verification for {self.parcel.parcel_id}"
