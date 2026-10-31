from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView, PublicResidentRegisterView, TowerViewSet, FlatViewSet, CarrierViewSet, StorageShelfViewSet,
    ParcelIntakeView, GuardPendingParcelsView, VerifyPickupView, ConfirmHandoverView,
    ResidentParcelsView, AdminDashboardStatsView, OverdueParcelsView, AdminParcelHistoryView,
    AdminUserManagementViewSet, NotificationListView, UnreadNotificationCountView,
    MarkNotificationReadView, MarkAllNotificationsReadView, ExpectedDeliveryViewSet,
    FlatmatesListView, DelegatePickupView, RevokeDelegationView,
    ParcelInspectionView, AcknowledgeInspectionView, ReportIncidentView,
    ResidentIncidentsListView, AdminIncidentsListView, IncidentDetailView, AdminIncidentStatusUpdateView,
    ResidentHouseholdListView, ResidentHouseholdAddView, ResidentHouseholdDetailView,
    AuthorizedReceiversListView, DirectHandoverView,
    GenerateParcelQRPassView, RevokeParcelQRPassView, GuardVerifyQRView, GuardConfirmQRHandoverView,
    GuardShiftStartView, GuardCurrentShiftView, GuardShiftHandoverView, GuardShiftReportView,
    GuardShiftAcceptView, AdminShiftsListView, AdminShiftForceAcceptView,
    EffectiveDeliveryPolicyView, AdminDeliveryPolicyListCreateView, AdminDeliveryPolicyDetailView,
    AdminDeliveryPolicyAuditHistoryView,
    CreateGuestPickupAuthorizationView, ResidentGuestAuthorizationsListView, RevokeGuestAuthorizationView,
    GuardVerifyGuestPassView, GuardConfirmGuestHandoverView, AdminGuestPickupsListView,
    ShelfRecommendationView, ShelfReserveView, ShelfReleaseReservationView,
    ParcelRelocateView, ShelfHistoryView, AdminShelfStatusUpdateView, AdminShelfAnalyticsView,
    CourierVisitEntryView, CourierVisitsActiveListView, CourierVisitsListView,
    CourierVisitDetailView, CourierVisitExitView, CourierVisitLinkParcelView,
    AdminCourierVisitsListView, AdminCourierAnalyticsView,
    AdminDeliveryScheduleAnalyticsView,
    PriorityAlertListCreateView, PriorityAlertDetailView, PriorityAlertAcknowledgeView,
    PriorityAlertStatusUpdateView, PriorityAlertAssignView,
    AdminAlertsListView, AdminAlertAnalyticsView,
    ResidentFeedbackListCreateView, ResidentFeedbackDetailUpdateView,
    AdminFeedbackListView, AdminFeedbackAnalyticsView,
    AdminFeedbackRespondView, AdminFeedbackReviewView,
    AdminReportsSummaryView, AdminReportDetailView, AdminReportExportView,
    AdminDatabaseBackupCreateView, AdminDatabaseBackupListView, AdminDatabaseBackupDownloadView
)

router = DefaultRouter()
router.register(r'towers', TowerViewSet, basename='tower')
router.register(r'flats', FlatViewSet, basename='flat')
router.register(r'carriers', CarrierViewSet, basename='carrier')
router.register(r'shelves', StorageShelfViewSet, basename='shelf')
router.register(r'expected-deliveries', ExpectedDeliveryViewSet, basename='expected-delivery')

urlpatterns = [
    # Auth URLs
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/register/', PublicResidentRegisterView.as_view(), name='register_resident'),

    # Smart Shelf Management URLs (Precedes router shelf viewset)
    path('shelves/recommend/', ShelfRecommendationView.as_view(), name='shelf-recommend'),
    path('shelves/reserve/', ShelfReserveView.as_view(), name='shelf-reserve'),
    path('shelves/release-reservation/', ShelfReleaseReservationView.as_view(), name='shelf-release-reservation'),
    path('shelves/<int:pk>/history/', ShelfHistoryView.as_view(), name='shelf-history'),

    # Router URLs for standard viewsets
    path('', include(router.urls)),

    # Guard URLs
    path('parcels/intake/', ParcelIntakeView.as_view(), name='parcel-intake'),
    path('parcels/pending/', GuardPendingParcelsView.as_view(), name='guard-pending-parcels'),
    path('parcels/<str:parcel_id>/verify/', VerifyPickupView.as_view(), name='parcel-verify'),
    path('parcels/<str:parcel_id>/handover/', ConfirmHandoverView.as_view(), name='parcel-handover'),
    path('parcels/<str:parcel_id>/relocate/', ParcelRelocateView.as_view(), name='parcel-relocate'),
    path('guard/verify-qr/', GuardVerifyQRView.as_view(), name='guard-verify-qr'),
    path('guard/confirm-qr-handover/', GuardConfirmQRHandoverView.as_view(), name='guard-confirm-qr-handover'),
    
    # Guard Shift Management URLs
    path('guard/shifts/start/', GuardShiftStartView.as_view(), name='guard-shift-start'),
    path('guard/shifts/current/', GuardCurrentShiftView.as_view(), name='guard-shift-current'),
    path('guard/shifts/<int:pk>/handover/', GuardShiftHandoverView.as_view(), name='guard-shift-handover'),
    path('guard/shifts/<int:pk>/report/', GuardShiftReportView.as_view(), name='guard-shift-report'),
    path('guard/shifts/<int:pk>/accept/', GuardShiftAcceptView.as_view(), name='guard-shift-accept'),
    
    # Resident URLs
    path('resident/parcels/', ResidentParcelsView.as_view(), name='resident-parcels'),
    path('residents/flatmates/', FlatmatesListView.as_view(), name='resident-flatmates'),
    path('parcels/<str:parcel_id>/delegate/', DelegatePickupView.as_view(), name='parcel-delegate'),
    path('parcels/<str:parcel_id>/revoke-delegation/', RevokeDelegationView.as_view(), name='parcel-revoke-delegation'),
    path('parcels/<str:parcel_id>/qr-pass/', GenerateParcelQRPassView.as_view(), name='parcel-qr-pass'),
    path('parcels/<str:parcel_id>/qr-pass/revoke/', RevokeParcelQRPassView.as_view(), name='parcel-qr-pass-revoke'),
    path('resident/incidents/', ResidentIncidentsListView.as_view(), name='resident-incidents'),

    # Household Management URLs
    path('resident/household/', ResidentHouseholdListView.as_view(), name='resident-household-list'),
    path('resident/household/add/', ResidentHouseholdAddView.as_view(), name='resident-household-add'),
    path('resident/household/<int:pk>/', ResidentHouseholdDetailView.as_view(), name='resident-household-detail'),
    path('resident/household/authorized-receivers/', AuthorizedReceiversListView.as_view(), name='authorized-receivers'),
    path('parcels/<str:parcel_id>/direct-handover/', DirectHandoverView.as_view(), name='parcel-direct-handover'),

    # Parcel Inspection & Incident Management URLs
    path('parcels/<str:parcel_id>/inspection/', ParcelInspectionView.as_view(), name='parcel-inspection'),
    path('parcels/<str:parcel_id>/inspection/acknowledge/', AcknowledgeInspectionView.as_view(), name='parcel-inspection-acknowledge'),
    path('parcels/<str:parcel_id>/report-incident/', ReportIncidentView.as_view(), name='parcel-report-incident'),
    path('incidents/<int:pk>/', IncidentDetailView.as_view(), name='incident-detail'),

    # Admin Incident URLs
    path('admin/incidents/', AdminIncidentsListView.as_view(), name='admin-incidents'),
    path('admin/incidents/<int:pk>/status/', AdminIncidentStatusUpdateView.as_view(), name='admin-incident-status'),

    # Admin Shift Management URLs
    path('admin/shifts/', AdminShiftsListView.as_view(), name='admin-shifts-list'),
    path('admin/shifts/<int:pk>/force-accept/', AdminShiftForceAcceptView.as_view(), name='admin-shift-force-accept'),

    # Delivery Policy Management URLs
    path('delivery-policies/effective/', EffectiveDeliveryPolicyView.as_view(), name='delivery-policies-effective'),
    path('admin/delivery-policies/', AdminDeliveryPolicyListCreateView.as_view(), name='admin-delivery-policies-list-create'),
    path('admin/delivery-policies/<int:pk>/', AdminDeliveryPolicyDetailView.as_view(), name='admin-delivery-policies-detail'),
    path('admin/delivery-policies/history/', AdminDeliveryPolicyAuditHistoryView.as_view(), name='admin-delivery-policies-history'),

    # Admin URLs
    path('admin/dashboard/', AdminDashboardStatsView.as_view(), name='admin-dashboard'),
    path('admin/overdue-parcels/', OverdueParcelsView.as_view(), name='overdue-parcels'),
    path('admin/parcel-history/', AdminParcelHistoryView.as_view(), name='admin-parcel-history'),
    path('admin/shelves/<int:pk>/status/', AdminShelfStatusUpdateView.as_view(), name='admin-shelf-status'),
    path('admin/shelf-analytics/', AdminShelfAnalyticsView.as_view(), name='admin-shelf-analytics'),
    
    # Admin User Management
    path('admin/users/', AdminUserManagementViewSet.as_view({'get': 'list'}), name='admin-users-list'),
    path('admin/users/resident/', AdminUserManagementViewSet.as_view({'post': 'create_resident'}), name='admin-create-resident'),
    path('admin/users/guard/', AdminUserManagementViewSet.as_view({'post': 'create_guard'}), name='admin-create-guard'),
    path('admin/users/<int:pk>/toggle-active/', AdminUserManagementViewSet.as_view({'patch': 'toggle_active'}), name='admin-toggle-user-active'),
    
    # Temporary Guest Pickup Authorization URLs
    path('parcels/<str:parcel_id>/guest-authorization/', CreateGuestPickupAuthorizationView.as_view(), name='parcel-guest-authorization'),
    path('resident/guest-authorizations/', ResidentGuestAuthorizationsListView.as_view(), name='resident-guest-authorizations'),
    path('guest-authorizations/<int:id>/revoke/', RevokeGuestAuthorizationView.as_view(), name='guest-authorization-revoke'),
    path('guard/verify-guest-pass/', GuardVerifyGuestPassView.as_view(), name='guard-verify-guest-pass'),
    path('guard/confirm-guest-handover/', GuardConfirmGuestHandoverView.as_view(), name='guard-confirm-guest-handover'),
    path('admin/guest-pickups/', AdminGuestPickupsListView.as_view(), name='admin-guest-pickups'),

    # Courier Arrival & Departure Tracking URLs
    path('courier-visits/entry/', CourierVisitEntryView.as_view(), name='courier-visit-entry'),
    path('courier-visits/active/', CourierVisitsActiveListView.as_view(), name='courier-visits-active'),
    path('courier-visits/', CourierVisitsListView.as_view(), name='courier-visits-list'),
    path('courier-visits/<int:pk>/', CourierVisitDetailView.as_view(), name='courier-visit-detail'),
    path('courier-visits/<int:pk>/exit/', CourierVisitExitView.as_view(), name='courier-visit-exit'),
    path('courier-visits/<int:pk>/link-parcel/', CourierVisitLinkParcelView.as_view(), name='courier-visit-link-parcel'),
    path('admin/courier-visits/', AdminCourierVisitsListView.as_view(), name='admin-courier-visits'),
    path('admin/courier-analytics/', AdminCourierAnalyticsView.as_view(), name='admin-courier-analytics'),
    path('admin/delivery-schedule-analytics/', AdminDeliveryScheduleAnalyticsView.as_view(), name='admin-delivery-schedule-analytics'),

    # Emergency & Priority Alerts
    path('alerts/', PriorityAlertListCreateView.as_view(), name='alerts-list-create'),
    path('alerts/<int:pk>/', PriorityAlertDetailView.as_view(), name='alert-detail'),
    path('alerts/<int:pk>/acknowledge/', PriorityAlertAcknowledgeView.as_view(), name='alert-acknowledge'),
    path('alerts/<int:pk>/status/', PriorityAlertStatusUpdateView.as_view(), name='alert-status-update'),
    path('alerts/<int:pk>/assign/', PriorityAlertAssignView.as_view(), name='alert-assign'),
    path('admin/alerts/', AdminAlertsListView.as_view(), name='admin-alerts-list'),
    path('admin/alert-analytics/', AdminAlertAnalyticsView.as_view(), name='admin-alert-analytics'),

    # Community Feedback & Rating URLs
    path('resident/feedback/', ResidentFeedbackListCreateView.as_view(), name='resident-feedback-list-create'),
    path('resident/feedback/<int:pk>/', ResidentFeedbackDetailUpdateView.as_view(), name='resident-feedback-detail-update'),
    path('admin/feedback/', AdminFeedbackListView.as_view(), name='admin-feedback-list'),
    path('admin/feedback/analytics/', AdminFeedbackAnalyticsView.as_view(), name='admin-feedback-analytics'),
    path('admin/feedback/<int:pk>/respond/', AdminFeedbackRespondView.as_view(), name='admin-feedback-respond'),
    path('admin/feedback/<int:pk>/review/', AdminFeedbackReviewView.as_view(), name='admin-feedback-review'),

    # Reports & Data Export URLs
    path('admin/reports/summary/', AdminReportsSummaryView.as_view(), name='admin-reports-summary'),
    path('admin/reports/preview/', AdminReportDetailView.as_view(), name='admin-reports-preview'),
    path('admin/reports/parcels/', AdminReportDetailView.as_view(), {'report_type': 'PARCEL_DELIVERY'}, name='admin-reports-parcels'),
    path('admin/reports/pending-overdue/', AdminReportDetailView.as_view(), {'report_type': 'PENDING_OVERDUE'}, name='admin-reports-pending-overdue'),
    path('admin/reports/courier-visits/', AdminReportDetailView.as_view(), {'report_type': 'COURIER_ACTIVITY'}, name='admin-reports-courier-visits'),
    path('admin/reports/guard-shifts/', AdminReportDetailView.as_view(), {'report_type': 'GUARD_SHIFTS'}, name='admin-reports-guard-shifts'),
    path('admin/reports/inspections/', AdminReportDetailView.as_view(), {'report_type': 'PARCEL_INSPECTION'}, name='admin-reports-inspections'),
    path('admin/reports/incidents/', AdminReportDetailView.as_view(), {'report_type': 'INCIDENTS'}, name='admin-reports-incidents'),
    path('admin/reports/shelves/', AdminReportDetailView.as_view(), {'report_type': 'SHELF_UTILIZATION'}, name='admin-reports-shelves'),
    path('admin/reports/cod-payments/', AdminReportDetailView.as_view(), {'report_type': 'COD_PAYMENTS'}, name='admin-reports-cod-payments'),
    path('admin/reports/feedback/', AdminReportDetailView.as_view(), {'report_type': 'COMMUNITY_FEEDBACK'}, name='admin-reports-feedback'),
    path('admin/reports/monthly-activity/', AdminReportDetailView.as_view(), {'report_type': 'MONTHLY_ACTIVITY'}, name='admin-reports-monthly-activity'),
    path('admin/reports/export/pdf/', AdminReportExportView.as_view(), {'format_type': 'pdf'}, name='admin-reports-export-pdf'),
    path('admin/reports/export/excel/', AdminReportExportView.as_view(), {'format_type': 'excel'}, name='admin-reports-export-excel'),
    path('admin/reports/export/csv/', AdminReportExportView.as_view(), {'format_type': 'csv'}, name='admin-reports-export-csv'),
    path('admin/reports/export/', AdminReportExportView.as_view(), name='admin-reports-export'),

    # Database Backup Management URLs
    path('admin/backups/', AdminDatabaseBackupListView.as_view(), name='admin-backups-list'),
    path('admin/backups/create/', AdminDatabaseBackupCreateView.as_view(), name='admin-backups-create'),
    path('admin/backups/<int:pk>/download/', AdminDatabaseBackupDownloadView.as_view(), name='admin-backups-download'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('notifications/unread-count/', UnreadNotificationCountView.as_view(), name='notifications-unread-count'),
    path('notifications/<int:pk>/read/', MarkNotificationReadView.as_view(), name='notifications-read'),
    path('notifications/read-all/', MarkAllNotificationsReadView.as_view(), name='notifications-read-all'),
]
