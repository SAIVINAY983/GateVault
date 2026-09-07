from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, PublicResidentRegisterView, TowerViewSet, FlatViewSet, CarrierViewSet, StorageShelfViewSet,
    ParcelIntakeView, GuardPendingParcelsView, VerifyPickupView, ConfirmHandoverView,
    ResidentParcelsView, AdminDashboardStatsView, OverdueParcelsView, AdminParcelHistoryView,
    AdminUserManagementViewSet
)

router = DefaultRouter()
router.register(r'towers', TowerViewSet, basename='tower')
router.register(r'flats', FlatViewSet, basename='flat')
router.register(r'carriers', CarrierViewSet, basename='carrier')
router.register(r'shelves', StorageShelfViewSet, basename='shelf')

urlpatterns = [
    # Auth URLs
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', PublicResidentRegisterView.as_view(), name='register_resident'),

    # Router URLs for standard viewsets
    path('', include(router.urls)),

    # Guard URLs
    path('parcels/intake/', ParcelIntakeView.as_view(), name='parcel-intake'),
    path('parcels/pending/', GuardPendingParcelsView.as_view(), name='guard-pending-parcels'),
    path('parcels/<str:parcel_id>/verify/', VerifyPickupView.as_view(), name='parcel-verify'),
    path('parcels/<str:parcel_id>/handover/', ConfirmHandoverView.as_view(), name='parcel-handover'),
    
    # Resident URLs
    path('resident/parcels/', ResidentParcelsView.as_view(), name='resident-parcels'),

    # Admin URLs
    path('admin/dashboard/', AdminDashboardStatsView.as_view(), name='admin-dashboard'),
    path('admin/overdue-parcels/', OverdueParcelsView.as_view(), name='overdue-parcels'),
    path('admin/parcel-history/', AdminParcelHistoryView.as_view(), name='admin-parcel-history'),
    
    # Admin User Management
    path('admin/users/', AdminUserManagementViewSet.as_view({'get': 'list'}), name='admin-users-list'),
    path('admin/users/resident/', AdminUserManagementViewSet.as_view({'post': 'create_resident'}), name='admin-create-resident'),
    path('admin/users/guard/', AdminUserManagementViewSet.as_view({'post': 'create_guard'}), name='admin-create-guard'),
    path('admin/users/<int:pk>/toggle-active/', AdminUserManagementViewSet.as_view({'patch': 'toggle_active'}), name='admin-toggle-user-active'),
]
