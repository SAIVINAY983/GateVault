from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, TowerViewSet, FlatViewSet, CarrierViewSet, StorageShelfViewSet,
    ParcelIntakeView, GuardPendingParcelsView, VerifyPickupView, ConfirmHandoverView,
    ResidentParcelsView, AdminDashboardStatsView, OverdueParcelsView, AdminParcelHistoryView
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
]
