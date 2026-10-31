# Generated for Parcel Condition Inspection & Incident Management

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_parcel_collected_by_parcel_collected_by_role_type_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('NEW_PARCEL', 'New Parcel'),
                    ('FOOD_DELIVERY', 'Food Delivery'),
                    ('OVERDUE', 'Overdue Parcel'),
                    ('HANDOVER', 'Handover Completed'),
                    ('CONDITION_ALERT', 'Parcel Condition Alert'),
                    ('INCIDENT_UPDATE', 'Incident Status Update'),
                ],
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name='ParcelInspection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('condition', models.CharField(choices=[('INTACT', 'Intact'), ('DAMAGED', 'Damaged'), ('TAMPERED', 'Tampered'), ('OPENED', 'Opened')], default='INTACT', max_length=20)),
                ('remarks', models.TextField(blank=True, null=True)),
                ('photo', models.ImageField(blank=True, null=True, upload_to='inspections/')),
                ('courier_confirmed', models.BooleanField(default=False)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('acknowledged_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='acknowledged_inspections', to=settings.AUTH_USER_MODEL)),
                ('guard', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='performed_inspections', to=settings.AUTH_USER_MODEL)),
                ('parcel', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='inspection', to='api.parcel')),
            ],
        ),
        migrations.CreateModel(
            name='ParcelIncident',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(choices=[('DAMAGED', 'Parcel Damaged'), ('TAMPERED', 'Parcel Tampered With'), ('MISSING_CONTENTS', 'Missing Contents'), ('INCORRECT_PARCEL', 'Incorrect Parcel'), ('OTHER', 'Other')], max_length=30)),
                ('description', models.TextField()),
                ('evidence_photo', models.ImageField(blank=True, null=True, upload_to='incidents/')),
                ('status', models.CharField(choices=[('OPEN', 'Open'), ('UNDER_REVIEW', 'Under Review'), ('RESOLVED', 'Resolved'), ('REJECTED', 'Rejected')], default='OPEN', max_length=20)),
                ('resolution_notes', models.TextField(blank=True, null=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('parcel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incidents', to='api.parcel')),
                ('resident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reported_incidents', to=settings.AUTH_USER_MODEL)),
                ('resolved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resolved_incidents', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='IncidentHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('old_status', models.CharField(max_length=20)),
                ('new_status', models.CharField(max_length=20)),
                ('notes', models.TextField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('action_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('incident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='history', to='api.parcelincident')),
            ],
            options={
                'ordering': ['timestamp'],
            },
        ),
    ]

