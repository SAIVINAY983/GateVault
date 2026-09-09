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
        ('DELIVERY_ATTEMPTED', 'Delivery Attempted'),
        ('RESCHEDULED', 'Rescheduled'),
    )

    DELIVERY_TYPE_CHOICES = (
        ('NORMAL', 'Normal'),
        ('FOOD', 'Food Delivery'),
    )

    PAYMENT_TYPE_CHOICES = (
        ('PREPAID', 'Prepaid'),
        ('COD', 'Cash on Delivery (COD)'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('CASH', 'Cash (Direct to Courier)'),
        ('UPI', 'UPI / Remote Digital Link'),
        ('NOT_APPLICABLE', 'Not Applicable'),
    )

    PAYMENT_STATUS_CHOICES = (
        ('PENDING', 'Pending Payment'),
        ('PAID', 'Payment Verified to Courier'),
        ('FAILED', 'Unpaid / Delivery Attempted'),
        ('NOT_APPLICABLE', 'Not Applicable'),
    )

    OPEN_BOX_RESOLUTION_CHOICES = (
        ('NOT_APPLICABLE', 'Not Applicable'),
        ('DIRECT_RESIDENT_HANDOVER', 'Direct Handover at Gate'),
        ('RESCHEDULED', 'Rescheduled - Returned with Courier'),
    )

    parcel_id = models.CharField(max_length=20, unique=True, default=generate_parcel_id)
    delivery_type = models.CharField(max_length=10, choices=DELIVERY_TYPE_CHOICES, default='NORMAL')
    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPE_CHOICES, default='PREPAID')
    cod_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='NOT_APPLICABLE')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='NOT_APPLICABLE')
    payment_confirmed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='confirmed_cod_parcels')
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    flat = models.ForeignKey(Flat, on_delete=models.CASCADE, related_name='parcels')
    resident = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='received_parcels', help_text="The resident receiving the parcel")
    carrier = models.ForeignKey(Carrier, on_delete=models.SET_NULL, null=True, related_name='parcels')
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    shelf = models.ForeignKey(StorageShelf, on_delete=models.SET_NULL, null=True, related_name='parcels')
    expected_delivery = models.OneToOneField('ExpectedDelivery', on_delete=models.SET_NULL, null=True, blank=True, related_name='received_parcel', help_text="The pre-registered expected delivery this parcel fulfills")
    
    is_open_box = models.BooleanField(default=False)
    open_box_resolution = models.CharField(max_length=30, choices=OPEN_BOX_RESOLUTION_CHOICES, default='NOT_APPLICABLE')

    delegated_to = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='delegated_parcels')
    is_delegated = models.BooleanField(default=False)
    collected_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='collected_parcels')
    collected_by_role_type = models.CharField(max_length=20, choices=[('PRIMARY_RESIDENT', 'Primary Resident'), ('DELEGATED_FLATMATE', 'Delegated Flatmate')], default='PRIMARY_RESIDENT')

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
        if self.delivery_type == 'FOOD':
            return False
            
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

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('NEW_PARCEL', 'New Parcel'),
        ('FOOD_DELIVERY', 'Food Delivery'),
        ('OVERDUE', 'Overdue Parcel'),
        ('HANDOVER', 'Handover Completed'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    parcel = models.ForeignKey(Parcel, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"

class ExpectedDelivery(models.Model):
    STATUS_CHOICES = (
        ('EXPECTED', 'Expected'),
        ('CANCELLED', 'Cancelled'),
    )
    DELIVERY_TYPE_CHOICES = (
        ('PARCEL', 'Parcel'),
        ('FOOD', 'Food Delivery'),
    )
    PAYMENT_TYPE_CHOICES = (
        ('PREPAID', 'Prepaid'),
        ('COD', 'Cash on Delivery (COD)'),
    )

    resident = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expected_deliveries', help_text="Resident who expects the delivery")
    tracking_id = models.CharField(max_length=100, db_index=True)
    order_id = models.CharField(max_length=100, blank=True, null=True)
    courier_name = models.CharField(max_length=100)
    
    delivery_type = models.CharField(max_length=10, choices=DELIVERY_TYPE_CHOICES)
    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPE_CHOICES)
    cod_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    expected_delivery_date = models.DateField()
    delivery_photo = models.ImageField(upload_to='expected_deliveries/', null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    is_open_box = models.BooleanField(default=False)
    open_box_resolution = models.CharField(max_length=30, choices=Parcel.OPEN_BOX_RESOLUTION_CHOICES, default='NOT_APPLICABLE')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='EXPECTED')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Expected {self.courier_name} for {self.resident.username} ({self.tracking_id})"
