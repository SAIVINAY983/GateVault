from rest_framework import serializers
from .models import User, Tower, Flat, ResidentProfile, GuardProfile, Carrier, StorageShelf, Parcel, PickupVerification

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
    carrier_name = serializers.CharField(source='carrier.name', read_only=True)
    shelf_name = serializers.CharField(source='shelf.name', read_only=True)
    resident_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Parcel
        fields = [
            'id', 'parcel_id', 'flat', 'flat_details', 'resident', 'resident_name',
            'carrier', 'carrier_name', 'tracking_number', 'shelf', 'shelf_name',
            'status', 'pickup_pin', 'received_at', 'handed_over_at', 'is_overdue'
        ]
        read_only_fields = ['parcel_id', 'pickup_pin', 'received_at', 'handed_over_at']

    def get_resident_name(self, obj):
        if obj.resident:
            name = obj.resident.get_full_name()
            return name if name else obj.resident.username
        return "Unknown Resident"
