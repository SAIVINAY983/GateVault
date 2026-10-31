import os
import io
import csv
import json
import sqlite3
import hashlib
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from django.db.models import Count, Avg, Sum, Q
from django.http import HttpResponse, FileResponse, Http404

from .models import (
    Parcel, ExpectedDelivery, StorageShelf, CourierVisit, GuardShift,
    ParcelInspection, ParcelIncident, CommunityFeedback, DatabaseBackup,
    Tower, Flat, Carrier, User, Notification
)

# Optional third-party export libraries with graceful fallbacks
try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    OPENPYXL_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    OPENPYXL_AVAILABLE = False
    openpyxl = None

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape, A4
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    REPORTLAB_AVAILABLE = False
    colors = None
    canvas = None


REPORT_CATEGORIES = {
    'PARCEL_DELIVERY': {
        'title': 'Parcel Delivery & Handover Report',
        'description': 'Log of delivered, pending, and received parcels'
    },
    'PENDING_OVERDUE': {
        'title': 'Pending & Overdue Storage Report',
        'description': 'Uncollected parcels exceeding standard retention threshold'
    },
    'COURIER_ACTIVITY': {
        'title': 'Courier Arrival & Departure Log Report',
        'description': 'Gatehouse entry/exit and delivery volume logs'
    },
    'COURIER_VISITS': {
        'title': 'Courier Arrival & Departure Log Report',
        'description': 'Gatehouse entry/exit and delivery volume logs'
    },
    'GUARD_SHIFTS': {
        'title': 'Guard Shift & Handover Log Report',
        'description': 'Guard check-ins, check-outs, and shift handovers'
    },
    'PARCEL_INSPECTION': {
        'title': 'Parcel Condition & Intake Inspection Report',
        'description': 'Package intake inspection records and damage notes'
    },
    'PARCEL_CONDITION': {
        'title': 'Parcel Condition & Intake Inspection Report',
        'description': 'Package intake inspection records and damage notes'
    },
    'INCIDENTS': {
        'title': 'Parcel Incident Management Report',
        'description': 'Damaged, missing, or disputed parcel cases'
    },
    'SHELF_UTILIZATION': {
        'title': 'Storage Shelf Capacity & Utilization Report',
        'description': 'Storage shelf occupancy, capacity, and allocation rates'
    },
    'COD_PAYMENTS': {
        'title': 'Cash on Delivery (COD) Collection Report',
        'description': 'Cash-on-delivery tracking and collection logs'
    },
    'COMMUNITY_FEEDBACK': {
        'title': 'Resident Community Feedback & Ratings Report',
        'description': 'Resident ratings and service review submissions'
    },
    'MONTHLY_ACTIVITY': {
        'title': 'Monthly Community Activity & Gatehouse Summary',
        'description': 'Aggregated monthly community trends and KPIs'
    },
}


# ==========================================
# REPORT DATA BUILDER & FILTER SERVICE
# ==========================================

def parse_report_filters(params):
    """
    Validates and parses query parameters for report filtering.
    Returns (filters_dict, error_string_or_None).
    """
    filters = {}
    date_from = params.get('date_from', '').strip()
    date_to = params.get('date_to', '').strip()

    if date_from:
        try:
            filters['date_from'] = datetime.strptime(date_from, '%Y-%m-%d').date()
        except ValueError:
            return None, "Invalid date_from format. Expected YYYY-MM-DD."

    if date_to:
        try:
            filters['date_to'] = datetime.strptime(date_to, '%Y-%m-%d').date()
        except ValueError:
            return None, "Invalid date_to format. Expected YYYY-MM-DD."

    if filters.get('date_from') and filters.get('date_to'):
        if filters['date_from'] > filters['date_to']:
            return None, "Start date (date_from) cannot be later than end date (date_to)."

    # Optional foreign key & string filters
    for key in ['tower_id', 'flat_id', 'courier_id', 'category', 'status', 'incident_status', 'guard_id',
                'tower', 'flat', 'courier', 'guard']:
        val = params.get(key, '').strip()
        if val and val != 'ALL':
            filters[key] = val

    return filters, None


def build_report_data(report_type, filters):
    """
    Retrieves filtered dataset and summary statistics based on report_type.
    """
    report_type = report_type.upper()
    if report_type == 'COURIER_ACTIVITY':
        report_type = 'COURIER_VISITS'
    elif report_type == 'PARCEL_INSPECTION':
        report_type = 'PARCEL_CONDITION'

    if report_type == 'PARCEL_DELIVERY':
        qs = Parcel.objects.all().select_related('flat', 'flat__tower', 'carrier', 'resident')
        if 'date_from' in filters:
            qs = qs.filter(received_at__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(received_at__date__lte=filters['date_to'])
        if 'tower_id' in filters:
            qs = qs.filter(flat__tower_id=filters['tower_id'])
        if 'flat_id' in filters:
            qs = qs.filter(flat_id=filters['flat_id'])
        if 'courier_id' in filters:
            qs = qs.filter(carrier_id=filters['courier_id'])
        if 'status' in filters:
            qs = qs.filter(status=filters['status'])
        if 'category' in filters:
            qs = qs.filter(delivery_type=filters['category'])

        records = []
        for p in qs.order_by('-received_at')[:500]:
            records.append({
                'parcel_id': p.parcel_id,
                'tracking_number': p.tracking_number,
                'carrier': p.carrier.name if p.carrier else 'Unknown',
                'flat': f"Flat {p.flat.number} ({p.flat.tower.name})" if p.flat else 'N/A',
                'resident': p.resident.get_full_name() or p.resident.username if p.resident else 'N/A',
                'delivery_type': p.get_delivery_type_display(),
                'status': p.get_status_display(),
                'received_at': p.received_at.strftime('%Y-%m-%d %H:%M') if p.received_at else '-',
                'collected_at': p.handed_over_at.strftime('%Y-%m-%d %H:%M') if p.handed_over_at else '-'
            })

        summary = {
            'total_parcels': qs.count(),
            'handed_over': qs.filter(status__in=['HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT']).count(),
            'pending': qs.filter(status='AWAITING_PICKUP').count(),
            'overdue': qs.filter(status='OVERDUE').count()
        }
        headers = ['Parcel ID', 'Tracking #', 'Carrier', 'Flat & Tower', 'Resident', 'Category', 'Status', 'Received At', 'Collected At']
        title = "Parcel Delivery & Handover Report"

    elif report_type == 'PENDING_OVERDUE':
        qs = Parcel.objects.filter(status__in=['AWAITING_PICKUP', 'OVERDUE']).select_related('flat', 'flat__tower', 'carrier', 'shelf')
        if 'tower_id' in filters:
            qs = qs.filter(flat__tower_id=filters['tower_id'])
        if 'courier_id' in filters:
            qs = qs.filter(carrier_id=filters['courier_id'])

        records = []
        for p in qs.order_by('-received_at'):
            records.append({
                'parcel_id': p.parcel_id,
                'tracking_number': p.tracking_number,
                'carrier': p.carrier.name if p.carrier else 'Unknown',
                'flat': f"Flat {p.flat.number} ({p.flat.tower.name})" if p.flat else 'N/A',
                'shelf': p.shelf.name if p.shelf else 'Unassigned',
                'status': p.get_status_display(),
                'received_at': p.received_at.strftime('%Y-%m-%d %H:%M') if p.received_at else '-',
                'hours_stored': round((timezone.now() - p.received_at).total_seconds() / 3600, 1) if p.received_at else 0
            })

        summary = {
            'total_pending': qs.count(),
            'overdue_count': qs.filter(status='OVERDUE').count(),
            'standard_pending': qs.filter(status='AWAITING_PICKUP').count()
        }
        headers = ['Parcel ID', 'Tracking #', 'Carrier', 'Flat & Tower', 'Shelf', 'Status', 'Received At', 'Hours in Storage']
        title = "Pending & Overdue Storage Report"

    elif report_type == 'COURIER_VISITS':
        qs = CourierVisit.objects.all().select_related('entry_guard', 'exit_guard', 'carrier')
        if 'date_from' in filters:
            qs = qs.filter(entry_time__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(entry_time__date__lte=filters['date_to'])
        if 'courier_id' in filters:
            qs = qs.filter(carrier_id=filters['courier_id'])
        if 'status' in filters:
            qs = qs.filter(status=filters['status'])

        records = []
        for cv in qs.order_by('-entry_time')[:500]:
            records.append({
                'visit_id': f"VISIT-{cv.id}",
                'courier_name': cv.courier_name,
                'carrier': cv.carrier_name or (cv.carrier.name if cv.carrier else 'Independent'),
                'mobile': cv.mobile_number,
                'vehicle': cv.vehicle_number or '-',
                'status': cv.get_status_display(),
                'entry_time': cv.entry_time.strftime('%Y-%m-%d %H:%M') if cv.entry_time else '-',
                'exit_time': cv.exit_time.strftime('%Y-%m-%d %H:%M') if cv.exit_time else '-',
                'duration_min': cv.visit_duration_minutes or 0,
                'parcels_delivered': cv.parcels_delivered_count or 0
            })

        summary = {
            'total_visits': qs.count(),
            'active_inside': qs.filter(status='INSIDE').count(),
            'completed_exits': qs.filter(status='EXITED').count(),
            'avg_duration_minutes': round(qs.filter(status='EXITED').aggregate(avg=Avg('visit_duration_minutes'))['avg'] or 0, 1)
        }
        headers = ['Visit ID', 'Courier Name', 'Carrier', 'Mobile', 'Vehicle', 'Status', 'Entry Time', 'Exit Time', 'Duration (min)', 'Parcels']
        title = "Courier Arrival & Departure Log Report"

    elif report_type == 'GUARD_SHIFTS':
        qs = GuardShift.objects.all().select_related('guard', 'accepted_by')
        if 'date_from' in filters:
            qs = qs.filter(shift_start__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(shift_start__date__lte=filters['date_to'])
        if 'guard_id' in filters:
            qs = qs.filter(guard_id=filters['guard_id'])
        if 'status' in filters:
            qs = qs.filter(status=filters['status'])

        records = []
        for gs in qs.order_by('-shift_start')[:500]:
            records.append({
                'shift_id': f"SHIFT-{gs.id}",
                'guard': gs.guard.get_full_name() or gs.guard.username,
                'status': gs.get_status_display(),
                'shift_start': gs.shift_start.strftime('%Y-%m-%d %H:%M'),
                'shift_end': gs.shift_end.strftime('%Y-%m-%d %H:%M') if gs.shift_end else 'Active',
                'duration_hours': round((gs.shift_duration_seconds or 0) / 3600, 1),
                'accepted_by': gs.accepted_by.username if gs.accepted_by else '-'
            })

        summary = {
            'total_shifts': qs.count(),
            'active_shifts': qs.filter(status='ACTIVE').count(),
            'completed_shifts': qs.filter(status='COMPLETED').count()
        }
        headers = ['Shift ID', 'Security Guard', 'Status', 'Shift Start', 'Shift End', 'Duration (hrs)', 'Handover Accepted By']
        title = "Guard Duty & Shift Handover Report"

    elif report_type == 'PARCEL_CONDITION':
        qs = ParcelInspection.objects.all().select_related('parcel', 'guard', 'acknowledged_by')
        if 'date_from' in filters:
            qs = qs.filter(timestamp__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(timestamp__date__lte=filters['date_to'])
        if 'status' in filters:
            qs = qs.filter(condition=filters['status'])

        records = []
        for insp in qs.order_by('-timestamp')[:500]:
            records.append({
                'inspection_id': f"INSP-{insp.id}",
                'parcel_id': insp.parcel.parcel_id if insp.parcel else 'N/A',
                'condition': insp.get_condition_display(),
                'remarks': insp.remarks or 'None',
                'courier_confirmed': 'Yes' if insp.courier_confirmed else 'No',
                'guard': insp.guard.username if insp.guard else 'Security',
                'timestamp': insp.timestamp.strftime('%Y-%m-%d %H:%M'),
                'resident_acknowledged': 'Acknowledged' if insp.acknowledged_at else 'Pending'
            })

        summary = {
            'total_inspections': qs.count(),
            'damaged_count': qs.filter(condition='DAMAGED').count(),
            'tampered_count': qs.filter(condition='TAMPERED').count(),
            'intact_count': qs.filter(condition='INTACT').count()
        }
        headers = ['Inspection ID', 'Parcel ID', 'Condition', 'Security Remarks', 'Courier Witnessed', 'Guard', 'Timestamp', 'Resident Acknowledgement']
        title = "Parcel Condition & Security Inspection Report"

    elif report_type == 'INCIDENTS':
        qs = ParcelIncident.objects.all().select_related('parcel', 'resident', 'resolved_by')
        if 'date_from' in filters:
            qs = qs.filter(created_at__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(created_at__date__lte=filters['date_to'])
        if 'incident_status' in filters:
            qs = qs.filter(status=filters['incident_status'])

        records = []
        for inc in qs.order_by('-created_at')[:500]:
            records.append({
                'incident_id': f"INC-{inc.id}",
                'parcel_id': inc.parcel.parcel_id if inc.parcel else 'N/A',
                'category': inc.get_category_display(),
                'status': inc.get_status_display(),
                'resident': inc.resident.username if inc.resident else 'N/A',
                'description': inc.description[:80] + ('...' if len(inc.description) > 80 else ''),
                'reported_at': inc.created_at.strftime('%Y-%m-%d %H:%M'),
                'resolved_by': inc.resolved_by.username if inc.resolved_by else '-'
            })

        summary = {
            'total_incidents': qs.count(),
            'open_incidents': qs.filter(status='OPEN').count(),
            'under_review': qs.filter(status='UNDER_REVIEW').count(),
            'resolved_incidents': qs.filter(status='RESOLVED').count()
        }
        headers = ['Incident ID', 'Parcel ID', 'Category', 'Status', 'Reported By', 'Description', 'Reported At', 'Resolved By']
        title = "Incident & Dispute Management Report"

    elif report_type == 'SHELF_UTILIZATION':
        qs = StorageShelf.objects.all().prefetch_related('parcels')
        records = []
        for s in qs.order_by('name'):
            records.append({
                'shelf_name': s.name,
                'status': s.status,
                'capacity': s.capacity,
                'occupied': s.occupied,
                'available': s.available,
                'max_size': s.max_parcel_size,
                'utilization': f"{s.utilization_percentage}%",
                'maintenance_notes': s.maintenance_notes or '-'
            })

        total_cap = sum(s.capacity for s in qs)
        total_occ = sum(s.occupied for s in qs)
        summary = {
            'total_shelves': qs.count(),
            'total_capacity': total_cap,
            'total_occupied': total_occ,
            'overall_utilization': f"{round((total_occ / total_cap) * 100, 1)}%" if total_cap > 0 else '0%'
        }
        headers = ['Shelf Name', 'Operational Status', 'Capacity', 'Occupied Slots', 'Available Slots', 'Max Size Tier', 'Utilization %', 'Maintenance Notes']
        title = "Storage Shelf Capacity & Utilization Report"

    elif report_type == 'COD_PAYMENTS':
        qs = Parcel.objects.filter(payment_type='COD').select_related('flat', 'carrier', 'payment_confirmed_by')
        if 'date_from' in filters:
            qs = qs.filter(received_at__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(received_at__date__lte=filters['date_to'])

        records = []
        for p in qs.order_by('-received_at')[:500]:
            records.append({
                'parcel_id': p.parcel_id,
                'tracking_number': p.tracking_number,
                'carrier': p.carrier.name if p.carrier else 'Unknown',
                'flat': f"Flat {p.flat.number}" if p.flat else 'N/A',
                'amount': f"₹{p.cod_amount}",
                'payment_method': p.payment_method,
                'payment_status': p.payment_status,
                'confirmed_at': p.payment_confirmed_at.strftime('%Y-%m-%d %H:%M') if p.payment_confirmed_at else '-',
                'confirmed_by': p.payment_confirmed_by.username if p.payment_confirmed_by else '-'
            })

        total_cod = qs.filter(payment_status='PAID').aggregate(total=Sum('cod_amount'))['total'] or 0
        summary = {
            'total_cod_parcels': qs.count(),
            'paid_count': qs.filter(payment_status='PAID').count(),
            'pending_count': qs.filter(payment_status='PENDING').count(),
            'total_collected_inr': f"₹{total_cod}"
        }
        headers = ['Parcel ID', 'Tracking #', 'Carrier', 'Flat', 'COD Amount', 'Payment Method', 'Payment Status', 'Confirmed At', 'Confirmed By']
        title = "Cash on Delivery (COD) Collection Report"

    elif report_type == 'COMMUNITY_FEEDBACK':
        qs = CommunityFeedback.objects.all().select_related('resident', 'parcel', 'parcel__carrier', 'reviewed_by')
        if 'date_from' in filters:
            qs = qs.filter(created_at__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs = qs.filter(created_at__date__lte=filters['date_to'])
        if 'category' in filters:
            qs = qs.filter(category=filters['category'])

        records = []
        for fb in qs.order_by('-created_at')[:500]:
            records.append({
                'feedback_id': f"FB-{fb.id}",
                'resident': fb.resident.username if fb.resident else 'Resident',
                'parcel_id': fb.parcel.parcel_id if fb.parcel else 'N/A',
                'carrier': fb.parcel.carrier.name if fb.parcel and fb.parcel.carrier else 'Courier',
                'category': fb.get_category_display(),
                'rating': f"{fb.rating} ★",
                'review': fb.review[:70] + ('...' if len(fb.review) > 70 else '') if fb.review else 'No text',
                'is_reviewed': 'Yes' if fb.is_reviewed else 'Pending',
                'admin_response': 'Yes' if fb.admin_response else 'No',
                'submitted_at': fb.created_at.strftime('%Y-%m-%d %H:%M')
            })

        avg_r = qs.aggregate(avg=Avg('rating'))['avg'] or 0
        summary = {
            'total_feedbacks': qs.count(),
            'average_rating': f"{round(avg_r, 2)} ★",
            'reviewed_count': qs.filter(is_reviewed=True).count(),
            'responded_count': qs.exclude(admin_response='').count()
        }
        headers = ['Feedback ID', 'Resident', 'Parcel ID', 'Carrier', 'Category', 'Rating', 'Review Text', 'Reviewed', 'Response Sent', 'Submitted At']
        title = "Resident Community Feedback & Ratings Report"

    else:  # MONTHLY_ACTIVITY
        qs_parcels = Parcel.objects.all()
        qs_visits = CourierVisit.objects.all()
        qs_incidents = ParcelIncident.objects.all()
        qs_feedback = CommunityFeedback.objects.all()

        if 'date_from' in filters:
            qs_parcels = qs_parcels.filter(received_at__date__gte=filters['date_from'])
            qs_visits = qs_visits.filter(entry_time__date__gte=filters['date_from'])
            qs_incidents = qs_incidents.filter(created_at__date__gte=filters['date_from'])
            qs_feedback = qs_feedback.filter(created_at__date__gte=filters['date_from'])
        if 'date_to' in filters:
            qs_parcels = qs_parcels.filter(received_at__date__lte=filters['date_to'])
            qs_visits = qs_visits.filter(entry_time__date__lte=filters['date_to'])
            qs_incidents = qs_incidents.filter(created_at__date__lte=filters['date_to'])
            qs_feedback = qs_feedback.filter(created_at__date__lte=filters['date_to'])

        summary = {
            'total_parcels_processed': qs_parcels.count(),
            'parcels_handed_over': qs_parcels.filter(status__in=['HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT']).count(),
            'courier_entries': qs_visits.count(),
            'incidents_reported': qs_incidents.count(),
            'feedback_submitted': qs_feedback.count(),
            'avg_community_rating': f"{round(qs_feedback.aggregate(avg=Avg('rating'))['avg'] or 0, 2)} ★"
        }
        records = [
            {'metric': 'Parcels Received', 'value': str(qs_parcels.count()), 'details': 'Deliveries logged at gatehouse'},
            {'metric': 'Parcels Handed Over', 'value': str(qs_parcels.filter(status__in=['HANDED_OVER', 'DELIVERED_DIRECTLY_TO_FLAT']).count()), 'details': 'Successfully verified and handed over'},
            {'metric': 'Overdue Packages', 'value': str(qs_parcels.filter(status='OVERDUE').count()), 'details': 'Stored beyond 48-hour threshold'},
            {'metric': 'Courier Partner Visits', 'value': str(qs_visits.count()), 'details': 'Gate entries recorded'},
            {'metric': 'Incidents Reported', 'value': str(qs_incidents.count()), 'details': 'Package damages or missing contents'},
            {'metric': 'Community Reviews', 'value': str(qs_feedback.count()), 'details': 'Feedback reviews registered'},
            {'metric': 'Average Satisfaction', 'value': summary['avg_community_rating'], 'details': 'Overall average community star rating'}
        ]
        headers = ['Operational Metric', 'Recorded Volume', 'Notes / Description']
        title = "Monthly Community Activity & Gatehouse Summary"

    rows = [list(rec.values()) for rec in records]
    return {
        'title': title,
        'report_type': report_type,
        'headers': headers,
        'columns': headers,
        'records': records,
        'rows': rows,
        'total_records': len(records),
        'summary': summary,
        'filters': {k: str(v) for k, v in filters.items()},
        'generated_at': timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    }


# ==========================================
# CSV EXPORT ENGINE
# ==========================================

def generate_csv_report(data):
    """
    Generates standard RFC 4180 compliant CSV bytes with UTF-8 BOM.
    Returns (content_bytes, filename, mimetype).
    """
    output = io.StringIO()
    # Write UTF-8 BOM for Microsoft Excel auto-encoding detection
    output.write('\ufeff')

    writer = csv.writer(output, dialect='excel')
    # Metadata Header
    writer.writerow([f"GateVault Community Logistics — {data['title']}"])
    writer.writerow([f"Generated On: {data['generated_at']}"])
    if data['filters']:
        writer.writerow([f"Applied Filters: {json.dumps(data['filters'])}"])
    writer.writerow([])

    # Summary Statistics
    writer.writerow(["--- SUMMARY STATISTICS ---"])
    for k, v in data['summary'].items():
        writer.writerow([k.replace('_', ' ').title(), v])
    writer.writerow([])

    # Table Headers & Rows
    writer.writerow(data['headers'])
    for record in data['records']:
        row = list(record.values())
        writer.writerow(row)

    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{data.get('report_type', 'report').lower()}_{timestamp}.csv"
    return output.getvalue().encode('utf-8-sig'), filename, 'text/csv; charset=utf-8'


# ==========================================
# EXCEL (XLSX) EXPORT ENGINE
# ==========================================

def generate_excel_report(data):
    """
    Generates an Excel .xlsx workbook using openpyxl, with fallback to CSV if openpyxl is not installed.
    Returns (content_bytes, filename, mimetype).
    """
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{data.get('report_type', 'report').lower()}_{timestamp}.xlsx"

    if not OPENPYXL_AVAILABLE:
        # Fallback to CSV format with Excel MIME type
        csv_bytes, _, _ = generate_csv_report(data)
        return csv_bytes, filename.replace('.xlsx', '.csv'), 'text/csv; charset=utf-8'

    wb = openpyxl.Workbook()
    # Sheet 1: Detailed Records
    ws_data = wb.active
    ws_data.title = "Detailed Records"

    # Sheet 2: Summary & Filters
    ws_summary = wb.create_sheet(title="Summary & Overview")

    # Styling definitions
    header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Segoe UI", size=14, bold=True, color="0F172A")
    bold_font = Font(name="Segoe UI", size=11, bold=True)
    regular_font = Font(name="Segoe UI", size=10)
    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    # --- Populate Sheet 1 (Detailed Records) ---
    ws_data.append([f"GateVault — {data['title']}"])
    ws_data.cell(row=1, column=1).font = title_font
    ws_data.append([f"Generated: {data['generated_at']}"])
    ws_data.append([])

    # Table Header Row
    ws_data.append(data['headers'])
    header_row_idx = 4
    for col_idx in range(1, len(data['headers']) + 1):
        cell = ws_data.cell(row=header_row_idx, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')

    # Data Rows
    row_idx = 5
    for record in data['records']:
        row_values = list(record.values())
        ws_data.append(row_values)
        for col_idx in range(1, len(row_values) + 1):
            cell = ws_data.cell(row=row_idx, column=col_idx)
            cell.font = regular_font
            cell.border = border_thin
        row_idx += 1

    # Auto-adjust column widths
    for col in ws_data.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws_data.column_dimensions[col_letter].width = max(max_len + 4, 12)

    # --- Populate Sheet 2 (Summary & Filters) ---
    ws_summary.append(["GateVault Community Report Summary"])
    ws_summary.cell(row=1, column=1).font = title_font
    ws_summary.append([])
    ws_summary.append(["METRIC", "VALUE"])
    ws_summary.cell(row=3, column=1).font = bold_font
    ws_summary.cell(row=3, column=2).font = bold_font

    s_row = 4
    for k, v in data['summary'].items():
        ws_summary.append([k.replace('_', ' ').title(), str(v)])
        s_row += 1

    ws_summary.append([])
    ws_summary.append(["FILTER PARAMETER", "VALUE"])
    ws_summary.cell(row=s_row + 1, column=1).font = bold_font
    ws_summary.cell(row=s_row + 1, column=2).font = bold_font
    if data['filters']:
        for k, v in data['filters'].items():
            ws_summary.append([k.replace('_', ' ').title(), str(v)])
    else:
        ws_summary.append(["None", "All Database Records"])

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue(), filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


# ==========================================
# PDF EXPORT ENGINE
# ==========================================

if REPORTLAB_AVAILABLE and canvas is not None:
    class NumberedCanvas(canvas.Canvas):
        """
        Two-pass canvas to dynamically compute and print 'Page X of Y' in ReportLab PDFs.
        """
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_number(num_pages)
                super().showPage()
            super().save()

        def draw_page_number(self, page_count):
            self.saveState()
            self.setFont("Helvetica", 8)
            if colors is not None:
                self.setFillColor(colors.HexColor("#64748B"))
            # Footer text
            footer_text = f"GateVault Smart Community • Confidential Operational Report • Page {self._pageNumber} of {page_count}"
            self.drawRightString(self._pagesize[0] - 36, 20, footer_text)
            self.restoreState()
else:
    NumberedCanvas = None


def generate_pdf_report(data):
    """
    Generates a structured PDF document using ReportLab.
    Falls back to structured HTML/CSV response if ReportLab is not installed.
    Returns (content_bytes, filename, mimetype).
    """
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{data.get('report_type', 'report').lower()}_{timestamp}.pdf"

    if not REPORTLAB_AVAILABLE:
        # Fallback to plain CSV report formatted with PDF headers
        csv_bytes, _, _ = generate_csv_report(data)
        return csv_bytes, filename.replace('.pdf', '.csv'), 'text/csv; charset=utf-8'

    buffer = io.BytesIO()
    # Landscape orientation for wide tabular data
    page_size = landscape(A4)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page_size,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        spaceAfter=12
    )
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1
    )
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#1E293B')
    )
    summary_label_style = ParagraphStyle(
        'SummaryLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )

    story = []

    # Title & Metadata
    story.append(Paragraph(f"GateVault — {data['title']}", title_style))
    filter_desc = ", ".join([f"{k}: {v}" for k, v in data['filters'].items()]) if data['filters'] else "All Records"
    story.append(Paragraph(f"Generated On: {data['generated_at']} | Filters: {filter_desc}", subtitle_style))
    story.append(Spacer(1, 8))

    # Summary Statistics Box
    summary_rows = [
        [Paragraph(f"<b>{k.replace('_', ' ').title()}:</b>", summary_label_style), Paragraph(str(v), table_cell_style)]
        for k, v in data['summary'].items()
    ]
    # Chunk summary into 2-column key/value layout
    summary_table_data = []
    for i in range(0, len(summary_rows), 2):
        row = summary_rows[i]
        if i + 1 < len(summary_rows):
            row = row + summary_rows[i + 1]
        else:
            row = row + [Paragraph("", table_cell_style), Paragraph("", table_cell_style)]
        summary_table_data.append(row)

    if summary_table_data:
        summary_table = Table(summary_table_data, colWidths=[130, 200, 130, 200])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 14))

    # Detailed Records Table
    table_data = [[Paragraph(h, table_header_style) for h in data['headers']]]
    for record in data['records'][:300]:  # Cap to 300 in single PDF to prevent out-of-memory
        row = [Paragraph(str(val), table_cell_style) for val in record.values()]
        table_data.append(row)

    col_width = (page_size[0] - 72) / len(data['headers'])
    col_widths = [col_width] * len(data['headers'])

    record_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    record_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    story.append(record_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue(), filename, 'application/pdf'


# ==========================================
# SQLITE ONLINE BACKUP SERVICE
# ==========================================

def execute_sqlite_backup(user=None, backup_type='MANUAL'):
    """
    Safely executes an online backup of the SQLite database using SQLite's online backup API.
    Performs integrity verification and SHA256 checksum calculation before marking COMPLETED.
    """
    source_db_path = settings.DATABASES['default']['NAME']
    if not os.path.isabs(source_db_path):
        source_db_path = os.path.join(settings.BASE_DIR, source_db_path)

    backup_dir = os.path.join(settings.BASE_DIR, 'backups')
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    backup_filename = f"gatevault_backup_{timestamp}.sqlite3"
    dest_path = os.path.join(backup_dir, backup_filename)

    backup_record = DatabaseBackup.objects.create(
        backup_name=backup_filename,
        file_path=dest_path,
        file_size=0,
        status='IN_PROGRESS',
        backup_type=backup_type,
        created_by=user
    )

    try:
        source_conn = sqlite3.connect(source_db_path)
        dest_conn = sqlite3.connect(dest_path)

        with dest_conn:
            source_conn.backup(dest_conn, pages=100)

        dest_conn.close()
        source_conn.close()

        # Step 2: Integrity Verification
        verify_conn = sqlite3.connect(dest_path)
        cursor = verify_conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        check_res = cursor.fetchone()
        verify_conn.close()

        if not check_res or check_res[0] != 'ok':
            raise ValueError(f"SQLite backup failed integrity verification: {check_res}")

        # Step 3: Compute SHA256 Checksum and Size
        file_size = os.path.getsize(dest_path)
        sha256 = hashlib.sha256()
        with open(dest_path, 'rb') as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        checksum = sha256.hexdigest()

        # Step 4: Prune old backups based on 30-day retention
        retention_cutoff = timezone.now() - timedelta(days=30)
        old_backups = DatabaseBackup.objects.filter(created_at__lt=retention_cutoff, status='COMPLETED')
        for ob in old_backups:
            if os.path.exists(ob.file_path):
                try:
                    os.remove(ob.file_path)
                except Exception:
                    pass
            ob.delete()

        # Update record
        backup_record.status = 'COMPLETED'
        backup_record.file_size = file_size
        backup_record.checksum = checksum
        backup_record.save()

        # Create notifications for admins
        try:
            admins = User.objects.filter(role='ADMIN')
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    title="Database Backup Completed",
                    message=f"Consistent SQLite snapshot '{backup_filename}' ({round(file_size/1024, 1)} KB) created and verified successfully.",
                    notification_type='DATABASE_BACKUP'
                )
        except Exception:
            pass

        return True, None, backup_record

    except Exception as exc:
        if os.path.exists(dest_path):
            try:
                os.remove(dest_path)
            except Exception:
                pass
        backup_record.status = 'FAILED'
        backup_record.failure_reason = str(exc)
        backup_record.save()

        try:
            admins = User.objects.filter(role='ADMIN')
            for admin in admins:
                Notification.objects.create(
                    user=admin,
                    title="Database Backup Failed",
                    message=f"Snapshot generation failed: {str(exc)}",
                    notification_type='DATABASE_BACKUP'
                )
        except Exception:
            pass

        return False, str(exc), backup_record
