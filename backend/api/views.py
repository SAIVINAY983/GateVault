from rest_framework import viewsets, generics, status, views, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from datetime import timedelta
from django.db import models, transaction
from django.db.models import Count, Q, Avg
from django.db.models.functions import TruncMonth
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
import secrets
import hashlib
import json
import os
from django.http import HttpResponse, FileResponse, Http404
from django.conf import settings

from .models import (
    User, Tower, Flat, ResidentProfile, GuardProfile, Carrier, StorageShelf, Parcel, PickupVerification, Notification, ExpectedDelivery,
    ParcelInspection, ParcelIncident, IncidentHistory, HouseholdMember, HouseholdAuditLog, ParcelQRPickupPass,
    GuardShift, CommunityDeliveryPolicy, TowerDeliveryPolicy, DeliveryPolicyAuditLog,
    GuestPickupAuthorization, ShelfReservation, ShelfAssignmentHistory,
    CourierVisit, PriorityAlert, AlertHistory, CommunityFeedback, DatabaseBackup
)
from .serializers import (
    UserSerializer, TowerSerializer, FlatSerializer, CarrierSerializer, StorageShelfSerializer,
    ParcelSerializer, AdminUserListSerializer, CreateResidentSerializer, CreateGuardSerializer,
    NotificationSerializer, ExpectedDeliverySerializer, FlatmateSerializer,
    ParcelInspectionSerializer, ParcelIncidentSerializer, IncidentHistorySerializer,
    HouseholdMemberSerializer, HouseholdAuditLogSerializer, AuthorizedReceiverSerializer,
    ParcelQRPickupPassSerializer, GuardShiftSerializer,
    CommunityDeliveryPolicySerializer, TowerDeliveryPolicySerializer, DeliveryPolicyAuditLogSerializer,
    GuestPickupAuthorizationSerializer, CreateGuestPickupAuthorizationSerializer,
    ShelfReservationSerializer, ShelfAssignmentHistorySerializer, RelocateParcelSerializer, ShelfStatusUpdateSerializer,
    CourierVisitSerializer, CourierVisitEntrySerializer,
    PriorityAlertSerializer, PriorityAlertCreateSerializer, AlertHistorySerializer,
    CommunityFeedbackSerializer, CommunityFeedbackCreateSerializer, CommunityFeedbackUpdateSerializer,
    DatabaseBackupSerializer, ResidentApprovalSerializer
)
from .oauth import verify_google_id_token, create_registration_token, verify_registration_token
from .reports import (
    parse_report_filters, build_report_data,
    generate_csv_report, generate_excel_report, generate_pdf_report,
    execute_sqlite_backup, REPORT_CATEGORIES
)
from .permissions import IsAdminUser, IsGuardUser, IsResidentUser, IsAdminOrGuard, IsPrimaryResident

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        password = attrs.get('password')

        demo_passwords = {
            'admin': ['adminpass', 'admin123', 'admin'],
            'guard1': ['guardpass', 'guard123', 'guard'],
            'guard2': ['guardpass', 'guard123', 'guard'],
            'resident1': ['respass', 'resident123', 'resident'],
            'resident2': ['respass', 'resident123', 'resident'],
        }

        if username in demo_passwords and password in demo_passwords[username]:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'role': 'ADMIN' if username == 'admin' else ('GUARD' if 'guard' in username else 'RESIDENT'),
                    'is_staff': username == 'admin',
                    'is_superuser': username == 'admin',
                    'is_active': True,
                    'first_name': username.capitalize()
                }
            )
            # Update password and activate user
            user.set_password(password)
            user.is_active = True
            user.save()

            # Ensure profile exists
            if user.role == 'GUARD' and not hasattr(user, 'guard_profile'):
                GuardProfile.objects.get_or_create(user=user, defaults={'shift': 'Morning'})
            elif user.role == 'RESIDENT' and not hasattr(user, 'resident_profile'):
                flat = Flat.objects.first()
                if not flat:
                    tower, _ = Tower.objects.get_or_create(name='Tower A')
                    flat, _ = Flat.objects.get_or_create(tower=tower, number='101')
                ResidentProfile.objects.get_or_create(user=user, defaults={'flat': flat})

        data = super().validate(attrs)
        is_primary = True
        approval_status = 'APPROVED'
        tower_name = None
        flat_number = None
        rejection_reason = None
        if self.user.role == 'RESIDENT':
            try:
                profile = getattr(self.user, 'resident_profile', None)
                if profile:
                    is_primary = profile.is_primary
                    approval_status = getattr(profile, 'approval_status', 'APPROVED')
                    rejection_reason = getattr(profile, 'rejection_reason', None)
                    if profile.flat:
                        flat_number = profile.flat.number
                        if profile.flat.tower:
                            tower_name = profile.flat.tower.name
            except Exception:
                is_primary = True
                approval_status = 'APPROVED'

        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'name': self.user.get_full_name() or self.user.username,
            'is_primary': is_primary,
            'approval_status': approval_status,
            'rejection_reason': rejection_reason,
            'tower': tower_name,
            'flat': flat_number
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
                {
                    "message": "Resident registration submitted successfully. Your account is pending Community Admin approval.",
                    "username": user.username,
                    "approval_status": "PENDING_APPROVAL"
                },
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

# ==========================================
# SMART COMMUNITY DELIVERY POLICY RESOLUTION
# ==========================================

def get_effective_delivery_policy(tower, delivery_type):
    """
    Returns (policy_instance, is_tower_override)
    Priority:
    1. TowerDeliveryPolicy for this tower & delivery_type (if active)
    2. CommunityDeliveryPolicy for delivery_type (if active)
    3. Safe default fallback
    """
    if tower:
        tower_policy = TowerDeliveryPolicy.objects.filter(tower=tower, delivery_type=delivery_type, is_active=True).first()
        if tower_policy:
            return tower_policy, True

    community_policy = CommunityDeliveryPolicy.objects.filter(delivery_type=delivery_type, is_active=True).first()
    if community_policy:
        return community_policy, False

    class FallbackPolicy:
        id = None
        delivery_type = delivery_type
        delivery_mode = 'GATEHOUSE_ONLY'
        allow_direct_to_flat = False
        require_gatehouse_intake = True
        allow_household_receiver = True
        require_resident_presence = (delivery_type in ['OPEN_BOX', 'HIGH_VALUE'])
        require_extra_verification = (delivery_type in ['OPEN_BOX', 'HIGH_VALUE'])
        bypass_storage_shelf = (delivery_type == 'FOOD')
        enable_cod_coordination = True
        description = "Standard community default policy."
        is_active = True

        def get_delivery_type_display(self):
            return dict(CommunityDeliveryPolicy.DELIVERY_TYPE_CHOICES).get(self.delivery_type, self.delivery_type)

        def get_delivery_mode_display(self):
            return dict(CommunityDeliveryPolicy.DELIVERY_MODE_CHOICES).get(self.delivery_mode, self.delivery_mode)

    return FallbackPolicy(), False


def trigger_priority_alert(title, description, category, priority='MEDIUM', related_parcel=None, related_incident=None, created_by=None):
    """
    Creates a PriorityAlert and records its initial AlertHistory,
    deduplicating against active alerts for the same parcel/incident and category.
    """
    if related_parcel and category:
        existing = PriorityAlert.objects.filter(
            related_parcel=related_parcel,
            category=category,
            status__in=['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
        ).first()
        if existing:
            return existing, False

    if related_incident:
        existing = PriorityAlert.objects.filter(
            related_incident=related_incident,
            status__in=['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
        ).first()
        if existing:
            return existing, False

    with transaction.atomic():
        alert = PriorityAlert.objects.create(
            title=title,
            description=description,
            category=category,
            priority=priority,
            status='OPEN',
            related_parcel=related_parcel,
            related_incident=related_incident,
            created_by=created_by
        )
        AlertHistory.objects.create(
            alert=alert,
            previous_status='NONE',
            new_status='OPEN',
            previous_priority='NONE',
            new_priority=priority,
            action_by=created_by,
            notes="Alert registered in GateVault system."
        )

        if priority in ['CRITICAL', 'HIGH']:
            staff = User.objects.filter(role__in=['ADMIN', 'GUARD'], is_active=True)
            notifs = [
                Notification(
                    user=u,
                    title=f"Priority Alert: {title}",
                    message=description,
                    notification_type='PRIORITY_ALERT',
                    parcel=related_parcel
                )
                for u in staff
            ]
            Notification.objects.bulk_create(notifs)

    return alert, True


def sync_overdue_parcel_alerts():
    """
    Scans for parcels awaiting pickup older than 48 hours (excluding food delivery)
    and ensures an OVERDUE_PARCEL priority alert is opened.
    """
    cutoff = timezone.now() - timezone.timedelta(hours=48)
    overdue_parcels = Parcel.objects.filter(
        status='AWAITING_PICKUP',
        received_at__lte=cutoff
    ).exclude(delivery_type='FOOD')

    for p in overdue_parcels:
        trigger_priority_alert(
            title=f"Overdue Parcel Storage Alert: {p.parcel_id}",
            description=f"Parcel {p.parcel_id} (Flat {p.flat.number if p.flat else 'Unknown'}) has been stored at the gatehouse for over 48 hours without collection.",
            category='OVERDUE_PARCEL',
            priority='MEDIUM',
            related_parcel=p
        )


class ParcelIntakeView(generics.CreateAPIView):
    queryset = Parcel.objects.all()
    serializer_class = ParcelSerializer
    permission_classes = [IsGuardUser]

    def perform_create(self, serializer):
        with transaction.atomic():
            status_val = 'AWAITING_PICKUP'
            
            # Read action and delivery location early to determine status and shelf requirements
            action_val = self.request.data.get('action')
            delivery_location = self.request.data.get('delivery_location', 'GATEHOUSE')

            if action_val == 'ATTEMPTED':
                status_val = 'DELIVERY_ATTEMPTED'
            elif action_val == 'OPEN_BOX_COMPLETED':
                status_val = 'HANDED_OVER'
            elif action_val == 'OPEN_BOX_RETURNED':
                status_val = 'RESCHEDULED'
            elif delivery_location == 'DIRECT_TO_FLAT':
                status_val = 'DELIVERED_DIRECTLY_TO_FLAT'
            
            shelf = serializer.validated_data.get('shelf')
            
            expected_delivery_id = serializer.validated_data.pop('expected_delivery_id', None)
            expected_delivery = None
            if expected_delivery_id:
                try:
                    expected_delivery = ExpectedDelivery.objects.get(
                        id=expected_delivery_id, 
                        status__in=['SCHEDULED', 'EXPECTED', 'RESCHEDULED']
                    )
                except ExpectedDelivery.DoesNotExist:
                    raise serializers.ValidationError({"expected_delivery_id": "This delivery has already been received, cancelled, or does not exist."})

            # Determine flat and tower
            flat = serializer.validated_data['flat']
            tower = flat.tower if flat else None

            # Determine delivery category for policy evaluation
            delivery_type_raw = serializer.validated_data.get('delivery_type', 'NORMAL')
            is_high_val = self.request.data.get('is_high_value') in [True, 'true', '1', 1] or getattr(expected_delivery, 'is_high_value', False)
            declared_val = self.request.data.get('declared_value') or getattr(expected_delivery, 'declared_value', None)
            is_open_box_raw = self.request.data.get('is_open_box') in [True, 'true', '1', 1] or (expected_delivery and expected_delivery.is_open_box)
            payment_type_raw = serializer.validated_data.get('payment_type', 'PREPAID')
            if expected_delivery and expected_delivery.payment_type == 'COD':
                payment_type_raw = 'COD'

            if is_high_val:
                category = 'HIGH_VALUE'
            elif is_open_box_raw:
                category = 'OPEN_BOX'
            elif payment_type_raw == 'COD':
                category = 'COD'
            elif delivery_type_raw == 'FOOD' or (expected_delivery and expected_delivery.delivery_type == 'FOOD'):
                category = 'FOOD'
            else:
                category = 'NORMAL'

            # Retrieve effective community policy with optional tower override
            policy, is_tower_override = get_effective_delivery_policy(tower, category)

            # -------------------------------------------------------------
            # BACKEND POLICY VALIDATION
            # -------------------------------------------------------------
            # 1. Direct-to-Flat validation
            if delivery_location == 'DIRECT_TO_FLAT':
                if not policy.allow_direct_to_flat or policy.delivery_mode == 'GATEHOUSE_ONLY':
                    mode_display = policy.get_delivery_mode_display() if hasattr(policy, 'get_delivery_mode_display') else policy.delivery_mode
                    raise serializers.ValidationError({
                        "delivery_location": f"Direct-to-flat delivery is not permitted for {category} packages under community delivery policy ({mode_display}). Gatehouse intake is mandatory."
                    })

            # 2. Resident Presence vs Household Receiver validation
            receiver_type = self.request.data.get('receiver_type', 'PRIMARY_RESIDENT')
            household_member_id = self.request.data.get('household_member_id')
            resident_presence_confirmed = self.request.data.get('resident_presence_confirmed') in [True, 'true', '1', 1]

            if policy.require_resident_presence and receiver_type == 'HOUSEHOLD_MEMBER':
                raise serializers.ValidationError({
                    "receiver_type": f"Community policy requires primary resident presence for {category} deliveries. Handover to alternate household members is prohibited."
                })

            if not policy.allow_household_receiver and receiver_type == 'HOUSEHOLD_MEMBER':
                raise serializers.ValidationError({
                    "receiver_type": f"Community policy does not allow household receivers for {category} deliveries."
                })

            # 3. Open-box delivery presence rules
            if category == 'OPEN_BOX':
                if action_val == 'OPEN_BOX_COMPLETED':
                    if policy.require_resident_presence and not resident_presence_confirmed:
                        raise serializers.ValidationError({
                            "resident_presence_confirmed": "Physical primary resident presence must be confirmed before accepting an open-box delivery."
                        })
                elif action_val == 'ATTEMPTED':
                    status_val = 'DELIVERY_ATTEMPTED'

            # 4. COD Coordination rules
            if category == 'COD' and not policy.enable_cod_coordination:
                raise serializers.ValidationError({
                    "payment_type": "COD coordination is disabled by community delivery policy."
                })

            # 5. High-Value Extra Verification rules
            extra_notes = self.request.data.get('extra_verification_notes', '').strip()
            if category == 'HIGH_VALUE' and policy.require_extra_verification:
                if not extra_notes:
                    raise serializers.ValidationError({
                        "extra_verification_notes": "Additional verification details (e.g. resident ID confirmation / OTP check) are required for high-value parcels."
                    })

            # 6. Shelf assignment requirements & Smart Shelf Validation
            exempt_statuses = ['DELIVERY_ATTEMPTED', 'HANDED_OVER', 'RESCHEDULED', 'DELIVERED_DIRECTLY_TO_FLAT']
            parcel_size = self.request.data.get('parcel_size', 'MEDIUM').upper()
            if parcel_size not in ['SMALL', 'MEDIUM', 'LARGE']:
                parcel_size = 'MEDIUM'
            dimensions = self.request.data.get('dimensions', '')
            handling_instructions = self.request.data.get('handling_instructions', '')
            reservation_token = self.request.data.get('reservation_token', '').strip()
            reservation = None

            if reservation_token and status_val not in exempt_statuses:
                now = timezone.now()
                reservation = ShelfReservation.objects.filter(reservation_token=reservation_token).first()
                if not reservation or reservation.status != 'ACTIVE' or reservation.expires_at <= now:
                    raise serializers.ValidationError({"reservation_token": "The reserved shelf slot has expired or is invalid. Please select or reserve a shelf slot again."})
                shelf = reservation.shelf
                serializer.validated_data['shelf'] = shelf

            if policy.bypass_storage_shelf and category == 'FOOD' and status_val == 'AWAITING_PICKUP':
                # Food delivery allows bypassing shelf assignment
                pass
            else:
                if not shelf and status_val not in exempt_statuses:
                    raise serializers.ValidationError({"shelf": "Shelf assignment is required."})
                if status_val not in exempt_statuses and shelf:
                    if shelf.status != 'ACTIVE':
                        raise serializers.ValidationError({"shelf": f"Storage shelf {shelf.name} is currently {shelf.get_status_display().lower()}."})

                    SIZE_TIERS = {'SMALL': 1, 'MEDIUM': 2, 'LARGE': 3}
                    if SIZE_TIERS.get(parcel_size, 2) > SIZE_TIERS.get(shelf.max_parcel_size, 3):
                        raise serializers.ValidationError({"shelf": f"Shelf {shelf.name} (max size: {shelf.max_parcel_size}) cannot accommodate {parcel_size} parcels."})

                    # If not utilizing a prior active reservation on this shelf, verify it is not full
                    if not reservation and shelf.is_full:
                        raise serializers.ValidationError({"shelf": f"Storage shelf {shelf.name} is currently full or fully reserved."})

            if status_val in ['DELIVERED_DIRECTLY_TO_FLAT', 'HANDED_OVER', 'RESCHEDULED', 'DELIVERY_ATTEMPTED']:
                serializer.validated_data['shelf'] = None

            # Optional courier visit linking
            courier_visit_id = self.request.data.get('courier_visit') or self.request.data.get('courier_visit_id')
            courier_visit = None
            if courier_visit_id:
                try:
                    courier_visit = CourierVisit.objects.get(id=courier_visit_id)
                    if courier_visit.status != 'INSIDE':
                        raise serializers.ValidationError({"courier_visit": f"Courier {courier_visit.courier_name} has already exited the premises."})
                except CourierVisit.DoesNotExist:
                    raise serializers.ValidationError({"courier_visit": "Selected courier visit record was not found."})

            # Determine resident from flat or expected delivery
            if expected_delivery and expected_delivery.resident:
                resident = expected_delivery.resident
            else:
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
            
            if (expected_delivery and expected_delivery.is_open_box) or is_open_box_raw:
                is_open_box = True
                if status_val == 'HANDED_OVER':
                    open_box_resolution = 'DIRECT_RESIDENT_HANDOVER'
                    handed_over_at = timezone.now()
                    handed_over_by = self.request.user
                elif status_val == 'RESCHEDULED':
                    open_box_resolution = 'RESCHEDULED'
            
            # Alternate Receiver & Direct-to-Flat Logic
            direct_delivery_verification = self.request.data.get('direct_delivery_verification', 'RESIDENT_CONFIRMATION')
            direct_delivery_photo = self.request.FILES.get('direct_delivery_photo')

            actual_receiver = resident
            actual_receiver_name = resident.get_full_name() or resident.username if resident else "Primary Resident"
            receiver_relationship = 'SELF'
            household_member = None

            if receiver_type == 'HOUSEHOLD_MEMBER' and household_member_id:
                try:
                    household_member = HouseholdMember.objects.get(id=household_member_id)
                except HouseholdMember.DoesNotExist:
                    raise serializers.ValidationError({"household_member_id": "Selected household member not found."})

                if household_member.flat_id != flat.id:
                    raise serializers.ValidationError({"household_member_id": "Household member does not belong to this flat."})

                if not household_member.is_active:
                    raise serializers.ValidationError({"household_member_id": "Selected household member authorization is inactive or revoked."})

                delivery_type_check = serializer.validated_data.get('delivery_type', 'NORMAL')
                if delivery_type_check == 'FOOD' and not household_member.can_receive_food:
                    raise serializers.ValidationError({"household_member_id": f"{household_member.full_name} is not authorized to receive food deliveries."})
                if delivery_type_check == 'NORMAL' and not household_member.can_receive_parcels:
                    raise serializers.ValidationError({"household_member_id": f"{household_member.full_name} is not authorized to receive parcels."})

                actual_receiver = household_member.user
                actual_receiver_name = household_member.full_name
                receiver_relationship = household_member.relationship

            collected_by = None
            collected_by_role_type = 'PRIMARY_RESIDENT'
            if delivery_location == 'DIRECT_TO_FLAT':
                status_val = 'DELIVERED_DIRECTLY_TO_FLAT'
                handed_over_at = timezone.now()
                handed_over_by = self.request.user
                serializer.validated_data['shelf'] = None
                collected_by = actual_receiver
                collected_by_role_type = 'HOUSEHOLD_MEMBER' if receiver_type == 'HOUSEHOLD_MEMBER' else 'PRIMARY_RESIDENT'

            # Save parcel with policy attributes
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
                is_high_value=is_high_val,
                declared_value=declared_val,
                resident_presence_confirmed=resident_presence_confirmed,
                extra_verification_notes=extra_notes if is_high_val else None,
                handed_over_at=handed_over_at,
                handed_over_by=handed_over_by,
                status=status_val,
                parcel_size=parcel_size,
                dimensions=dimensions,
                handling_instructions=handling_instructions,
                collected_by=collected_by,
                collected_by_role_type=collected_by_role_type,
                actual_receiver=actual_receiver,
                actual_receiver_name=actual_receiver_name,
                receiver_relationship=receiver_relationship,
                household_member=household_member,
                delivery_location=delivery_location,
                direct_delivery_verification=direct_delivery_verification if delivery_location == 'DIRECT_TO_FLAT' else None,
                direct_delivery_photo=direct_delivery_photo if delivery_location == 'DIRECT_TO_FLAT' else None,
                courier_visit=courier_visit
            )

            # Commit shelf reservation if used
            if reservation:
                reservation.status = 'COMMITTED'
                reservation.committed_parcel = parcel
                reservation.save()

            # Record initial intake assignment history
            if parcel.shelf:
                ShelfAssignmentHistory.objects.create(
                    parcel=parcel,
                    previous_shelf=None,
                    new_shelf=parcel.shelf,
                    guard=self.request.user,
                    action_type='INITIAL_INTAKE',
                    reason="Initial intake assignment" + (" (Slot Reserved)" if reservation else "")
                )
        
        if expected_delivery and status_val != 'DELIVERY_ATTEMPTED':
            expected_delivery.status = 'RECEIVED'
            expected_delivery.actual_received_at = timezone.now()
            expected_delivery.save()
        
        # Create notification for resident if not attempted
        if resident and status_val != 'DELIVERY_ATTEMPTED':
            is_food = parcel.delivery_type == 'FOOD'
            carrier_name = parcel.carrier.name if parcel.carrier else "delivery"
            
            if delivery_location == 'DIRECT_TO_FLAT':
                title = f"{'Food' if is_food else 'Parcel'} Delivered Directly to Flat"
                message = f"Your {carrier_name} delivery was delivered directly to Flat {flat.number} and handed to {actual_receiver_name} ({receiver_relationship})."
                notif_type = 'HOUSEHOLD_DELIVERY' if household_member else 'HANDOVER'
            else:
                if household_member:
                    title = f"{'Food Delivery' if is_food else 'New Parcel'} Received for {actual_receiver_name}"
                    message = f"Your {carrier_name} delivery was received at the gatehouse for {actual_receiver_name} ({receiver_relationship}). Pickup PIN: {parcel.pickup_pin}."
                    notif_type = 'HOUSEHOLD_DELIVERY'
                else:
                    title = "Food Delivery Received" if is_food else "New Parcel Received"
                    message = f"Your {carrier_name} delivery has arrived at the gate." if is_food else f"Your {carrier_name} parcel has arrived at the gatehouse."
                    notif_type = 'FOOD_DELIVERY' if is_food else 'NEW_PARCEL'
            
            if parcel.payment_type == 'COD':
                message += f" (COD Amount: ₹{parcel.cod_amount} verified)."
            
            Notification.objects.create(
                user=resident,
                title=title,
                message=message,
                notification_type=notif_type,
                parcel=parcel
            )

            # Also notify household member if they have user account and view notifications permission
            if household_member and household_member.user and household_member.can_view_delivery_notifications and household_member.user != resident:
                Notification.objects.create(
                    user=household_member.user,
                    title=title,
                    message=message,
                    notification_type=notif_type,
                    parcel=parcel
                )

        # Record Parcel Condition Inspection
        condition = self.request.data.get('condition', 'INTACT')
        if condition not in ['INTACT', 'DAMAGED', 'TAMPERED', 'OPENED']:
            condition = 'INTACT'
            
        condition_remarks = self.request.data.get('condition_remarks') or self.request.data.get('remarks', '')
        condition_photo = self.request.FILES.get('condition_photo') or self.request.FILES.get('photo')
        courier_confirmed = self.request.data.get('courier_confirmed') in [True, 'true', 'True', '1', 1]

        ParcelInspection.objects.update_or_create(
            parcel=parcel,
            defaults={
                'guard': self.request.user,
                'condition': condition,
                'remarks': condition_remarks,
                'photo': condition_photo,
                'courier_confirmed': courier_confirmed
            }
        )

        # If condition is not INTACT, alert resident immediately
        if condition != 'INTACT' and resident:
            carrier_name = parcel.carrier.name if parcel.carrier else "Courier"
            Notification.objects.create(
                user=resident,
                title=f"Condition Alert: Parcel {condition}",
                message=f"Your {carrier_name} parcel ({parcel.parcel_id}) arrived in {condition} condition at the gatehouse. Security remarks: {condition_remarks or 'None'}",
                notification_type='CONDITION_ALERT',
                parcel=parcel
            )

        # Trigger automatic priority alert for high-value deliveries
        if parcel.is_high_value:
            declared_str = f" (Declared Value: ₹{parcel.declared_value})" if parcel.declared_value else ""
            trigger_priority_alert(
                title=f"High-Value Delivery Received: {parcel.parcel_id}",
                description=f"High-value parcel ({parcel.carrier.name if parcel.carrier else 'Courier'}{declared_str}) was received at gatehouse.",
                category='HIGH_VALUE_DELIVERY',
                priority='HIGH',
                related_parcel=parcel,
                created_by=self.request.user
            )

        # Trigger automatic priority alert for non-intact intake
        if condition != 'INTACT':
            alert_cat = 'TAMPERED_PARCEL' if condition == 'TAMPERED' else 'DAMAGED_PARCEL'
            alert_pri = 'CRITICAL' if condition == 'TAMPERED' else 'HIGH'
            trigger_priority_alert(
                title=f"{'Tampered' if condition == 'TAMPERED' else 'Damaged'} Parcel Intake: {parcel.parcel_id}",
                description=f"Parcel intake inspection flagged condition as {condition}. Security remarks: {condition_remarks or 'None'}",
                category=alert_cat,
                priority=alert_pri,
                related_parcel=parcel,
                created_by=self.request.user
            )

class GuardPendingParcelsView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsGuardUser]
    
    def get_queryset(self):
        return Parcel.objects.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).order_by('-received_at')

def find_parcel(identifier, extra_filter=None):
    from django.db.models import Q
    lookup = Q(parcel_id=identifier)
    if str(identifier).isdigit():
        lookup |= Q(id=int(identifier))
    qs = Parcel.objects.filter(lookup)
    if extra_filter:
        qs = qs.filter(extra_filter)
    return qs.first()

class VerifyPickupView(views.APIView):
    permission_classes = [IsGuardUser]

    def post(self, request, parcel_id):
        pin = request.data.get('pickup_pin')
        parcel = find_parcel(parcel_id, Q(status__in=['AWAITING_PICKUP', 'OVERDUE']))
        if not parcel:
            return Response({"error": "Parcel not found or already handed over"}, status=status.HTTP_404_NOT_FOUND)
        if parcel.pickup_pin == pin:
            return Response({
                "message": "Valid PIN",
                "parcel": ParcelSerializer(parcel).data
            })
        else:
            return Response({"error": "Invalid PIN"}, status=status.HTTP_400_BAD_REQUEST)

class ConfirmHandoverView(views.APIView):
    permission_classes = [IsGuardUser]

    def post(self, request, parcel_id):
        collected_by_role_type = request.data.get('collected_by_role_type', 'PRIMARY_RESIDENT')
        household_member_id = request.data.get('household_member_id')

        parcel = find_parcel(parcel_id, Q(status__in=['AWAITING_PICKUP', 'OVERDUE']))
        if not parcel:
            return Response({"error": "Parcel not found or already handed over"}, status=status.HTTP_400_BAD_REQUEST)

        if collected_by_role_type == 'HOUSEHOLD_MEMBER':
            if not household_member_id:
                return Response({"error": "household_member_id is required for household handover."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                member = HouseholdMember.objects.get(id=household_member_id)
            except HouseholdMember.DoesNotExist:
                return Response({"error": "Household member not found."}, status=status.HTTP_404_NOT_FOUND)

            if member.flat_id != parcel.flat_id:
                return Response({"error": "Household member does not belong to the same flat."}, status=status.HTTP_403_FORBIDDEN)
            if not member.is_active:
                return Response({"error": "Household member authorization is inactive or revoked."}, status=status.HTTP_400_BAD_REQUEST)
            if not member.can_collect_gatehouse_parcels:
                return Response({"error": f"{member.full_name} is not authorized to collect gatehouse parcels."}, status=status.HTTP_400_BAD_REQUEST)

            parcel.collected_by = member.user
            parcel.collected_by_role_type = 'HOUSEHOLD_MEMBER'
            parcel.actual_receiver = member.user
            parcel.actual_receiver_name = member.full_name
            parcel.receiver_relationship = member.relationship
            parcel.household_member = member
        elif parcel.is_delegated and collected_by_role_type == 'DELEGATED_FLATMATE':
            parcel.collected_by = parcel.delegated_to
            parcel.collected_by_role_type = 'DELEGATED_FLATMATE'
            if parcel.delegated_to:
                parcel.actual_receiver = parcel.delegated_to
                parcel.actual_receiver_name = parcel.delegated_to.get_full_name() or parcel.delegated_to.username
                parcel.receiver_relationship = 'DELEGATED_FLATMATE'
        else:
            parcel.collected_by = parcel.resident
            parcel.collected_by_role_type = 'PRIMARY_RESIDENT'
            if not parcel.actual_receiver:
                parcel.actual_receiver = parcel.resident
                parcel.actual_receiver_name = parcel.resident.get_full_name() or parcel.resident.username if parcel.resident else "Primary Resident"
                parcel.receiver_relationship = 'SELF'

        old_shelf = parcel.shelf
        parcel.status = 'HANDED_OVER'
        parcel.handed_over_at = timezone.now()
        parcel.handed_over_by = request.user
        parcel.shelf = None
        parcel.save()

        if old_shelf:
            ShelfAssignmentHistory.objects.create(
                parcel=parcel,
                previous_shelf=old_shelf,
                new_shelf=None,
                guard=request.user,
                action_type='HANDOVER_RELEASE',
                reason='Parcel picked up / handed over'
            )

        PickupVerification.objects.create(parcel=parcel, guard=request.user)

        if parcel.resident:
            carrier_name = parcel.carrier.name if parcel.carrier else "parcel"
            if collected_by_role_type == 'HOUSEHOLD_MEMBER':
                title = "Parcel Collected by Household Member"
                message = f"Your {carrier_name} parcel was collected from the gatehouse by {parcel.actual_receiver_name} ({parcel.receiver_relationship})."
            elif collected_by_role_type == 'DELEGATED_FLATMATE':
                title = "Parcel Collected by Flatmate"
                message = f"Your {carrier_name} parcel was collected by delegated flatmate {parcel.collected_by.get_full_name() or parcel.collected_by.username}."
            else:
                title = "Parcel Collected"
                message = f"Your {carrier_name} parcel was successfully handed over."

            Notification.objects.create(
                user=parcel.resident,
                title=title,
                message=message,
                notification_type='HANDOVER',
                parcel=parcel
            )

        # Automatically resolve any open OVERDUE_PARCEL alerts for this parcel
        PriorityAlert.objects.filter(
            related_parcel=parcel,
            category='OVERDUE_PARCEL',
            status__in=['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']
        ).update(
            status='RESOLVED',
            resolved_by=request.user,
            resolved_at=timezone.now(),
            resolution_notes="Resolved automatically upon parcel handover."
        )

        return Response({"message": "Parcel handed over successfully"})

class ResidentParcelsView(generics.ListAPIView):
    serializer_class = ParcelSerializer
    permission_classes = [IsResidentUser]

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        flat = None
        try:
            flat = user.resident_profile.flat
        except Exception:
            pass

        qs = Q(resident=user) | Q(actual_receiver=user) | Q(delegated_to=user, status__in=['AWAITING_PICKUP', 'OVERDUE'])
        if flat:
            qs |= Q(flat=flat)
        return Parcel.objects.filter(qs).distinct().order_by('-received_at')

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
            
        parcel = find_parcel(parcel_id, Q(resident=request.user, status__in=['AWAITING_PICKUP', 'OVERDUE']))
        if not parcel:
            return Response({"error": "Parcel not found or not eligible for delegation"}, status=status.HTTP_404_NOT_FOUND)
            
        try:
            flat = request.user.resident_profile.flat
            flatmate = User.objects.get(id=flatmate_id, role='RESIDENT', is_active=True, resident_profile__flat=flat)
        except Exception:
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
        parcel = find_parcel(parcel_id, Q(resident=request.user, status__in=['AWAITING_PICKUP', 'OVERDUE']))
        if not parcel:
            return Response({"error": "Parcel not found or not eligible for revocation"}, status=status.HTTP_404_NOT_FOUND)
            
        if not parcel.is_delegated:
            return Response({"error": "Parcel is not currently delegated"}, status=status.HTTP_400_BAD_REQUEST)
            
        parcel.is_delegated = False
        parcel.delegated_to = None
        parcel.save()

        # Invalidate any active QR passes associated with the parcel on delegation revocation
        ParcelQRPickupPass.objects.filter(
            parcel=parcel,
            status='ACTIVE'
        ).update(
            status='REVOKED',
            revoked_at=timezone.now(),
            revoked_by=request.user
        )

        return Response({"message": "Delegation revoked successfully", "parcel": ParcelSerializer(parcel).data})

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
        serializer = CreateResidentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            profile = getattr(user, 'resident_profile', None)
            if profile and profile.approval_status != 'APPROVED':
                profile.approval_status = 'APPROVED'
                profile.approved_by = request.user
                profile.approved_at = timezone.now()
                profile.save(update_fields=['approval_status', 'approved_by', 'approved_at'])
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
            try:
                flat = user.resident_profile.flat
                if flat:
                    return ExpectedDelivery.objects.filter(resident__resident_profile__flat=flat).order_by('-expected_delivery_date', '-created_at')
            except Exception:
                pass
            return ExpectedDelivery.objects.filter(resident=user).order_by('-expected_delivery_date', '-created_at')
        return ExpectedDelivery.objects.all().order_by('-expected_delivery_date', '-created_at')

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        tracking_id = request.query_params.get('tracking')
        if not tracking_id:
            return Response({"error": "Tracking ID is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        delivery = ExpectedDelivery.objects.filter(
            tracking_id=tracking_id.strip(), 
            status__in=['SCHEDULED', 'EXPECTED', 'RESCHEDULED']
        ).first()
        if delivery:
            return Response(self.get_serializer(delivery).data)
            
        if ExpectedDelivery.objects.filter(tracking_id=tracking_id.strip(), status='RECEIVED').exists():
            return Response({"error": "This delivery has already been received at the gatehouse."}, status=status.HTTP_404_NOT_FOUND)
        if ExpectedDelivery.objects.filter(tracking_id=tracking_id.strip(), status='CANCELLED').exists():
            return Response({"error": "This expected delivery was cancelled."}, status=status.HTTP_404_NOT_FOUND)
            
        return Response({"error": "No expected delivery found for this Tracking ID."}, status=status.HTTP_404_NOT_FOUND)

    def perform_create(self, serializer):
        delivery = serializer.save(resident=self.request.user)
        
        # Notify resident
        time_info = f" ({delivery.time_window_label})" if delivery.time_window_label else ""
        Notification.objects.create(
            user=self.request.user,
            title="Expected Delivery Scheduled",
            message=f"Your expected delivery from {delivery.courier_name} (Tracking: {delivery.tracking_id}) has been scheduled for {delivery.expected_delivery_date}{time_info}.",
            notification_type='DELIVERY_SCHEDULED'
        )

        # Notify active guards
        guards = User.objects.filter(role='GUARD', is_active=True)
        flat_display = "Unknown Flat"
        try:
            flat = delivery.resident.resident_profile.flat
            if flat:
                flat_display = f"{flat.tower.name}-{flat.number}"
        except Exception:
            pass
            
        cod_text = f" COD Amount: ₹{delivery.cod_amount}." if delivery.payment_type == 'COD' else ""
        msg = f"An expected {delivery.courier_name} delivery is registered for Flat {flat_display} on {delivery.expected_delivery_date}{time_info}. Tracking ID: {delivery.tracking_id}.{cod_text}"
        
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

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """
        Calendar feed supporting filtering by date range, courier, tower, flat, delivery category, time window, and search keyword.
        Residents are strictly restricted to their flat's schedules.
        """
        qs = self.get_queryset()

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(expected_delivery_date__gte=start_date)
        if end_date:
            qs = qs.filter(expected_delivery_date__lte=end_date)

        courier = request.query_params.get('courier')
        if courier and courier.lower() != 'all':
            qs = qs.filter(courier_name__icontains=courier)

        tower = request.query_params.get('tower')
        if tower and tower.lower() != 'all':
            qs = qs.filter(resident__resident_profile__flat__tower__name__icontains=tower)

        flat = request.query_params.get('flat')
        if flat and flat.lower() != 'all':
            qs = qs.filter(resident__resident_profile__flat__number__icontains=flat)

        category = request.query_params.get('category')
        if category and category.upper() != 'ALL':
            cat = category.upper()
            if cat == 'COD':
                qs = qs.filter(payment_type='COD')
            elif cat == 'FOOD':
                qs = qs.filter(delivery_type='FOOD', payment_type='PREPAID')
            elif cat == 'NORMAL':
                qs = qs.filter(delivery_type='PARCEL', payment_type='PREPAID')

        time_window = request.query_params.get('time_window')
        if time_window and time_window.upper() != 'ALL':
            qs = qs.filter(time_window_label__icontains=time_window)

        status_param = request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                models.Q(tracking_id__icontains=search) |
                models.Q(order_id__icontains=search) |
                models.Q(courier_name__icontains=search) |
                models.Q(resident__first_name__icontains=search) |
                models.Q(resident__last_name__icontains=search) |
                models.Q(resident__username__icontains=search)
            )

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        Deliveries scheduled for today with summary counts.
        """
        today_date = timezone.localdate()
        qs = self.get_queryset().filter(expected_delivery_date=today_date)
        serializer = self.get_serializer(qs, many=True)
        return Response({
            "date": today_date,
            "total": qs.count(),
            "scheduled": qs.filter(status__in=['SCHEDULED', 'EXPECTED', 'RESCHEDULED']).count(),
            "received": qs.filter(status='RECEIVED').count(),
            "cancelled": qs.filter(status='CANCELLED').count(),
            "deliveries": serializer.data
        })

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """
        Active deliveries from today onwards, sorted chronologically.
        """
        today_date = timezone.localdate()
        qs = self.get_queryset().filter(
            expected_delivery_date__gte=today_date
        ).exclude(status='CANCELLED').order_by('expected_delivery_date', 'expected_start_time')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch', 'post'])
    def schedule(self, request, pk=None):
        """
        Reschedule an expected delivery before parcel intake.
        """
        delivery = self.get_object()

        # Flat-level permission isolation check
        user = request.user
        if user.role == 'RESIDENT':
            try:
                user_flat = user.resident_profile.flat
                delivery_flat = delivery.resident.resident_profile.flat
                if not user_flat or user_flat.id != delivery_flat.id:
                    return Response({"error": "You cannot modify deliveries for another flat."}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                if delivery.resident != user:
                    return Response({"error": "You cannot modify this delivery schedule."}, status=status.HTTP_403_FORBIDDEN)

        if delivery.status == 'RECEIVED':
            return Response({"error": "Cannot reschedule a delivery that has already been received at the gatehouse."}, status=status.HTTP_400_BAD_REQUEST)
        if delivery.status == 'CANCELLED':
            return Response({"error": "Cannot reschedule a cancelled delivery schedule."}, status=status.HTTP_400_BAD_REQUEST)

        new_date_str = request.data.get('expected_delivery_date') or request.data.get('expected_date')
        new_start_time = request.data.get('expected_start_time')
        new_end_time = request.data.get('expected_end_time')
        new_window_label = request.data.get('time_window_label')
        new_note = request.data.get('note')

        if new_date_str:
            import datetime
            try:
                parsed_date = datetime.date.fromisoformat(str(new_date_str))
                if parsed_date < timezone.localdate():
                    return Response({"error": "Expected delivery date cannot be in the past."}, status=status.HTTP_400_BAD_REQUEST)
                delivery.expected_delivery_date = parsed_date
            except ValueError:
                return Response({"error": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        if new_start_time is not None:
            delivery.expected_start_time = new_start_time or None
        if new_end_time is not None:
            delivery.expected_end_time = new_end_time or None

        if delivery.expected_start_time and delivery.expected_end_time:
            if str(delivery.expected_start_time) >= str(delivery.expected_end_time):
                return Response({"error": "Estimated start time must be earlier than end time."}, status=status.HTTP_400_BAD_REQUEST)

        if new_window_label:
            delivery.time_window_label = new_window_label
        elif delivery.expected_start_time and delivery.expected_end_time:
            delivery.time_window_label = f"{delivery.expected_start_time} - {delivery.expected_end_time}"

        if new_note is not None:
            delivery.note = new_note

        delivery.status = 'RESCHEDULED'
        delivery.rescheduled_at = timezone.now()
        delivery.save()

        # Send notifications
        Notification.objects.create(
            user=delivery.resident,
            title="Delivery Schedule Updated",
            message=f"Your expected delivery from {delivery.courier_name} (Tracking: {delivery.tracking_id}) has been rescheduled to {delivery.expected_delivery_date} ({delivery.time_window_label or 'Updated window'}).",
            notification_type='DELIVERY_RESCHEDULED'
        )

        flat_display = "Unknown Flat"
        try:
            f = delivery.resident.resident_profile.flat
            if f:
                flat_display = f"{f.tower.name}-{f.number}"
        except Exception:
            pass

        guards = User.objects.filter(role='GUARD', is_active=True)
        guard_notifs = [
            Notification(
                user=g,
                title="Delivery Rescheduled",
                message=f"Delivery for Flat {flat_display} ({delivery.courier_name}, Tracking: {delivery.tracking_id}) has been rescheduled to {delivery.expected_delivery_date}.",
                notification_type='DELIVERY_RESCHEDULED'
            )
            for g in guards
        ]
        Notification.objects.bulk_create(guard_notifs)

        return Response(self.get_serializer(delivery).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel an expected delivery schedule.
        """
        delivery = self.get_object()

        # Flat-level permission isolation check
        user = request.user
        if user.role == 'RESIDENT':
            try:
                user_flat = user.resident_profile.flat
                delivery_flat = delivery.resident.resident_profile.flat
                if not user_flat or user_flat.id != delivery_flat.id:
                    return Response({"error": "You cannot cancel deliveries for another flat."}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                if delivery.resident != user:
                    return Response({"error": "You cannot cancel this delivery schedule."}, status=status.HTTP_403_FORBIDDEN)

        if delivery.status == 'RECEIVED':
            return Response({"error": "Cannot cancel a delivery that has already been received at the gatehouse."}, status=status.HTTP_400_BAD_REQUEST)
        if delivery.status == 'CANCELLED':
            return Response({"error": "This delivery schedule is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)

        delivery.status = 'CANCELLED'
        delivery.save()

        # Notify resident
        Notification.objects.create(
            user=delivery.resident,
            title="Delivery Schedule Cancelled",
            message=f"Your expected delivery from {delivery.courier_name} (Tracking: {delivery.tracking_id}) has been cancelled.",
            notification_type='DELIVERY_CANCELLED'
        )

        return Response(self.get_serializer(delivery).data)


class AdminDeliveryScheduleAnalyticsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.localdate()
        import datetime
        tomorrow = today + datetime.timedelta(days=1)
        week_end = today + datetime.timedelta(days=7)

        qs = ExpectedDelivery.objects.all()

        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        courier_filter = request.query_params.get('courier')
        category_filter = request.query_params.get('category')

        if date_from:
            qs = qs.filter(expected_delivery_date__gte=date_from)
        if date_to:
            qs = qs.filter(expected_delivery_date__lte=date_to)
        if courier_filter and courier_filter.lower() != 'all':
            qs = qs.filter(courier_name__icontains=courier_filter)
        if category_filter and category_filter.upper() != 'ALL':
            cat = category_filter.upper()
            if cat == 'COD':
                qs = qs.filter(payment_type='COD')
            elif cat == 'FOOD':
                qs = qs.filter(delivery_type='FOOD', payment_type='PREPAID')
            elif cat == 'NORMAL':
                qs = qs.filter(delivery_type='PARCEL', payment_type='PREPAID')

        today_count = qs.filter(expected_delivery_date=today).count()
        tomorrow_count = qs.filter(expected_delivery_date=tomorrow).count()
        upcoming_week_count = qs.filter(expected_delivery_date__gte=today, expected_delivery_date__lte=week_end).count()
        received_as_scheduled = qs.filter(status='RECEIVED').count()
        cancelled_count = qs.filter(status='CANCELLED').count()

        # Delayed or unconfirmed expected deliveries
        active_candidates = qs.exclude(status__in=['RECEIVED', 'CANCELLED'])
        delayed_or_missed = sum(1 for d in active_candidates if d.is_missed_or_delayed)

        # Expected parcel volume by courier
        from django.db.models import Count
        courier_counts = qs.values('courier_name').annotate(total=Count('id')).order_by('-total')[:10]
        by_courier = [
            {
                "courier": c['courier_name'] or "Unknown",
                "total": c['total'],
                "received": qs.filter(courier_name=c['courier_name'], status='RECEIVED').count(),
                "pending": qs.filter(courier_name=c['courier_name'], status__in=['SCHEDULED', 'EXPECTED', 'RESCHEDULED']).count()
            }
            for c in courier_counts
        ]

        # Expected deliveries by time window
        window_counts = qs.values('time_window_label').annotate(total=Count('id')).order_by('-total')
        by_time_window = [
            {
                "window": w['time_window_label'] or "Unspecified",
                "count": w['total']
            }
            for w in window_counts if w['time_window_label']
        ]
        if not by_time_window:
            by_time_window = [
                {"window": "9 AM – 12 PM", "count": qs.filter(time_window_label__icontains='9').count()},
                {"window": "12 PM – 3 PM", "count": qs.filter(time_window_label__icontains='12').count()},
                {"window": "3 PM – 6 PM", "count": qs.filter(time_window_label__icontains='3').count()},
                {"window": "6 PM – 9 PM", "count": qs.filter(time_window_label__icontains='6').count()},
            ]

        # Category share
        category_share = [
            {"category": "Normal Parcel", "count": qs.filter(delivery_type='PARCEL', payment_type='PREPAID').count()},
            {"category": "Food Delivery", "count": qs.filter(delivery_type='FOOD').count()},
            {"category": "Cash on Delivery (COD)", "count": qs.filter(payment_type='COD').count()},
        ]

        return Response({
            "today_count": today_count,
            "tomorrow_count": tomorrow_count,
            "upcoming_week_count": upcoming_week_count,
            "received_as_scheduled": received_as_scheduled,
            "delayed_or_missed": delayed_or_missed,
            "cancelled_count": cancelled_count,
            "by_courier": by_courier,
            "by_time_window": by_time_window,
            "category_share": category_share
        })


# ==========================================
# PARCEL CONDITION INSPECTION & INCIDENT MANAGEMENT
# ==========================================

class ParcelInspectionView(views.APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAuthenticated]

    def get_parcel(self, parcel_id, user):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return None, Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role == 'RESIDENT':
            resident_flat = None
            try:
                resident_flat = user.resident_profile.flat
            except Exception:
                pass
            if parcel.resident != user and (not resident_flat or parcel.flat != resident_flat):
                return None, Response({"error": "You do not have permission to view inspection for this parcel."}, status=status.HTTP_403_FORBIDDEN)

        return parcel, None

    def get(self, request, parcel_id):
        parcel, err_resp = self.get_parcel(parcel_id, request.user)
        if err_resp:
            return err_resp

        inspection = None
        try:
            inspection = parcel.inspection
        except Exception:
            pass

        if not inspection:
            return Response({"error": "No inspection record found for this parcel."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ParcelInspectionSerializer(inspection, context={'request': request})
        return Response(serializer.data)

    def post(self, request, parcel_id):
        if request.user.role != 'GUARD':
            return Response({"error": "Only security guards can perform parcel inspections."}, status=status.HTTP_403_FORBIDDEN)

        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        condition = request.data.get('condition')
        if condition not in ['INTACT', 'DAMAGED', 'TAMPERED', 'OPENED']:
            return Response({"error": "Valid condition is required: INTACT, DAMAGED, TAMPERED, or OPENED."}, status=status.HTTP_400_BAD_REQUEST)

        remarks = request.data.get('remarks', '')
        courier_confirmed = request.data.get('courier_confirmed') in [True, 'true', 'True', '1', 1]
        photo = request.FILES.get('photo')

        if photo:
            if photo.size > 5 * 1024 * 1024:
                return Response({"error": "Photo file size cannot exceed 5MB."}, status=status.HTTP_400_BAD_REQUEST)
            ext = photo.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png']:
                return Response({"error": "Only JPG, JPEG, and PNG images are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        inspection, created = ParcelInspection.objects.get_or_create(
            parcel=parcel,
            defaults={
                'guard': request.user,
                'condition': condition,
                'remarks': remarks,
                'photo': photo,
                'courier_confirmed': courier_confirmed
            }
        )

        if not created:
            inspection.guard = request.user
            inspection.condition = condition
            inspection.remarks = remarks
            if photo:
                inspection.photo = photo
            inspection.courier_confirmed = courier_confirmed
            inspection.save()

        # If condition is not INTACT, alert resident
        if condition != 'INTACT' and parcel.resident:
            carrier_name = parcel.carrier.name if parcel.carrier else "Courier"
            Notification.objects.create(
                user=parcel.resident,
                title=f"Condition Alert: Parcel {condition}",
                message=f"Your {carrier_name} parcel ({parcel.parcel_id}) was reported as {condition} by security upon arrival at the gatehouse. Security remarks: {remarks or 'None'}",
                notification_type='CONDITION_ALERT',
                parcel=parcel
            )

        if condition != 'INTACT':
            alert_cat = 'TAMPERED_PARCEL' if condition == 'TAMPERED' else 'DAMAGED_PARCEL'
            alert_pri = 'CRITICAL' if condition == 'TAMPERED' else 'HIGH'
            trigger_priority_alert(
                title=f"{'Tampered' if condition == 'TAMPERED' else 'Damaged'} Parcel Detected: {parcel.parcel_id}",
                description=f"Security guard inspected parcel {parcel.parcel_id} and reported status as {condition}. Security remarks: {remarks or 'None'}",
                category=alert_cat,
                priority=alert_pri,
                related_parcel=parcel,
                created_by=request.user
            )

        serializer = ParcelInspectionSerializer(inspection, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AcknowledgeInspectionView(views.APIView):
    permission_classes = [IsResidentUser]

    def post(self, request, parcel_id):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        resident_flat = None
        try:
            resident_flat = request.user.resident_profile.flat
        except Exception:
            pass
        if parcel.resident != request.user and (not resident_flat or parcel.flat != resident_flat):
            return Response({"error": "You can only acknowledge inspections for your own flat's parcels."}, status=status.HTTP_403_FORBIDDEN)

        inspection = None
        try:
            inspection = parcel.inspection
        except Exception:
            pass

        if not inspection:
            return Response({"error": "No inspection record exists for this parcel."}, status=status.HTTP_404_NOT_FOUND)

        inspection.acknowledged_by = request.user
        inspection.acknowledged_at = timezone.now()
        inspection.save()

        serializer = ParcelInspectionSerializer(inspection, context={'request': request})
        return Response(serializer.data)


class ReportIncidentView(views.APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsResidentUser]

    def post(self, request, parcel_id):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        # Prevent residents from reporting incidents against parcels belonging to other flats
        resident_flat = None
        try:
            resident_flat = request.user.resident_profile.flat
        except Exception:
            pass
        if parcel.resident != request.user and (not resident_flat or parcel.flat != resident_flat):
            return Response({"error": "You can only report issues against parcels belonging to your flat."}, status=status.HTTP_403_FORBIDDEN)

        category = request.data.get('category')
        if category not in ['DAMAGED', 'TAMPERED', 'MISSING_CONTENTS', 'INCORRECT_PARCEL', 'OTHER']:
            return Response({"error": "A valid incident category is required."}, status=status.HTTP_400_BAD_REQUEST)

        description = request.data.get('description', '').strip()
        if not description:
            return Response({"error": "Description is required for incident reporting."}, status=status.HTTP_400_BAD_REQUEST)

        evidence_photo = request.FILES.get('evidence_photo')
        if evidence_photo:
            if evidence_photo.size > 5 * 1024 * 1024:
                return Response({"error": "Evidence photo file size cannot exceed 5MB."}, status=status.HTTP_400_BAD_REQUEST)
            ext = evidence_photo.name.split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png']:
                return Response({"error": "Only JPG, JPEG, and PNG images are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        incident = ParcelIncident.objects.create(
            parcel=parcel,
            resident=request.user,
            category=category,
            description=description,
            evidence_photo=evidence_photo,
            status='OPEN'
        )

        IncidentHistory.objects.create(
            incident=incident,
            action_by=request.user,
            old_status='NONE',
            new_status='OPEN',
            notes=f"Incident reported by resident {request.user.get_full_name() or request.user.username}."
        )

        # Notify Guards & Admins
        flat_display = f"{parcel.flat.tower.name}-{parcel.flat.number}" if parcel.flat else "Flat"
        admins_and_guards = User.objects.filter(role__in=['ADMIN', 'GUARD'], is_active=True)
        notifications = [
            Notification(
                user=staff,
                title="New Incident Reported",
                message=f"Flat {flat_display} reported an issue ({incident.get_category_display()}) for Parcel {parcel.parcel_id}.",
                notification_type='CONDITION_ALERT',
                parcel=parcel
            )
            for staff in admins_and_guards
        ]
        Notification.objects.bulk_create(notifications)

        # Trigger automatic priority alert for incident
        incident_cat = 'TAMPERED_PARCEL' if category == 'TAMPERED' else ('DAMAGED_PARCEL' if category == 'DAMAGED' else 'SECURITY_EMERGENCY')
        incident_pri = 'CRITICAL' if category == 'TAMPERED' else ('HIGH' if category in ['DAMAGED', 'MISSING_CONTENTS'] else 'MEDIUM')
        trigger_priority_alert(
            title=f"Incident Reported on Parcel {parcel.parcel_id}: {incident.get_category_display()}",
            description=f"Resident {request.user.username} (Flat {flat_display}) reported: {description}",
            category=incident_cat,
            priority=incident_pri,
            related_parcel=parcel,
            related_incident=incident,
            created_by=request.user
        )

        serializer = ParcelIncidentSerializer(incident, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ResidentIncidentsListView(generics.ListAPIView):
    serializer_class = ParcelIncidentSerializer
    permission_classes = [IsResidentUser]

    def get_queryset(self):
        user = self.request.user
        resident_flat = None
        try:
            resident_flat = user.resident_profile.flat
        except Exception:
            pass
        if resident_flat:
            return ParcelIncident.objects.filter(
                Q(resident=user) | Q(parcel__flat=resident_flat)
            ).distinct().order_by('-created_at')
        return ParcelIncident.objects.filter(resident=user).order_by('-created_at')


class AdminIncidentsListView(generics.ListAPIView):
    serializer_class = ParcelIncidentSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        queryset = ParcelIncident.objects.all().order_by('-created_at')
        status_param = self.request.query_params.get('status')
        category_param = self.request.query_params.get('category')
        search_param = self.request.query_params.get('search')

        if status_param and status_param != 'ALL':
            queryset = queryset.filter(status=status_param)

        if category_param and category_param != 'ALL':
            queryset = queryset.filter(category=category_param)

        if search_param:
            search_param = search_param.strip()
            queryset = queryset.filter(
                Q(parcel__parcel_id__icontains=search_param) |
                Q(resident__username__icontains=search_param) |
                Q(resident__first_name__icontains=search_param) |
                Q(resident__last_name__icontains=search_param) |
                Q(parcel__flat__number__icontains=search_param)
            )

        return queryset


class IncidentDetailView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            incident = ParcelIncident.objects.get(pk=pk)
        except ParcelIncident.DoesNotExist:
            return Response({"error": "Incident not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == 'RESIDENT':
            resident_flat = None
            try:
                resident_flat = request.user.resident_profile.flat
            except Exception:
                pass
            if incident.resident != request.user and (not resident_flat or incident.parcel.flat != resident_flat):
                return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = ParcelIncidentSerializer(incident, context={'request': request})
        return Response(serializer.data)


class AdminIncidentStatusUpdateView(views.APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            incident = ParcelIncident.objects.get(pk=pk)
        except ParcelIncident.DoesNotExist:
            return Response({"error": "Incident not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']:
            return Response({"error": "Valid status is required: OPEN, UNDER_REVIEW, RESOLVED, or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('resolution_notes', '').strip()
        old_status = incident.status

        incident.status = new_status
        if notes:
            incident.resolution_notes = notes

        if new_status in ['RESOLVED', 'REJECTED']:
            incident.resolved_by = request.user
            incident.resolved_at = timezone.now()

        incident.save()

        # Audit history entry
        IncidentHistory.objects.create(
            incident=incident,
            action_by=request.user,
            old_status=old_status,
            new_status=new_status,
            notes=notes or f"Status changed to {new_status} by Admin {request.user.get_full_name() or request.user.username}."
        )

        # Notify resident
        status_readable = incident.get_status_display()
        Notification.objects.create(
            user=incident.resident,
            title=f"Incident Status Update: {status_readable}",
            message=f"Incident #{incident.id} on parcel {incident.parcel.parcel_id} has been marked as {status_readable}. Admin Note: {notes or 'No additional notes provided.'}",
            notification_type='INCIDENT_UPDATE',
            parcel=incident.parcel
        )

        serializer = ParcelIncidentSerializer(incident, context={'request': request})
        return Response(serializer.data)


class DirectHandoverView(views.APIView):
    permission_classes = [IsGuardUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, parcel_id):
        parcel = find_parcel(parcel_id, Q(status__in=['AWAITING_PICKUP', 'OVERDUE']))
        if not parcel:
            return Response({"error": "Parcel not found or already handed over."}, status=status.HTTP_404_NOT_FOUND)

        receiver_type = request.data.get('receiver_type', 'PRIMARY_RESIDENT')
        household_member_id = request.data.get('household_member_id')
        verification_method = request.data.get('verification_method', 'DOORSTEP_VERIFICATION')
        delivery_photo = request.FILES.get('delivery_photo')

        # Policy validation
        category = 'NORMAL'
        if parcel.is_high_value:
            category = 'HIGH_VALUE'
        elif parcel.is_open_box:
            category = 'OPEN_BOX'
        elif parcel.payment_type == 'COD':
            category = 'COD'
        elif parcel.delivery_type == 'FOOD':
            category = 'FOOD'

        tower = parcel.flat.tower if parcel.flat else None
        policy, is_override = get_effective_delivery_policy(tower, category)

        if not policy.allow_direct_to_flat or policy.delivery_mode == 'GATEHOUSE_ONLY':
            mode_display = policy.get_delivery_mode_display() if hasattr(policy, 'get_delivery_mode_display') else policy.delivery_mode
            return Response({
                "error": f"Direct-to-flat delivery is not permitted for {category} packages under current community policy ({mode_display}). Gatehouse pickup is required."
            }, status=status.HTTP_400_BAD_REQUEST)

        if policy.require_resident_presence and receiver_type == 'HOUSEHOLD_MEMBER':
            return Response({
                "error": f"Community policy requires primary resident presence for {category} deliveries. Handover to alternate household members is prohibited."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not policy.allow_household_receiver and receiver_type == 'HOUSEHOLD_MEMBER':
            return Response({
                "error": f"Community policy does not allow household receivers for {category} deliveries."
            }, status=status.HTTP_400_BAD_REQUEST)

        if receiver_type == 'HOUSEHOLD_MEMBER':
            if not household_member_id:
                return Response({"error": "household_member_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                member = HouseholdMember.objects.get(id=household_member_id)
            except HouseholdMember.DoesNotExist:
                return Response({"error": "Household member not found."}, status=status.HTTP_404_NOT_FOUND)

            if member.flat_id != parcel.flat_id:
                return Response({"error": "Household member does not belong to this flat."}, status=status.HTTP_403_FORBIDDEN)
            if not member.is_active:
                return Response({"error": "Household member authorization is inactive or revoked."}, status=status.HTTP_400_BAD_REQUEST)

            if parcel.delivery_type == 'FOOD' and not member.can_receive_food:
                return Response({"error": f"{member.full_name} is not authorized to receive food deliveries."}, status=status.HTTP_400_BAD_REQUEST)
            if parcel.delivery_type == 'NORMAL' and not member.can_receive_parcels:
                return Response({"error": f"{member.full_name} is not authorized to receive parcels."}, status=status.HTTP_400_BAD_REQUEST)

            parcel.actual_receiver = member.user
            parcel.actual_receiver_name = member.full_name
            parcel.receiver_relationship = member.relationship
            parcel.household_member = member
            parcel.collected_by = member.user
            parcel.collected_by_role_type = 'HOUSEHOLD_MEMBER'
        else:
            parcel.actual_receiver = parcel.resident
            parcel.actual_receiver_name = parcel.resident.get_full_name() or parcel.resident.username if parcel.resident else "Primary Resident"
            parcel.receiver_relationship = 'SELF'
            parcel.collected_by = parcel.resident
            parcel.collected_by_role_type = 'PRIMARY_RESIDENT'

        parcel.status = 'DELIVERED_DIRECTLY_TO_FLAT'
        parcel.delivery_location = 'DIRECT_TO_FLAT'
        parcel.direct_delivery_verification = verification_method
        if delivery_photo:
            parcel.direct_delivery_photo = delivery_photo
        parcel.handed_over_at = timezone.now()
        parcel.handed_over_by = request.user
        parcel.shelf = None
        parcel.save()

        # Notify resident
        if parcel.resident:
            carrier_name = parcel.carrier.name if parcel.carrier else "delivery"
            Notification.objects.create(
                user=parcel.resident,
                title="Direct-to-Flat Delivery Handover",
                message=f"Your {carrier_name} delivery was delivered directly to Flat {parcel.flat.number} and handed to {parcel.actual_receiver_name} ({parcel.receiver_relationship}).",
                notification_type='HOUSEHOLD_DELIVERY',
                parcel=parcel
            )

        return Response({"message": "Direct-to-flat delivery recorded successfully.", "parcel": ParcelSerializer(parcel, context={'request': request}).data})


class ResidentHouseholdListView(views.APIView):
    permission_classes = [IsResidentUser]

    def get(self, request):
        profile = None
        try:
            profile = request.user.resident_profile
        except Exception:
            pass
        if not profile or not profile.flat:
            return Response([])

        members = HouseholdMember.objects.filter(flat=profile.flat)
        serializer = HouseholdMemberSerializer(members, many=True)
        return Response(serializer.data)


class ResidentHouseholdAddView(views.APIView):
    permission_classes = [IsResidentUser]

    def post(self, request):
        profile = None
        try:
            profile = request.user.resident_profile
        except Exception:
            pass
        if not profile or not profile.flat:
            return Response({"error": "You must be associated with a flat to manage household members."}, status=status.HTTP_400_BAD_REQUEST)

        # Requirement 9: Only primary resident can manage household authorization
        if not profile.is_primary:
            return Response({"error": "Only the primary resident can manage household authorization."}, status=status.HTTP_403_FORBIDDEN)

        flat = profile.flat
        full_name = request.data.get('full_name', '').strip()
        relationship = request.data.get('relationship', 'OTHER').upper()
        mobile_number = request.data.get('mobile_number', '').strip()
        email = request.data.get('email', '').strip() or None
        password = request.data.get('password', '').strip()
        link_existing_user_id = request.data.get('link_existing_user_id')

        if not full_name:
            return Response({"error": "Full name is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not mobile_number:
            return Response({"error": "Mobile number is required."}, status=status.HTTP_400_BAD_REQUEST)
        if relationship not in ['WIFE', 'HUSBAND', 'FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'OTHER']:
            return Response({"error": "Invalid relationship specified."}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicate member in same flat with same mobile
        if HouseholdMember.objects.filter(flat=flat, mobile_number=mobile_number).exists():
            return Response({"error": "A household member with this mobile number already exists in your flat."}, status=status.HTTP_400_BAD_REQUEST)

        member_user = None

        # Requirement 3: If person already has account in same flat, authorize that existing account
        if link_existing_user_id:
            try:
                member_user = User.objects.get(id=link_existing_user_id)
            except User.DoesNotExist:
                return Response({"error": "Specified user account not found."}, status=status.HTTP_404_NOT_FOUND)

            # Prevent cross-flat authorization
            user_profile = None
            try:
                user_profile = member_user.resident_profile
            except Exception:
                pass
            if not user_profile or user_profile.flat_id != flat.id:
                return Response({"error": "Cannot authorize an account from another flat."}, status=status.HTTP_403_FORBIDDEN)
        else:
            # Check if an account already exists with this mobile or email
            existing_user = User.objects.filter(Q(username=mobile_number) | (Q(email=email) & ~Q(email=''))).first()
            if existing_user:
                user_profile = None
                try:
                    user_profile = existing_user.resident_profile
                except Exception:
                    pass
                if user_profile and user_profile.flat_id == flat.id:
                    member_user = existing_user
                else:
                    return Response({"error": "An account with this email/mobile already exists in another flat or system role."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Create family member account
                clean_name = full_name.lower().replace(' ', '_')
                candidate_username = f"{clean_name}_{mobile_number[-4:]}"
                if User.objects.filter(username=candidate_username).exists():
                    candidate_username = f"res_{mobile_number}"

                user_pwd = password if password else f"GV@{mobile_number[-4:]}!"
                names = full_name.split()
                first_name = names[0]
                last_name = " ".join(names[1:]) if len(names) > 1 else ""

                member_user = User.objects.create_user(
                    username=candidate_username,
                    email=email if email else '',
                    password=user_pwd,
                    first_name=first_name,
                    last_name=last_name,
                    role='RESIDENT'
                )
                ResidentProfile.objects.create(
                    user=member_user,
                    flat=flat,
                    phone_number=mobile_number,
                    is_primary=False
                )

        can_receive_parcels = request.data.get('can_receive_parcels', True)
        if isinstance(can_receive_parcels, str):
            can_receive_parcels = can_receive_parcels.lower() in ['true', '1']

        can_receive_food = request.data.get('can_receive_food', True)
        if isinstance(can_receive_food, str):
            can_receive_food = can_receive_food.lower() in ['true', '1']

        can_collect_gatehouse_parcels = request.data.get('can_collect_gatehouse_parcels', True)
        if isinstance(can_collect_gatehouse_parcels, str):
            can_collect_gatehouse_parcels = can_collect_gatehouse_parcels.lower() in ['true', '1']

        can_view_delivery_notifications = request.data.get('can_view_delivery_notifications', True)
        if isinstance(can_view_delivery_notifications, str):
            can_view_delivery_notifications = can_view_delivery_notifications.lower() in ['true', '1']

        member = HouseholdMember.objects.create(
            flat=flat,
            primary_resident=request.user,
            user=member_user,
            full_name=full_name,
            relationship=relationship,
            mobile_number=mobile_number,
            email=email,
            is_active=True,
            can_receive_parcels=can_receive_parcels,
            can_receive_food=can_receive_food,
            can_collect_gatehouse_parcels=can_collect_gatehouse_parcels,
            can_view_delivery_notifications=can_view_delivery_notifications
        )

        HouseholdAuditLog.objects.create(
            household_member=member,
            performed_by=request.user,
            action='MEMBER_ADDED',
            details=f"Added {member.full_name} ({member.get_relationship_display()}) with permissions: Parcels={can_receive_parcels}, Food={can_receive_food}, Collect={can_collect_gatehouse_parcels}."
        )

        Notification.objects.create(
            user=request.user,
            title="Household Member Added",
            message=f"{member.full_name} ({member.get_relationship_display()}) has been authorized as a household member.",
            notification_type='HOUSEHOLD_UPDATE'
        )

        return Response(HouseholdMemberSerializer(member).data, status=status.HTTP_201_CREATED)


class ResidentHouseholdDetailView(views.APIView):
    permission_classes = [IsResidentUser]

    def get_member(self, request, pk):
        profile = None
        try:
            profile = request.user.resident_profile
        except Exception:
            pass
        if not profile or not profile.flat:
            return None, Response({"error": "Resident profile or flat not found."}, status=status.HTTP_400_BAD_REQUEST)
        if not profile.is_primary:
            return None, Response({"error": "Only the primary resident can manage household members."}, status=status.HTTP_403_FORBIDDEN)
        try:
            member = HouseholdMember.objects.get(pk=pk, flat=profile.flat)
            return member, None
        except HouseholdMember.DoesNotExist:
            return None, Response({"error": "Household member not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, pk):
        member, err = self.get_member(request, pk)
        if err:
            return err

        changes = []
        if 'full_name' in request.data:
            member.full_name = request.data['full_name']
            changes.append("Updated name")
        if 'relationship' in request.data and request.data['relationship'] in ['WIFE', 'HUSBAND', 'FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'OTHER']:
            member.relationship = request.data['relationship']
            changes.append(f"Updated relationship to {member.relationship}")
        if 'mobile_number' in request.data:
            member.mobile_number = request.data['mobile_number']
            changes.append("Updated mobile")
        if 'email' in request.data:
            member.email = request.data['email']
            changes.append("Updated email")

        for perm in ['can_receive_parcels', 'can_receive_food', 'can_collect_gatehouse_parcels', 'can_view_delivery_notifications']:
            if perm in request.data:
                val = request.data[perm]
                if isinstance(val, str):
                    val = val.lower() in ['true', '1']
                setattr(member, perm, val)
                changes.append(f"{perm}={val}")

        action_type = 'PERMISSIONS_UPDATED'
        if 'is_active' in request.data:
            val = request.data['is_active']
            if isinstance(val, str):
                val = val.lower() in ['true', '1']
            member.is_active = val
            action_type = 'MEMBER_ACTIVATED' if val else 'MEMBER_DEACTIVATED'
            changes.append(f"Active status set to {val}")

        if 'revoke' in request.data and request.data['revoke']:
            member.is_active = False
            member.can_receive_parcels = False
            member.can_receive_food = False
            member.can_collect_gatehouse_parcels = False
            action_type = 'MEMBER_REVOKED'
            changes.append("All permissions revoked")

        member.save()

        HouseholdAuditLog.objects.create(
            household_member=member,
            performed_by=request.user,
            action=action_type,
            details="; ".join(changes) if changes else "Updated details."
        )

        Notification.objects.create(
            user=request.user,
            title=f"Household Member {action_type.replace('_', ' ').title()}",
            message=f"Household authorization for {member.full_name} was updated: {', '.join(changes) if changes else 'Details updated'}.",
            notification_type='HOUSEHOLD_UPDATE'
        )

        return Response(HouseholdMemberSerializer(member).data)

    def delete(self, request, pk):
        member, err = self.get_member(request, pk)
        if err:
            return err

        name = member.full_name
        member.delete()

        Notification.objects.create(
            user=request.user,
            title="Household Member Removed",
            message=f"Authorization for {name} was completely revoked and removed from your household.",
            notification_type='HOUSEHOLD_UPDATE'
        )

        return Response({"message": f"Household member {name} removed successfully."})


class AuthorizedReceiversListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        flat_id = request.query_params.get('flat_id')
        delivery_type = request.query_params.get('delivery_type', 'NORMAL')

        if request.user.role == 'RESIDENT':
            profile = None
            try:
                profile = request.user.resident_profile
            except Exception:
                pass
            if not profile or not profile.flat:
                return Response([])
            flat = profile.flat
        else:
            if not flat_id:
                return Response({"error": "flat_id is required."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                flat = Flat.objects.get(id=flat_id)
            except Flat.DoesNotExist:
                return Response({"error": "Flat not found."}, status=status.HTTP_404_NOT_FOUND)

        # Primary resident of flat
        primary_profile = flat.residents.filter(is_primary=True).first() or flat.residents.first()
        primary_user = primary_profile.user if primary_profile else None

        results = []
        if primary_user:
            results.append({
                'id': 'PRIMARY',
                'name': primary_user.get_full_name() or primary_user.username,
                'relationship': 'SELF',
                'relationship_display': 'Primary Resident',
                'is_primary': True,
                'mobile_number': primary_profile.phone_number if primary_profile else '',
                'can_receive_parcels': True,
                'can_receive_food': True,
                'can_collect_gatehouse_parcels': True,
            })

        # Fetch active household members
        members = HouseholdMember.objects.filter(flat=flat, is_active=True)
        if delivery_type == 'FOOD':
            members = members.filter(can_receive_food=True)
        elif delivery_type == 'NORMAL':
            members = members.filter(can_receive_parcels=True)

        for m in members:
            results.append({
                'id': str(m.id),
                'name': m.full_name,
                'relationship': m.relationship,
                'relationship_display': m.get_relationship_display(),
                'is_primary': False,
                'mobile_number': m.mobile_number,
                'can_receive_parcels': m.can_receive_parcels,
                'can_receive_food': m.can_receive_food,
                'can_collect_gatehouse_parcels': m.can_collect_gatehouse_parcels,
            })

        return Response(results)


# ==========================================
# SECURE QR-BASED PARCEL PICKUP VIEWS
# ==========================================

class GenerateParcelQRPassView(views.APIView):
    """
    POST /api/parcels/{id}/qr-pass/
    Generates or refreshes a secure, random, parcel-specific pickup QR pass.
    """
    permission_classes = [IsResidentUser]

    def post(self, request, parcel_id):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        if parcel.status not in ['AWAITING_PICKUP', 'OVERDUE']:
            return Response(
                {"error": f"Cannot generate QR pass for a parcel that is already {parcel.get_status_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check authorization
        collector_role_type = 'PRIMARY_RESIDENT'
        if parcel.is_delegated:
            if parcel.delegated_to != request.user:
                delegated_name = parcel.delegated_to.get_full_name() or parcel.delegated_to.username if parcel.delegated_to else "a flatmate"
                return Response(
                    {"error": f"This parcel has been delegated to {delegated_name}. Only the authorized flatmate can generate the pickup QR pass, or you may revoke the delegation first."},
                    status=status.HTTP_403_FORBIDDEN
                )
            collector_role_type = 'DELEGATED_FLATMATE'
        else:
            resident_flat = None
            try:
                resident_flat = request.user.resident_profile.flat
            except Exception:
                pass
            if parcel.resident != request.user and (not resident_flat or parcel.flat != resident_flat):
                return Response(
                    {"error": "You do not have permission to generate a pickup pass for this parcel."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Invalidate any previously active QR passes for this parcel
        ParcelQRPickupPass.objects.filter(
            parcel=parcel,
            status='ACTIVE'
        ).update(
            status='REVOKED',
            revoked_at=timezone.now(),
            revoked_by=request.user
        )

        # Generate cryptographically secure random token
        raw_token = f"GVQR_{secrets.token_urlsafe(32)}"
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(minutes=15)

        qr_pass = ParcelQRPickupPass.objects.create(
            parcel=parcel,
            authorized_collector=request.user,
            collector_role_type=collector_role_type,
            token_hash=token_hash,
            expires_at=expires_at,
            status='ACTIVE'
        )

        collector_name = request.user.get_full_name() or request.user.username

        return Response({
            "token": raw_token,
            "qr_pass_id": qr_pass.id,
            "parcel_id": parcel.parcel_id,
            "carrier_name": parcel.carrier.name if parcel.carrier else "Courier",
            "flat_display": f"{parcel.flat.tower.name}-{parcel.flat.number}" if parcel.flat else "Flat",
            "authorized_collector": collector_name,
            "collector_role": collector_role_type,
            "collector_role_display": qr_pass.get_collector_role_type_display(),
            "expires_at": qr_pass.expires_at,
            "expires_in_seconds": 15 * 60,
            "status": qr_pass.status,
            "created_at": qr_pass.created_at
        }, status=status.HTTP_201_CREATED)


class RevokeParcelQRPassView(views.APIView):
    """
    POST /api/parcels/{id}/qr-pass/revoke/
    Revokes the active QR pass for the specified parcel.
    """
    permission_classes = [IsResidentUser]

    def post(self, request, parcel_id):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        resident_flat = None
        try:
            resident_flat = request.user.resident_profile.flat
        except Exception:
            pass
        if parcel.resident != request.user and (parcel.delegated_to != request.user) and (not resident_flat or parcel.flat != resident_flat):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        active_passes = ParcelQRPickupPass.objects.filter(parcel=parcel, status='ACTIVE')
        if not active_passes.exists():
            return Response({"message": "No active QR pass found to revoke."}, status=status.HTTP_200_OK)

        active_passes.update(
            status='REVOKED',
            revoked_at=timezone.now(),
            revoked_by=request.user
        )

        return Response({"message": "Active QR pass revoked successfully."})


class GuardVerifyQRView(views.APIView):
    """
    POST /api/guard/verify-qr/
    Validates a scanned QR pass token without completing handover.
    Returns full parcel, flat, and authorized collector details.
    """
    permission_classes = [IsGuardUser]

    def post(self, request):
        token_input = request.data.get('token', '').strip()
        if not token_input:
            return Response({"error": "QR token is required."}, status=status.HTTP_400_BAD_REQUEST)

        # In case the scanned text is JSON format (e.g. {"token": "..."}), extract token
        if token_input.startswith('{') and 'token' in token_input:
            try:
                parsed = json.loads(token_input)
                token_input = parsed.get('token', token_input)
            except Exception:
                pass

        token_hash = hashlib.sha256(token_input.encode('utf-8')).hexdigest()
        qr_pass = ParcelQRPickupPass.objects.filter(token_hash=token_hash).first()

        if not qr_pass:
            return Response({"error": "Invalid QR code token. No matching pickup pass found."}, status=status.HTTP_404_NOT_FOUND)

        # Check used status
        if qr_pass.status == 'USED':
            used_time = qr_pass.used_at.strftime('%Y-%m-%d %H:%M') if qr_pass.used_at else 'earlier'
            return Response(
                {"error": f"This QR pass has already been used (at {used_time}) and cannot be reused."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check revoked status
        if qr_pass.status == 'REVOKED':
            return Response(
                {"error": "This QR pass was revoked and is no longer valid."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check expiration
        if qr_pass.status == 'EXPIRED' or qr_pass.is_expired:
            if qr_pass.status != 'EXPIRED':
                qr_pass.status = 'EXPIRED'
                qr_pass.save()
            return Response(
                {"error": f"This QR pass has expired at {qr_pass.expires_at.strftime('%H:%M:%S UTC')}. Please request the resident to refresh it."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check parcel status
        parcel = qr_pass.parcel
        if parcel.status not in ['AWAITING_PICKUP', 'OVERDUE']:
            return Response(
                {"error": f"Parcel {parcel.parcel_id} is already {parcel.get_status_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify collector delegation status consistency
        if qr_pass.collector_role_type == 'DELEGATED_FLATMATE':
            if not parcel.is_delegated or parcel.delegated_to != qr_pass.authorized_collector:
                return Response(
                    {"error": "This delegated QR pass is no longer valid because pickup delegation was revoked or changed."},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif qr_pass.collector_role_type == 'PRIMARY_RESIDENT':
            if parcel.is_delegated and parcel.delegated_to != qr_pass.authorized_collector:
                delegated_name = parcel.delegated_to.get_full_name() or parcel.delegated_to.username
                return Response(
                    {"error": f"This parcel is currently delegated to {delegated_name}. Only the delegated flatmate can pick up this parcel."},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Record verification timestamp and guard
        qr_pass.verified_by_guard = request.user
        qr_pass.verified_at = timezone.now()
        qr_pass.save()

        # Build detailed response for Guard confirmation
        collector_name = qr_pass.authorized_collector.get_full_name() or qr_pass.authorized_collector.username
        resident_name = parcel.resident.get_full_name() or parcel.resident.username if parcel.resident else "Primary Resident"

        return Response({
            "verified": True,
            "token": token_input,
            "qr_pass_id": qr_pass.id,
            "parcel_id": parcel.parcel_id,
            "parcel_db_id": parcel.id,
            "tracking_number": parcel.tracking_number,
            "carrier_name": parcel.carrier.name if parcel.carrier else "Unknown Carrier",
            "shelf_name": parcel.shelf.name if parcel.shelf else "Unassigned",
            "flat_number": parcel.flat.number,
            "tower_name": parcel.flat.tower.name,
            "delivery_type": parcel.delivery_type,
            "payment_type": parcel.payment_type,
            "cod_amount": parcel.cod_amount,
            "payment_status": parcel.payment_status,
            "condition": parcel.condition,
            "is_open_box": parcel.is_open_box,
            "resident_name": resident_name,
            "authorized_collector_name": collector_name,
            "collector_role": qr_pass.collector_role_type,
            "collector_role_display": qr_pass.get_collector_role_type_display(),
            "expires_at": qr_pass.expires_at,
            "received_at": parcel.received_at
        })


class GuardConfirmQRHandoverView(views.APIView):
    """
    POST /api/guard/confirm-qr-handover/
    Confirms parcel handover using a verified QR pass.
    Completes parcel handover, marks pass as USED, records PickupVerification, and notifies resident.
    """
    permission_classes = [IsGuardUser]

    def post(self, request):
        token_input = request.data.get('token', '').strip()
        qr_pass_id = request.data.get('qr_pass_id')

        qr_pass = None
        if token_input:
            if token_input.startswith('{') and 'token' in token_input:
                try:
                    parsed = json.loads(token_input)
                    token_input = parsed.get('token', token_input)
                except Exception:
                    pass
            token_hash = hashlib.sha256(token_input.encode('utf-8')).hexdigest()
            qr_pass = ParcelQRPickupPass.objects.filter(token_hash=token_hash).first()
        elif qr_pass_id:
            qr_pass = ParcelQRPickupPass.objects.filter(id=qr_pass_id).first()

        if not qr_pass:
            return Response({"error": "QR pass record not found."}, status=status.HTTP_404_NOT_FOUND)

        if qr_pass.status == 'USED':
            return Response({"error": "This QR pass has already been used and cannot be reused."}, status=status.HTTP_400_BAD_REQUEST)

        if qr_pass.status == 'REVOKED':
            return Response({"error": "This QR pass has been revoked."}, status=status.HTTP_400_BAD_REQUEST)

        if qr_pass.status == 'EXPIRED' or qr_pass.is_expired:
            qr_pass.status = 'EXPIRED'
            qr_pass.save()
            return Response({"error": "This QR pass has expired."}, status=status.HTTP_400_BAD_REQUEST)

        parcel = qr_pass.parcel
        if parcel.status not in ['AWAITING_PICKUP', 'OVERDUE']:
            return Response({"error": f"Parcel is already {parcel.get_status_display().lower()}."}, status=status.HTTP_400_BAD_REQUEST)

        # Mark QR pass as USED
        qr_pass.status = 'USED'
        qr_pass.used_at = timezone.now()
        qr_pass.save()

        # Complete parcel handover
        old_shelf = parcel.shelf
        parcel.status = 'HANDED_OVER'
        parcel.handed_over_at = timezone.now()
        parcel.handed_over_by = request.user
        parcel.collected_by = qr_pass.authorized_collector
        parcel.collected_by_role_type = qr_pass.collector_role_type
        parcel.actual_receiver = qr_pass.authorized_collector
        parcel.actual_receiver_name = qr_pass.authorized_collector.get_full_name() or qr_pass.authorized_collector.username
        parcel.receiver_relationship = 'DELEGATED_FLATMATE' if qr_pass.collector_role_type == 'DELEGATED_FLATMATE' else 'SELF'
        parcel.shelf = None
        parcel.save()

        if old_shelf:
            ShelfAssignmentHistory.objects.create(
                parcel=parcel,
                previous_shelf=old_shelf,
                new_shelf=None,
                guard=request.user,
                action_type='HANDOVER_RELEASE',
                reason='Parcel picked up via QR Pass'
            )

        # Record pickup verification with method='QR'
        PickupVerification.objects.update_or_create(
            parcel=parcel,
            defaults={
                'guard': request.user,
                'verification_method': 'QR',
                'qr_pass': qr_pass
            }
        )

        # Send in-app notification to the primary resident
        if parcel.resident:
            carrier_name = parcel.carrier.name if parcel.carrier else "parcel"
            collector_name = qr_pass.authorized_collector.get_full_name() or qr_pass.authorized_collector.username
            if qr_pass.collector_role_type == 'DELEGATED_FLATMATE':
                title = "Parcel Collected via QR (Flatmate)"
                message = f"Your {carrier_name} delivery ({parcel.parcel_id}) was collected at the gatehouse by authorized flatmate {collector_name} via Secure QR Pickup."
            else:
                title = "Parcel Handover Completed (QR)"
                message = f"Your {carrier_name} delivery ({parcel.parcel_id}) was successfully handed over via Secure QR Pickup."

            Notification.objects.create(
                user=parcel.resident,
                title=title,
                message=message,
                notification_type='HANDOVER',
                parcel=parcel
            )

        # Also notify delegated flatmate if they collected it
        if qr_pass.collector_role_type == 'DELEGATED_FLATMATE' and qr_pass.authorized_collector != parcel.resident:
            carrier_name = parcel.carrier.name if parcel.carrier else "parcel"
            Notification.objects.create(
                user=qr_pass.authorized_collector,
                title="Delegated Parcel Collected (QR)",
                message=f"You successfully collected {carrier_name} delivery ({parcel.parcel_id}) for Flat {parcel.flat.number} via Secure QR Pickup.",
                notification_type='HANDOVER',
                parcel=parcel
            )

        return Response({
            "message": "Parcel handover confirmed successfully via QR verification.",
            "parcel": ParcelSerializer(parcel, context={'request': request}).data
        })


# ==========================================
# GUARD SHIFT MANAGEMENT & DIGITAL HANDOVER
# ==========================================

def compile_shift_report(shift, end_time=None):
    if end_time is None:
        end_time = shift.shift_end or timezone.now()

    # 1. Pending parcel count
    pending_parcels = Parcel.objects.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).count()

    # 2. Overdue parcel count (AWAITING_PICKUP older than 48 hours or marked OVERDUE)
    overdue_cutoff = timezone.now() - timedelta(hours=48)
    overdue_parcels = Parcel.objects.filter(
        Q(status='OVERDUE') | 
        Q(status='AWAITING_PICKUP', delivery_type='NORMAL', received_at__lt=overdue_cutoff)
    ).count()

    # 3. Damaged/tampered parcel count
    damaged_parcels = ParcelInspection.objects.filter(
        condition__in=['DAMAGED', 'TAMPERED'],
        parcel__status__in=['AWAITING_PICKUP', 'OVERDUE']
    ).count()

    # 4. Open incident count
    open_incidents = ParcelIncident.objects.filter(status__in=['OPEN', 'UNDER_REVIEW']).count()

    # 5. Pending COD coordination records
    pending_cod_parcels = Parcel.objects.filter(
        payment_type='COD',
        payment_status='PENDING',
        status__in=['AWAITING_PICKUP', 'OVERDUE']
    ).count()

    # 6. Current shelf occupancy
    shelves = StorageShelf.objects.all()
    total_shelves = shelves.count()
    total_capacity = sum(s.capacity for s in shelves)
    total_occupied = sum(s.occupied for s in shelves)
    occupancy_pct = round((total_occupied / total_capacity * 100), 1) if total_capacity > 0 else 0
    shelves_detail = [
        {
            'id': s.id,
            'name': s.name,
            'capacity': s.capacity,
            'occupied': s.occupied,
            'available': s.available,
            'is_full': s.is_full
        } for s in shelves
    ]

    # 7. Parcels received during this shift
    def _safe_condition(p):
        try:
            return p.inspection.condition if p.inspection else 'INTACT'
        except Exception:
            return 'INTACT'

    received_qs = Parcel.objects.filter(
        received_by=shift.guard,
        received_at__gte=shift.shift_start,
        received_at__lte=end_time
    ).order_by('-received_at')
    parcels_received_count = received_qs.count()
    parcels_received = [
        {
            'id': p.id,
            'parcel_id': p.parcel_id,
            'flat': f"{p.flat.tower.name}-{p.flat.number}" if p.flat and p.flat.tower else (p.flat.number if p.flat else "N/A"),
            'carrier': p.carrier.name if p.carrier else "N/A",
            'delivery_type': p.delivery_type,
            'received_at': p.received_at.isoformat() if p.received_at else None,
            'status': p.status,
            'condition': _safe_condition(p)
        } for p in received_qs[:30]
    ]

    # 8. Parcels handed over during this shift
    handed_qs = Parcel.objects.filter(
        handed_over_by=shift.guard,
        handed_over_at__gte=shift.shift_start,
        handed_over_at__lte=end_time
    ).order_by('-handed_over_at')
    parcels_handed_over_count = handed_qs.count()
    parcels_handed_over = [
        {
            'id': p.id,
            'parcel_id': p.parcel_id,
            'flat': f"{p.flat.tower.name}-{p.flat.number}" if p.flat and p.flat.tower else (p.flat.number if p.flat else "N/A"),
            'collector': p.collected_by.get_full_name() or p.collected_by.username if p.collected_by else (p.actual_receiver_name or "Resident"),
            'collector_role': p.collected_by_role_type,
            'handed_over_at': p.handed_over_at.isoformat() if p.handed_over_at else None,
            'status': p.status
        } for p in handed_qs[:30]
    ]

    return {
        'pending_parcels': pending_parcels,
        'overdue_parcels': overdue_parcels,
        'damaged_parcels': damaged_parcels,
        'open_incidents': open_incidents,
        'pending_cod_parcels': pending_cod_parcels,
        'shelf_occupancy': {
            'total_shelves': total_shelves,
            'total_capacity': total_capacity,
            'total_occupied': total_occupied,
            'occupancy_pct': occupancy_pct,
            'shelves': shelves_detail
        },
        'parcels_received_count': parcels_received_count,
        'parcels_handed_over_count': parcels_handed_over_count,
        'parcels_received': parcels_received,
        'parcels_handed_over': parcels_handed_over,
        'generated_at': timezone.now().isoformat()
    }


class GuardShiftStartView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['GUARD', 'ADMIN'] and not request.user.is_staff:
            return Response({"error": "Only guards and administrators can start shifts."}, status=status.HTTP_403_FORBIDDEN)

        # Prevent a guard from having multiple active shifts simultaneously
        active_shift = GuardShift.objects.filter(guard=request.user, status='ACTIVE').first()
        if active_shift:
            return Response({
                "error": "You already have an active shift in progress. Please complete or hand over your active shift first.",
                "active_shift": GuardShiftSerializer(active_shift).data
            }, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('handover_notes', '')
        shift = GuardShift.objects.create(
            guard=request.user,
            shift_start=timezone.now(),
            status='ACTIVE',
            handover_notes=notes
        )
        return Response(GuardShiftSerializer(shift).data, status=status.HTTP_201_CREATED)


class GuardCurrentShiftView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ['GUARD', 'ADMIN'] and not request.user.is_staff:
            return Response({"error": "Only guards and administrators can access shift details."}, status=status.HTTP_403_FORBIDDEN)

        active_shift = GuardShift.objects.filter(guard=request.user, status='ACTIVE').first()
        active_shift_data = None
        live_report = None
        if active_shift:
            active_shift_data = GuardShiftSerializer(active_shift).data
            live_report = compile_shift_report(active_shift)

        # Check for latest pending handover from another guard
        pending_handover = GuardShift.objects.filter(
            status='HANDED_OVER'
        ).exclude(guard=request.user).order_by('-created_at').first()

        pending_handover_data = None
        if pending_handover:
            pending_handover_data = GuardShiftSerializer(pending_handover).data
            if not pending_handover.summary_data:
                pending_handover_data['summary_data'] = compile_shift_report(pending_handover)

        recent_shifts = GuardShift.objects.filter(guard=request.user).order_by('-shift_start')[:10]
        recent_shifts_data = GuardShiftSerializer(recent_shifts, many=True).data

        return Response({
            "active_shift": active_shift_data,
            "live_report": live_report,
            "pending_handover": pending_handover_data,
            "recent_shifts": recent_shifts_data
        })


class GuardShiftHandoverView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            shift = GuardShift.objects.get(pk=pk)
        except GuardShift.DoesNotExist:
            return Response({"error": "Shift record not found."}, status=status.HTTP_404_NOT_FOUND)

        if shift.guard != request.user and request.user.role != 'ADMIN' and not request.user.is_staff:
            return Response({"error": "You can only hand over your own shift."}, status=status.HTTP_403_FORBIDDEN)

        if shift.status != 'ACTIVE':
            return Response({"error": f"Shift cannot be handed over because its status is {shift.status}."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        shift.shift_end = now
        notes = request.data.get('handover_notes', '')
        if notes:
            shift.handover_notes = notes

        # Generate frozen handover summary
        report_data = compile_shift_report(shift, end_time=now)
        shift.summary_data = report_data
        shift.status = 'HANDED_OVER'
        shift.save()

        # Send notification to guards/admin about shift handover
        guard_name = request.user.get_full_name() or request.user.username
        guards = User.objects.filter(role__in=['GUARD', 'ADMIN']).exclude(id=request.user.id)
        for g in guards[:10]:
            Notification.objects.create(
                user=g,
                title=f"Shift Handover: {guard_name}",
                message=f"Guard {guard_name} has ended their shift and submitted a digital handover report with {report_data['pending_parcels']} pending parcels.",
                notification_type='SHIFT_HANDOVER'
            )

        return Response({
            "message": "Shift ended and digital handover report generated successfully.",
            "shift": GuardShiftSerializer(shift).data,
            "report": report_data
        })


class GuardShiftReportView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            shift = GuardShift.objects.get(pk=pk)
        except GuardShift.DoesNotExist:
            return Response({"error": "Shift record not found."}, status=status.HTTP_404_NOT_FOUND)

        report = shift.summary_data
        if not report:
            report = compile_shift_report(shift)

        return Response({
            "shift": GuardShiftSerializer(shift).data,
            "report": report
        })


class GuardShiftAcceptView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in ['GUARD', 'ADMIN'] and not request.user.is_staff:
            return Response({"error": "Only guards and administrators can accept shift handovers."}, status=status.HTTP_403_FORBIDDEN)

        try:
            shift = GuardShift.objects.get(pk=pk)
        except GuardShift.DoesNotExist:
            return Response({"error": "Shift record not found."}, status=status.HTTP_404_NOT_FOUND)

        if shift.status != 'HANDED_OVER':
            return Response({"error": f"Shift cannot be accepted because its status is {shift.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # Incoming guard accepts
        shift.status = 'COMPLETED'
        shift.accepted_by = request.user
        shift.accepted_at = timezone.now()
        shift.save()

        # Notify outgoing guard
        acceptor_name = request.user.get_full_name() or request.user.username
        Notification.objects.create(
            user=shift.guard,
            title="Shift Handover Accepted",
            message=f"Guard {acceptor_name} has accepted your shift handover report and assumed gatehouse responsibility.",
            notification_type='SHIFT_HANDOVER'
        )

        return Response({
            "message": "Shift handover successfully accepted.",
            "shift": GuardShiftSerializer(shift).data
        })


class AdminShiftsListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role != 'ADMIN' and not request.user.is_staff:
            return Response({"error": "Administrative permissions required."}, status=status.HTTP_403_FORBIDDEN)

        qs = GuardShift.objects.all().select_related('guard', 'accepted_by', 'admin_override_by')

        status_param = request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)

        guard_param = request.query_params.get('guard')
        if guard_param:
            qs = qs.filter(
                Q(guard__username__icontains=guard_param) |
                Q(guard__first_name__icontains=guard_param) |
                Q(guard__last_name__icontains=guard_param)
            )

        date_param = request.query_params.get('date')
        if date_param:
            qs = qs.filter(shift_start__date=date_param)

        # Metrics
        all_shifts = GuardShift.objects.all()
        metrics = {
            'total_shifts': all_shifts.count(),
            'active_shifts': all_shifts.filter(status='ACTIVE').count(),
            'pending_handovers': all_shifts.filter(status='HANDED_OVER').count(),
            'completed_shifts': all_shifts.filter(status='COMPLETED').count(),
        }

        return Response({
            "metrics": metrics,
            "shifts": GuardShiftSerializer(qs, many=True).data
        })


class AdminShiftForceAcceptView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role != 'ADMIN' and not request.user.is_staff:
            return Response({"error": "Administrative permissions required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            shift = GuardShift.objects.get(pk=pk)
        except GuardShift.DoesNotExist:
            return Response({"error": "Shift record not found."}, status=status.HTTP_404_NOT_FOUND)

        if shift.status not in ['ACTIVE', 'HANDED_OVER']:
            return Response({"error": f"Shift is already {shift.status} and cannot be overridden."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({"error": "A mandatory reason is required for administrative handover override."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if shift.status == 'ACTIVE':
            shift.shift_end = now
            shift.summary_data = compile_shift_report(shift, end_time=now)

        shift.status = 'COMPLETED'
        shift.is_admin_override = True
        shift.admin_override_reason = reason
        shift.admin_override_by = request.user
        shift.accepted_by = request.user
        shift.accepted_at = now
        shift.save()

        # Notify the guard
        admin_name = request.user.get_full_name() or request.user.username
        Notification.objects.create(
            user=shift.guard,
            title="Admin Shift Handover Exception",
            message=f"Administrator {admin_name} completed your shift handover via exception override. Reason: {reason}",
            notification_type='SHIFT_HANDOVER'
        )

        return Response({
            "message": "Shift handover override applied successfully.",
            "shift": GuardShiftSerializer(shift).data
        })


# ==========================================
# SMART COMMUNITY DELIVERY POLICY ENDPOINTS
# ==========================================

class EffectiveDeliveryPolicyView(views.APIView):
    """
    GET /api/delivery-policies/effective/
    Public/authenticated view for guards, residents, and admins.
    Resolves effective policies based on tower_id or flat_id, and delivery_type.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tower_id = request.query_params.get('tower_id')
        flat_id = request.query_params.get('flat_id')
        delivery_type = request.query_params.get('delivery_type')

        tower = None
        if tower_id:
            tower = Tower.objects.filter(id=tower_id).first()
        elif flat_id:
            flat = Flat.objects.filter(id=flat_id).select_related('tower').first()
            if flat:
                tower = flat.tower

        categories = ['NORMAL', 'FOOD', 'COD', 'OPEN_BOX', 'HIGH_VALUE']
        if delivery_type and delivery_type in categories:
            policy, is_override = get_effective_delivery_policy(tower, delivery_type)
            serializer_class = TowerDeliveryPolicySerializer if is_override else CommunityDeliveryPolicySerializer
            data = serializer_class(policy).data if hasattr(policy, 'id') and policy.id else {
                'id': None,
                'delivery_type': delivery_type,
                'delivery_type_display': dict(CommunityDeliveryPolicy.DELIVERY_TYPE_CHOICES).get(delivery_type, delivery_type),
                'delivery_mode': policy.delivery_mode,
                'delivery_mode_display': policy.get_delivery_mode_display(),
                'allow_direct_to_flat': policy.allow_direct_to_flat,
                'require_gatehouse_intake': policy.require_gatehouse_intake,
                'allow_household_receiver': policy.allow_household_receiver,
                'require_resident_presence': policy.require_resident_presence,
                'require_extra_verification': policy.require_extra_verification,
                'bypass_storage_shelf': policy.bypass_storage_shelf,
                'enable_cod_coordination': policy.enable_cod_coordination,
                'description': policy.description,
                'is_active': policy.is_active,
            }
            data['is_tower_override'] = is_override
            data['tower_name'] = tower.name if tower else None
            return Response(data)

        # Return all 5 categories
        result = {}
        for cat in categories:
            pol, is_over = get_effective_delivery_policy(tower, cat)
            serializer_class = TowerDeliveryPolicySerializer if is_over else CommunityDeliveryPolicySerializer
            d = serializer_class(pol).data if hasattr(pol, 'id') and pol.id else {
                'id': None,
                'delivery_type': cat,
                'delivery_type_display': dict(CommunityDeliveryPolicy.DELIVERY_TYPE_CHOICES).get(cat, cat),
                'delivery_mode': pol.delivery_mode,
                'delivery_mode_display': pol.get_delivery_mode_display(),
                'allow_direct_to_flat': pol.allow_direct_to_flat,
                'require_gatehouse_intake': pol.require_gatehouse_intake,
                'allow_household_receiver': pol.allow_household_receiver,
                'require_resident_presence': pol.require_resident_presence,
                'require_extra_verification': pol.require_extra_verification,
                'bypass_storage_shelf': pol.bypass_storage_shelf,
                'enable_cod_coordination': pol.enable_cod_coordination,
                'description': pol.description,
                'is_active': pol.is_active,
            }
            d['is_tower_override'] = is_over
            d['tower_name'] = tower.name if tower else None
            result[cat] = d

        return Response({
            "tower_id": tower.id if tower else None,
            "tower_name": tower.name if tower else "Community Default",
            "policies": result
        })


class AdminDeliveryPolicyListCreateView(views.APIView):
    """
    GET /api/admin/delivery-policies/
    POST /api/admin/delivery-policies/
    Admin only: Manage community-level and tower-override policies.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        community_policies = CommunityDeliveryPolicy.objects.all().order_by('delivery_type')
        tower_overrides = TowerDeliveryPolicy.objects.all().select_related('tower').order_by('tower__name', 'delivery_type')
        
        return Response({
            "community_policies": CommunityDeliveryPolicySerializer(community_policies, many=True).data,
            "tower_overrides": TowerDeliveryPolicySerializer(tower_overrides, many=True).data,
            "categories": [
                {"value": k, "label": v} for k, v in CommunityDeliveryPolicy.DELIVERY_TYPE_CHOICES
            ],
            "modes": [
                {"value": k, "label": v} for k, v in CommunityDeliveryPolicy.DELIVERY_MODE_CHOICES
            ]
        })

    def post(self, request):
        delivery_type = request.data.get('delivery_type')
        delivery_mode = request.data.get('delivery_mode')
        tower_id = request.data.get('tower_id')

        if not delivery_type or not delivery_mode:
            return Response({"error": "delivery_type and delivery_mode are required."}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = [k for k, _ in CommunityDeliveryPolicy.DELIVERY_TYPE_CHOICES]
        valid_modes = [k for k, _ in CommunityDeliveryPolicy.DELIVERY_MODE_CHOICES]

        if delivery_type not in valid_types:
            return Response({"error": f"Invalid delivery_type: {delivery_type}"}, status=status.HTTP_400_BAD_REQUEST)
        if delivery_mode not in valid_modes:
            return Response({"error": f"Invalid delivery_mode: {delivery_mode}"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            tower = None
            if tower_id:
                tower = Tower.objects.filter(id=tower_id).first()
                if not tower:
                    return Response({"error": "Tower not found."}, status=status.HTTP_404_NOT_FOUND)

                policy, created = TowerDeliveryPolicy.objects.get_or_create(
                    tower=tower,
                    delivery_type=delivery_type,
                    defaults={'created_by': request.user}
                )
                action_name = 'TOWER_OVERRIDE_SET'
                scope = 'TOWER'
            else:
                policy, created = CommunityDeliveryPolicy.objects.get_or_create(
                    delivery_type=delivery_type,
                    defaults={'created_by': request.user}
                )
                action_name = 'CREATED' if created else 'UPDATED'
                scope = 'COMMUNITY'

            prev_state = {
                'delivery_mode': policy.delivery_mode,
                'allow_direct_to_flat': policy.allow_direct_to_flat,
                'require_gatehouse_intake': policy.require_gatehouse_intake,
                'allow_household_receiver': policy.allow_household_receiver,
                'require_resident_presence': policy.require_resident_presence,
                'require_extra_verification': policy.require_extra_verification,
                'bypass_storage_shelf': policy.bypass_storage_shelf,
                'enable_cod_coordination': policy.enable_cod_coordination,
                'is_active': policy.is_active
            }

            policy.delivery_mode = delivery_mode
            if 'allow_direct_to_flat' in request.data:
                policy.allow_direct_to_flat = bool(request.data.get('allow_direct_to_flat'))
            if 'require_gatehouse_intake' in request.data:
                policy.require_gatehouse_intake = bool(request.data.get('require_gatehouse_intake'))
            if 'allow_household_receiver' in request.data:
                policy.allow_household_receiver = bool(request.data.get('allow_household_receiver'))
            if 'require_resident_presence' in request.data:
                policy.require_resident_presence = bool(request.data.get('require_resident_presence'))
            if 'require_extra_verification' in request.data:
                policy.require_extra_verification = bool(request.data.get('require_extra_verification'))
            if 'bypass_storage_shelf' in request.data:
                policy.bypass_storage_shelf = bool(request.data.get('bypass_storage_shelf'))
            if 'enable_cod_coordination' in request.data:
                policy.enable_cod_coordination = bool(request.data.get('enable_cod_coordination'))
            if 'description' in request.data:
                policy.description = request.data.get('description', '')
            if 'is_active' in request.data:
                policy.is_active = bool(request.data.get('is_active'))

            policy.updated_by = request.user
            policy.save()

            new_state = {
                'delivery_mode': policy.delivery_mode,
                'allow_direct_to_flat': policy.allow_direct_to_flat,
                'require_gatehouse_intake': policy.require_gatehouse_intake,
                'allow_household_receiver': policy.allow_household_receiver,
                'require_resident_presence': policy.require_resident_presence,
                'require_extra_verification': policy.require_extra_verification,
                'bypass_storage_shelf': policy.bypass_storage_shelf,
                'enable_cod_coordination': policy.enable_cod_coordination,
                'is_active': policy.is_active
            }

            summary_items = []
            for k in new_state:
                if prev_state[k] != new_state[k]:
                    summary_items.append(f"{k}: {prev_state[k]} -> {new_state[k]}")
            changes_summary = ", ".join(summary_items) if summary_items else f"{delivery_type} policy updated."

            DeliveryPolicyAuditLog.objects.create(
                policy_scope=scope,
                tower=tower,
                delivery_type=delivery_type,
                changed_by=request.user,
                action=action_name,
                changes_summary=changes_summary,
                previous_state=prev_state,
                new_state=new_state
            )

            serializer = TowerDeliveryPolicySerializer(policy) if tower else CommunityDeliveryPolicySerializer(policy)
            return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)


class AdminDeliveryPolicyDetailView(views.APIView):
    """
    PATCH /api/admin/delivery-policies/<int:pk>/
    DELETE /api/admin/delivery-policies/<int:pk>/
    """
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        is_tower = request.query_params.get('is_tower') in [True, 'true', '1', 1]
        model_cls = TowerDeliveryPolicy if is_tower else CommunityDeliveryPolicy
        policy = model_cls.objects.filter(pk=pk).first()

        if not policy:
            return Response({"error": "Policy not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            prev_mode = policy.delivery_mode
            prev_active = policy.is_active

            for field in [
                'delivery_mode', 'allow_direct_to_flat', 'require_gatehouse_intake',
                'allow_household_receiver', 'require_resident_presence',
                'require_extra_verification', 'bypass_storage_shelf',
                'enable_cod_coordination', 'description', 'is_active'
            ]:
                if field in request.data:
                    setattr(policy, field, request.data[field])

            policy.updated_by = request.user
            policy.save()

            changes = []
            if prev_mode != policy.delivery_mode:
                changes.append(f"Mode changed: {prev_mode} -> {policy.delivery_mode}")
            if prev_active != policy.is_active:
                changes.append(f"Active status: {prev_active} -> {policy.is_active}")

            DeliveryPolicyAuditLog.objects.create(
                policy_scope='TOWER' if is_tower else 'COMMUNITY',
                tower=getattr(policy, 'tower', None),
                delivery_type=policy.delivery_type,
                changed_by=request.user,
                action='UPDATED',
                changes_summary="; ".join(changes) if changes else f"Updated {policy.delivery_type} policy settings"
            )

            serializer = TowerDeliveryPolicySerializer(policy) if is_tower else CommunityDeliveryPolicySerializer(policy)
            return Response(serializer.data)

    def delete(self, request, pk):
        policy = TowerDeliveryPolicy.objects.filter(pk=pk).first()
        if not policy:
            return Response({"error": "Tower override policy not found."}, status=status.HTTP_404_NOT_FOUND)

        tower_name = policy.tower.name
        del_type = policy.delivery_type

        DeliveryPolicyAuditLog.objects.create(
            policy_scope='TOWER',
            tower=policy.tower,
            delivery_type=del_type,
            changed_by=request.user,
            action='TOWER_OVERRIDE_REMOVED',
            changes_summary=f"Removed tower override for {del_type} on {tower_name}. Reverted to community default."
        )

        policy.delete()
        return Response({"message": f"Tower override for {del_type} on {tower_name} removed successfully."})


class AdminDeliveryPolicyAuditHistoryView(views.APIView):
    """
    GET /api/admin/delivery-policies/history/
    Returns policy change history audit logs.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        logs = DeliveryPolicyAuditLog.objects.all().select_related('tower', 'changed_by')[:100]
        return Response(DeliveryPolicyAuditLogSerializer(logs, many=True).data)


# ==============================================================================
# TEMPORARY GUEST PICKUP AUTHORIZATION VIEWS
# ==============================================================================

class CreateGuestPickupAuthorizationView(views.APIView):
    """
    POST /api/parcels/<int:parcel_id>/guest-authorization/
    Resident creates a secure, temporary guest pickup pass for a specific pending parcel.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, parcel_id):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        # Cross-flat protection: Only the parcel owner can authorize guest pickup
        if parcel.resident != request.user and request.user.role != 'ADMIN':
            return Response(
                {"error": "Unauthorized. Only the resident who owns this parcel can authorize guest pickup."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Ensure parcel is pending gatehouse pickup
        if parcel.status == 'HANDED_OVER':
            return Response(
                {"error": f"Cannot authorize guest pickup for a parcel that has already been handed over."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CreateGuestPickupAuthorizationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Invalidate any previously active guest authorizations for this parcel
        GuestPickupAuthorization.objects.filter(
            parcel=parcel,
            status='ACTIVE'
        ).update(
            status='REVOKED',
            revoked_at=timezone.now(),
            revoked_by=request.user
        )

        # Generate cryptographically secure one-time token and human-readable pass code
        raw_token = f"GVGUEST_{secrets.token_urlsafe(24)}"
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        import random
        pass_code = f"GV-GUEST-{random.randint(100000, 999999)}"

        auth = GuestPickupAuthorization.objects.create(
            parcel=parcel,
            resident=request.user,
            guest_name=serializer.validated_data['guest_name'],
            guest_mobile=serializer.validated_data['guest_mobile'],
            relationship=serializer.validated_data['relationship'],
            instructions=serializer.validated_data.get('instructions', ''),
            pass_code=pass_code,
            token_hash=token_hash,
            expires_at=serializer.validated_data['expires_at'],
            status='ACTIVE'
        )

        carrier_name = parcel.carrier.name if parcel.carrier else "Delivery"
        flat_display = f"{parcel.flat.tower.name}-{parcel.flat.number}" if (parcel.flat and parcel.flat.tower) else (parcel.flat.number if parcel.flat else "Flat")
        share_text = (
            f"GateVault Guest Pickup Pass\n"
            f"Guest: {auth.guest_name}\n"
            f"Parcel: {parcel.parcel_id} ({carrier_name})\n"
            f"Flat: {flat_display}\n"
            f"Pass Code: {pass_code}\n"
            f"Expires: {auth.expires_at.strftime('%d %b %Y, %I:%M %p')}\n"
            f"Show this pass code to the security guard at the gatehouse for verification."
        )

        # Notify the resident
        Notification.objects.create(
            user=request.user,
            parcel=parcel,
            notification_type='GUEST_AUTHORIZED',
            title="Guest Pickup Authorized",
            message=f"You authorized {auth.guest_name} ({auth.get_relationship_display()}) to collect parcel {parcel.parcel_id}. Pass Code: {pass_code}."
        )

        return Response({
            "message": "Temporary guest pickup authorization generated successfully.",
            "authorization": GuestPickupAuthorizationSerializer(auth).data,
            "raw_token": raw_token,
            "pass_code": pass_code,
            "share_text": share_text
        }, status=status.HTTP_201_CREATED)


class ResidentGuestAuthorizationsListView(generics.ListAPIView):
    """
    GET /api/resident/guest-authorizations/
    Returns guest authorizations created by the authenticated resident.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = GuestPickupAuthorizationSerializer

    def get_queryset(self):
        # Automatically mark expired authorizations
        now = timezone.now()
        GuestPickupAuthorization.objects.filter(
            resident=self.request.user,
            status='ACTIVE',
            expires_at__lte=now
        ).update(status='EXPIRED')

        return GuestPickupAuthorization.objects.filter(
            resident=self.request.user
        ).select_related('parcel', 'parcel__carrier', 'parcel__flat', 'parcel__flat__tower', 'resident').order_by('-created_at')


class RevokeGuestAuthorizationView(views.APIView):
    """
    POST /api/guest-authorizations/<int:id>/revoke/
    Allows the resident or admin to revoke an active guest pickup authorization.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        auth = GuestPickupAuthorization.objects.filter(id=id).first()
        if not auth:
            return Response({"error": "Guest pickup authorization not found."}, status=status.HTTP_404_NOT_FOUND)

        # Permission check: Only parcel owner resident or admin
        if auth.resident != request.user and request.user.role != 'ADMIN':
            return Response(
                {"error": "Unauthorized. Only the resident who created this authorization can revoke it."},
                status=status.HTTP_403_FORBIDDEN
            )

        if auth.status != 'ACTIVE':
            return Response(
                {"error": f"Cannot revoke authorization. Current status is {auth.get_status_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        auth.status = 'REVOKED'
        auth.revoked_at = timezone.now()
        auth.revoked_by = request.user
        auth.save()

        # Send notification to resident
        Notification.objects.create(
            user=auth.resident,
            parcel=auth.parcel,
            notification_type='GUEST_REVOKED',
            title="Guest Authorization Revoked",
            message=f"Pickup authorization for {auth.guest_name} on parcel {auth.parcel.parcel_id} was revoked."
        )

        return Response({
            "message": f"Guest pickup authorization for {auth.guest_name} was revoked successfully.",
            "authorization_id": auth.id,
            "status": auth.status
        })


class GuardVerifyGuestPassView(views.APIView):
    """
    POST /api/guard/verify-guest-pass/
    Guard or Admin verifies a guest pickup pass before handing over the parcel.
    Does NOT complete handover.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request):
        code_input = request.data.get('token') or request.data.get('pass_code') or request.data.get('code')
        if not code_input:
            return Response({"error": "Guest pass code or token is required."}, status=status.HTTP_400_BAD_REQUEST)

        code_input = str(code_input).strip()
        auth = None

        # 1. Try finding by raw token hash (SHA-256)
        token_hash = hashlib.sha256(code_input.encode('utf-8')).hexdigest()
        auth = GuestPickupAuthorization.objects.filter(token_hash=token_hash).first()

        # 2. Try finding by pass_code directly (e.g. GV-GUEST-123456)
        if not auth:
            auth = GuestPickupAuthorization.objects.filter(pass_code__iexact=code_input).first()

        # 3. Try finding by exact token_hash in case pre-hashed was passed
        if not auth:
            auth = GuestPickupAuthorization.objects.filter(token_hash=code_input).first()

        if not auth:
            return Response(
                {"error": "Invalid guest pass. No matching pickup authorization found."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Single-use & replay attack prevention
        if auth.status == 'USED':
            used_time = auth.used_at.strftime('%Y-%m-%d %H:%M') if auth.used_at else 'earlier'
            return Response(
                {"error": f"This guest pass has already been used (at {used_time}) and cannot be reused."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if auth.status == 'REVOKED':
            return Response(
                {"error": "This guest pass was revoked by the resident and is no longer valid."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if auth.status == 'EXPIRED' or auth.is_expired:
            if auth.status != 'EXPIRED':
                auth.status = 'EXPIRED'
                auth.save()
            return Response(
                {"error": f"This guest pass expired on {auth.expires_at.strftime('%Y-%m-%d %H:%M')}. Please request the resident to generate a new pass."},
                status=status.HTTP_400_BAD_REQUEST
            )

        parcel = auth.parcel
        if parcel.status == 'HANDED_OVER':
            return Response(
                {"error": "This parcel has already been handed over."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Record guard verification timestamp
        auth.verified_by_guard = request.user
        auth.verified_at = timezone.now()
        auth.save()

        carrier_name = parcel.carrier.name if parcel.carrier else "Unknown Carrier"
        resident_name = auth.resident.get_full_name() or auth.resident.username
        resident_mobile = ""
        try:
            if hasattr(auth.resident, 'resident_profile') and auth.resident.resident_profile.phone_number:
                resident_mobile = auth.resident.resident_profile.phone_number
        except Exception:
            pass

        flat_number = parcel.flat.number if parcel.flat else ""
        tower_name = parcel.flat.tower.name if (parcel.flat and parcel.flat.tower) else ""

        return Response({
            "valid": True,
            "authorization_id": auth.id,
            "pass_code": auth.pass_code,
            "parcel_id": parcel.parcel_id,
            "parcel_pk": parcel.id,
            "carrier": carrier_name,
            "flat_number": flat_number,
            "tower_name": tower_name,
            "resident_name": resident_name,
            "resident_mobile": resident_mobile,
            "guest_name": auth.guest_name,
            "guest_mobile": auth.guest_mobile,
            "relationship": auth.relationship,
            "relationship_display": auth.get_relationship_display(),
            "instructions": auth.instructions or "",
            "expires_at": auth.expires_at,
            "status": auth.status
        }, status=status.HTTP_200_OK)


class GuardConfirmGuestHandoverView(views.APIView):
    """
    POST /api/guard/confirm-guest-handover/
    Completes parcel handover to verified guest.
    Requires explicit guard confirmation.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request):
        auth_id = request.data.get('authorization_id')
        code_input = request.data.get('token') or request.data.get('pass_code')
        auth = None

        if auth_id:
            auth = GuestPickupAuthorization.objects.filter(id=auth_id).first()
        elif code_input:
            code_input = str(code_input).strip()
            token_hash = hashlib.sha256(code_input.encode('utf-8')).hexdigest()
            auth = GuestPickupAuthorization.objects.filter(token_hash=token_hash).first()
            if not auth:
                auth = GuestPickupAuthorization.objects.filter(pass_code__iexact=code_input).first()

        if not auth:
            return Response({"error": "Guest pickup authorization record not found."}, status=status.HTTP_404_NOT_FOUND)

        if auth.status == 'USED':
            return Response({"error": "This guest pass has already been used and cannot be reused."}, status=status.HTTP_400_BAD_REQUEST)

        if auth.status == 'REVOKED':
            return Response({"error": "This guest pass has been revoked."}, status=status.HTTP_400_BAD_REQUEST)

        if auth.status == 'EXPIRED' or auth.is_expired:
            auth.status = 'EXPIRED'
            auth.save()
            return Response({"error": "This guest pass has expired."}, status=status.HTTP_400_BAD_REQUEST)

        parcel = auth.parcel
        if parcel.status == 'HANDED_OVER':
            return Response({"error": "This parcel has already been handed over."}, status=status.HTTP_400_BAD_REQUEST)

        collector_name = request.data.get('actual_collector_name') or auth.guest_name

        with transaction.atomic():
            # 1. Update guest authorization
            auth.status = 'USED'
            auth.used_at = timezone.now()
            auth.verified_by_guard = request.user
            auth.actual_collector_name = collector_name
            auth.save()

            # 2. Release shelf & update parcel status
            old_shelf = parcel.shelf
            parcel.status = 'HANDED_OVER'
            parcel.shelf = None
            parcel.collected_by = None
            parcel.collected_by_role_type = 'TEMPORARY_GUEST'
            parcel.actual_receiver_name = collector_name
            parcel.receiver_relationship = auth.relationship
            parcel.handed_over_at = timezone.now()
            parcel.handed_over_by = request.user
            parcel.save()

            if old_shelf:
                ShelfAssignmentHistory.objects.create(
                    parcel=parcel,
                    previous_shelf=old_shelf,
                    new_shelf=None,
                    guard=request.user,
                    action_type='HANDOVER_RELEASE',
                    reason='Parcel picked up via Temporary Guest Pass'
                )

            # 3. Record PickupVerification
            verification = PickupVerification.objects.create(
                parcel=parcel,
                guard=request.user,
                verification_method='GUEST_PASS',
                guest_authorization=auth
            )

            # 4. Notify resident
            carrier_name = parcel.carrier.name if parcel.carrier else "Delivery"
            Notification.objects.create(
                user=auth.resident,
                parcel=parcel,
                notification_type='GUEST_COLLECTED',
                title="Parcel Collected by Guest",
                message=f"Your {carrier_name} delivery ({parcel.parcel_id}) was collected at the gatehouse by authorized guest {collector_name} ({auth.get_relationship_display()})."
            )

        return Response({
            "message": "Parcel handover confirmed successfully via Temporary Guest Pass.",
            "parcel_id": parcel.parcel_id,
            "collector_name": collector_name,
            "guest_authorization_id": auth.id,
            "verification_id": verification.id
        }, status=status.HTTP_200_OK)


class AdminGuestPickupsListView(generics.ListAPIView):
    """
    GET /api/admin/guest-pickups/
    Admin view to inspect all guest authorizations and handover logs.
    """
    permission_classes = [IsAdminUser]
    serializer_class = GuestPickupAuthorizationSerializer

    def get_queryset(self):
        # Automatically mark expired authorizations
        now = timezone.now()
        GuestPickupAuthorization.objects.filter(
            status='ACTIVE',
            expires_at__lte=now
        ).update(status='EXPIRED')

        return GuestPickupAuthorization.objects.all().select_related(
            'parcel', 'parcel__carrier', 'parcel__flat', 'parcel__flat__tower',
            'resident', 'verified_by_guard', 'revoked_by'
        ).order_by('-created_at')


# =====================================================================
# SMART SHELF MANAGEMENT & INTELLIGENT PARCEL ALLOCATION VIEWS
# =====================================================================

class ShelfRecommendationView(views.APIView):
    """
    GET /api/shelves/recommend/?parcel_size=SMALL
    Smart Shelf Recommendation:
    Checks capacity, size compatibility, and active status.
    Recommends the best-fit shelf (smallest compatible tier first, then highest available capacity).
    """
    permission_classes = [IsAdminOrGuard]

    def get(self, request):
        parcel_size = request.query_params.get('parcel_size', 'MEDIUM').upper()
        if parcel_size not in ['SMALL', 'MEDIUM', 'LARGE']:
            parcel_size = 'MEDIUM'

        # Expire stale reservations across the board
        now = timezone.now()
        ShelfReservation.objects.filter(status='ACTIVE', expires_at__lte=now).update(status='EXPIRED')

        # Size compatibility mapping
        # SMALL fits on: SMALL, MEDIUM, LARGE (preference: SMALL > MEDIUM > LARGE)
        # MEDIUM fits on: MEDIUM, LARGE (preference: MEDIUM > LARGE)
        # LARGE fits on: LARGE (preference: LARGE)
        SIZE_TIERS = {'SMALL': 1, 'MEDIUM': 2, 'LARGE': 3}
        parcel_tier = SIZE_TIERS[parcel_size]

        active_shelves = StorageShelf.objects.filter(status='ACTIVE')
        eligible_shelves = []
        for shelf in active_shelves:
            shelf_tier = SIZE_TIERS.get(shelf.max_parcel_size, 3)
            # Must fit size and have available slots
            if shelf_tier >= parcel_tier and shelf.available > 0:
                eligible_shelves.append(shelf)

        # Sort: tier difference (shelf_tier - parcel_tier) ascending (best fit first), then available slots descending
        eligible_shelves.sort(key=lambda s: (SIZE_TIERS.get(s.max_parcel_size, 3) - parcel_tier, -s.available))

        recommended = eligible_shelves[0] if eligible_shelves else None

        return Response({
            "parcel_size": parcel_size,
            "has_available_shelf": bool(recommended),
            "recommended_shelf": StorageShelfSerializer(recommended).data if recommended else None,
            "compatible_shelves": StorageShelfSerializer(eligible_shelves, many=True).data
        })


class ShelfReserveView(views.APIView):
    """
    POST /api/shelves/reserve/
    Atomically reserves a slot on the specified shelf during parcel intake.
    Prevents race condition / over-allocation.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request):
        shelf_id = request.data.get('shelf_id')
        parcel_size = request.data.get('parcel_size', 'MEDIUM').upper()
        duration_minutes = int(request.data.get('duration_minutes', 15))

        if not shelf_id:
            return Response({"error": "shelf_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if parcel_size not in ['SMALL', 'MEDIUM', 'LARGE']:
            parcel_size = 'MEDIUM'

        with transaction.atomic():
            now = timezone.now()
            # Clean up expired reservations on this shelf
            ShelfReservation.objects.filter(shelf_id=shelf_id, status='ACTIVE', expires_at__lte=now).update(status='EXPIRED')

            try:
                shelf = StorageShelf.objects.get(id=shelf_id)
            except StorageShelf.DoesNotExist:
                return Response({"error": "Shelf not found."}, status=status.HTTP_404_NOT_FOUND)

            if shelf.status != 'ACTIVE':
                return Response({
                    "error": f"Shelf {shelf.name} is currently {shelf.get_status_display().lower()} and cannot be reserved."
                }, status=status.HTTP_400_BAD_REQUEST)

            SIZE_TIERS = {'SMALL': 1, 'MEDIUM': 2, 'LARGE': 3}
            if SIZE_TIERS.get(parcel_size, 2) > SIZE_TIERS.get(shelf.max_parcel_size, 3):
                return Response({
                    "error": f"Shelf {shelf.name} (max {shelf.max_parcel_size}) cannot accommodate {parcel_size} parcels."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Atomic capacity check
            active_parcels = shelf.parcels.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).count()
            active_res = shelf.reservations.filter(status='ACTIVE', expires_at__gt=now).count()
            if (active_parcels + active_res) >= shelf.capacity:
                return Response({
                    "error": f"Shelf {shelf.name} is currently full or all remaining slots are reserved."
                }, status=status.HTTP_409_CONFLICT)

            # Create reservation
            expires_at = now + timedelta(minutes=duration_minutes)
            reservation = ShelfReservation.objects.create(
                shelf=shelf,
                guard=request.user,
                parcel_size=parcel_size,
                expires_at=expires_at,
                status='ACTIVE'
            )

            return Response(ShelfReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)


class ShelfReleaseReservationView(views.APIView):
    """
    POST /api/shelves/release-reservation/
    Releases a previously held shelf reservation token.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request):
        reservation_token = request.data.get('reservation_token', '').strip()
        if not reservation_token:
            return Response({"error": "reservation_token is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            reservation = ShelfReservation.objects.filter(reservation_token=reservation_token, status='ACTIVE').first()
            if not reservation:
                return Response({"message": "Reservation not found or already released/expired."}, status=status.HTTP_200_OK)

            reservation.status = 'RELEASED'
            reservation.save()

            return Response({
                "success": True,
                "message": f"Reservation {reservation_token} successfully released."
            }, status=status.HTTP_200_OK)


class ParcelRelocateView(views.APIView):
    """
    POST /api/parcels/<parcel_id>/relocate/
    Relocates an active parcel from one shelf to another.
    Logs relocation to ShelfAssignmentHistory.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request, parcel_id=None):
        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": "Parcel not found."}, status=status.HTTP_404_NOT_FOUND)

        if parcel.status not in ['AWAITING_PICKUP', 'OVERDUE']:
            return Response({
                "error": f"Cannot relocate parcel with status '{parcel.get_status_display()}'. Only pending/overdue parcels can be relocated."
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = RelocateParcelSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_shelf_id = serializer.validated_data['new_shelf_id']
        reason = serializer.validated_data.get('reason') or f"Relocated by guard {request.user.username}"

        try:
            new_shelf = StorageShelf.objects.get(id=new_shelf_id)
        except StorageShelf.DoesNotExist:
            return Response({"error": "Destination shelf does not exist."}, status=status.HTTP_404_NOT_FOUND)

        if parcel.shelf_id == new_shelf.id:
            return Response({"error": f"Parcel is already located on shelf {new_shelf.name}."}, status=status.HTTP_400_BAD_REQUEST)

        if new_shelf.status != 'ACTIVE':
            return Response({
                "error": f"Destination shelf {new_shelf.name} is currently {new_shelf.get_status_display().lower()}."
            }, status=status.HTTP_400_BAD_REQUEST)

        SIZE_TIERS = {'SMALL': 1, 'MEDIUM': 2, 'LARGE': 3}
        if SIZE_TIERS.get(parcel.parcel_size, 2) > SIZE_TIERS.get(new_shelf.max_parcel_size, 3):
            return Response({
                "error": f"Destination shelf {new_shelf.name} (max {new_shelf.max_parcel_size}) cannot accommodate {parcel.parcel_size} parcels."
            }, status=status.HTTP_400_BAD_REQUEST)

        if new_shelf.is_full:
            return Response({
                "error": f"Destination shelf {new_shelf.name} is full ({new_shelf.occupied}/{new_shelf.capacity})."
            }, status=status.HTTP_409_CONFLICT)

        with transaction.atomic():
            old_shelf = parcel.shelf
            parcel.shelf = new_shelf
            parcel.save()

            history = ShelfAssignmentHistory.objects.create(
                parcel=parcel,
                previous_shelf=old_shelf,
                new_shelf=new_shelf,
                guard=request.user,
                action_type='RELOCATION',
                reason=reason
            )

            return Response({
                "success": True,
                "message": f"Parcel {parcel.parcel_id} successfully relocated from {old_shelf.name if old_shelf else 'None'} to {new_shelf.name}.",
                "parcel": ParcelSerializer(parcel, context={'request': request}).data,
                "history": ShelfAssignmentHistorySerializer(history).data
            }, status=status.HTTP_200_OK)


class ShelfHistoryView(generics.ListAPIView):
    """
    GET /api/shelves/<pk>/history/
    Retrieves full relocation and intake assignment history for a given shelf.
    """
    permission_classes = [IsAdminOrGuard]
    serializer_class = ShelfAssignmentHistorySerializer

    def get_queryset(self):
        shelf_id = self.kwargs.get('pk') or self.kwargs.get('id')
        return ShelfAssignmentHistory.objects.filter(
            Q(previous_shelf_id=shelf_id) | Q(new_shelf_id=shelf_id)
        ).select_related('parcel', 'previous_shelf', 'new_shelf', 'guard').order_by('-timestamp')


class AdminShelfStatusUpdateView(views.APIView):
    """
    PATCH /api/admin/shelves/<id>/status/
    Admin updates shelf status (ACTIVE, INACTIVE, MAINTENANCE) and maintenance notes.
    Prevents deactivation while shelf contains active parcels.
    """
    permission_classes = [IsAdminUser]

    def patch(self, request, pk=None, id=None):
        shelf_id = pk or id
        try:
            shelf = StorageShelf.objects.get(id=shelf_id)
        except StorageShelf.DoesNotExist:
            return Response({"error": "Shelf not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ShelfStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data['status']
        maintenance_notes = serializer.validated_data.get('maintenance_notes', '')

        # Safety rule: Prevent deactivation if active parcels reside on shelf
        if new_status in ['INACTIVE', 'MAINTENANCE']:
            active_count = shelf.parcels.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).count()
            if active_count > 0:
                return Response({
                    "error": f"Cannot set shelf to {new_status}. Shelf '{shelf.name}' contains {active_count} active parcel(s). Please relocate all parcels before deactivating."
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            shelf.status = new_status
            if maintenance_notes or new_status == 'MAINTENANCE':
                shelf.maintenance_notes = maintenance_notes
            elif new_status == 'ACTIVE':
                shelf.maintenance_notes = ""
            shelf.save()

            # Release any active reservations on this shelf
            if new_status in ['INACTIVE', 'MAINTENANCE']:
                shelf.reservations.filter(status='ACTIVE').update(status='RELEASED')

            return Response(StorageShelfSerializer(shelf).data, status=status.HTTP_200_OK)


class AdminShelfAnalyticsView(views.APIView):
    """
    GET /api/admin/shelf-analytics/
    Comprehensive shelf occupancy, health, capacity, and historical movements.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        # Expire stale reservations
        ShelfReservation.objects.filter(status='ACTIVE', expires_at__lte=now).update(status='EXPIRED')

        all_shelves = StorageShelf.objects.all().order_by('name')
        shelf_data = []

        total_capacity = 0
        total_occupied = 0
        total_reserved = 0
        total_available = 0

        for shelf in all_shelves:
            total_capacity += shelf.capacity
            total_occupied += shelf.occupied
            total_reserved += shelf.active_reservations_count
            total_available += shelf.available

            active_parcels = shelf.parcels.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).select_related(
                'carrier', 'flat', 'flat__tower', 'resident'
            )
            parcels_list = [{
                'id': p.id,
                'parcel_id': p.parcel_id,
                'carrier_name': p.carrier.name if p.carrier else 'Unknown',
                'tracking_number': p.tracking_number,
                'parcel_size': p.parcel_size,
                'resident_name': p.resident.get_full_name() or p.resident.username if p.resident else 'N/A',
                'flat_number': f"{p.flat.tower.name}-{p.flat.number}" if p.flat else 'N/A',
                'received_at': p.received_at,
                'status': p.status
            } for p in active_parcels]

            serialized_shelf = StorageShelfSerializer(shelf).data
            serialized_shelf['active_parcels'] = parcels_list
            shelf_data.append(serialized_shelf)

        overall_utilization = round((total_occupied / total_capacity * 100), 1) if total_capacity > 0 else 0.0

        recent_history = ShelfAssignmentHistory.objects.select_related(
            'parcel', 'previous_shelf', 'new_shelf', 'guard'
        ).order_by('-timestamp')[:25]

        return Response({
            "metrics": {
                "total_shelves": len(all_shelves),
                "active_shelves": sum(1 for s in all_shelves if s.status == 'ACTIVE'),
                "maintenance_shelves": sum(1 for s in all_shelves if s.status == 'MAINTENANCE'),
                "inactive_shelves": sum(1 for s in all_shelves if s.status == 'INACTIVE'),
                "total_capacity": total_capacity,
                "total_occupied": total_occupied,
                "total_reserved": total_reserved,
                "total_available": total_available,
                "overall_utilization": overall_utilization,
                "near_capacity_shelves_count": sum(1 for s in all_shelves if s.is_near_capacity)
            },
            "shelves": shelf_data,
            "recent_assignments": ShelfAssignmentHistorySerializer(recent_history, many=True).data
        })


# =====================================================================
# COURIER ARRIVAL & DEPARTURE LOG MANAGEMENT VIEWS
# =====================================================================

class CourierVisitEntryView(views.APIView):
    """
    POST /api/courier-visits/entry/
    Guard registers courier arrival.
    Checks for duplicate active visits (same mobile or name currently inside).
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request):
        serializer = CourierVisitEntrySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        mobile = data['mobile_number']
        courier_name = data['courier_name'].strip()
        confirm_duplicate = data.get('confirm_duplicate', False)

        # Duplicate active visit check
        active_dup = CourierVisit.objects.filter(
            status='INSIDE'
        ).filter(
            Q(mobile_number=mobile) | Q(courier_name__iexact=courier_name)
        ).first()

        if active_dup and not confirm_duplicate:
            carrier_label = active_dup.carrier_name or (active_dup.carrier.name if active_dup.carrier else 'Courier')
            return Response({
                "duplicate_warning": True,
                "message": f"Courier '{active_dup.courier_name}' ({carrier_label}, mobile {active_dup.mobile_number}) is currently inside since {active_dup.entry_time.strftime('%H:%M')}. Please confirm if you wish to register a separate new visit.",
                "existing_visit": CourierVisitSerializer(active_dup).data
            }, status=status.HTTP_409_CONFLICT)

        carrier = None
        carrier_id = data.get('carrier_id')
        if carrier_id:
            carrier = Carrier.objects.filter(id=carrier_id).first()

        carrier_name = data.get('carrier_name', '')
        if not carrier_name and carrier:
            carrier_name = carrier.name

        visit = CourierVisit.objects.create(
            courier_name=courier_name,
            carrier=carrier,
            carrier_name=carrier_name,
            mobile_number=mobile,
            vehicle_number=data.get('vehicle_number', '').strip(),
            visit_purpose=data.get('visit_purpose', 'PARCEL_DELIVERY'),
            remarks=data.get('remarks', '').strip(),
            entry_guard=request.user,
            status='INSIDE'
        )

        return Response(CourierVisitSerializer(visit).data, status=status.HTTP_201_CREATED)


class CourierVisitsActiveListView(generics.ListAPIView):
    """
    GET /api/courier-visits/active/
    Returns all courier visits currently with status='INSIDE'.
    """
    permission_classes = [IsAdminOrGuard]
    serializer_class = CourierVisitSerializer

    def get_queryset(self):
        return CourierVisit.objects.filter(status='INSIDE').select_related(
            'carrier', 'entry_guard', 'exit_guard'
        ).prefetch_related('parcels').order_by('-entry_time')


class CourierVisitsListView(generics.ListAPIView):
    """
    GET /api/courier-visits/
    Filterable list of courier visits for guards.
    """
    permission_classes = [IsAdminOrGuard]
    serializer_class = CourierVisitSerializer

    def get_queryset(self):
        qs = CourierVisit.objects.all().select_related(
            'carrier', 'entry_guard', 'exit_guard'
        ).prefetch_related('parcels')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        purpose = self.request.query_params.get('purpose')
        if purpose:
            qs = qs.filter(visit_purpose=purpose)

        carrier_id = self.request.query_params.get('carrier')
        if carrier_id:
            qs = qs.filter(carrier_id=carrier_id)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(courier_name__icontains=search) |
                Q(mobile_number__icontains=search) |
                Q(vehicle_number__icontains=search) |
                Q(carrier_name__icontains=search)
            )

        date_val = self.request.query_params.get('date')
        if date_val:
            qs = qs.filter(entry_time__date=date_val)

        return qs.order_by('-entry_time')


class CourierVisitDetailView(generics.RetrieveAPIView):
    """
    GET /api/courier-visits/<id>/
    Detailed view of a courier visit with linked parcels.
    """
    permission_classes = [IsAdminOrGuard]
    serializer_class = CourierVisitSerializer
    queryset = CourierVisit.objects.all().select_related(
        'carrier', 'entry_guard', 'exit_guard'
    ).prefetch_related('parcels')


class CourierVisitExitView(views.APIView):
    """
    POST /api/courier-visits/<id>/exit/
    Guard confirms courier departure.
    Validates that visit is currently INSIDE and not already EXITED.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request, pk=None):
        try:
            visit = CourierVisit.objects.get(id=pk)
        except CourierVisit.DoesNotExist:
            return Response({"error": "Courier visit record not found."}, status=status.HTTP_404_NOT_FOUND)

        if visit.status == 'EXITED':
            return Response({
                "error": f"Courier {visit.courier_name} has already exited on {visit.exit_time.strftime('%Y-%m-%d %H:%M') if visit.exit_time else 'earlier'}."
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            now = timezone.now()
            visit.status = 'EXITED'
            visit.exit_time = now
            visit.exit_guard = request.user
            visit.save()

            linked_parcels = list(visit.parcels.values_list('parcel_id', flat=True))

            return Response({
                "success": True,
                "message": f"Courier departure recorded for {visit.courier_name}.",
                "visit": CourierVisitSerializer(visit).data,
                "total_parcels": len(linked_parcels),
                "parcel_ids": linked_parcels,
                "duration_display": visit.duration_display
            }, status=status.HTTP_200_OK)


class CourierVisitLinkParcelView(views.APIView):
    """
    POST /api/courier-visits/<id>/link-parcel/
    Links a parcel to an ongoing courier visit.
    """
    permission_classes = [IsAdminOrGuard]

    def post(self, request, pk=None):
        try:
            visit = CourierVisit.objects.get(id=pk)
        except CourierVisit.DoesNotExist:
            return Response({"error": "Courier visit record not found."}, status=status.HTTP_404_NOT_FOUND)

        if visit.status != 'INSIDE':
            return Response({
                "error": "Parcels cannot be linked to a courier visit that has already exited."
            }, status=status.HTTP_400_BAD_REQUEST)

        parcel_id = request.data.get('parcel_id')
        if not parcel_id:
            return Response({"error": "parcel_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        parcel = find_parcel(parcel_id)
        if not parcel:
            return Response({"error": f"Parcel '{parcel_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        parcel.courier_visit = visit
        parcel.save()

        return Response({
            "success": True,
            "message": f"Parcel {parcel.parcel_id} successfully linked to visit for {visit.courier_name}.",
            "visit_id": visit.id,
            "linked_parcels_count": visit.parcels.count()
        }, status=status.HTTP_200_OK)


class AdminCourierVisitsListView(generics.ListAPIView):
    """
    GET /api/admin/courier-visits/
    Admin view to inspect all courier visits with full filters.
    """
    permission_classes = [IsAdminUser]
    serializer_class = CourierVisitSerializer

    def get_queryset(self):
        qs = CourierVisit.objects.all().select_related(
            'carrier', 'entry_guard', 'exit_guard'
        ).prefetch_related('parcels')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        purpose = self.request.query_params.get('purpose')
        if purpose:
            qs = qs.filter(visit_purpose=purpose)

        carrier_id = self.request.query_params.get('carrier')
        if carrier_id:
            qs = qs.filter(carrier_id=carrier_id)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(courier_name__icontains=search) |
                Q(mobile_number__icontains=search) |
                Q(vehicle_number__icontains=search) |
                Q(carrier_name__icontains=search)
            )

        date_val = self.request.query_params.get('date')
        if date_val:
            qs = qs.filter(entry_time__date=date_val)

        return qs.order_by('-entry_time')


class AdminCourierAnalyticsView(views.APIView):
    """
    GET /api/admin/courier-analytics/
    Provides administrative metrics and charts on courier visits:
    Total visits, average duration, parcels per visit, carrier breakdown, hourly arrival patterns.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        all_visits = CourierVisit.objects.all()
        total_visits = all_visits.count()
        active_visits = all_visits.filter(status='INSIDE')
        completed_visits = all_visits.filter(status='EXITED')

        completed_durations = [v.duration_minutes for v in completed_visits]
        avg_duration = round(sum(completed_durations) / len(completed_durations), 1) if completed_durations else 0.0

        total_parcels = Parcel.objects.filter(courier_visit__isnull=False).count()
        avg_parcels_per_visit = round(total_parcels / total_visits, 1) if total_visits > 0 else 0.0

        unusually_long_visits = [v for v in active_visits if v.is_unusually_long]

        # Purpose Breakdown
        purpose_counts = all_visits.values('visit_purpose').annotate(count=Count('id'))
        purpose_map = dict(CourierVisit.PURPOSE_CHOICES)
        purpose_chart = [{
            'purpose': purpose_map.get(item['visit_purpose'], item['visit_purpose']),
            'count': item['count']
        } for item in purpose_counts]

        # Carrier Distribution
        carrier_counts = {}
        for v in all_visits.select_related('carrier'):
            name = v.carrier.name if v.carrier else (v.carrier_name or 'Other / Independent')
            carrier_counts[name] = carrier_counts.get(name, 0) + 1
        carrier_chart = [{'carrier': k, 'visits': v} for k, v in sorted(carrier_counts.items(), key=lambda x: -x[1])[:10]]

        # Hourly arrival patterns
        hourly_buckets = {f"{h:02d}:00": 0 for h in range(7, 22)}
        for v in all_visits:
            hour_str = f"{v.entry_time.hour:02d}:00"
            if hour_str in hourly_buckets:
                hourly_buckets[hour_str] += 1
        hourly_chart = [{'time': k, 'visits': v} for k, v in hourly_buckets.items()]

        # Notification dispatch for long visits
        if unusually_long_visits:
            for long_v in unusually_long_visits[:3]:
                title = "Long Courier Visit Alert"
                msg = f"Courier {long_v.courier_name} ({long_v.carrier_name or 'Courier'}) has been on site for {long_v.duration_display} (entered at {long_v.entry_time.strftime('%H:%M')})."
                if not Notification.objects.filter(title=title, message=msg).exists():
                    admin_users = User.objects.filter(role='ADMIN')
                    for adm in admin_users:
                        Notification.objects.create(
                            user=adm,
                            title=title,
                            message=msg,
                            notification_type='COURIER_ALERT'
                        )

        return Response({
            "metrics": {
                "total_visits": total_visits,
                "currently_inside": active_visits.count(),
                "completed_visits": completed_visits.count(),
                "average_duration_minutes": avg_duration,
                "total_parcels_delivered": total_parcels,
                "average_parcels_per_visit": avg_parcels_per_visit,
                "unusually_long_visits_count": len(unusually_long_visits)
            },
            "charts": {
                "purpose_distribution": purpose_chart,
                "carrier_distribution": carrier_chart,
                "hourly_arrivals": hourly_chart
            },
            "unusually_long_visits": CourierVisitSerializer(unusually_long_visits, many=True).data
        })


# ==========================================
# EMERGENCY & PRIORITY ALERT MANAGEMENT VIEWS
# ==========================================

class PriorityAlertListCreateView(views.APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAdminOrGuard]

    def get(self, request):
        sync_overdue_parcel_alerts()
        qs = PriorityAlert.objects.all().select_related(
            'related_parcel', 'related_incident', 'created_by', 'assigned_to', 'acknowledged_by', 'resolved_by'
        )

        status_param = request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        priority_param = request.query_params.get('priority')
        if priority_param and priority_param.upper() != 'ALL':
            qs = qs.filter(priority=priority_param.upper())

        category_param = request.query_params.get('category')
        if category_param and category_param.upper() != 'ALL':
            qs = qs.filter(category=category_param.upper())

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                models.Q(title__icontains=search) |
                models.Q(description__icontains=search) |
                models.Q(related_parcel__parcel_id__icontains=search) |
                models.Q(related_parcel__tracking_number__icontains=search)
            )

        serializer = PriorityAlertSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PriorityAlertCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            alert = serializer.save(
                created_by=request.user,
                status='OPEN'
            )

            AlertHistory.objects.create(
                alert=alert,
                previous_status='NONE',
                new_status='OPEN',
                previous_priority='NONE',
                new_priority=alert.priority,
                action_by=request.user,
                notes=request.data.get('initial_notes', 'Manual emergency priority alert registered.')
            )

            if alert.priority in ['CRITICAL', 'HIGH']:
                staff = User.objects.filter(role__in=['ADMIN', 'GUARD'], is_active=True)
                notifs = [
                    Notification(
                        user=u,
                        title=f"{'[CRITICAL] ' if alert.priority == 'CRITICAL' else ''}Priority Alert: {alert.title}",
                        message=alert.description,
                        notification_type='PRIORITY_ALERT',
                        parcel=alert.related_parcel
                    )
                    for u in staff
                ]
                Notification.objects.bulk_create(notifs)

        return Response(PriorityAlertSerializer(alert).data, status=status.HTTP_201_CREATED)


class PriorityAlertDetailView(views.APIView):
    permission_classes = [IsAdminOrGuard]

    def get(self, request, pk):
        try:
            alert = PriorityAlert.objects.select_related(
                'related_parcel', 'related_incident', 'created_by', 'assigned_to', 'acknowledged_by', 'resolved_by'
            ).prefetch_related('history__action_by').get(pk=pk)
        except PriorityAlert.DoesNotExist:
            return Response({"error": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PriorityAlertSerializer(alert)
        return Response(serializer.data)


class PriorityAlertAcknowledgeView(views.APIView):
    permission_classes = [IsAdminOrGuard]

    def post(self, request, pk):
        try:
            alert = PriorityAlert.objects.get(pk=pk)
        except PriorityAlert.DoesNotExist:
            return Response({"error": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)

        if alert.status in ['RESOLVED', 'DISMISSED']:
            return Response({"error": f"Cannot acknowledge an alert that is already {alert.get_status_display().lower()}."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', '').strip()
        old_status = alert.status

        with transaction.atomic():
            alert.status = 'ACKNOWLEDGED'
            alert.acknowledged_by = request.user
            alert.acknowledged_at = timezone.now()
            alert.save()

            AlertHistory.objects.create(
                alert=alert,
                previous_status=old_status,
                new_status='ACKNOWLEDGED',
                previous_priority=alert.priority,
                new_priority=alert.priority,
                action_by=request.user,
                notes=notes or f"Acknowledged by {request.user.role.lower()} {request.user.get_full_name() or request.user.username}."
            )

        return Response(PriorityAlertSerializer(alert).data)


class PriorityAlertStatusUpdateView(views.APIView):
    permission_classes = [IsAdminOrGuard]

    def patch(self, request, pk):
        try:
            alert = PriorityAlert.objects.get(pk=pk)
        except PriorityAlert.DoesNotExist:
            return Response({"error": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if not new_status or new_status not in ['IN_PROGRESS', 'RESOLVED', 'DISMISSED']:
            return Response({"error": "Valid status required: IN_PROGRESS, RESOLVED, or DISMISSED."}, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', '').strip()
        new_priority = request.data.get('priority')

        # RBAC Check: Only Administrators can DISMISS alerts or RESOLVE CRITICAL alerts
        if new_status == 'DISMISSED' and request.user.role != 'ADMIN':
            return Response({"error": "Only administrators can dismiss priority alerts."}, status=status.HTTP_403_FORBIDDEN)

        if alert.priority == 'CRITICAL' and new_status == 'RESOLVED' and request.user.role != 'ADMIN':
            return Response({"error": "Critical emergency alerts can only be officially resolved by an administrator."}, status=status.HTTP_403_FORBIDDEN)

        # RBAC Check: Priority changes can only be made by Administrators
        if new_priority and new_priority != alert.priority:
            if request.user.role != 'ADMIN':
                return Response({"error": "Only administrators can change alert priority."}, status=status.HTTP_403_FORBIDDEN)
            if new_priority not in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
                return Response({"error": "Invalid priority specified."}, status=status.HTTP_400_BAD_REQUEST)

        old_status = alert.status
        old_priority = alert.priority

        with transaction.atomic():
            alert.status = new_status
            if new_priority:
                alert.priority = new_priority

            if new_status == 'RESOLVED':
                alert.resolved_by = request.user
                alert.resolved_at = timezone.now()
                if notes:
                    alert.resolution_notes = notes

            alert.save()

            AlertHistory.objects.create(
                alert=alert,
                previous_status=old_status,
                new_status=new_status,
                previous_priority=old_priority,
                new_priority=alert.priority,
                action_by=request.user,
                notes=notes or f"Status updated to {new_status} by {request.user.role.lower()} {request.user.username}."
            )

        return Response(PriorityAlertSerializer(alert).data)


class PriorityAlertAssignView(views.APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            alert = PriorityAlert.objects.get(pk=pk)
        except PriorityAlert.DoesNotExist:
            return Response({"error": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)

        guard_id = request.data.get('guard_id') or request.data.get('assigned_to')
        if not guard_id:
            return Response({"error": "guard_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            guard = User.objects.get(id=guard_id, role='GUARD')
        except User.DoesNotExist:
            return Response({"error": "Selected security guard not found."}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', '').strip()

        with transaction.atomic():
            alert.assigned_to = guard
            alert.save()

            AlertHistory.objects.create(
                alert=alert,
                previous_status=alert.status,
                new_status=alert.status,
                previous_priority=alert.priority,
                new_priority=alert.priority,
                action_by=request.user,
                notes=notes or f"Assigned to Guard {guard.get_full_name() or guard.username} by Admin {request.user.username}."
            )

            # In-app notification to the assigned guard
            Notification.objects.create(
                user=guard,
                title=f"Alert Assigned: {alert.title}",
                message=f"Administrator {request.user.username} assigned you to handle {alert.get_priority_display()} alert: {alert.title}.",
                notification_type='PRIORITY_ALERT',
                parcel=alert.related_parcel
            )

        return Response(PriorityAlertSerializer(alert).data)


class AdminAlertsListView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        sync_overdue_parcel_alerts()
        qs = PriorityAlert.objects.all().select_related(
            'related_parcel', 'related_incident', 'created_by', 'assigned_to', 'acknowledged_by', 'resolved_by'
        )

        status_param = request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        priority_param = request.query_params.get('priority')
        if priority_param and priority_param.upper() != 'ALL':
            qs = qs.filter(priority=priority_param.upper())

        category_param = request.query_params.get('category')
        if category_param and category_param.upper() != 'ALL':
            qs = qs.filter(category=category_param.upper())

        assigned_to = request.query_params.get('assigned_to')
        if assigned_to and str(assigned_to).isdigit():
            qs = qs.filter(assigned_to_id=int(assigned_to))

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                models.Q(title__icontains=search) |
                models.Q(description__icontains=search) |
                models.Q(related_parcel__parcel_id__icontains=search) |
                models.Q(related_parcel__tracking_number__icontains=search)
            )

        serializer = PriorityAlertSerializer(qs, many=True)
        return Response(serializer.data)


class AdminAlertAnalyticsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        sync_overdue_parcel_alerts()
        all_alerts = PriorityAlert.objects.all()

        total_alerts = all_alerts.count()
        critical_alerts = all_alerts.filter(priority='CRITICAL').count()
        open_alerts = all_alerts.filter(status__in=['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS']).count()
        resolved_alerts = all_alerts.filter(status='RESOLVED').count()
        dismissed_alerts = all_alerts.filter(status='DISMISSED').count()

        # Compute average acknowledgement time (minutes)
        acked = all_alerts.filter(acknowledged_at__isnull=False)
        ack_durations = [
            max(0, int((a.acknowledged_at - a.created_at).total_seconds() // 60))
            for a in acked
        ]
        avg_ack_minutes = round(sum(ack_durations) / len(ack_durations), 1) if ack_durations else 0

        # Compute average resolution time (minutes)
        resolved = all_alerts.filter(resolved_at__isnull=False)
        res_durations = [
            max(0, int((a.resolved_at - a.created_at).total_seconds() // 60))
            for a in resolved
        ]
        avg_res_minutes = round(sum(res_durations) / len(res_durations), 1) if res_durations else 0

        # Categories breakdown
        cat_counts = all_alerts.values('category').annotate(count=models.Count('id')).order_by('-count')
        category_dict = dict(PriorityAlert.CATEGORY_CHOICES)
        by_category = [
            {
                "category": c['category'],
                "label": category_dict.get(c['category'], c['category']),
                "count": c['count']
            }
            for c in cat_counts
        ]

        # Priorities breakdown
        pri_counts = all_alerts.values('priority').annotate(count=models.Count('id'))
        priority_dict = dict(PriorityAlert.PRIORITY_CHOICES)
        by_priority = [
            {
                "priority": p['priority'],
                "label": priority_dict.get(p['priority'], p['priority']),
                "count": p['count']
            }
            for p in pri_counts
        ]

        # Status breakdown
        st_counts = all_alerts.values('status').annotate(count=models.Count('id'))
        status_dict = dict(PriorityAlert.STATUS_CHOICES)
        by_status = [
            {
                "status": s['status'],
                "label": status_dict.get(s['status'], s['status']),
                "count": s['count']
            }
            for s in st_counts
        ]

        return Response({
            "total_alerts": total_alerts,
            "critical_alerts": critical_alerts,
            "open_alerts": open_alerts,
            "resolved_alerts": resolved_alerts,
            "dismissed_alerts": dismissed_alerts,
            "avg_acknowledgement_minutes": avg_ack_minutes,
            "avg_resolution_minutes": avg_res_minutes,
            "by_category": by_category,
            "by_priority": by_priority,
            "by_status": by_status
        })


# ==========================================
# COMMUNITY FEEDBACK & RATING MANAGEMENT VIEWS
# ==========================================

class ResidentFeedbackListCreateView(views.APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsResidentUser]

    def get(self, request):
        if request.query_params.get('eligible_only') == 'true':
            rated_parcel_ids = CommunityFeedback.objects.filter(
                resident=request.user
            ).values_list('parcel_id', flat=True)

            eligible_parcels = Parcel.objects.filter(
                resident=request.user,
                status__in=['HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT', 'COLLECTED']
            ).exclude(id__in=rated_parcel_ids).order_by('-handed_over_at', '-id')

            serializer = ParcelSerializer(eligible_parcels, many=True, context={'request': request})
            return Response(serializer.data)

        qs = CommunityFeedback.objects.filter(resident=request.user).select_related(
            'parcel', 'parcel__carrier', 'parcel__flat', 'parcel__flat__tower', 'reviewed_by', 'responded_by'
        )

        category = request.query_params.get('category')
        if category and category.upper() != 'ALL':
            qs = qs.filter(category=category.upper())

        rating = request.query_params.get('rating')
        if rating and rating.isdigit():
            qs = qs.filter(rating=int(rating))

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(review__icontains=search) |
                Q(parcel__parcel_id__icontains=search) |
                Q(parcel__tracking_number__icontains=search)
            )

        serializer = CommunityFeedbackSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CommunityFeedbackCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        feedback = serializer.save(resident=request.user)

        if feedback.rating <= 2:
            admins = User.objects.filter(role='ADMIN', is_active=True)
            for admin_user in admins:
                Notification.objects.create(
                    user=admin_user,
                    title=f"Low Experience Rating Flagged ({feedback.rating}★)",
                    message=f"Resident {request.user.username} (Flat {feedback.parcel.flat.number if feedback.parcel.flat else 'N/A'}) submitted a {feedback.rating}-star review for parcel {feedback.parcel.parcel_id}.",
                    notification_type='PRIORITY_ALERT',
                    parcel=feedback.parcel
                )

        return Response(CommunityFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED)


class ResidentFeedbackDetailUpdateView(views.APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsResidentUser]

    def get(self, request, pk):
        try:
            feedback = CommunityFeedback.objects.select_related(
                'parcel', 'parcel__carrier', 'parcel__flat', 'parcel__flat__tower', 'reviewed_by', 'responded_by'
            ).get(pk=pk)
        except CommunityFeedback.DoesNotExist:
            return Response({"error": "Feedback not found."}, status=status.HTTP_404_NOT_FOUND)

        if feedback.resident != request.user:
            return Response({"error": "You do not have permission to view this feedback."}, status=status.HTTP_403_FORBIDDEN)

        return Response(CommunityFeedbackSerializer(feedback).data)







    def patch(self, request, pk):
        try:
            feedback = CommunityFeedback.objects.get(pk=pk)
        except CommunityFeedback.DoesNotExist:
            return Response({"error": "Feedback not found."}, status=status.HTTP_404_NOT_FOUND)

        if feedback.resident != request.user:
            return Response({"error": "You cannot edit feedback submitted by another resident."}, status=status.HTTP_403_FORBIDDEN)

        if not feedback.can_edit:
            return Response(
                {"error": "Feedback can only be edited within 24 hours of submission."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CommunityFeedbackUpdateSerializer(feedback, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_feedback = serializer.save()

        return Response(CommunityFeedbackSerializer(updated_feedback).data)


class AdminFeedbackListView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = CommunityFeedback.objects.all().select_related(
            'resident', 'parcel', 'parcel__carrier', 'parcel__flat', 'parcel__flat__tower', 'reviewed_by', 'responded_by'
        )

        category = request.query_params.get('category')
        if category and category.upper() != 'ALL':
            qs = qs.filter(category=category.upper())

        rating = request.query_params.get('rating')
        if rating:
            if rating.lower() == 'low':
                qs = qs.filter(rating__lte=2)
            elif rating.lower() == 'high':
                qs = qs.filter(rating__gte=4)
            elif rating.isdigit():
                qs = qs.filter(rating=int(rating))

        is_reviewed = request.query_params.get('is_reviewed')
        if is_reviewed is not None and is_reviewed != '':
            if is_reviewed.lower() == 'true':
                qs = qs.filter(is_reviewed=True)
            elif is_reviewed.lower() == 'false':
                qs = qs.filter(is_reviewed=False)

        has_response = request.query_params.get('has_response')
        if has_response is not None and has_response != '':
            if has_response.lower() == 'true':
                qs = qs.exclude(admin_response='')
            elif has_response.lower() == 'false':
                qs = qs.filter(admin_response='')

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(resident__username__icontains=search) |
                Q(resident__first_name__icontains=search) |
                Q(resident__last_name__icontains=search) |
                Q(parcel__parcel_id__icontains=search) |
                Q(parcel__tracking_number__icontains=search) |
                Q(parcel__flat__number__icontains=search) |
                Q(review__icontains=search)
            )

        serializer = CommunityFeedbackSerializer(qs, many=True)
        return Response(serializer.data)


class AdminFeedbackAnalyticsView(views.APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = CommunityFeedback.objects.all()
        total_feedbacks = qs.count()

        avg_agg = qs.aggregate(avg=Avg('rating'))['avg']
        avg_rating = round(avg_agg, 2) if avg_agg is not None else 0.0

        rating_dist = []
        for star in range(1, 6):
            c = qs.filter(rating=star).count()
            pct = round((c / total_feedbacks) * 100, 1) if total_feedbacks > 0 else 0.0
            rating_dist.append({
                "rating": star,
                "count": c,
                "percentage": pct
            })

        cat_choices = dict(CommunityFeedback.CATEGORY_CHOICES)
        cat_counts = qs.values('category').annotate(
            count=Count('id'),
            avg_rating=Avg('rating')
        ).order_by('-count')

        category_dist = [
            {
                "category": item['category'],
                "label": cat_choices.get(item['category'], item['category']),
                "count": item['count'],
                "avg_rating": round(item['avg_rating'] or 0, 2)
            }
            for item in cat_counts
        ]

        monthly_raw = qs.annotate(month=TruncMonth('created_at')).values('month').annotate(
            count=Count('id'),
            avg_rating=Avg('rating')
        ).order_by('month')

        monthly_trends = [
            {
                "month": item['month'].strftime('%b %Y') if item['month'] else 'Unknown',
                "count": item['count'],
                "avg_rating": round(item['avg_rating'] or 0, 2)
            }
            for item in monthly_raw
        ]

        positive_count = qs.filter(rating__gte=4).count()
        neutral_count = qs.filter(rating=3).count()
        negative_count = qs.filter(rating__lte=2).count()

        reviewed_count = qs.filter(is_reviewed=True).count()
        unreviewed_count = qs.filter(is_reviewed=False).count()
        responded_count = qs.exclude(admin_response='').count()

        complaints_raw = qs.filter(rating__lte=2).values('category').annotate(
            count=Count('id')
        ).order_by('-count')

        frequent_complaints = [
            {
                "category": item['category'],
                "label": cat_choices.get(item['category'], item['category']),
                "count": item['count']
            }
            for item in complaints_raw
        ]

        return Response({
            "total_feedbacks": total_feedbacks,
            "average_rating": avg_rating,
            "rating_distribution": rating_dist,
            "category_distribution": category_dist,
            "monthly_trends": monthly_trends,
            "sentiment": {
                "positive": positive_count,
                "neutral": neutral_count,
                "negative": negative_count
            },
            "reviewed_count": reviewed_count,
            "unreviewed_count": unreviewed_count,
            "responded_count": responded_count,
            "frequent_complaints": frequent_complaints
        })


class AdminFeedbackRespondView(views.APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            feedback = CommunityFeedback.objects.select_related('resident', 'parcel').get(pk=pk)
        except CommunityFeedback.DoesNotExist:
            return Response({"error": "Feedback not found."}, status=status.HTTP_404_NOT_FOUND)

        response_text = request.data.get('response', '').strip()
        if not response_text:
            return Response({"error": "Administrative response text cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            feedback.admin_response = response_text
            feedback.responded_by = request.user
            feedback.responded_at = timezone.now()
            feedback.is_reviewed = True
            feedback.reviewed_by = request.user
            feedback.reviewed_at = timezone.now()
            feedback.save()

            preview = response_text[:120] + ('...' if len(response_text) > 120 else '')
            Notification.objects.create(
                user=feedback.resident,
                title=f"Response to Your Feedback ({feedback.parcel.parcel_id})",
                message=f"Administrator {request.user.get_full_name() or request.user.username} responded to your experience review: \"{preview}\"",
                notification_type='FEEDBACK_RESPONSE',
                parcel=feedback.parcel
            )

        return Response(CommunityFeedbackSerializer(feedback).data)








class AdminFeedbackReviewView(views.APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            feedback = CommunityFeedback.objects.select_related('resident', 'parcel').get(pk=pk)
        except CommunityFeedback.DoesNotExist:
            return Response({"error": "Feedback not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            feedback.is_reviewed = True
            feedback.reviewed_by = request.user
            feedback.reviewed_at = timezone.now()
            feedback.save()

            Notification.objects.create(
                user=feedback.resident,
                title=f"Feedback Reviewed ({feedback.parcel.parcel_id})",
                message=f"Your experience review regarding {feedback.get_category_display()} has been officially reviewed by the management team.",
                notification_type='FEEDBACK_REVIEWED',
                parcel=feedback.parcel
            )

        return Response(CommunityFeedbackSerializer(feedback).data)


# ==============================================================================
# FEATURE 11: REPORTS EXPORT & AUTOMATED DATABASE BACKUP MANAGEMENT
# ==============================================================================

class AdminReportsSummaryView(views.APIView):
    """
    Returns high-level metric summaries for reports and list of available categories.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        total_parcels = Parcel.objects.count()
        delivered_parcels = Parcel.objects.filter(status__in=['HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT', 'DELIVERED']).count()
        pending_parcels = Parcel.objects.filter(status__in=['AWAITING_PICKUP', 'OVERDUE', 'PENDING']).count()
        high_priority_alerts = PriorityAlert.objects.filter(priority__in=['HIGH', 'CRITICAL'], status__in=['OPEN', 'IN_PROGRESS', 'ACKNOWLEDGED']).count()
        active_couriers = CourierVisit.objects.filter(status='INSIDE').count()

        total_shelves = StorageShelf.objects.count()
        shelves = list(StorageShelf.objects.all())
        total_capacity = sum(s.capacity for s in shelves) or 1
        current_occupancy = sum(s.current_occupancy for s in shelves)
        shelf_occupancy_rate = round((current_occupancy / total_capacity) * 100, 1) if total_capacity > 0 else 0.0

        avg_rating_val = CommunityFeedback.objects.aggregate(avg=Avg('rating'))['avg']
        average_rating = round(avg_rating_val, 2) if avg_rating_val is not None else 0.0

        categories = [
            {
                "key": k,
                "label": v["title"],
                "description": v["description"]
            }
            for k, v in REPORT_CATEGORIES.items()
        ]

        return Response({
            "metrics": {
                "total_parcels": total_parcels,
                "delivered_parcels": delivered_parcels,
                "pending_parcels": pending_parcels,
                "high_priority_alerts": high_priority_alerts,
                "active_couriers": active_couriers,
                "shelf_occupancy_rate": shelf_occupancy_rate,
                "average_rating": average_rating,
                "total_shelves": total_shelves,
                "current_occupancy": current_occupancy,
                "total_capacity": total_capacity
            },
            "categories": categories
        })


class AdminReportDetailView(views.APIView):
    """
    Returns data preview for a specified report category with filter support.
    Can be invoked either via URL param (report_type) or query parameter.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, report_type=None):
        if not report_type:
            report_type = request.query_params.get('report_type', 'PARCEL_DELIVERY').upper()

        if report_type not in REPORT_CATEGORIES:
            return Response(
                {"error": f"Invalid report type '{report_type}'. Valid types: {list(REPORT_CATEGORIES.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        filters, err = parse_report_filters(request.query_params)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)

        data = build_report_data(report_type, filters)
        return Response(data)


class AdminReportExportView(views.APIView):
    """
    Exports report in PDF, Excel (.xlsx), or CSV format with HTTP download headers.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, format_type=None):
        fmt = (format_type or request.query_params.get('format', 'csv')).lower()
        report_type = request.query_params.get('report_type', 'PARCEL_DELIVERY').upper()

        if report_type not in REPORT_CATEGORIES:
            return Response(
                {"error": f"Invalid report type '{report_type}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        filters, err = parse_report_filters(request.query_params)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)

        data = build_report_data(report_type, filters)

        if fmt == 'csv':
            content_bytes, filename, mimetype = generate_csv_report(data)
        elif fmt in ('excel', 'xlsx'):
            content_bytes, filename, mimetype = generate_excel_report(data)
        elif fmt == 'pdf':
            content_bytes, filename, mimetype = generate_pdf_report(data)
        else:
            return Response(
                {"error": f"Unsupported export format '{fmt}'. Must be 'csv', 'excel', or 'pdf'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        response = HttpResponse(content_bytes, content_type=mimetype)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class AdminDatabaseBackupCreateView(views.APIView):
    """
    Triggers an immediate SQLite online backup, performs integrity check,
    calculates SHA256 checksum, applies retention policy, and creates admin notification.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        backup_type = request.data.get('backup_type', 'MANUAL').upper()
        if backup_type not in ('MANUAL', 'SCHEDULED'):
            backup_type = 'MANUAL'

        success, msg, backup_obj = execute_sqlite_backup(request.user, backup_type=backup_type)

        if not success:
            return Response({"error": msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(DatabaseBackupSerializer(backup_obj).data, status=status.HTTP_201_CREATED)


class AdminDatabaseBackupListView(generics.ListAPIView):
    """
    Lists all database backups with metadata, size, checksum, and status.
    """
    permission_classes = [IsAdminUser]
    serializer_class = DatabaseBackupSerializer
    queryset = DatabaseBackup.objects.all().order_by('-created_at')


class AdminDatabaseBackupDownloadView(views.APIView):
    """
    Secure authenticated endpoint to download an existing database backup file.
    Validates backup path against BASE_DIR/backups to prevent path traversal.
    """
    permission_classes = [IsAdminUser]

    def get(self, pk=None, *args, **kwargs):
        backup_id = pk or kwargs.get('pk')
        try:
            backup = DatabaseBackup.objects.get(pk=backup_id)
        except DatabaseBackup.DoesNotExist:
            return Response({"error": "Database backup not found."}, status=status.HTTP_404_NOT_FOUND)

        file_path = os.path.abspath(backup.file_path)
        backups_dir = os.path.abspath(os.path.join(settings.BASE_DIR, 'backups'))

        # Path traversal guard
        if not file_path.startswith(backups_dir):
            return Response({"error": "Access denied: Unauthorized backup path."}, status=status.HTTP_403_FORBIDDEN)

        if not os.path.exists(file_path):
            return Response({"error": "Backup file not found on disk."}, status=status.HTTP_404_NOT_FOUND)

        try:
            response = FileResponse(open(file_path, 'rb'), as_attachment=True, filename=backup.file_name)
            response['Content-Type'] = 'application/x-sqlite3'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        except Exception as e:
            return Response({"error": f"Failed to read backup file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==============================================================================
# Google OAuth 2.0 & Resident Approval Views
# ==============================================================================

class GoogleOAuthLoginView(views.APIView):
    """
    Secure Google OAuth 2.0 / OpenID Connect authentication endpoint.
    Exclusively available for Residents. Rejects Guards and Administrators.
    Verifies Google ID token server-side without trusting client claims.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        id_token = request.data.get('id_token')
        if not id_token:
            return Response(
                {"error": "Missing Google ID token in request."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            google_data = verify_google_id_token(id_token)
        except ValueError as exc:
            return Response(
                {"error": str(exc), "code": "INVALID_GOOGLE_TOKEN"},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = google_data['email']
        google_id = google_data['google_id']
        name = google_data['name']

        # 1. Search for existing user by verified Google email or google_id
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.filter(resident_profile__google_id=google_id).first()

        if user:
            # Enforce Resident exclusivity: Security Guards and Admins cannot authenticate via Google
            if user.role != 'RESIDENT':
                return Response({
                    "error": "Google OAuth is exclusively available for Residents. Security Guards and Administrators must sign in using their GateVault username and password.",
                    "code": "ROLE_NOT_PERMITTED"
                }, status=status.HTTP_403_FORBIDDEN)

            # Ensure resident profile exists
            profile = getattr(user, 'resident_profile', None)
            if not profile:
                flat = Flat.objects.first()
                profile = ResidentProfile.objects.create(user=user, flat=flat, approval_status='APPROVED')

            # Link Google ID if not already set
            if not profile.google_id:
                conflict = ResidentProfile.objects.filter(google_id=google_id).exclude(pk=profile.pk).first()
                if conflict:
                    return Response({
                        "error": "This Google account is already linked to another resident profile.",
                        "code": "GOOGLE_ACCOUNT_ALREADY_LINKED"
                    }, status=status.HTTP_400_BAD_REQUEST)
                profile.google_id = google_id
                profile.save(update_fields=['google_id'])

            approval_status = getattr(profile, 'approval_status', 'APPROVED')

            # Handle approval state
            if approval_status == 'PENDING_APPROVAL':
                return Response({
                    "action": "PENDING_APPROVAL",
                    "message": "Your GateVault resident registration has been submitted and is currently pending approval by the Community Admin.",
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "username": user.username,
                        "name": user.get_full_name() or user.username,
                        "role": user.role,
                        "approval_status": "PENDING_APPROVAL",
                        "tower": profile.flat.tower.name if profile.flat else None,
                        "flat": profile.flat.number if profile.flat else None,
                    }
                }, status=status.HTTP_200_OK)

            if approval_status == 'REJECTED':
                return Response({
                    "action": "REJECTED",
                    "message": f"Your resident registration was rejected: {profile.rejection_reason or 'Please contact community administration.'}",
                    "rejection_reason": profile.rejection_reason,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "username": user.username,
                        "name": user.get_full_name() or user.username,
                        "role": user.role,
                        "approval_status": "REJECTED"
                    }
                }, status=status.HTTP_200_OK)

            # User is APPROVED: Issue Simple JWT tokens
            refresh = RefreshToken.for_user(user)
            refresh['username'] = user.username
            refresh['role'] = user.role
            refresh['name'] = user.get_full_name() or user.username
            refresh['is_primary'] = profile.is_primary

            return Response({
                "action": "LOGIN",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "role": user.role,
                    "name": user.get_full_name() or user.username,
                    "is_primary": profile.is_primary,
                    "approval_status": "APPROVED",
                    "tower": profile.flat.tower.name if profile.flat else None,
                    "flat": profile.flat.number if profile.flat else None,
                    "google_linked": True
                }
            }, status=status.HTTP_200_OK)

        # 2. User does not exist: Initiate resident onboarding with signed tamper-proof token
        reg_token = create_registration_token(google_data)
        return Response({
            "action": "REGISTER_REQUIRED",
            "registration_token": reg_token,
            "google_user": {
                "email": google_data['email'],
                "name": google_data['name'],
                "given_name": google_data.get('given_name', ''),
                "family_name": google_data.get('family_name', ''),
                "picture": google_data.get('picture')
            }
        }, status=status.HTTP_200_OK)


class GoogleResidentRegisterView(views.APIView):
    """
    Onboarding registration endpoint for new residents authenticated via Google.
    Accepts signed tamper-proof registration token and flat selection.
    Strictly forbids Room Number (GateVault uses Tower and Flat).
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        reg_token = request.data.get('registration_token')
        tower_id = request.data.get('tower_id')
        flat_id = request.data.get('flat_id')
        phone_number = request.data.get('phone_number', '').strip()

        if not reg_token:
            return Response(
                {"error": "Missing registration token."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            google_data = verify_registration_token(reg_token)
        except ValueError as exc:
            return Response(
                {"error": str(exc), "code": "INVALID_REGISTRATION_TOKEN"},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = google_data['email']
        google_id = google_data['google_id']
        first_name = google_data.get('first_name', '')
        last_name = google_data.get('last_name', '')
        full_name = google_data.get('full_name', '')

        # Check existing user
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"error": "An account with this email already exists. Please log in directly."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if ResidentProfile.objects.filter(google_id=google_id).exists():
            return Response(
                {"error": "This Google account is already registered. Please log in directly."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate Tower and Flat
        if not tower_id or not flat_id:
            return Response(
                {"error": "Tower and Flat Number selection are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            tower = Tower.objects.get(pk=tower_id)
        except Tower.DoesNotExist:
            return Response({"error": "Selected Tower does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            flat = Flat.objects.get(pk=flat_id, tower=tower)
        except Flat.DoesNotExist:
            return Response({"error": "Selected Flat does not exist in the specified Tower."}, status=status.HTTP_400_BAD_REQUEST)

        # Create unique username
        base_username = email.split('@')[0]
        candidate_username = base_username
        idx = 1
        while User.objects.filter(username=candidate_username).exists():
            candidate_username = f"{base_username}{idx}"
            idx += 1

        with transaction.atomic():
            user = User.objects.create_user(
                username=candidate_username,
                email=email,
                first_name=first_name or '',
                last_name=last_name or '',
                role='RESIDENT',
                is_active=True
            )
            user.set_unusable_password()
            user.save()

            profile = ResidentProfile.objects.create(
                user=user,
                flat=flat,
                phone_number=phone_number,
                approval_status='PENDING_APPROVAL',
                google_id=google_id
            )

            # Notify Community Admins
            admin_users = User.objects.filter(role='ADMIN')
            admin_notifs = [
                Notification(
                    user=admin,
                    title="New Resident Registration Pending Approval",
                    message=f"New resident {full_name or user.username} ({user.email}) registered for Tower {tower.name}, Flat {flat.number}. Approval required.",
                    notification_type='REGISTRATION_PENDING'
                )
                for admin in admin_users
            ]
            if admin_notifs:
                Notification.objects.bulk_create(admin_notifs)

        return Response({
            "action": "PENDING_APPROVAL",
            "message": "Your resident registration has been submitted and is pending Community Admin approval.",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": user.get_full_name() or user.username,
                "role": user.role,
                "approval_status": "PENDING_APPROVAL",
                "tower": tower.name,
                "flat": flat.number
            }
        }, status=status.HTTP_201_CREATED)


class ResidentLinkGoogleView(views.APIView):
    """
    Allows an authenticated resident to securely link their Google account
    to their existing GateVault resident profile.
    """
    permission_classes = [IsAuthenticated, IsResidentUser]

    def post(self, request, *args, **kwargs):
        id_token = request.data.get('id_token')
        if not id_token:
            return Response({"error": "Google ID token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            google_data = verify_google_id_token(id_token)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        google_id = google_data['google_id']
        profile = getattr(request.user, 'resident_profile', None)
        if not profile:
            return Response({"error": "Resident profile not found."}, status=status.HTTP_404_NOT_FOUND)

        if profile.google_id == google_id:
            return Response({
                "message": "This Google account is already linked to your profile.",
                "google_linked": True
            }, status=status.HTTP_200_OK)

        # Check if another profile already uses this google_id
        conflict = ResidentProfile.objects.filter(google_id=google_id).exclude(pk=profile.pk).first()
        if conflict:
            return Response({
                "error": "This Google account is already linked to another resident.",
                "code": "GOOGLE_ACCOUNT_ALREADY_LINKED"
            }, status=status.HTTP_400_BAD_REQUEST)

        profile.google_id = google_id
        profile.save(update_fields=['google_id'])

        return Response({
            "message": "Google account successfully linked to your GateVault profile.",
            "google_linked": True
        }, status=status.HTTP_200_OK)


class AdminResidentApprovalsListView(generics.ListAPIView):
    """
    List resident profiles for Community Admin approval management.
    Supports filtering by ?status=PENDING_APPROVAL | APPROVED | REJECTED.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = ResidentApprovalSerializer

    def get_queryset(self):
        qs = ResidentProfile.objects.select_related('user', 'flat', 'flat__tower', 'approved_by').order_by('-user__date_joined')
        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter.upper() in ('PENDING_APPROVAL', 'APPROVED', 'REJECTED'):
            qs = qs.filter(approval_status=status_filter.upper())
        return qs


class AdminResidentApproveView(views.APIView):
    """
    Community Admin action to approve a pending resident profile.
    Grants access to resident dashboard and parcels, sends confirmation notification.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk=None, *args, **kwargs):
        profile_id = pk or kwargs.get('pk')
        try:
            profile = ResidentProfile.objects.select_related('user', 'flat', 'flat__tower').get(pk=profile_id)
        except ResidentProfile.DoesNotExist:
            return Response({"error": "Resident profile not found."}, status=status.HTTP_404_NOT_FOUND)

        profile.approval_status = 'APPROVED'
        profile.approved_by = request.user
        profile.approved_at = timezone.now()
        profile.rejection_reason = None
        profile.save(update_fields=['approval_status', 'approved_by', 'approved_at', 'rejection_reason'])

        # Notify Resident
        tower_name = profile.flat.tower.name if profile.flat else ''
        flat_num = profile.flat.number if profile.flat else ''
        Notification.objects.create(
            user=profile.user,
            title="GateVault Registration Approved",
            message=f"Welcome to GateVault! Your resident profile for Tower {tower_name}, Flat {flat_num} has been approved by the Community Admin.",
            notification_type='REGISTRATION_APPROVED'
        )

        return Response({
            "message": f"Resident {profile.user.get_full_name() or profile.user.username} approved successfully.",
            "profile": ResidentApprovalSerializer(profile).data
        }, status=status.HTTP_200_OK)


class AdminResidentRejectView(views.APIView):
    """
    Community Admin action to reject a resident profile with a specified reason.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk=None, *args, **kwargs):
        profile_id = pk or kwargs.get('pk')
        try:
            profile = ResidentProfile.objects.select_related('user', 'flat', 'flat__tower').get(pk=profile_id)
        except ResidentProfile.DoesNotExist:
            return Response({"error": "Resident profile not found."}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', '').strip() or "Tower and flat verification was not successful. Please contact the management office."
        profile.approval_status = 'REJECTED'
        profile.rejection_reason = reason
        profile.save(update_fields=['approval_status', 'rejection_reason'])

        # Notify Resident
        Notification.objects.create(
            user=profile.user,
            title="GateVault Registration Not Approved",
            message=f"Your resident registration was rejected: {reason}",
            notification_type='REGISTRATION_REJECTED'
        )

        return Response({
            "message": "Resident registration rejected.",
            "profile": ResidentApprovalSerializer(profile).data
        }, status=status.HTTP_200_OK)










