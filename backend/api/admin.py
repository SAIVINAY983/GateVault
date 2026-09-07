from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Tower, Flat, ResidentProfile, GuardProfile,
    Carrier, StorageShelf, Parcel, PickupVerification
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
    list_display = ('name', 'capacity', 'occupied', 'is_full')

@admin.register(Parcel)
class ParcelAdmin(admin.ModelAdmin):
    list_display = ('parcel_id', 'flat', 'carrier', 'status', 'received_at', 'is_overdue')
    list_filter = ('status', 'carrier')
    search_fields = ('parcel_id', 'tracking_number')

admin.site.register(PickupVerification)
