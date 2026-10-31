from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_smartshelfmanagement_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CourierVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('courier_name', models.CharField(max_length=150)),
                ('carrier_name', models.CharField(blank=True, help_text='Delivery company name', max_length=100, null=True)),
                ('mobile_number', models.CharField(max_length=20)),
                ('vehicle_number', models.CharField(blank=True, max_length=50, null=True)),
                ('visit_purpose', models.CharField(choices=[('PARCEL_DELIVERY', 'Parcel Delivery'), ('FOOD_DELIVERY', 'Food Delivery'), ('RETURN_PICKUP', 'Return Pickup'), ('MULTIPLE_DELIVERIES', 'Multiple Deliveries'), ('OTHER', 'Other')], default='PARCEL_DELIVERY', max_length=30)),
                ('entry_time', models.DateTimeField(default=django.utils.timezone.now)),
                ('exit_time', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('INSIDE', 'Currently Inside'), ('EXITED', 'Exited')], default='INSIDE', max_length=15)),
                ('remarks', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('carrier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='courier_visits', to='api.carrier')),
                ('entry_guard', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registered_courier_visits', to=settings.AUTH_USER_MODEL)),
                ('exit_guard', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='checked_out_courier_visits', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-entry_time'],
            },
        ),
        migrations.AddField(
            model_name='parcel',
            name='courier_visit',
            field=models.ForeignKey(blank=True, help_text='Courier visit during which this parcel was received', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='parcels', to='api.couriervisit'),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(choices=[('NEW_PARCEL', 'New Parcel'), ('FOOD_DELIVERY', 'Food Delivery'), ('OVERDUE', 'Overdue Parcel'), ('HANDOVER', 'Handover Completed'), ('CONDITION_ALERT', 'Parcel Condition Alert'), ('INCIDENT_UPDATE', 'Incident Status Update'), ('HOUSEHOLD_UPDATE', 'Household Authorization Update'), ('HOUSEHOLD_DELIVERY', 'Household Delivery Handover'), ('SHIFT_HANDOVER', 'Guard Shift Handover'), ('POLICY_UPDATE', 'Delivery Policy Update'), ('GUEST_AUTHORIZED', 'Guest Pickup Authorized'), ('GUEST_COLLECTED', 'Guest Parcel Collected'), ('GUEST_REVOKED', 'Guest Authorization Revoked'), ('GUEST_EXPIRED', 'Guest Authorization Expired'), ('COURIER_ALERT', 'Courier Visit Alert')], max_length=35),
        ),
    ]

