from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_guardshift'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='parcel',
            name='is_high_value',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='parcel',
            name='declared_value',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='parcel',
            name='resident_presence_confirmed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='parcel',
            name='extra_verification_notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='expecteddelivery',
            name='is_high_value',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='expecteddelivery',
            name='declared_value',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.CreateModel(
            name='CommunityDeliveryPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_type', models.CharField(choices=[('NORMAL', 'Normal Courier Parcels'), ('FOOD', 'Food Deliveries'), ('COD', 'Cash on Delivery (COD)'), ('OPEN_BOX', 'Open-Box Deliveries'), ('HIGH_VALUE', 'High-Value Parcels')], max_length=20, unique=True)),
                ('delivery_mode', models.CharField(choices=[('DIRECT_TO_FLAT', 'Direct to Flat'), ('GATEHOUSE_ONLY', 'Gatehouse Only'), ('RESIDENT_PREFERENCE', 'Resident Preference'), ('AUTHORIZED_RECEIVER_ONLY', 'Authorized Receiver Only')], default='GATEHOUSE_ONLY', max_length=30)),
                ('allow_direct_to_flat', models.BooleanField(default=False)),
                ('require_gatehouse_intake', models.BooleanField(default=True)),
                ('allow_household_receiver', models.BooleanField(default=True)),
                ('require_resident_presence', models.BooleanField(default=False)),
                ('require_extra_verification', models.BooleanField(default=False)),
                ('bypass_storage_shelf', models.BooleanField(default=False)),
                ('enable_cod_coordination', models.BooleanField(default=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_community_policies', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_community_policies', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['delivery_type'],
            },
        ),
        migrations.CreateModel(
            name='TowerDeliveryPolicy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_type', models.CharField(choices=[('NORMAL', 'Normal Courier Parcels'), ('FOOD', 'Food Deliveries'), ('COD', 'Cash on Delivery (COD)'), ('OPEN_BOX', 'Open-Box Deliveries'), ('HIGH_VALUE', 'High-Value Parcels')], max_length=20)),
                ('delivery_mode', models.CharField(choices=[('DIRECT_TO_FLAT', 'Direct to Flat'), ('GATEHOUSE_ONLY', 'Gatehouse Only'), ('RESIDENT_PREFERENCE', 'Resident Preference'), ('AUTHORIZED_RECEIVER_ONLY', 'Authorized Receiver Only')], default='GATEHOUSE_ONLY', max_length=30)),
                ('allow_direct_to_flat', models.BooleanField(default=False)),
                ('require_gatehouse_intake', models.BooleanField(default=True)),
                ('allow_household_receiver', models.BooleanField(default=True)),
                ('require_resident_presence', models.BooleanField(default=False)),
                ('require_extra_verification', models.BooleanField(default=False)),
                ('bypass_storage_shelf', models.BooleanField(default=False)),
                ('enable_cod_coordination', models.BooleanField(default=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_tower_policies', to=settings.AUTH_USER_MODEL)),
                ('tower', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_policies', to='api.tower')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_tower_policies', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['tower__name', 'delivery_type'],
                'unique_together': {('tower', 'delivery_type')},
            },
        ),
        migrations.CreateModel(
            name='DeliveryPolicyAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('policy_scope', models.CharField(default='COMMUNITY', max_length=20)),
                ('delivery_type', models.CharField(max_length=20)),
                ('action', models.CharField(choices=[('CREATED', 'Policy Created'), ('UPDATED', 'Policy Updated'), ('TOGGLED_ACTIVE', 'Status Toggled'), ('TOWER_OVERRIDE_SET', 'Tower Override Configured'), ('TOWER_OVERRIDE_REMOVED', 'Tower Override Removed')], max_length=40)),
                ('changes_summary', models.TextField()),
                ('previous_state', models.JSONField(blank=True, null=True)),
                ('new_state', models.JSONField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('tower', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.tower')),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
    ]

