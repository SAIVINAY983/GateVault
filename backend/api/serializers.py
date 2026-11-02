from rest_framework import serializers
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from .models import (
    User, Tower, Flat, ResidentProfile, GuardProfile, Carrier, StorageShelf, Parcel, PickupVerification, Notification, ExpectedDelivery,
    ParcelInspection, ParcelIncident, IncidentHistory, HouseholdMember, HouseholdAuditLog, ParcelQRPickupPass,
    GuardShift, CommunityDeliveryPolicy, TowerDeliveryPolicy, DeliveryPolicyAuditLog,
    GuestPickupAuthorization, ShelfReservation, ShelfAssignmentHistory,
    CourierVisit, PriorityAlert, AlertHistory, CommunityFeedback, DatabaseBackup
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role']

class TowerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tower
        fields = '__all__'

class FlatSerializer(serializers.ModelSerializer):
    tower_name = serializers.CharField(source='tower.name', read_only=True)
    
    class Meta:
        model = Flat
        fields = ['id', 'number', 'tower', 'tower_name']

class CarrierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Carrier
        fields = '__all__'

class StorageShelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorageShelf
        fields = [
            'id', 'name', 'capacity', 'occupied', 'effective_occupied',
            'is_full', 'available', 'max_parcel_size', 'status',
            'maintenance_notes', 'utilization_percentage', 'is_near_capacity'
        ]

class ParcelInspectionSerializer(serializers.ModelSerializer):
    guard_name = serializers.SerializerMethodField(read_only=True)
    acknowledged_by_name = serializers.SerializerMethodField(read_only=True)
    parcel_id = serializers.CharField(source='parcel.parcel_id', read_only=True)

    class Meta:
        model = ParcelInspection
        fields = [
            'id', 'parcel', 'parcel_id', 'guard', 'guard_name', 'condition',
            'remarks', 'photo', 'courier_confirmed', 'timestamp',
            'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at'
        ]
        read_only_fields = ['id', 'guard', 'timestamp', 'acknowledged_by', 'acknowledged_at']

    def get_guard_name(self, obj):
        if obj.guard:
            name = obj.guard.get_full_name()
            return name if name else obj.guard.username
        return "Unknown Guard"

    def get_acknowledged_by_name(self, obj):
        if obj.acknowledged_by:
            name = obj.acknowledged_by.get_full_name()
            return name if name else obj.acknowledged_by.username
        return None

    def validate_photo(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Photo file size cannot exceed 5MB.")
            ext = value.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png']:
                raise serializers.ValidationError("Only JPG, JPEG, and PNG images are allowed.")
        return value

class ParcelSerializer(serializers.ModelSerializer):
    flat_details = FlatSerializer(source='flat', read_only=True)
    carrier_name = serializers.SerializerMethodField()
    shelf_name = serializers.SerializerMethodField()
    resident_name = serializers.SerializerMethodField()
    expected_delivery_id = serializers.IntegerField(write_only=True, required=False)
    shelf = serializers.PrimaryKeyRelatedField(queryset=StorageShelf.objects.all(), required=False, allow_null=True)
    courier_payment_confirmed = serializers.BooleanField(write_only=True, required=False)
    payment_confirmed_by_username = serializers.SerializerMethodField()
    delegated_to_name = serializers.SerializerMethodField()
    is_delegated_to_me = serializers.SerializerMethodField()
    condition = serializers.SerializerMethodField()
    inspection = serializers.SerializerMethodField()
    has_incident = serializers.SerializerMethodField()
    incident_status = serializers.SerializerMethodField()
    actual_receiver_display = serializers.SerializerMethodField()
    collected_by_name = serializers.SerializerMethodField()
    has_active_qr_pass = serializers.SerializerMethodField()
    courier_visit_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Parcel
        fields = [
            'id', 'parcel_id', 'delivery_type', 'parcel_size', 'dimensions', 'handling_instructions',
            'flat', 'flat_details', 'resident', 'resident_name',
            'carrier', 'carrier_name', 'courier_visit', 'courier_visit_display', 'tracking_number', 'shelf', 'shelf_name',
            'status', 'pickup_pin', 'received_at', 'handed_over_at', 'is_overdue', 'expected_delivery_id',
            'payment_type', 'cod_amount', 'payment_method', 'payment_status', 'payment_confirmed_by', 
            'payment_confirmed_at', 'courier_payment_confirmed', 'payment_confirmed_by_username',
            'is_open_box', 'open_box_resolution',
            'is_high_value', 'declared_value', 'resident_presence_confirmed', 'extra_verification_notes',
            'delegated_to', 'is_delegated', 'collected_by', 'collected_by_role_type', 'delegated_to_name', 'is_delegated_to_me',
            'condition', 'inspection', 'has_incident', 'incident_status',
            'actual_receiver', 'actual_receiver_name', 'actual_receiver_display', 'receiver_relationship',
            'household_member', 'delivery_location', 'direct_delivery_verification', 'direct_delivery_photo', 'collected_by_name',
            'has_active_qr_pass'
        ]
        read_only_fields = ['parcel_id', 'pickup_pin', 'received_at', 'handed_over_at', 'payment_confirmed_by', 'payment_confirmed_at']

    def get_resident_name(self, obj):
        if obj.resident:
            name = obj.resident.get_full_name()
            return name if name else obj.resident.username
        return "Unknown Resident"
        
    def get_carrier_name(self, obj):
        return obj.carrier.name if obj.carrier else "Unknown Carrier"
        
    def get_shelf_name(self, obj):
        return obj.shelf.name if obj.shelf else None

    def get_payment_confirmed_by_username(self, obj):
        return obj.payment_confirmed_by.username if obj.payment_confirmed_by else None

    def get_delegated_to_name(self, obj):
        if obj.delegated_to:
            name = obj.delegated_to.get_full_name()
            return name if name else obj.delegated_to.username
        return None
        
    def get_is_delegated_to_me(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            return obj.delegated_to_id == request.user.id
        return False

    def get_condition(self, obj):
        try:
            if obj.inspection:
                return obj.inspection.condition
        except (ObjectDoesNotExist, AttributeError, Exception):
            pass
        return 'INTACT'

    def get_inspection(self, obj):
        try:
            if obj.inspection:
                return ParcelInspectionSerializer(obj.inspection, context=self.context).data
        except (ObjectDoesNotExist, AttributeError, Exception):
            pass
        return None

    def get_has_incident(self, obj):
        return obj.incidents.exists()

    def get_incident_status(self, obj):
        first_incident = obj.incidents.first()
        return first_incident.status if first_incident else None

    def get_actual_receiver_display(self, obj):
        if obj.actual_receiver_name:
            rel = f" ({obj.receiver_relationship})" if obj.receiver_relationship and obj.receiver_relationship != 'SELF' else ""
            return f"{obj.actual_receiver_name}{rel}"
        if obj.actual_receiver:
            name = obj.actual_receiver.get_full_name() or obj.actual_receiver.username
            rel = f" ({obj.receiver_relationship})" if obj.receiver_relationship and obj.receiver_relationship != 'SELF' else ""
            return f"{name}{rel}"
        if obj.resident:
            return obj.resident.get_full_name() or obj.resident.username
        return "Primary Resident"

    def get_collected_by_name(self, obj):
        if obj.collected_by:
            name = obj.collected_by.get_full_name() or obj.collected_by.username
            if obj.collected_by_role_type == 'HOUSEHOLD_MEMBER':
                return f"{obj.actual_receiver_name or name} ({obj.receiver_relationship or 'Household Member'})"
            elif obj.collected_by_role_type == 'DELEGATED_FLATMATE':
                return f"{name} (Delegated Flatmate)"
            return f"{name} (Primary Resident)"
        return None

    def get_has_active_qr_pass(self, obj):
        from django.utils import timezone
        return obj.qr_passes.filter(status='ACTIVE', expires_at__gt=timezone.now()).exists()

    def get_courier_visit_display(self, obj):
        if obj.courier_visit:
            carrier_str = obj.courier_visit.carrier_name or (obj.courier_visit.carrier.name if obj.courier_visit.carrier else 'Courier')
            return f"{obj.courier_visit.courier_name} ({carrier_str})"
        return None

class ParcelQRPickupPassSerializer(serializers.ModelSerializer):
    parcel_id = serializers.CharField(source='parcel.parcel_id', read_only=True)
    authorized_collector_name = serializers.SerializerMethodField(read_only=True)
    collector_role_display = serializers.CharField(source='get_collector_role_type_display', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = ParcelQRPickupPass
        fields = [
            'id', 'parcel', 'parcel_id', 'authorized_collector', 'authorized_collector_name',
            'collector_role_type', 'collector_role_display', 'expires_at', 'status',
            'created_at', 'used_at', 'revoked_at', 'is_expired', 'is_valid'
        ]
        read_only_fields = fields

    def get_authorized_collector_name(self, obj):
        if obj.authorized_collector:
            name = obj.authorized_collector.get_full_name()
            return name if name else obj.authorized_collector.username
        return "Unknown Collector"

class FlatmateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']

class AdminUserListSerializer(serializers.ModelSerializer):
    flat_details = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    approval_status = serializers.SerializerMethodField()
    google_linked = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'flat_details', 'status', 'approval_status', 'google_linked']

    def get_flat_details(self, obj):
        if obj.role == 'RESIDENT':
            try:
                if obj.resident_profile and obj.resident_profile.flat:
                    return {
                        "tower": obj.resident_profile.flat.tower.name,
                        "number": obj.resident_profile.flat.number
                    }
            except (ObjectDoesNotExist, AttributeError, Exception):
                pass
        return None

    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"

    def get_approval_status(self, obj):
        if obj.role == 'RESIDENT':
            try:
                return obj.resident_profile.approval_status
            except Exception:
                return 'APPROVED'
        return 'APPROVED'

    def get_google_linked(self, obj):
        if obj.role == 'RESIDENT':
            try:
                return bool(obj.resident_profile.google_id)
            except Exception:
                return False
        return False


class ResidentApprovalSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    full_name = serializers.SerializerMethodField()
    tower_name = serializers.CharField(source='flat.tower.name', read_only=True)
    flat_number = serializers.CharField(source='flat.number', read_only=True)
    date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
    google_linked = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ResidentProfile
        fields = [
            'id', 'user_id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'phone_number', 'flat_id', 'tower_name', 'flat_number', 'approval_status',
            'google_linked', 'rejection_reason', 'date_joined', 'approved_by_name', 'approved_at'
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_google_linked(self, obj):
        return bool(obj.google_id)

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None


class CreateResidentSerializer(serializers.ModelSerializer):
    flat_id = serializers.IntegerField(write_only=True)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'flat_id']

    def create(self, validated_data):
        flat_id = validated_data.pop('flat_id')
        try:
            flat = Flat.objects.get(id=flat_id)
        except Flat.DoesNotExist:
            raise serializers.ValidationError({"flat_id": "Invalid flat ID."})
            
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role='RESIDENT'
        )
        
        # Check context if created by admin directly
        request = self.context.get('request')
        is_admin_creation = bool(request and request.user and request.user.is_authenticated and request.user.role == 'ADMIN')
        
        approval_status = 'APPROVED' if is_admin_creation else 'PENDING_APPROVAL'
        approved_by = request.user if is_admin_creation else None
        approved_at = timezone.now() if is_admin_creation else None

        profile = ResidentProfile.objects.create(
            user=user,
            flat=flat,
            approval_status=approval_status,
            approved_by=approved_by,
            approved_at=approved_at
        )

        if not is_admin_creation:
            # Notify Community Admins of new pending registration
            admin_users = User.objects.filter(role='ADMIN')
            admin_notifs = [
                Notification(
                    user=admin,
                    title="New Resident Registration Pending Approval",
                    message=f"New resident {user.get_full_name() or user.username} ({user.email or 'No email'}) registered for Tower {flat.tower.name if flat.tower else ''}, Flat {flat.number}. Approval required.",
                    notification_type='REGISTRATION_PENDING'
                )
                for admin in admin_users
            ]
            if admin_notifs:
                Notification.objects.bulk_create(admin_notifs)

        return user


class CreateGuardSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role='GUARD'
        )
        
        GuardProfile.objects.create(user=user)
        return user

class NotificationSerializer(serializers.ModelSerializer):
    parcel_id = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'is_read', 'created_at', 'parcel', 'parcel_id']

    def get_parcel_id(self, obj):
        return obj.parcel.parcel_id if obj.parcel else None

class ExpectedDeliverySerializer(serializers.ModelSerializer):
    resident_name = serializers.SerializerMethodField(read_only=True)
    flat_display = serializers.SerializerMethodField(read_only=True)
    flat_id = serializers.SerializerMethodField(read_only=True)
    tower_id = serializers.SerializerMethodField(read_only=True)
    tower_name = serializers.SerializerMethodField(read_only=True)
    flat_number = serializers.SerializerMethodField(read_only=True)
    expected_date = serializers.DateField(source='expected_delivery_date', required=False)
    scheduling_status = serializers.CharField(source='status', read_only=True)
    delivery_category = serializers.CharField(read_only=True)
    is_missed_or_delayed = serializers.BooleanField(read_only=True)

    class Meta:
        model = ExpectedDelivery
        fields = '__all__'
        read_only_fields = ['resident', 'status', 'created_at', 'updated_at', 'actual_received_at', 'rescheduled_at']

    def get_resident_name(self, obj):
        if obj.resident:
            name = obj.resident.get_full_name()
            return name if name else obj.resident.username
        return "Unknown Resident"

    def get_flat_display(self, obj):
        try:
            flat = obj.resident.resident_profile.flat
            if flat:
                return f"{flat.tower.name}-{flat.number}"
        except Exception:
            pass
        return "Unknown"
        
    def get_flat_id(self, obj):
        try:
            flat = obj.resident.resident_profile.flat
            if flat:
                return flat.id
        except Exception:
            pass
        return None
        
    def get_tower_id(self, obj):
        try:
            flat = obj.resident.resident_profile.flat
            if flat:
                return flat.tower.id
        except Exception:
            pass
        return None

    def get_tower_name(self, obj):
        try:
            flat = obj.resident.resident_profile.flat
            if flat:
                return flat.tower.name
        except Exception:
            pass
        return ""

    def get_flat_number(self, obj):
        try:
            flat = obj.resident.resident_profile.flat
            if flat:
                return flat.number
        except Exception:
            pass
        return ""

    def validate_expected_delivery_date(self, value):
        if value and value < timezone.localdate():
            raise serializers.ValidationError("Expected delivery date cannot be in the past.")
        return value

    def validate_tracking_id(self, value):
        active_statuses = ['EXPECTED', 'SCHEDULED', 'RESCHEDULED']
        qs = ExpectedDelivery.objects.filter(tracking_id=value, status__in=active_statuses)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This tracking ID is already registered for an active delivery.")
        return value

    def validate(self, attrs):
        # Support expected_date as alias if passed
        if 'expected_date' in self.initial_data and 'expected_delivery_date' not in attrs:
            attrs['expected_delivery_date'] = self.initial_data.get('expected_date')

        start_time = attrs.get('expected_start_time', getattr(self.instance, 'expected_start_time', None))
        end_time = attrs.get('expected_end_time', getattr(self.instance, 'expected_end_time', None))

        if start_time and end_time:
            if start_time >= end_time:
                raise serializers.ValidationError({"expected_end_time": "Estimated start time must be earlier than end time."})

        payment_type = attrs.get('payment_type', getattr(self.instance, 'payment_type', None))
        cod_amount = attrs.get('cod_amount', getattr(self.instance, 'cod_amount', None))

        if payment_type == 'COD':
            if not cod_amount or float(cod_amount) <= 0:
                raise serializers.ValidationError({"cod_amount": "COD amount must be greater than 0 for COD deliveries."})
        elif payment_type == 'PREPAID':
            attrs['cod_amount'] = None

        return attrs

    def create(self, validated_data):
        if 'request' in self.context and self.context['request'].user:
            validated_data['resident'] = self.context['request'].user
        return super().create(validated_data)


class IncidentHistorySerializer(serializers.ModelSerializer):
    action_by_name = serializers.SerializerMethodField(read_only=True)
    action_by_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = IncidentHistory
        fields = ['id', 'old_status', 'new_status', 'notes', 'timestamp', 'action_by', 'action_by_name', 'action_by_role']

    def get_action_by_name(self, obj):
        if obj.action_by:
            name = obj.action_by.get_full_name()
            return name if name else obj.action_by.username
        return "System"

    def get_action_by_role(self, obj):
        return obj.action_by.role if obj.action_by else None


class ParcelIncidentSerializer(serializers.ModelSerializer):
    parcel_id = serializers.CharField(source='parcel.parcel_id', read_only=True)
    resident_name = serializers.SerializerMethodField(read_only=True)
    resident_flat = serializers.SerializerMethodField(read_only=True)
    resolved_by_name = serializers.SerializerMethodField(read_only=True)
    inspection_details = serializers.SerializerMethodField(read_only=True)
    history = IncidentHistorySerializer(many=True, read_only=True)
    carrier_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ParcelIncident
        fields = [
            'id', 'parcel', 'parcel_id', 'carrier_name', 'resident', 'resident_name', 'resident_flat',
            'category', 'description', 'evidence_photo', 'status', 'resolution_notes',
            'resolved_by', 'resolved_by_name', 'resolved_at', 'created_at', 'updated_at',
            'inspection_details', 'history'
        ]
        read_only_fields = ['id', 'parcel', 'resident', 'status', 'resolved_by', 'resolved_at', 'created_at', 'updated_at']

    def get_resident_name(self, obj):
        if obj.resident:
            name = obj.resident.get_full_name()
            return name if name else obj.resident.username
        return "Unknown"

    def get_resident_flat(self, obj):
        try:
            flat = obj.parcel.flat
            if flat:
                return f"{flat.tower.name}-{flat.number}"
        except Exception:
            pass
        return "Unknown"

    def get_carrier_name(self, obj):
        return obj.parcel.carrier.name if obj.parcel and obj.parcel.carrier else "Unknown Carrier"

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            name = obj.resolved_by.get_full_name()
            return name if name else obj.resolved_by.username
        return None

    def get_inspection_details(self, obj):
        try:
            if obj.parcel and obj.parcel.inspection:
                return ParcelInspectionSerializer(obj.parcel.inspection, context=self.context).data
        except (ObjectDoesNotExist, AttributeError, Exception):
            pass
        return None

    def validate_evidence_photo(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Evidence photo file size cannot exceed 5MB.")
            ext = value.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png']:
                raise serializers.ValidationError("Only JPG, JPEG, and PNG images are allowed.")
        return value


class HouseholdAuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField(read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = HouseholdAuditLog
        fields = ['id', 'action', 'action_display', 'details', 'timestamp', 'performed_by', 'performed_by_name']

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            name = obj.performed_by.get_full_name()
            return name if name else obj.performed_by.username
        return "System"


class HouseholdMemberSerializer(serializers.ModelSerializer):
    flat_number = serializers.CharField(source='flat.number', read_only=True)
    tower_name = serializers.CharField(source='flat.tower.name', read_only=True)
    primary_resident_name = serializers.SerializerMethodField(read_only=True)
    user_username = serializers.SerializerMethodField(read_only=True)
    relationship_display = serializers.CharField(source='get_relationship_display', read_only=True)
    audit_logs = HouseholdAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = HouseholdMember
        fields = [
            'id', 'flat', 'flat_number', 'tower_name', 'primary_resident', 'primary_resident_name',
            'user', 'user_username', 'full_name', 'relationship', 'relationship_display',
            'mobile_number', 'email', 'is_active',
            'can_receive_parcels', 'can_receive_food', 'can_collect_gatehouse_parcels',
            'can_view_delivery_notifications', 'created_at', 'updated_at', 'audit_logs'
        ]
        read_only_fields = ['id', 'flat', 'primary_resident', 'created_at', 'updated_at']

    def get_user_username(self, obj):
        return obj.user.username if obj.user else None

    def get_primary_resident_name(self, obj):
        if obj.primary_resident:
            name = obj.primary_resident.get_full_name()
            return name if name else obj.primary_resident.username
        return "Primary Resident"


class AuthorizedReceiverSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    relationship = serializers.CharField()
    relationship_display = serializers.CharField()
    is_primary = serializers.BooleanField()
    mobile_number = serializers.CharField(allow_blank=True, required=False)
    can_receive_parcels = serializers.BooleanField(default=True)
    can_receive_food = serializers.BooleanField(default=True)
    can_collect_gatehouse_parcels = serializers.BooleanField(default=True)


class GuardShiftSerializer(serializers.ModelSerializer):
    guard_name = serializers.SerializerMethodField(read_only=True)
    guard_username = serializers.CharField(source='guard.username', read_only=True)
    accepted_by_name = serializers.SerializerMethodField(read_only=True)
    admin_override_by_name = serializers.SerializerMethodField(read_only=True)
    duration_minutes = serializers.ReadOnlyField()
    duration_display = serializers.ReadOnlyField()

    class Meta:
        model = GuardShift
        fields = [
            'id', 'guard', 'guard_name', 'guard_username',
            'shift_start', 'shift_end', 'duration_minutes', 'duration_display',
            'status', 'handover_notes', 'summary_data',
            'accepted_by', 'accepted_by_name', 'accepted_at',
            'is_admin_override', 'admin_override_reason',
            'admin_override_by', 'admin_override_by_name',
            'created_at'
        ]
        read_only_fields = ['id', 'guard', 'shift_start', 'created_at']

    def get_guard_name(self, obj):
        if obj.guard:
            name = obj.guard.get_full_name()
            return name if name else obj.guard.username
        return "Unknown"

    def get_accepted_by_name(self, obj):
        if obj.accepted_by:
            name = obj.accepted_by.get_full_name()
            return name if name else obj.accepted_by.username
        return None

    def get_admin_override_by_name(self, obj):
        if obj.admin_override_by:
            name = obj.admin_override_by.get_full_name()
            return name if name else obj.admin_override_by.username
        return None


class CommunityDeliveryPolicySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name = serializers.SerializerMethodField(read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)
    delivery_mode_display = serializers.CharField(source='get_delivery_mode_display', read_only=True)

    class Meta:
        model = CommunityDeliveryPolicy
        fields = [
            'id', 'delivery_type', 'delivery_type_display', 'delivery_mode', 'delivery_mode_display',
            'allow_direct_to_flat', 'require_gatehouse_intake', 'allow_household_receiver',
            'require_resident_presence', 'require_extra_verification', 'bypass_storage_shelf',
            'enable_cod_coordination', 'description', 'is_active',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = obj.created_by.get_full_name()
            return name if name else obj.created_by.username
        return "System"

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            name = obj.updated_by.get_full_name()
            return name if name else obj.updated_by.username
        return None


class TowerDeliveryPolicySerializer(serializers.ModelSerializer):
    tower_name = serializers.CharField(source='tower.name', read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    updated_by_name = serializers.SerializerMethodField(read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)
    delivery_mode_display = serializers.CharField(source='get_delivery_mode_display', read_only=True)

    class Meta:
        model = TowerDeliveryPolicy
        fields = [
            'id', 'tower', 'tower_name', 'delivery_type', 'delivery_type_display',
            'delivery_mode', 'delivery_mode_display', 'allow_direct_to_flat',
            'require_gatehouse_intake', 'allow_household_receiver',
            'require_resident_presence', 'require_extra_verification',
            'bypass_storage_shelf', 'enable_cod_coordination', 'description', 'is_active',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = obj.created_by.get_full_name()
            return name if name else obj.created_by.username
        return "System"

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            name = obj.updated_by.get_full_name()
            return name if name else obj.updated_by.username
        return None


class DeliveryPolicyAuditLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField(read_only=True)
    tower_name = serializers.CharField(source='tower.name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = DeliveryPolicyAuditLog
        fields = [
            'id', 'policy_scope', 'tower', 'tower_name', 'delivery_type',
            'action', 'action_display', 'changes_summary', 'previous_state',
            'new_state', 'timestamp', 'changed_by', 'changed_by_name'
        ]

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            name = obj.changed_by.get_full_name()
            return name if name else obj.changed_by.username
        return "System / Admin"


class GuestPickupAuthorizationSerializer(serializers.ModelSerializer):
    parcel_id_str = serializers.CharField(source='parcel.parcel_id', read_only=True)
    carrier_name = serializers.SerializerMethodField(read_only=True)
    flat_number = serializers.SerializerMethodField(read_only=True)
    tower_name = serializers.SerializerMethodField(read_only=True)
    resident_name = serializers.SerializerMethodField(read_only=True)
    relationship_display = serializers.CharField(source='get_relationship_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    verified_by_guard_name = serializers.SerializerMethodField(read_only=True)
    revoked_by_name = serializers.SerializerMethodField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = GuestPickupAuthorization
        fields = [
            'id', 'parcel', 'parcel_id_str', 'carrier_name', 'flat_number', 'tower_name',
            'resident', 'resident_name', 'guest_name', 'guest_mobile', 'relationship',
            'relationship_display', 'instructions', 'pass_code', 'expires_at',
            'status', 'status_display', 'is_expired', 'created_at', 'used_at',
            'revoked_at', 'revoked_by', 'revoked_by_name', 'verified_at',
            'verified_by_guard', 'verified_by_guard_name', 'actual_collector_name'
        ]
        read_only_fields = [
            'id', 'resident', 'pass_code', 'status', 'created_at', 'used_at',
            'revoked_at', 'revoked_by', 'verified_at', 'verified_by_guard', 'actual_collector_name'
        ]

    def get_flat_number(self, obj):
        try:
            return obj.parcel.flat.number if obj.parcel and obj.parcel.flat else ""
        except Exception:
            return ""

    def get_tower_name(self, obj):
        try:
            return obj.parcel.flat.tower.name if obj.parcel and obj.parcel.flat and obj.parcel.flat.tower else ""
        except Exception:
            return ""

    def get_carrier_name(self, obj):
        return obj.parcel.carrier.name if obj.parcel and obj.parcel.carrier else "Unknown"

    def get_resident_name(self, obj):
        if obj.resident:
            name = obj.resident.get_full_name()
            return name if name else obj.resident.username
        return "Resident"

    def get_verified_by_guard_name(self, obj):
        if obj.verified_by_guard:
            name = obj.verified_by_guard.get_full_name()
            return name if name else obj.verified_by_guard.username
        return None

    def get_revoked_by_name(self, obj):
        if obj.revoked_by:
            name = obj.revoked_by.get_full_name()
            return name if name else obj.revoked_by.username
        return None


class CreateGuestPickupAuthorizationSerializer(serializers.Serializer):
    guest_name = serializers.CharField(max_length=150, required=True)
    guest_mobile = serializers.CharField(max_length=20, required=True)
    relationship = serializers.ChoiceField(
        choices=[('FRIEND', 'Friend'), ('RELATIVE', 'Relative'), ('OTHER', 'Other')],
        default='FRIEND'
    )
    expires_at = serializers.DateTimeField(required=True)
    instructions = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_expires_at(self, value):
        from django.utils import timezone
        if value <= timezone.now():
            raise serializers.ValidationError("Expiry time must be in the future.")
        return value

    def validate_guest_mobile(self, value):
        import re
        clean = re.sub(r'[\s\-+]', '', value)
        if not clean.isdigit() or len(clean) < 7:
            raise serializers.ValidationError("Please provide a valid mobile phone number.")
        return value.strip()


class ShelfReservationSerializer(serializers.ModelSerializer):
    shelf_name = serializers.CharField(source='shelf.name', read_only=True)
    shelf_capacity = serializers.IntegerField(source='shelf.capacity', read_only=True)
    shelf_available = serializers.IntegerField(source='shelf.available', read_only=True)
    shelf_max_parcel_size = serializers.CharField(source='shelf.max_parcel_size', read_only=True)
    guard_name = serializers.SerializerMethodField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = ShelfReservation
        fields = [
            'id', 'shelf', 'shelf_name', 'shelf_capacity', 'shelf_available',
            'shelf_max_parcel_size', 'guard', 'guard_name', 'parcel_size',
            'reservation_token', 'expires_at', 'status', 'committed_parcel',
            'created_at', 'is_expired'
        ]
        read_only_fields = ['id', 'reservation_token', 'status', 'committed_parcel', 'created_at']

    def get_guard_name(self, obj):
        if obj.guard:
            return obj.guard.get_full_name() or obj.guard.username
        return "Guard"


class ShelfAssignmentHistorySerializer(serializers.ModelSerializer):
    parcel_id_str = serializers.CharField(source='parcel.parcel_id', read_only=True)
    previous_shelf_name = serializers.CharField(source='previous_shelf.name', read_only=True)
    new_shelf_name = serializers.CharField(source='new_shelf.name', read_only=True)
    guard_name = serializers.SerializerMethodField(read_only=True)
    action_type_display = serializers.CharField(source='get_action_type_display', read_only=True)

    class Meta:
        model = ShelfAssignmentHistory
        fields = [
            'id', 'parcel', 'parcel_id_str', 'previous_shelf', 'previous_shelf_name',
            'new_shelf', 'new_shelf_name', 'guard', 'guard_name',
            'action_type', 'action_type_display', 'reason', 'timestamp'
        ]

    def get_guard_name(self, obj):
        if obj.guard:
            return obj.guard.get_full_name() or obj.guard.username
        return "Guard / System"


class RelocateParcelSerializer(serializers.Serializer):
    new_shelf_id = serializers.IntegerField(required=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="Guard shelf relocation")


class ShelfStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('MAINTENANCE', 'Under Maintenance')], required=True)
    maintenance_notes = serializers.CharField(required=False, allow_blank=True, default="")


class CourierVisitSerializer(serializers.ModelSerializer):
    carrier_display = serializers.SerializerMethodField(read_only=True)
    entry_guard_name = serializers.SerializerMethodField(read_only=True)
    exit_guard_name = serializers.SerializerMethodField(read_only=True)
    visit_purpose_display = serializers.CharField(source='get_visit_purpose_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    duration_display = serializers.CharField(read_only=True)
    is_unusually_long = serializers.BooleanField(read_only=True)
    linked_parcels = serializers.SerializerMethodField(read_only=True)
    linked_parcels_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CourierVisit
        fields = [
            'id', 'courier_name', 'carrier', 'carrier_name', 'carrier_display',
            'mobile_number', 'vehicle_number', 'visit_purpose', 'visit_purpose_display',
            'entry_time', 'exit_time', 'entry_guard', 'entry_guard_name',
            'exit_guard', 'exit_guard_name', 'status', 'status_display',
            'remarks', 'created_at', 'duration_minutes', 'duration_display',
            'is_unusually_long', 'linked_parcels', 'linked_parcels_count'
        ]
        read_only_fields = ['id', 'entry_time', 'exit_time', 'entry_guard', 'exit_guard', 'status', 'created_at']

    def get_carrier_display(self, obj):
        if obj.carrier:
            return obj.carrier.name
        return obj.carrier_name or "Independent / Other"

    def get_entry_guard_name(self, obj):
        if obj.entry_guard:
            return obj.entry_guard.get_full_name() or obj.entry_guard.username
        return "Unknown Guard"

    def get_exit_guard_name(self, obj):
        if obj.exit_guard:
            return obj.exit_guard.get_full_name() or obj.exit_guard.username
        return None

    def get_linked_parcels(self, obj):
        return [{
            'id': p.id,
            'parcel_id': p.parcel_id,
            'tracking_number': p.tracking_number,
            'flat': f"{p.flat.tower.name}-{p.flat.number}" if p.flat and p.flat.tower else (p.flat.number if p.flat else ''),
            'status': p.status,
            'status_display': p.get_status_display(),
            'shelf': p.shelf.name if p.shelf else None,
            'received_at': p.received_at
        } for p in obj.parcels.all().select_related('flat', 'flat__tower', 'shelf')]


class CourierVisitEntrySerializer(serializers.Serializer):
    courier_name = serializers.CharField(max_length=150, required=True)
    carrier_id = serializers.IntegerField(required=False, allow_null=True)
    carrier_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    mobile_number = serializers.CharField(max_length=20, required=True)
    vehicle_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    visit_purpose = serializers.ChoiceField(
        choices=CourierVisit.PURPOSE_CHOICES,
        default='PARCEL_DELIVERY'
    )
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    confirm_duplicate = serializers.BooleanField(required=False, default=False)

    def validate_mobile_number(self, value):
        import re
        clean = re.sub(r'[\s\-+]', '', value)
        if not clean.isdigit() or len(clean) < 7:
            raise serializers.ValidationError("Please provide a valid courier mobile phone number.")
        return value.strip()


class AlertHistorySerializer(serializers.ModelSerializer):
    action_by_name = serializers.SerializerMethodField(read_only=True)
    action_by_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AlertHistory
        fields = ['id', 'previous_status', 'new_status', 'previous_priority', 'new_priority', 'notes', 'timestamp', 'action_by', 'action_by_name', 'action_by_role']

    def get_action_by_name(self, obj):
        if obj.action_by:
            return obj.action_by.get_full_name() or obj.action_by.username
        return "System"

    def get_action_by_role(self, obj):
        if obj.action_by:
            return obj.action_by.role
        return "SYSTEM"


class PriorityAlertSerializer(serializers.ModelSerializer):
    history = AlertHistorySerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    assigned_to_name = serializers.SerializerMethodField(read_only=True)
    acknowledged_by_name = serializers.SerializerMethodField(read_only=True)
    resolved_by_name = serializers.SerializerMethodField(read_only=True)
    parcel_id_display = serializers.SerializerMethodField(read_only=True)
    incident_id_display = serializers.SerializerMethodField(read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PriorityAlert
        fields = [
            'id', 'title', 'description', 'category', 'category_display',
            'priority', 'priority_display', 'status', 'status_display',
            'related_parcel', 'parcel_id_display',
            'related_incident', 'incident_id_display',
            'created_by', 'created_by_name',
            'assigned_to', 'assigned_to_name',
            'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at',
            'resolved_by', 'resolved_by_name', 'resolved_at', 'resolution_notes',
            'photo', 'created_at', 'updated_at',
            'history'
        ]
        read_only_fields = [
            'status', 'created_by', 'acknowledged_by', 'acknowledged_at',
            'resolved_by', 'resolved_at', 'created_at', 'updated_at'
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "System Automatic"

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_acknowledged_by_name(self, obj):
        if obj.acknowledged_by:
            return obj.acknowledged_by.get_full_name() or obj.acknowledged_by.username
        return None

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.get_full_name() or obj.resolved_by.username
        return None

    def get_parcel_id_display(self, obj):
        if obj.related_parcel:
            return obj.related_parcel.parcel_id
        return None

    def get_incident_id_display(self, obj):
        if obj.related_incident:
            return f"INC-{obj.related_incident.id}"
        return None


class PriorityAlertCreateSerializer(serializers.ModelSerializer):
    parcel_identifier = serializers.CharField(required=False, write_only=True, allow_blank=True, default='')

    class Meta:
        model = PriorityAlert
        fields = ['title', 'description', 'category', 'priority', 'related_parcel', 'related_incident', 'photo', 'parcel_identifier']

    def validate_photo(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Photo size cannot exceed 5MB.")
            ext = value.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png']:
                raise serializers.ValidationError("Only JPG, JPEG, and PNG images are allowed.")
        return value

    def validate(self, attrs):
        ident = attrs.pop('parcel_identifier', '').strip()
        if ident and not attrs.get('related_parcel'):
            from .models import Parcel
            parcel = Parcel.objects.filter(parcel_id=ident).first()
            if not parcel and ident.isdigit():
                parcel = Parcel.objects.filter(id=int(ident)).first()
            if parcel:
                attrs['related_parcel'] = parcel
        return attrs


class CommunityFeedbackSerializer(serializers.ModelSerializer):
    resident_name = serializers.SerializerMethodField()
    resident_username = serializers.CharField(source='resident.username', read_only=True)
    flat_number = serializers.SerializerMethodField()
    tower_name = serializers.SerializerMethodField()
    parcel_id_display = serializers.CharField(source='parcel.parcel_id', read_only=True)
    tracking_number = serializers.CharField(source='parcel.tracking_number', read_only=True)
    carrier_name = serializers.SerializerMethodField()
    delivery_type = serializers.CharField(source='parcel.delivery_type', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    responded_by_name = serializers.SerializerMethodField()
    can_edit = serializers.BooleanField(read_only=True)
    time_remaining_seconds = serializers.SerializerMethodField()

    class Meta:
        model = CommunityFeedback
        fields = [
            'id', 'resident', 'resident_name', 'resident_username', 'flat_number', 'tower_name',
            'parcel', 'parcel_id_display', 'tracking_number', 'carrier_name', 'delivery_type',
            'category', 'category_display', 'rating', 'review', 'photo',
            'created_at', 'updated_at',
            'is_reviewed', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'admin_response', 'responded_by', 'responded_by_name', 'responded_at',
            'can_edit', 'time_remaining_seconds'
        ]
        read_only_fields = [
            'resident', 'is_reviewed', 'reviewed_by', 'reviewed_at',
            'admin_response', 'responded_by', 'responded_at', 'created_at', 'updated_at'
        ]

    def get_resident_name(self, obj):
        if obj.resident:
            return obj.resident.get_full_name() or obj.resident.username
        return "Resident"

    def get_flat_number(self, obj):
        if obj.parcel and obj.parcel.flat:
            return obj.parcel.flat.number
        return None

    def get_tower_name(self, obj):
        if obj.parcel and obj.parcel.flat and obj.parcel.flat.tower:
            return obj.parcel.flat.tower.name
        return None

    def get_carrier_name(self, obj):
        if obj.parcel and obj.parcel.carrier:
            return obj.parcel.carrier.name
        return "Courier"

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None

    def get_responded_by_name(self, obj):
        if obj.responded_by:
            return obj.responded_by.get_full_name() or obj.responded_by.username
        return None

    def get_time_remaining_seconds(self, obj):
        if not obj.can_edit:
            return 0
        elapsed = (timezone.now() - obj.created_at).total_seconds()
        return max(0, int(86400 - elapsed))


class CommunityFeedbackCreateSerializer(serializers.ModelSerializer):
    parcel_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = CommunityFeedback
        fields = ['parcel_id', 'rating', 'category', 'review', 'photo']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be an integer between 1 and 5.")
        return value

    def validate_photo(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Photo size cannot exceed 5MB.")
            ext = value.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp']:
                raise serializers.ValidationError("Only JPG, JPEG, PNG, and WebP images are allowed.")
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        parcel_id = attrs.get('parcel_id')
        try:
            parcel = Parcel.objects.get(id=parcel_id)
        except Parcel.DoesNotExist:
            raise serializers.ValidationError({"parcel_id": "Specified parcel does not exist."})

        if parcel.resident != request.user:
            raise serializers.ValidationError({"parcel_id": "You can only submit feedback for your own parcels."})

        if parcel.status not in ['HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT', 'COLLECTED']:
            raise serializers.ValidationError({"parcel_id": "Feedback can only be submitted after the parcel has been successfully collected/handed over."})

        if CommunityFeedback.objects.filter(resident=request.user, parcel=parcel).exists():
            raise serializers.ValidationError({"parcel_id": "Feedback has already been submitted for this parcel."})

        attrs['parcel'] = parcel
        return attrs


class CommunityFeedbackUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityFeedback
        fields = ['rating', 'category', 'review', 'photo']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be an integer between 1 and 5.")
        return value

    def validate_photo(self, value):
        if value:
            if value.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Photo size cannot exceed 5MB.")
            ext = value.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp']:
                raise serializers.ValidationError("Only JPG, JPEG, PNG, and WebP images are allowed.")
        return value


class DatabaseBackupSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    file_size_formatted = serializers.SerializerMethodField(read_only=True)
    file_name = serializers.CharField(source='backup_name', read_only=True)
    checksum_sha256 = serializers.CharField(source='checksum', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    backup_type_display = serializers.CharField(source='get_backup_type_display', read_only=True)

    class Meta:
        model = DatabaseBackup
        fields = [
            'id', 'backup_name', 'file_name', 'file_path', 'file_size', 'file_size_formatted',
            'status', 'status_display', 'backup_type', 'backup_type_display',
            'checksum', 'checksum_sha256', 'failure_reason', 'created_by', 'created_by_name',
            'created_at'
        ]
        read_only_fields = [
            'id', 'backup_name', 'file_name', 'file_path', 'file_size', 'file_size_formatted',
            'status', 'status_display', 'backup_type', 'backup_type_display',
            'checksum', 'checksum_sha256', 'failure_reason', 'created_by', 'created_by_name',
            'created_at'
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "System Automated"

    def get_file_size_formatted(self, obj):
        size = obj.file_size or 0
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{round(size / 1024, 1)} KB"
        else:
            return f"{round(size / (1024 * 1024), 2)} MB"








