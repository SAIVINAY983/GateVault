from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_householdmember_householdauditlog_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ParcelQRPickupPass',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('collector_role_type', models.CharField(choices=[('PRIMARY_RESIDENT', 'Primary Resident'), ('DELEGATED_FLATMATE', 'Delegated Flatmate')], default='PRIMARY_RESIDENT', max_length=35)),
                ('token_hash', models.CharField(db_index=True, help_text='SHA-256 hash of the secure pickup pass token', max_length=64, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('USED', 'Used'), ('REVOKED', 'Revoked'), ('EXPIRED', 'Expired')], default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('authorized_collector', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='authorized_qr_passes', to=settings.AUTH_USER_MODEL)),
                ('parcel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='qr_passes', to='api.parcel')),
                ('revoked_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revoked_qr_passes', to=settings.AUTH_USER_MODEL)),
                ('verified_by_guard', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verified_qr_passes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='pickupverification',
            name='verification_method',
            field=models.CharField(choices=[('PIN', '4-Digit PIN'), ('QR', 'Secure QR Pass'), ('DIRECT_DOORSTEP', 'Direct Doorstep Handover')], default='PIN', max_length=20),
        ),
        migrations.AddField(
            model_name='pickupverification',
            name='qr_pass',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='verifications', to='api.parcelqrpickuppass'),
        ),
    ]

