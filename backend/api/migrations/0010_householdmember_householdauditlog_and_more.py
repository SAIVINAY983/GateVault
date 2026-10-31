from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_parcelinspection_parcelincident_incidenthistory'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='residentprofile',
            name='is_primary',
            field=models.BooleanField(default=True, help_text='Designates primary resident who can authorize household members'),
        ),
        migrations.CreateModel(
            name='HouseholdMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=150)),
                ('relationship', models.CharField(choices=[('WIFE', 'Wife'), ('HUSBAND', 'Husband'), ('FATHER', 'Father'), ('MOTHER', 'Mother'), ('BROTHER', 'Brother'), ('SISTER', 'Sister'), ('OTHER', 'Other')], max_length=20)),
                ('mobile_number', models.CharField(max_length=20)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('is_active', models.BooleanField(default=True, help_text='Authorization active status')),
                ('can_receive_parcels', models.BooleanField(default=True)),
                ('can_receive_food', models.BooleanField(default=True)),
                ('can_collect_gatehouse_parcels', models.BooleanField(default=True)),
                ('can_view_delivery_notifications', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('flat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='household_members', to='api.flat')),
                ('primary_resident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='managed_household_members', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='household_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('flat', 'mobile_number')},
            },
        ),
        migrations.CreateModel(
            name='HouseholdAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('MEMBER_ADDED', 'Member Added'), ('PERMISSIONS_UPDATED', 'Permissions Updated'), ('MEMBER_ACTIVATED', 'Member Activated'), ('MEMBER_DEACTIVATED', 'Member Deactivated'), ('MEMBER_REVOKED', 'Authorization Revoked'), ('MEMBER_REMOVED', 'Member Removed')], max_length=30)),
                ('details', models.TextField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('household_member', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to='api.householdmember')),
                ('performed_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddField(
            model_name='parcel',
            name='actual_receiver',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='received_parcels_as_receiver', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='parcel',
            name='actual_receiver_name',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name='parcel',
            name='receiver_relationship',
            field=models.CharField(blank=True, max_length=30, null=True),
        ),
        migrations.AddField(
            model_name='parcel',
            name='household_member',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='parcels', to='api.householdmember'),
        ),
        migrations.AddField(
            model_name='parcel',
            name='delivery_location',
            field=models.CharField(choices=[('GATEHOUSE', 'Gatehouse'), ('DIRECT_TO_FLAT', 'Direct to Flat')], default='GATEHOUSE', max_length=30),
        ),
        migrations.AddField(
            model_name='parcel',
            name='direct_delivery_verification',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='parcel',
            name='direct_delivery_photo',
            field=models.ImageField(blank=True, null=True, upload_to='direct_deliveries/'),
        ),
        migrations.AlterField(
            model_name='parcel',
            name='collected_by_role_type',
            field=models.CharField(choices=[('PRIMARY_RESIDENT', 'Primary Resident'), ('DELEGATED_FLATMATE', 'Delegated Flatmate'), ('HOUSEHOLD_MEMBER', 'Authorized Household Member')], default='PRIMARY_RESIDENT', max_length=25),
        ),
        migrations.AlterField(
            model_name='parcel',
            name='status',
            field=models.CharField(choices=[('AWAITING_PICKUP', 'Awaiting Pickup'), ('OVERDUE', 'Overdue'), ('HANDED_OVER', 'Handed Over'), ('CANCELLED', 'Cancelled'), ('DELIVERY_ATTEMPTED', 'Delivery Attempted'), ('RESCHEDULED', 'Rescheduled'), ('DELIVERED_DIRECTLY_TO_FLAT', 'Delivered Directly to Flat')], default='AWAITING_PICKUP', max_length=30),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(choices=[('NEW_PARCEL', 'New Parcel'), ('FOOD_DELIVERY', 'Food Delivery'), ('OVERDUE', 'Overdue Parcel'), ('HANDOVER', 'Handover Completed'), ('CONDITION_ALERT', 'Parcel Condition Alert'), ('INCIDENT_UPDATE', 'Incident Status Update'), ('HOUSEHOLD_UPDATE', 'Household Authorization Update'), ('HOUSEHOLD_DELIVERY', 'Household Delivery Handover')], max_length=25),
        ),
    ]

