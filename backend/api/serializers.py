from rest_framework import serializers
from .models import (
    User, Tower, Flat, ResidentProfile, GuardProfile, Carrier, StorageShelf, Parcel, PickupVerification, Notification, ExpectedDelivery
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
        fields = ['id', 'name', 'capacity', 'occupied', 'is_full', 'available']

class ParcelSerializer(serializers.ModelSerializer):
    flat_details = FlatSerializer(source='flat', read_only=True)
    carrier_name = serializers.SerializerMethodField()
    shelf_name = serializers.SerializerMethodField()
    resident_name = serializers.SerializerMethodField()
    expected_delivery_id = serializers.IntegerField(write_only=True, required=False)
    shelf = serializers.PrimaryKeyRelatedField(queryset=StorageShelf.objects.all(), required=False, allow_null=True)
    courier_payment_confirmed = serializers.BooleanField(write_only=True, required=False)
    payment_confirmed_by_username = serializers.SerializerMethodField()
    
    class Meta:
        model = Parcel
        fields = [
            'id', 'parcel_id', 'delivery_type', 'flat', 'flat_details', 'resident', 'resident_name',
            'carrier', 'carrier_name', 'tracking_number', 'shelf', 'shelf_name',
            'status', 'pickup_pin', 'received_at', 'handed_over_at', 'is_overdue', 'expected_delivery_id',
            'payment_type', 'cod_amount', 'payment_method', 'payment_status', 'payment_confirmed_by', 
            'payment_confirmed_at', 'courier_payment_confirmed', 'payment_confirmed_by_username',
            'is_open_box', 'open_box_resolution'
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

class AdminUserListSerializer(serializers.ModelSerializer):
    flat_details = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'flat_details', 'status']

    def get_flat_details(self, obj):
        if obj.role == 'RESIDENT' and hasattr(obj, 'resident_profile') and obj.resident_profile.flat:
            return {
                "tower": obj.resident_profile.flat.tower.name,
                "number": obj.resident_profile.flat.number
            }
        return None

    def get_status(self, obj):
        return "Active" if obj.is_active else "Inactive"


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
        
        ResidentProfile.objects.create(user=user, flat=flat)
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
    parcel_id = serializers.CharField(source='parcel.parcel_id', read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'title', 'message', 'notification_type', 'is_read', 'created_at', 'parcel', 'parcel_id']

class ExpectedDeliverySerializer(serializers.ModelSerializer):
    resident_name = serializers.SerializerMethodField(read_only=True)
    flat_display = serializers.SerializerMethodField(read_only=True)
    flat_id = serializers.SerializerMethodField(read_only=True)
    tower_id = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ExpectedDelivery
        fields = '__all__'
        read_only_fields = ['resident', 'status', 'created_at', 'updated_at']

    def get_resident_name(self, obj):
        name = obj.resident.get_full_name()
        return name if name else obj.resident.username

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

    def validate_tracking_id(self, value):
        # Validate uniqueness of tracking_id among ACTIVE ('EXPECTED') records
        if ExpectedDelivery.objects.filter(tracking_id=value, status='EXPECTED').exists():
            raise serializers.ValidationError("This tracking ID is already registered.")
        return value

    def validate(self, attrs):
        payment_type = attrs.get('payment_type')
        cod_amount = attrs.get('cod_amount')

        if payment_type == 'COD':
            if not cod_amount or cod_amount <= 0:
                raise serializers.ValidationError({"cod_amount": "COD amount must be greater than 0."})
        elif payment_type == 'PREPAID':
            attrs['cod_amount'] = None

        return attrs

    def create(self, validated_data):
        # request.user is passed via serializer context in viewset
        validated_data['resident'] = self.context['request'].user
        return super().create(validated_data)
