from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
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
    APPROVAL_STATUS_CHOICES = (
        ('PENDING_APPROVAL', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='resident_profile')
    flat = models.ForeignKey(Flat, on_delete=models.SET_NULL, null=True, related_name='residents')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    is_primary = models.BooleanField(default=True, help_text="Designates primary resident who can authorize household members")
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='APPROVED')
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)
    rejection_reason = models.TextField(blank=True, null=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_residents')
    approved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Resident: {self.user.get_full_name() or self.user.username} ({self.approval_status})"

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
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('INACTIVE', 'Inactive'),
        ('MAINTENANCE', 'Under Maintenance'),
    )
    SIZE_CHOICES = (
        ('SMALL', 'Small'),
        ('MEDIUM', 'Medium'),
        ('LARGE', 'Large'),
    )

    name = models.CharField(max_length=50, unique=True)
    capacity = models.PositiveIntegerField(default=20)
    max_parcel_size = models.CharField(max_length=10, choices=SIZE_CHOICES, default='LARGE')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    maintenance_notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} [{self.max_parcel_size}] ({self.occupied}/{self.capacity})"

    @property
    def active_parcels_count(self):
        return self.parcels.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).count()

    @property
    def active_reservations_count(self):
        return self.reservations.filter(status='ACTIVE', expires_at__gt=timezone.now()).count()

    @property
    def occupied(self):
        return self.active_parcels_count

    @property
    def current_occupancy(self):
        return self.occupied

    @property
    def effective_occupied(self):
        return self.active_parcels_count + self.active_reservations_count

    @property
    def is_full(self):
        return self.effective_occupied >= self.capacity

    @property
    def available(self):
        return max(0, self.capacity - self.effective_occupied)

    @property
    def utilization_percentage(self):
        if self.capacity == 0:
            return 100.0
        return round((self.occupied / self.capacity) * 100, 1)

    @property
    def is_near_capacity(self):
        return self.utilization_percentage >= 85.0

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
        ('DELIVERED_DIRECTLY_TO_FLAT', 'Delivered Directly to Flat'),
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

    SIZE_CHOICES = (
        ('SMALL', 'Small'),
        ('MEDIUM', 'Medium'),
        ('LARGE', 'Large'),
    )

    parcel_id = models.CharField(max_length=20, unique=True, default=generate_parcel_id)
    delivery_type = models.CharField(max_length=10, choices=DELIVERY_TYPE_CHOICES, default='NORMAL')
    parcel_size = models.CharField(max_length=10, choices=SIZE_CHOICES, default='MEDIUM')
    dimensions = models.CharField(max_length=50, blank=True, null=True, help_text="e.g. 30x20x15 cm")
    handling_instructions = models.TextField(blank=True, null=True, help_text="e.g. Fragile, Keep upright")
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
    courier_visit = models.ForeignKey('CourierVisit', null=True, blank=True, on_delete=models.SET_NULL, related_name='parcels', help_text="Courier visit during which this parcel was received")
    
    is_open_box = models.BooleanField(default=False)
    open_box_resolution = models.CharField(max_length=30, choices=OPEN_BOX_RESOLUTION_CHOICES, default='NOT_APPLICABLE')

    is_high_value = models.BooleanField(default=False)
    declared_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    resident_presence_confirmed = models.BooleanField(default=False)
    extra_verification_notes = models.TextField(blank=True, null=True)

    delegated_to = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='delegated_parcels')
    is_delegated = models.BooleanField(default=False)
    collected_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='collected_parcels')
    collected_by_role_type = models.CharField(
        max_length=35, 
        choices=[
            ('PRIMARY_RESIDENT', 'Primary Resident'), 
            ('DELEGATED_FLATMATE', 'Delegated Flatmate'),
            ('HOUSEHOLD_MEMBER', 'Authorized Household Member'),
            ('TEMPORARY_GUEST', 'Temporary Authorized Guest')
        ], 
        default='PRIMARY_RESIDENT'
    )

    # Alternate Receiver & Direct Delivery fields
    actual_receiver = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='received_parcels_as_receiver')
    actual_receiver_name = models.CharField(max_length=150, blank=True, null=True)
    receiver_relationship = models.CharField(max_length=30, blank=True, null=True)
    household_member = models.ForeignKey('HouseholdMember', null=True, blank=True, on_delete=models.SET_NULL, related_name='parcels')
    delivery_location = models.CharField(max_length=30, choices=[('GATEHOUSE', 'Gatehouse'), ('DIRECT_TO_FLAT', 'Direct to Flat')], default='GATEHOUSE')
    direct_delivery_verification = models.CharField(max_length=50, blank=True, null=True)
    direct_delivery_photo = models.ImageField(upload_to='direct_deliveries/', null=True, blank=True)

    status = models.CharField(max_length=35, choices=STATUS_CHOICES, default='AWAITING_PICKUP')
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
    VERIFICATION_METHOD_CHOICES = (
        ('PIN', '4-Digit PIN'),
        ('QR', 'Secure QR Pass'),
        ('DIRECT_DOORSTEP', 'Direct Doorstep Handover'),
        ('GUEST_PASS', 'Temporary Guest Pass'),
    )
    parcel = models.OneToOneField(Parcel, on_delete=models.CASCADE, related_name='verification')
    guard = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='verifications')
    verification_method = models.CharField(max_length=20, choices=VERIFICATION_METHOD_CHOICES, default='PIN')
    qr_pass = models.ForeignKey('ParcelQRPickupPass', null=True, blank=True, on_delete=models.SET_NULL, related_name='verifications')
    guest_authorization = models.ForeignKey('GuestPickupAuthorization', null=True, blank=True, on_delete=models.SET_NULL, related_name='verifications')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Verification for {self.parcel.parcel_id} via {self.verification_method}"

class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('NEW_PARCEL', 'New Parcel'),
        ('FOOD_DELIVERY', 'Food Delivery'),
        ('OVERDUE', 'Overdue Parcel'),
        ('HANDOVER', 'Handover Completed'),
        ('CONDITION_ALERT', 'Parcel Condition Alert'),
        ('INCIDENT_UPDATE', 'Incident Status Update'),
        ('HOUSEHOLD_UPDATE', 'Household Authorization Update'),
        ('HOUSEHOLD_DELIVERY', 'Household Delivery Handover'),
        ('SHIFT_HANDOVER', 'Guard Shift Handover'),
        ('POLICY_UPDATE', 'Delivery Policy Update'),
        ('GUEST_AUTHORIZED', 'Guest Pickup Authorized'),
        ('GUEST_COLLECTED', 'Guest Parcel Collected'),
        ('GUEST_REVOKED', 'Guest Authorization Revoked'),
        ('GUEST_EXPIRED', 'Guest Authorization Expired'),
        ('COURIER_ALERT', 'Courier Visit Alert'),
        ('DELIVERY_SCHEDULED', 'Expected Delivery Scheduled'),
        ('DELIVERY_RESCHEDULED', 'Delivery Schedule Updated'),
        ('DELIVERY_CANCELLED', 'Delivery Schedule Cancelled'),
        ('PRIORITY_ALERT', 'Priority Alert Notification'),
        ('FEEDBACK_REVIEWED', 'Feedback Reviewed'),
        ('FEEDBACK_RESPONSE', 'Feedback Response'),
        ('DATABASE_BACKUP', 'Database Backup Notification'),
        ('REGISTRATION_PENDING', 'Resident Registration Pending Approval'),
        ('REGISTRATION_APPROVED', 'Resident Registration Approved'),
        ('REGISTRATION_REJECTED', 'Resident Registration Rejected'),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=35, choices=NOTIFICATION_TYPES)
    parcel = models.ForeignKey(Parcel, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"

class ExpectedDelivery(models.Model):
    STATUS_CHOICES = (
        ('SCHEDULED', 'Scheduled'),
        ('EXPECTED', 'Expected'),
        ('RECEIVED', 'Received'),
        ('CANCELLED', 'Cancelled'),
        ('MISSED', 'Missed'),
        ('RESCHEDULED', 'Rescheduled'),
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
    
    expected_delivery_date = models.DateField(help_text="Resident-estimated delivery date")
    expected_start_time = models.TimeField(null=True, blank=True, help_text="Estimated delivery window start time")
    expected_end_time = models.TimeField(null=True, blank=True, help_text="Estimated delivery window end time")
    time_window_label = models.CharField(max_length=50, blank=True, null=True, help_text="Resident-selected time window, e.g., 9 AM - 12 PM")
    actual_received_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when parcel was received at gatehouse")
    rescheduled_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when delivery was last rescheduled")
    delivery_photo = models.ImageField(upload_to='expected_deliveries/', null=True, blank=True)
    note = models.TextField(blank=True, null=True)
    is_open_box = models.BooleanField(default=False)
    open_box_resolution = models.CharField(max_length=30, choices=Parcel.OPEN_BOX_RESOLUTION_CHOICES, default='NOT_APPLICABLE')
    is_high_value = models.BooleanField(default=False)
    declared_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def expected_date(self):
        return self.expected_delivery_date

    @property
    def scheduling_status(self):
        return self.status

    @property
    def delivery_category(self):
        if self.payment_type == 'COD':
            return 'COD'
        if self.delivery_type == 'FOOD':
            return 'FOOD'
        return 'NORMAL'

    @property
    def is_missed_or_delayed(self):
        """
        Determines whether the estimated delivery window has lapsed with a grace period.
        Grace period: 2 hours after expected_end_time on delivery date, or end of delivery date.
        """
        if self.status in ['RECEIVED', 'CANCELLED']:
            return False
        today = timezone.localdate()
        if self.expected_delivery_date < today:
            return True
        if self.expected_delivery_date == today and self.expected_end_time:
            current_time = timezone.localtime().time()
            end_minutes = self.expected_end_time.hour * 60 + self.expected_end_time.minute + 120
            cur_minutes = current_time.hour * 60 + current_time.minute
            if cur_minutes > end_minutes:
                return True
        return False

    def __str__(self):
        return f"Expected {self.courier_name} for {self.resident.username} ({self.tracking_id})"


class ParcelInspection(models.Model):
    CONDITION_CHOICES = (
        ('INTACT', 'Intact'),
        ('DAMAGED', 'Damaged'),
        ('TAMPERED', 'Tampered'),
        ('OPENED', 'Opened'),
    )

    parcel = models.OneToOneField(Parcel, on_delete=models.CASCADE, related_name='inspection')
    guard = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='performed_inspections')
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='INTACT')
    remarks = models.TextField(blank=True, null=True)
    photo = models.ImageField(upload_to='inspections/', null=True, blank=True)
    courier_confirmed = models.BooleanField(default=False)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Resident acknowledgement
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_inspections')
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Inspection for {self.parcel.parcel_id} - {self.condition}"


class ParcelIncident(models.Model):
    CATEGORY_CHOICES = (
        ('DAMAGED', 'Parcel Damaged'),
        ('TAMPERED', 'Parcel Tampered With'),
        ('MISSING_CONTENTS', 'Missing Contents'),
        ('INCORRECT_PARCEL', 'Incorrect Parcel'),
        ('OTHER', 'Other'),
    )

    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('UNDER_REVIEW', 'Under Review'),
        ('RESOLVED', 'Resolved'),
        ('REJECTED', 'Rejected'),
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name='incidents')
    resident = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reported_incidents')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    description = models.TextField()
    evidence_photo = models.ImageField(upload_to='incidents/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    resolution_notes = models.TextField(blank=True, null=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_incidents')
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Incident #{self.id} on {self.parcel.parcel_id} ({self.status})"


class IncidentHistory(models.Model):
    incident = models.ForeignKey(ParcelIncident, on_delete=models.CASCADE, related_name='history')
    action_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    old_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20)
    notes = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"History for Incident #{self.incident_id}: {self.old_status} -> {self.new_status}"


class HouseholdMember(models.Model):
    RELATIONSHIP_CHOICES = (
        ('WIFE', 'Wife'),
        ('HUSBAND', 'Husband'),
        ('FATHER', 'Father'),
        ('MOTHER', 'Mother'),
        ('BROTHER', 'Brother'),
        ('SISTER', 'Sister'),
        ('OTHER', 'Other'),
    )

    flat = models.ForeignKey(Flat, on_delete=models.CASCADE, related_name='household_members')
    primary_resident = models.ForeignKey(User, on_delete=models.CASCADE, related_name='managed_household_members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='household_memberships')
    
    full_name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES)
    mobile_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    
    is_active = models.BooleanField(default=True, help_text="Authorization active status")
    
    # Granular Permissions
    can_receive_parcels = models.BooleanField(default=True)
    can_receive_food = models.BooleanField(default=True)
    can_collect_gatehouse_parcels = models.BooleanField(default=True)
    can_view_delivery_notifications = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('flat', 'mobile_number')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.get_relationship_display()}) - Flat {self.flat.number}"


class HouseholdAuditLog(models.Model):
    ACTION_CHOICES = (
        ('MEMBER_ADDED', 'Member Added'),
        ('PERMISSIONS_UPDATED', 'Permissions Updated'),
        ('MEMBER_ACTIVATED', 'Member Activated'),
        ('MEMBER_DEACTIVATED', 'Member Deactivated'),
        ('MEMBER_REVOKED', 'Authorization Revoked'),
        ('MEMBER_REMOVED', 'Member Removed'),
    )
    household_member = models.ForeignKey(HouseholdMember, on_delete=models.CASCADE, related_name='audit_logs')
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    details = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} on {self.household_member.full_name} at {self.timestamp}"


class ParcelQRPickupPass(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('USED', 'Used'),
        ('REVOKED', 'Revoked'),
        ('EXPIRED', 'Expired'),
    )

    COLLECTOR_ROLE_CHOICES = (
        ('PRIMARY_RESIDENT', 'Primary Resident'),
        ('DELEGATED_FLATMATE', 'Delegated Flatmate'),
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name='qr_passes')
    authorized_collector = models.ForeignKey(User, on_delete=models.CASCADE, related_name='authorized_qr_passes')
    collector_role_type = models.CharField(max_length=35, choices=COLLECTOR_ROLE_CHOICES, default='PRIMARY_RESIDENT')
    token_hash = models.CharField(max_length=64, db_index=True, unique=True, help_text="SHA-256 hash of the secure pickup pass token")
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='revoked_qr_passes')
    verified_by_guard = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_qr_passes')
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.status == 'ACTIVE' and not self.is_expired

    def __str__(self):
        return f"QR Pass for {self.parcel.parcel_id} ({self.status}) - Exp: {self.expires_at}"


class GuardShift(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('HANDED_OVER', 'Handed Over'),
        ('COMPLETED', 'Completed'),
    )

    guard = models.ForeignKey(User, on_delete=models.CASCADE, related_name='guard_shifts')
    shift_start = models.DateTimeField(default=timezone.now)
    shift_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    handover_notes = models.TextField(blank=True, null=True)
    summary_data = models.JSONField(blank=True, null=True)
    accepted_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='accepted_guard_shifts')
    accepted_at = models.DateTimeField(null=True, blank=True)
    is_admin_override = models.BooleanField(default=False)
    admin_override_reason = models.TextField(blank=True, null=True)
    admin_override_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='admin_override_shifts')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-shift_start']

    @property
    def duration_minutes(self):
        end_time = self.shift_end or timezone.now()
        delta = end_time - self.shift_start
        return max(0, int(delta.total_seconds() // 60))

    @property
    def duration_display(self):
        minutes = self.duration_minutes
        hours = minutes // 60
        mins = minutes % 60
        if hours > 0:
            return f"{hours}h {mins}m"
        return f"{mins}m"

    def __str__(self):
        return f"Shift #{self.id} - {self.guard.username} ({self.status})"


class CommunityDeliveryPolicy(models.Model):
    DELIVERY_TYPE_CHOICES = (
        ('NORMAL', 'Normal Courier Parcels'),
        ('FOOD', 'Food Deliveries'),
        ('COD', 'Cash on Delivery (COD)'),
        ('OPEN_BOX', 'Open-Box Deliveries'),
        ('HIGH_VALUE', 'High-Value Parcels'),
    )

    DELIVERY_MODE_CHOICES = (
        ('DIRECT_TO_FLAT', 'Direct to Flat'),
        ('GATEHOUSE_ONLY', 'Gatehouse Only'),
        ('RESIDENT_PREFERENCE', 'Resident Preference'),
        ('AUTHORIZED_RECEIVER_ONLY', 'Authorized Receiver Only'),
    )

    delivery_type = models.CharField(max_length=20, choices=DELIVERY_TYPE_CHOICES, unique=True)
    delivery_mode = models.CharField(max_length=30, choices=DELIVERY_MODE_CHOICES, default='GATEHOUSE_ONLY')
    
    allow_direct_to_flat = models.BooleanField(default=False, help_text="Allow direct-to-flat doorstep delivery")
    require_gatehouse_intake = models.BooleanField(default=True, help_text="Mandate intake registration and shelf assignment at gatehouse")
    allow_household_receiver = models.BooleanField(default=True, help_text="Allow authorized household members to receive")
    require_resident_presence = models.BooleanField(default=False, help_text="Require primary resident presence for handover")
    require_extra_verification = models.BooleanField(default=False, help_text="Require additional identity verification notes")
    bypass_storage_shelf = models.BooleanField(default=False, help_text="Allow package to bypass parcel storage shelves")
    enable_cod_coordination = models.BooleanField(default=True, help_text="Enable cash-on-delivery coordination at gate")
    
    description = models.TextField(blank=True, null=True, help_text="Clear explanation and guideline of this policy")
    is_active = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_community_policies')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_community_policies')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['delivery_type']

    def __str__(self):
        return f"Community Policy: {self.get_delivery_type_display()} -> {self.delivery_mode}"


class TowerDeliveryPolicy(models.Model):
    tower = models.ForeignKey(Tower, on_delete=models.CASCADE, related_name='delivery_policies')
    delivery_type = models.CharField(max_length=20, choices=CommunityDeliveryPolicy.DELIVERY_TYPE_CHOICES)
    delivery_mode = models.CharField(max_length=30, choices=CommunityDeliveryPolicy.DELIVERY_MODE_CHOICES, default='GATEHOUSE_ONLY')
    
    allow_direct_to_flat = models.BooleanField(default=False)
    require_gatehouse_intake = models.BooleanField(default=True)
    allow_household_receiver = models.BooleanField(default=True)
    require_resident_presence = models.BooleanField(default=False)
    require_extra_verification = models.BooleanField(default=False)
    bypass_storage_shelf = models.BooleanField(default=False)
    enable_cod_coordination = models.BooleanField(default=True)
    
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_tower_policies')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_tower_policies')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tower', 'delivery_type')
        ordering = ['tower__name', 'delivery_type']

    def __str__(self):
        return f"Tower {self.tower.name} Override: {self.delivery_type} -> {self.delivery_mode}"


class DeliveryPolicyAuditLog(models.Model):
    ACTION_CHOICES = (
        ('CREATED', 'Policy Created'),
        ('UPDATED', 'Policy Updated'),
        ('TOGGLED_ACTIVE', 'Status Toggled'),
        ('TOWER_OVERRIDE_SET', 'Tower Override Configured'),
        ('TOWER_OVERRIDE_REMOVED', 'Tower Override Removed'),
    )

    policy_scope = models.CharField(max_length=20, default='COMMUNITY')
    tower = models.ForeignKey(Tower, on_delete=models.SET_NULL, null=True, blank=True)
    delivery_type = models.CharField(max_length=20)
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    changes_summary = models.TextField()
    previous_state = models.JSONField(null=True, blank=True)
    new_state = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.action} on {self.delivery_type} by {self.changed_by} at {self.timestamp}"


class GuestPickupAuthorization(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('USED', 'Used'),
        ('REVOKED', 'Revoked'),
        ('EXPIRED', 'Expired'),
    )

    RELATIONSHIP_CHOICES = (
        ('FRIEND', 'Friend'),
        ('RELATIVE', 'Relative'),
        ('OTHER', 'Other'),
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name='guest_authorizations')
    resident = models.ForeignKey(User, on_delete=models.CASCADE, related_name='guest_authorizations')
    guest_name = models.CharField(max_length=150)
    guest_mobile = models.CharField(max_length=20)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES, default='FRIEND')
    instructions = models.TextField(blank=True, null=True)

    pass_code = models.CharField(max_length=30, blank=True, null=True, help_text="Display pass code (e.g. GV-GUEST-123456)")
    token_hash = models.CharField(max_length=64, db_index=True, unique=True, help_text="SHA-256 hash of the secure one-time guest token")
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='revoked_guest_authorizations')
    verified_by_guard = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='verified_guest_authorizations')
    verified_at = models.DateTimeField(null=True, blank=True)
    actual_collector_name = models.CharField(max_length=150, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.status == 'ACTIVE' and not self.is_expired

    def __str__(self):
        return f"Guest Pass for {self.guest_name} on {self.parcel.parcel_id} ({self.status})"


def generate_reservation_token():
    return 'SR-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=16))


class ShelfReservation(models.Model):
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('COMMITTED', 'Committed'),
        ('RELEASED', 'Released'),
        ('EXPIRED', 'Expired'),
    )

    shelf = models.ForeignKey(StorageShelf, on_delete=models.CASCADE, related_name='reservations')
    guard = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shelf_reservations')
    parcel_size = models.CharField(max_length=10, choices=Parcel.SIZE_CHOICES, default='MEDIUM')
    reservation_token = models.CharField(max_length=64, unique=True, default=generate_reservation_token)
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    committed_parcel = models.ForeignKey(Parcel, null=True, blank=True, on_delete=models.SET_NULL, related_name='reservation_used')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return self.status == 'ACTIVE' and timezone.now() > self.expires_at

    def __str__(self):
        return f"Reservation {self.reservation_token} on {self.shelf.name} ({self.status})"


class ShelfAssignmentHistory(models.Model):
    ACTION_CHOICES = (
        ('INITIAL_INTAKE', 'Initial Intake Assignment'),
        ('RELOCATION', 'Parcel Relocation'),
        ('HANDOVER_RELEASE', 'Handover Release'),
        ('MAINTENANCE_RELOCATION', 'Maintenance Relocation'),
    )

    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name='shelf_history')
    previous_shelf = models.ForeignKey(StorageShelf, null=True, blank=True, on_delete=models.SET_NULL, related_name='relocations_from')
    new_shelf = models.ForeignKey(StorageShelf, null=True, blank=True, on_delete=models.SET_NULL, related_name='relocations_to')
    guard = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='shelf_assignments')
    action_type = models.CharField(max_length=30, choices=ACTION_CHOICES, default='INITIAL_INTAKE')
    reason = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        prev = self.previous_shelf.name if self.previous_shelf else 'None'
        nxt = self.new_shelf.name if self.new_shelf else 'None'
        return f"{self.parcel.parcel_id}: {prev} -> {nxt} ({self.action_type})"


class CourierVisit(models.Model):
    STATUS_CHOICES = (
        ('INSIDE', 'Currently Inside'),
        ('EXITED', 'Exited'),
    )

    PURPOSE_CHOICES = (
        ('PARCEL_DELIVERY', 'Parcel Delivery'),
        ('FOOD_DELIVERY', 'Food Delivery'),
        ('RETURN_PICKUP', 'Return Pickup'),
        ('MULTIPLE_DELIVERIES', 'Multiple Deliveries'),
        ('OTHER', 'Other'),
    )

    courier_name = models.CharField(max_length=150)
    carrier = models.ForeignKey(Carrier, null=True, blank=True, on_delete=models.SET_NULL, related_name='courier_visits')
    carrier_name = models.CharField(max_length=100, blank=True, null=True, help_text="Delivery company name")
    mobile_number = models.CharField(max_length=20)
    vehicle_number = models.CharField(max_length=50, blank=True, null=True)
    visit_purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES, default='PARCEL_DELIVERY')
    
    entry_time = models.DateTimeField(default=timezone.now)
    exit_time = models.DateTimeField(null=True, blank=True)
    
    entry_guard = models.ForeignKey(User, on_delete=models.CASCADE, related_name='registered_courier_visits')
    exit_guard = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='checked_out_courier_visits')
    
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='INSIDE')
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-entry_time']

    @property
    def duration_minutes(self):
        end_t = self.exit_time or timezone.now()
        diff = (end_t - self.entry_time).total_seconds()
        return max(0, int(diff // 60))

    @property
    def duration_display(self):
        minutes = self.duration_minutes
        hours = minutes // 60
        mins = minutes % 60
        if hours > 0:
            return f"{hours}h {mins}m"
        return f"{mins}m"

    @property
    def is_unusually_long(self):
        return self.status == 'INSIDE' and self.duration_minutes >= 45

    @property
    def linked_parcels_count(self):
        return self.parcels.count()

    def __str__(self):
        carrier_label = self.carrier_name or (self.carrier.name if self.carrier else 'Courier')
        return f"{self.courier_name} ({carrier_label}) - {self.status}"


class PriorityAlert(models.Model):
    CATEGORY_CHOICES = (
        ('SECURITY_EMERGENCY', 'Security Emergency'),
        ('DAMAGED_PARCEL', 'Damaged Parcel'),
        ('TAMPERED_PARCEL', 'Tampered Parcel'),
        ('OVERDUE_PARCEL', 'Overdue Parcel'),
        ('HIGH_VALUE_DELIVERY', 'High-Value Delivery'),
        ('FOOD_DELIVERY_DELAY', 'Food Delivery Delay'),
        ('GATEHOUSE_OPERATION', 'Gatehouse Operation'),
        ('OTHER', 'Other Issue'),
    )

    PRIORITY_CHOICES = (
        ('CRITICAL', 'Critical'),
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    )

    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('DISMISSED', 'Dismissed'),
    )

    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')

    related_parcel = models.ForeignKey(Parcel, on_delete=models.SET_NULL, null=True, blank=True, related_name='priority_alerts')
    related_incident = models.ForeignKey(ParcelIncident, on_delete=models.SET_NULL, null=True, blank=True, related_name='priority_alerts')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_alerts')

    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_alerts')
    acknowledged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_alerts')
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, null=True)

    photo = models.ImageField(upload_to='priority_alerts/', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.priority}] {self.title} ({self.status})"


class AlertHistory(models.Model):
    alert = models.ForeignKey(PriorityAlert, on_delete=models.CASCADE, related_name='history')
    previous_status = models.CharField(max_length=20, blank=True, null=True)
    new_status = models.CharField(max_length=20)
    previous_priority = models.CharField(max_length=20, blank=True, null=True)
    new_priority = models.CharField(max_length=20)
    action_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.alert.title} changed to {self.new_status} by {self.action_by}"


class CommunityFeedback(models.Model):
    CATEGORY_CHOICES = (
        ('GUARD_SERVICE', 'Guard Service'),
        ('PARCEL_HANDLING', 'Parcel Handling'),
        ('DELIVERY_EXPERIENCE', 'Delivery Experience'),
        ('GATEHOUSE_MANAGEMENT', 'Gatehouse Management'),
        ('FOOD_DELIVERY', 'Food Delivery'),
        ('OVERALL_EXPERIENCE', 'Overall Experience'),
    )

    resident = models.ForeignKey(User, on_delete=models.CASCADE, related_name='community_feedbacks')
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name='feedbacks')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='OVERALL_EXPERIENCE')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    review = models.TextField(blank=True, default='')
    photo = models.ImageField(upload_to='feedback/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_feedbacks')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    admin_response = models.TextField(blank=True, default='')
    responded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='responded_feedbacks')
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['resident', 'parcel'], name='unique_resident_parcel_feedback')
        ]

    def __str__(self):
        return f"{self.resident.username} - {self.parcel.parcel_id} ({self.rating}★)"

    @property
    def can_edit(self):
        return timezone.now() - self.created_at <= timezone.timedelta(hours=24)


class DatabaseBackup(models.Model):
    BACKUP_TYPE_CHOICES = (
        ('MANUAL', 'Manual Backup'),
        ('AUTOMATIC', 'Scheduled Automatic Backup'),
    )

    STATUS_CHOICES = (
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    )

    backup_name = models.CharField(max_length=200)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS')
    backup_type = models.CharField(max_length=20, choices=BACKUP_TYPE_CHOICES, default='MANUAL')
    checksum = models.CharField(max_length=64, blank=True, default='')
    failure_reason = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_backups')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.backup_name} ({self.status}) - {self.created_at.strftime('%Y-%m-%d %H:%M')}"

    @property
    def file_name(self):
        return self.backup_name

    @property
    def checksum_sha256(self):
        return self.checksum










