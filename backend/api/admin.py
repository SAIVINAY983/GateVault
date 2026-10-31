from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Tower, Flat, ResidentProfile, GuardProfile,
    Carrier, StorageShelf, Parcel, PickupVerification,
    ExpectedDelivery, Notification, ParcelInspection,
    ParcelIncident, IncidentHistory, HouseholdMember, HouseholdAuditLog,
    ParcelQRPickupPass, GuardShift,
    CommunityDeliveryPolicy, TowerDeliveryPolicy, DeliveryPolicyAuditLog,
    GuestPickupAuthorization, ShelfReservation, ShelfAssignmentHistory,
    CourierVisit, PriorityAlert, AlertHistory, CommunityFeedback, DatabaseBackup
)

class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ['username', 'email', 'first_name', 'last_name', 'role', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        ('Role Info', {'fields': ('role',)}),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(Tower)
admin.site.register(Flat)
admin.site.register(ResidentProfile)
admin.site.register(GuardProfile)
admin.site.register(Carrier)

@admin.register(StorageShelf)
class StorageShelfAdmin(admin.ModelAdmin):
    list_display = ('name', 'max_parcel_size', 'status', 'capacity', 'occupied', 'available', 'is_full')
    list_filter = ('status', 'max_parcel_size')
    search_fields = ('name', 'maintenance_notes')

@admin.register(Parcel)
class ParcelAdmin(admin.ModelAdmin):
    list_display = ('parcel_id', 'flat', 'carrier', 'status', 'received_at', 'is_overdue')
    list_filter = ('status', 'carrier')
    search_fields = ('parcel_id', 'tracking_number')

admin.site.register(PickupVerification)

@admin.register(ExpectedDelivery)
class ExpectedDeliveryAdmin(admin.ModelAdmin):
    list_display = ('tracking_id', 'resident', 'courier_name', 'expected_delivery_date', 'time_window_label', 'status', 'delivery_type', 'payment_type')
    list_filter = ('status', 'delivery_type', 'payment_type', 'expected_delivery_date')
    search_fields = ('tracking_id', 'order_id', 'courier_name', 'resident__username')

admin.site.register(Notification)
admin.site.register(ParcelInspection)
admin.site.register(ParcelIncident)
admin.site.register(IncidentHistory)
admin.site.register(HouseholdMember)
admin.site.register(HouseholdAuditLog)

@admin.register(ParcelQRPickupPass)
class ParcelQRPickupPassAdmin(admin.ModelAdmin):
    list_display = ('parcel', 'authorized_collector', 'collector_role_type', 'status', 'expires_at', 'created_at')
    list_filter = ('status', 'collector_role_type')
    search_fields = ('parcel__parcel_id', 'authorized_collector__username', 'token_hash')

@admin.register(GuardShift)
class GuardShiftAdmin(admin.ModelAdmin):
    list_display = ('id', 'guard', 'shift_start', 'shift_end', 'status', 'accepted_by', 'is_admin_override')
    list_filter = ('status', 'is_admin_override')
    search_fields = ('guard__username', 'accepted_by__username', 'handover_notes')

@admin.register(CommunityDeliveryPolicy)
class CommunityDeliveryPolicyAdmin(admin.ModelAdmin):
    list_display = ('delivery_type', 'delivery_mode', 'allow_direct_to_flat', 'require_gatehouse_intake', 'is_active', 'updated_at')
    list_filter = ('delivery_mode', 'is_active')
    search_fields = ('delivery_type', 'description')

@admin.register(TowerDeliveryPolicy)
class TowerDeliveryPolicyAdmin(admin.ModelAdmin):
    list_display = ('tower', 'delivery_type', 'delivery_mode', 'is_active', 'updated_at')
    list_filter = ('tower', 'delivery_mode', 'is_active')
    search_fields = ('tower__name', 'delivery_type')

@admin.register(DeliveryPolicyAuditLog)
class DeliveryPolicyAuditLogAdmin(admin.ModelAdmin):
    list_display = ('delivery_type', 'policy_scope', 'action', 'changed_by', 'timestamp')
    list_filter = ('policy_scope', 'action')
    search_fields = ('delivery_type', 'changes_summary', 'changed_by__username')


@admin.register(GuestPickupAuthorization)
class GuestPickupAuthorizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'parcel', 'guest_name', 'guest_mobile', 'relationship', 'status', 'expires_at', 'created_at')
    list_filter = ('status', 'relationship')
    search_fields = ('parcel__parcel_id', 'guest_name', 'guest_mobile', 'pass_code')


@admin.register(ShelfReservation)
class ShelfReservationAdmin(admin.ModelAdmin):
    list_display = ('reservation_token', 'shelf', 'guard', 'parcel_size', 'status', 'expires_at', 'created_at')
    list_filter = ('status', 'parcel_size')
    search_fields = ('reservation_token', 'shelf__name', 'guard__username')


@admin.register(ShelfAssignmentHistory)
class ShelfAssignmentHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'parcel', 'previous_shelf', 'new_shelf', 'guard', 'action_type', 'timestamp')
    list_filter = ('action_type',)
    search_fields = ('parcel__parcel_id', 'previous_shelf__name', 'new_shelf__name', 'guard__username', 'reason')


@admin.register(CourierVisit)
class CourierVisitAdmin(admin.ModelAdmin):
    list_display = ('id', 'courier_name', 'carrier_name', 'mobile_number', 'vehicle_number', 'visit_purpose', 'status', 'entry_time', 'exit_time', 'duration_display')
    list_filter = ('status', 'visit_purpose')
    search_fields = ('courier_name', 'mobile_number', 'vehicle_number', 'carrier_name')


@admin.register(PriorityAlert)
class PriorityAlertAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'category', 'priority', 'status', 'created_by', 'assigned_to', 'created_at')
    list_filter = ('priority', 'status', 'category')
    search_fields = ('title', 'description', 'related_parcel__parcel_id')


@admin.register(AlertHistory)
class AlertHistoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'alert', 'previous_status', 'new_status', 'new_priority', 'action_by', 'timestamp')
    list_filter = ('new_status', 'new_priority')
    search_fields = ('alert__title', 'notes', 'action_by__username')


@admin.register(CommunityFeedback)
class CommunityFeedbackAdmin(admin.ModelAdmin):
    list_display = ('id', 'resident', 'parcel', 'category', 'rating', 'is_reviewed', 'created_at')
    list_filter = ('rating', 'category', 'is_reviewed', 'created_at')
    search_fields = ('resident__username', 'parcel__parcel_id', 'review', 'admin_response')


@admin.register(DatabaseBackup)
class DatabaseBackupAdmin(admin.ModelAdmin):
    list_display = ('id', 'backup_name', 'backup_type', 'status', 'file_size', 'created_by', 'created_at')
    list_filter = ('status', 'backup_type', 'created_at')
    search_fields = ('backup_name', 'checksum', 'file_path')






