from rest_framework import viewsets, generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    User, Tower, Flat, Carrier, StorageShelf, Parcel, PickupVerification
)
from .serializers import (
    UserSerializer, TowerSerializer, FlatSerializer,
    CarrierSerializer, StorageShelfSerializer, ParcelSerializer,
    AdminUserListSerializer, CreateResidentSerializer, CreateGuardSerializer
)
from .permissions import IsAdminUser, IsGuardUser, IsResidentUser, IsAdminOrGuard

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'role': self.user.role,
            'name': self.user.get_full_name()
        }
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class PublicResidentRegisterView(generics.CreateAPIView):
    serializer_class = CreateResidentSerializer
    permission_classes = [] # AllowAny
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {"message": "Resident account created successfully.", "username": user.username},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class TowerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tower.objects.all()
    serializer_class = TowerSerializer
    permission_classes = [AllowAny]

class FlatViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Flat.objects.all()
    serializer_class = FlatSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        tower_id = self.request.query_params.get('tower', None)
        if tower_id:
            queryset = queryset.filter(tower_id=tower_id)
        return queryset

class CarrierViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Carrier.objects.all()
    serializer_class = CarrierSerializer
    permission_classes = [IsAuthenticated]

class StorageShelfViewSet(viewsets.ModelViewSet):
    queryset = StorageShelf.objects.all()
    serializer_class = StorageShelfSerializer
    permission_classes = [IsAdminOrGuard]

class ParcelIntakeView(generics.CreateAPIView):
    queryset = Parcel.objects.all()
    serializer_class = ParcelSerializer
    permission_classes = [IsGuardUser]

    def perform_create(self, serializer):
        shelf = serializer.validated_data['shelf']
        if shelf.is_full:
            raise serializers.ValidationError({"shelf": "This storage shelf is full."})
        
        # Determine resident from flat if possible
        flat = serializer.validated_data['flat']
        resident_profile = flat.residents.first()
        resident = resident_profile.user if resident_profile else None
        
        # Save parcel (occupancy is dynamically calculated via property)
        parcel = serializer.save(received_by=self.request.user, resident=resident)

class GuardPendingParcelsView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsGuardUser]
    
    def get_queryset(self):
        return Parcel.objects.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).order_by('-received_at')

class VerifyPickupView(views.APIView):
    permission_classes = [IsGuardUser]

    def post(self, request, parcel_id):
        pin = request.data.get('pickup_pin')
        try:
            parcel = Parcel.objects.get(parcel_id=parcel_id, status__in=['AWAITING_PICKUP', 'OVERDUE'])
            if parcel.pickup_pin == pin:
                return Response({
                    "message": "Valid PIN",
                    "parcel": ParcelSerializer(parcel).data
                })
            else:
                return Response({"error": "Invalid PIN"}, status=status.HTTP_400_BAD_REQUEST)
        except Parcel.DoesNotExist:
            return Response({"error": "Parcel not found or already handed over"}, status=status.HTTP_404_NOT_FOUND)

class ConfirmHandoverView(views.APIView):
    permission_classes = [IsGuardUser]

    def post(self, request, parcel_id):
        try:
            parcel = Parcel.objects.get(parcel_id=parcel_id, status__in=['AWAITING_PICKUP', 'OVERDUE'])
            parcel.status = 'HANDED_OVER'
            parcel.handed_over_at = timezone.now()
            parcel.handed_over_by = request.user
            parcel.save()

            PickupVerification.objects.create(parcel=parcel, guard=request.user)

            return Response({"message": "Parcel handed over successfully"})
        except Parcel.DoesNotExist:
            return Response({"error": "Parcel not found or already handed over"}, status=status.HTTP_400_BAD_REQUEST)

class ResidentParcelsView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsResidentUser]

    def get_queryset(self):
        return Parcel.objects.filter(resident=self.request.user).order_by('-received_at')

class AdminDashboardStatsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.now().date()
        total_parcels = Parcel.objects.count()
        pending = Parcel.objects.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).count()
        handed_over_today = Parcel.objects.filter(
            status='HANDED_OVER', 
            handed_over_at__date=today
        ).count()
        
        # Calculate overdue manually
        overdue_limit = timezone.now() - timedelta(hours=48)
        overdue_parcels = Parcel.objects.filter(
            status__in=['AWAITING_PICKUP', 'OVERDUE'],
            received_at__lt=overdue_limit
        ).count()

        shelves = StorageShelf.objects.all()
        total_capacity = sum(s.capacity for s in shelves)
        total_occupied = sum(s.occupied for s in shelves)
        
        carrier_stats = Parcel.objects.values('carrier__name').annotate(count=Count('id'))

        return Response({
            "total_parcels": total_parcels,
            "pending_parcels": pending,
            "handed_over_today": handed_over_today,
            "overdue_parcels": overdue_parcels,
            "storage": {
                "capacity": total_capacity,
                "occupied": total_occupied
            },
            "carrier_stats": carrier_stats
        })

class OverdueParcelsView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsAdminOrGuard]

    def get_queryset(self):
        overdue_limit = timezone.now() - timedelta(hours=48)
        return Parcel.objects.filter(
            status__in=['AWAITING_PICKUP', 'OVERDUE'],
            received_at__lt=overdue_limit
        ).order_by('received_at')

class AdminParcelHistoryView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsAdminUser]
    queryset = Parcel.objects.all().order_by('-received_at')


class AdminUserManagementViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]

    def list(self, request):
        users = User.objects.exclude(id=request.user.id).order_by('-date_joined')
        serializer = AdminUserListSerializer(users, many=True)
        return Response(serializer.data)

    def create_resident(self, request):
        serializer = CreateResidentSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {"message": "Resident created successfully", "user": AdminUserListSerializer(user).data},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def create_guard(self, request):
        serializer = CreateGuardSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {"message": "Guard created successfully", "user": AdminUserListSerializer(user).data},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def toggle_active(self, request, pk=None):
        try:
            user = User.objects.exclude(id=request.user.id).get(pk=pk)
            user.is_active = not user.is_active
            user.save()
            return Response({"message": f"User {'activated' if user.is_active else 'deactivated'} successfully", "is_active": user.is_active})
        except User.DoesNotExist:
            return Response({"error": "User not found or cannot modify self."}, status=status.HTTP_404_NOT_FOUND)
