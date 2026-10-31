from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_communitydeliverypolicy_towerdeliverypolicy_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='parcel',
            name='collected_by_role_type',
            field=models.CharField(
                choices=[
                    ('PRIMARY_RESIDENT', 'Primary Resident'),
                    ('DELEGATED_FLATMATE', 'Delegated Flatmate'),
                    ('HOUSEHOLD_MEMBER', 'Authorized Household Member'),
                    ('TEMPORARY_GUEST', 'Temporary Authorized Guest'),
                ],
                default='PRIMARY_RESIDENT',
                max_length=35,
            ),
        ),
        migrations.AlterField(
            model_name='pickupverification',
            name='verification_method',
            field=models.CharField(
                choices=[
                    ('PIN', '4-Digit PIN'),
                    ('QR', 'Secure QR Pass'),
                    ('DIRECT_DOORSTEP', 'Direct Doorstep Handover'),
                    ('GUEST_PASS', 'Temporary Guest Pass'),
                ],
                default='PIN',
                max_length=20,
            ),
        ),
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
                    ('POLICY_UPDATE', 'Delivery Policy Update'),
                    ('GUEST_AUTHORIZED', 'Guest Pickup Authorized'),
                    ('GUEST_COLLECTED', 'Guest Parcel Collected'),
                    ('GUEST_REVOKED', 'Guest Authorization Revoked'),
                    ('GUEST_EXPIRED', 'Guest Authorization Expired'),
                ],
                max_length=35,
            ),
        ),
        migrations.CreateModel(
            name='GuestPickupAuthorization',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('guest_name', models.CharField(max_length=150)),
                ('guest_mobile', models.CharField(max_length=20)),
                ('relationship', models.CharField(choices=[('FRIEND', 'Friend'), ('RELATIVE', 'Relative'), ('OTHER', 'Other')], default='FRIEND', max_length=20)),
                ('instructions', models.TextField(blank=True, null=True)),
                ('pass_code', models.CharField(blank=True, help_text='Display pass code (e.g. GV-GUEST-123456)', max_length=30, null=True)),
                ('token_hash', models.CharField(db_index=True, help_text='SHA-256 hash of the secure one-time guest token', max_length=64, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('USED', 'Used'), ('REVOKED', 'Revoked'), ('EXPIRED', 'Expired')], default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('actual_collector_name', models.CharField(blank=True, max_length=150, null=True)),
                ('parcel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='guest_authorizations', to='api.parcel')),
                ('resident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='guest_authorizations', to=settings.AUTH_USER_MODEL)),
                ('revoked_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revoked_guest_authorizations', to=settings.AUTH_USER_MODEL)),
                ('verified_by_guard', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_guest_authorizations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='pickupverification',
            name='guest_authorization',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verifications', to='api.guestpickupauthorization'),
        ),
    ]

