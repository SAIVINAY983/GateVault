from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_parcelqrpickuppass_pickupverification_qr_pass_and_more'),
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
                    ('HOUSEHOLD_UPDATE', 'Household Authorization Update'),
                    ('HOUSEHOLD_DELIVERY', 'Household Delivery Handover'),
                    ('SHIFT_HANDOVER', 'Guard Shift Handover'),
                ],
                max_length=35,
            ),
        ),
        migrations.CreateModel(
            name='GuardShift',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('shift_start', models.DateTimeField(default=django.utils.timezone.now)),
                ('shift_end', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('HANDED_OVER', 'Handed Over'), ('COMPLETED', 'Completed')], default='ACTIVE', max_length=20)),
                ('handover_notes', models.TextField(blank=True, null=True)),
                ('summary_data', models.JSONField(blank=True, null=True)),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('is_admin_override', models.BooleanField(default=False)),
                ('admin_override_reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('accepted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='accepted_guard_shifts', to=settings.AUTH_USER_MODEL)),
                ('admin_override_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='admin_override_shifts', to=settings.AUTH_USER_MODEL)),
                ('guard', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='guard_shifts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-shift_start'],
            },
        ),
    ]

