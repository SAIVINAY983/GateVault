from rest_framework import viewsets, generics, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    User, Tower, Flat, Carrier, StorageShelf, Parcel, PickupVerification, Notification, ExpectedDelivery
)
from .serializers import (
    UserSerializer, TowerSerializer, FlatSerializer, CarrierSerializer, StorageShelfSerializer,
    ParcelSerializer, AdminUserListSerializer, CreateResidentSerializer, CreateGuardSerializer,
    NotificationSerializer, ExpectedDeliverySerializer, FlatmateSerializer
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
        status_val = 'AWAITING_PICKUP'
        
        # Allow action parameter to override status and bypass shelf logic
        action_val = self.request.data.get('action')
        if action_val == 'ATTEMPTED':
            status_val = 'DELIVERY_ATTEMPTED'
        elif action_val == 'OPEN_BOX_COMPLETED':
            status_val = 'HANDED_OVER'
        elif action_val == 'OPEN_BOX_RETURNED':
            status_val = 'RESCHEDULED'
        
        shelf = serializer.validated_data.get('shelf')
        
        # Shelf assignment is required unless it's a special resolution
        if not shelf and status_val not in ['DELIVERY_ATTEMPTED', 'HANDED_OVER', 'RESCHEDULED']:
            raise serializers.ValidationError({"shelf": "Shelf assignment is required."})
        
        if status_val != 'DELIVERY_ATTEMPTED':
            if shelf and shelf.is_full:
                raise serializers.ValidationError({"shelf": "This storage shelf is full."})
        
        expected_delivery_id = serializer.validated_data.pop('expected_delivery_id', None)
        expected_delivery = None
        if expected_delivery_id:
            try:
                expected_delivery = ExpectedDelivery.objects.get(id=expected_delivery_id, status='EXPECTED')
            except ExpectedDelivery.DoesNotExist:
                raise serializers.ValidationError({"expected_delivery_id": "This delivery has already been received or does not exist."})
        
        # Determine resident from flat if possible
        flat = serializer.validated_data['flat']
        resident_profile = flat.residents.first()
        resident = resident_profile.user if resident_profile else None
        
        # COD Verification Logic
        payment_status = serializer.validated_data.get('payment_status', 'NOT_APPLICABLE')
        payment_method = serializer.validated_data.get('payment_method', 'NOT_APPLICABLE')
        courier_payment_confirmed = serializer.validated_data.pop('courier_payment_confirmed', False)
        payment_type = serializer.validated_data.get('payment_type', 'PREPAID')
        cod_amount = serializer.validated_data.get('cod_amount', None)
        
        if expected_delivery and expected_delivery.payment_type == 'COD':
            payment_type = 'COD'
            cod_amount = expected_delivery.cod_amount
            
        payment_confirmed_by = None
        payment_confirmed_at = None
        if payment_type == 'COD':
            if status_val == 'DELIVERY_ATTEMPTED':
                payment_status = 'FAILED'
            else:
                if payment_method not in ['CASH', 'UPI']:
                    raise serializers.ValidationError({"payment_method": "Payment method must be CASH or UPI for COD deliveries."})
                if not courier_payment_confirmed:
                    raise serializers.ValidationError({"courier_payment_confirmed": "Courier payment must be confirmed."})
                
                payment_status = 'PAID'
                payment_confirmed_by = self.request.user
                payment_confirmed_at = timezone.now()
                
        # Open Box Logic
        is_open_box = False
        open_box_resolution = 'NOT_APPLICABLE'
        handed_over_at = None
        handed_over_by = None
        
        if expected_delivery and expected_delivery.is_open_box:
            is_open_box = True
            if status_val == 'HANDED_OVER':
                open_box_resolution = 'DIRECT_RESIDENT_HANDOVER'
                handed_over_at = timezone.now()
                handed_over_by = self.request.user
            elif status_val == 'RESCHEDULED':
                open_box_resolution = 'RESCHEDULED'
        
        # Save parcel
        parcel = serializer.save(
            received_by=self.request.user, 
            resident=resident, 
            expected_delivery=expected_delivery,
            payment_type=payment_type,
            cod_amount=cod_amount,
            payment_method=payment_method,
            payment_status=payment_status,
            payment_confirmed_by=payment_confirmed_by,
            payment_confirmed_at=payment_confirmed_at,
            is_open_box=is_open_box,
            open_box_resolution=open_box_resolution,
            handed_over_at=handed_over_at,
            handed_over_by=handed_over_by,
            status=status_val
        )
        
        if expected_delivery and status_val != 'DELIVERY_ATTEMPTED':
            expected_delivery.status = 'RECEIVED'
            expected_delivery.save()
        
        # Create notification for resident if not attempted
        if resident and status_val != 'DELIVERY_ATTEMPTED':
            is_food = parcel.delivery_type == 'FOOD'
            title = "Food Delivery Received" if is_food else "New Parcel Received"
            carrier_name = parcel.carrier.name if parcel.carrier else "parcel"
            
            message = f"Your {carrier_name} delivery has arrived at the gate." if is_food else f"Your {carrier_name} parcel has arrived at the gatehouse."
            
            if parcel.payment_type == 'COD':
                message = f"Your COD parcel from {carrier_name} (₹{parcel.cod_amount}) was received and safely stored"
                if parcel.shelf:
                    message += f" on {parcel.shelf.name}."
                else:
                    message += "."
                message += f" Pickup PIN: {parcel.pickup_pin}."
            
            Notification.objects.create(
                user=resident,
                title=title,
                message=message,
                notification_type='FOOD_DELIVERY' if is_food else 'NEW_PARCEL',
                parcel=parcel
            )

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
        collected_by_role_type = request.data.get('collected_by_role_type', 'PRIMARY_RESIDENT')
        try:
            parcel = Parcel.objects.get(parcel_id=parcel_id, status__in=['AWAITING_PICKUP', 'OVERDUE'])
            parcel.status = 'HANDED_OVER'
            parcel.handed_over_at = timezone.now()
            parcel.handed_over_by = request.user
            
            if parcel.is_delegated and collected_by_role_type == 'DELEGATED_FLATMATE':
                parcel.collected_by = parcel.delegated_to
                parcel.collected_by_role_type = 'DELEGATED_FLATMATE'
            else:
                parcel.collected_by = parcel.resident
                parcel.collected_by_role_type = 'PRIMARY_RESIDENT'
                
            parcel.save()

            PickupVerification.objects.create(parcel=parcel, guard=request.user)

            if parcel.resident:
                carrier_name = parcel.carrier.name if parcel.carrier else "parcel"
                Notification.objects.create(
                    user=parcel.resident,
                    title="Parcel Collected",
                    message=f"Your {carrier_name} parcel was successfully handed over.",
                    notification_type='HANDOVER',
                    parcel=parcel
                )

            return Response({"message": "Parcel handed over successfully"})
        except Parcel.DoesNotExist:
            return Response({"error": "Parcel not found or already handed over"}, status=status.HTTP_400_BAD_REQUEST)

class ResidentParcelsView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsResidentUser]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        return Parcel.objects.filter(
            Q(resident=user) | 
            Q(delegated_to=user, status__in=['AWAITING_PICKUP', 'OVERDUE'])
        ).order_by('-received_at')

class FlatmatesListView(generics.ListAPIView):
    serializer_class = FlatmateSerializer
    permission_classes = [IsResidentUser]

    def get_queryset(self):
        user = self.request.user
        try:
            flat = user.resident_profile.flat
            if not flat:
                return User.objects.none()
            return User.objects.filter(role='RESIDENT', is_active=True, resident_profile__flat=flat).exclude(id=user.id)
        except Exception:
            return User.objects.none()

class DelegatePickupView(views.APIView):
    permission_classes = [IsResidentUser]

    def post(self, request, parcel_id):
        flatmate_id = request.data.get('flatmate_id')
        if not flatmate_id:
            return Response({"error": "flatmate_id is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            parcel = Parcel.objects.get(parcel_id=parcel_id, resident=request.user, status__in=['AWAITING_PICKUP', 'OVERDUE'])
        except Parcel.DoesNotExist:
            return Response({"error": "Parcel not found or not eligible for delegation"}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            flat = request.user.resident_profile.flat
            flatmate = User.objects.get(id=flatmate_id, role='RESIDENT', is_active=True, resident_profile__flat=flat)
        except User.DoesNotExist:
            return Response({"error": "Invalid flatmate selected"}, status=status.HTTP_400_BAD_REQUEST)
            
        if flatmate.id == request.user.id:
            return Response({"error": "Cannot delegate to yourself"}, status=status.HTTP_400_BAD_REQUEST)
            
        parcel.is_delegated = True
        parcel.delegated_to = flatmate
        parcel.save()
        
        carrier_name = parcel.carrier.name if parcel.carrier else "parcel"
        Notification.objects.create(
            user=flatmate,
            title="Pickup Authorized",
            message=f"{request.user.get_full_name() or request.user.username} authorized you to collect {carrier_name} delivery ({parcel.parcel_id}). Pickup PIN: {parcel.pickup_pin}.",
            notification_type='NEW_PARCEL',
            parcel=parcel
        )
        
        return Response({"message": "Delegation successful", "parcel": ParcelSerializer(parcel).data})

class RevokeDelegationView(views.APIView):
    permission_classes = [IsResidentUser]

    def post(self, request, parcel_id):
        try:
            parcel = Parcel.objects.get(parcel_id=parcel_id, resident=request.user, status__in=['AWAITING_PICKUP', 'OVERDUE'])
            
            if not parcel.is_delegated:
                return Response({"error": "Parcel is not currently delegated"}, status=status.HTTP_400_BAD_REQUEST)
                
            parcel.is_delegated = False
            parcel.delegated_to = None
            parcel.save()
            return Response({"message": "Delegation revoked successfully", "parcel": ParcelSerializer(parcel).data})
        except Parcel.DoesNotExist:
            return Response({"error": "Parcel not found or not eligible for revocation"}, status=status.HTTP_404_NOT_FOUND)

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

        shelf_breakdown = [
            {"name": s.name, "capacity": s.capacity, "occupied": s.occupied}
            for s in shelves
        ]

        return Response({
            "total_parcels": total_parcels,
            "pending_parcels": pending,
            "handed_over_today": handed_over_today,
            "overdue_parcels": overdue_parcels,
            "storage": {
                "capacity": total_capacity,
                "occupied": total_occupied,
                "breakdown": shelf_breakdown
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

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Lazy evaluation of overdue parcels for this user
        if user.role == 'RESIDENT':
            overdue_limit = timezone.now() - timedelta(hours=48)
            overdue_parcels = Parcel.objects.filter(
                resident=user,
                status='AWAITING_PICKUP',
                delivery_type='NORMAL',
                received_at__lt=overdue_limit
            )
            
            for p in overdue_parcels:
                if not Notification.objects.filter(parcel=p, notification_type='OVERDUE').exists():
                    carrier_name = p.carrier.name if p.carrier else "parcel"
                    Notification.objects.create(
                        user=user,
                        title="Parcel Waiting for Pickup",
                        message=f"Your {carrier_name} parcel has been waiting at the gatehouse for more than 48 hours.",
                        notification_type='OVERDUE',
                        parcel=p
                    )
                    
        return Notification.objects.filter(user=user)

class UnreadNotificationCountView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})

class MarkNotificationReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.is_read = True
            notification.save()
            return Response({"message": "Marked as read"})
        except Notification.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

class MarkAllNotificationsReadView(views.APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"message": "All marked as read"})

class ExpectedDeliveryViewSet(viewsets.ModelViewSet):
    serializer_class = ExpectedDeliverySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'RESIDENT':
            return ExpectedDelivery.objects.filter(resident=user).order_by('-created_at')
        return ExpectedDelivery.objects.all().order_by('-created_at')

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        tracking_id = request.query_params.get('tracking')
        if not tracking_id:
            return Response({"error": "Tracking ID is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # Only lookup ACTIVE expected deliveries
            delivery = ExpectedDelivery.objects.get(tracking_id=tracking_id, status='EXPECTED')
            return Response(self.get_serializer(delivery).data)
        except ExpectedDelivery.DoesNotExist:
            # Check if it was already received or cancelled for better error messages
            if ExpectedDelivery.objects.filter(tracking_id=tracking_id, status='RECEIVED').exists():
                return Response({"error": "This delivery has already been received."}, status=status.HTTP_404_NOT_FOUND)
            if ExpectedDelivery.objects.filter(tracking_id=tracking_id, status='CANCELLED').exists():
                return Response({"error": "This expected delivery has been cancelled."}, status=status.HTTP_404_NOT_FOUND)
                
            return Response({"error": "No expected delivery found for this Tracking ID."}, status=status.HTTP_404_NOT_FOUND)

    def perform_create(self, serializer):
        delivery = serializer.save()
        
        # Notify guards
        guards = User.objects.filter(role='GUARD', is_active=True)
        
        flat_display = "Unknown Flat"
        try:
            flat = delivery.resident.resident_profile.flat
            if flat:
                flat_display = f"{flat.tower.name}-{flat.number}"
        except Exception:
            pass
            
        cod_text = f" COD Amount: ₹{delivery.cod_amount}." if delivery.payment_type == 'COD' else ""
        msg = f"An expected {delivery.courier_name} delivery is registered for Flat {flat_display}. Tracking ID: {delivery.tracking_id}.{cod_text}"
        
        notifications = [
            Notification(
                user=guard,
                title="New Expected Delivery",
                message=msg,
                notification_type='NEW_PARCEL'
            )
            for guard in guards
        ]
        Notification.objects.bulk_create(notifications)

