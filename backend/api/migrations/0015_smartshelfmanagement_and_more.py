from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import api.models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_guestpickupauthorization_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='storageshelf',
            name='max_parcel_size',
            field=models.CharField(
                choices=[('SMALL', 'Small'), ('MEDIUM', 'Medium'), ('LARGE', 'Large')],
                default='LARGE',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='storageshelf',
            name='status',
            field=models.CharField(
                choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive'), ('MAINTENANCE', 'Under Maintenance')],
                default='ACTIVE',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='storageshelf',
            name='maintenance_notes',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='parcel',
            name='parcel_size',
            field=models.CharField(
                choices=[('SMALL', 'Small'), ('MEDIUM', 'Medium'), ('LARGE', 'Large')],
                default='MEDIUM',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='parcel',
            name='dimensions',
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='parcel',
            name='handling_instructions',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='ShelfReservation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('parcel_size', models.CharField(choices=[('SMALL', 'Small'), ('MEDIUM', 'Medium'), ('LARGE', 'Large')], default='MEDIUM', max_length=10)),
                ('reservation_token', models.CharField(default=api.models.generate_reservation_token, max_length=64, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('status', models.CharField(choices=[('ACTIVE', 'Active'), ('COMMITTED', 'Committed'), ('RELEASED', 'Released'), ('EXPIRED', 'Expired')], default='ACTIVE', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('committed_parcel', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reservation_used', to='api.parcel')),
                ('guard', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shelf_reservations', to=settings.AUTH_USER_MODEL)),
                ('shelf', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reservations', to='api.storageshelf')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ShelfAssignmentHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action_type', models.CharField(choices=[('INITIAL_INTAKE', 'Initial Intake Assignment'), ('RELOCATION', 'Parcel Relocation'), ('HANDOVER_RELEASE', 'Handover Release'), ('MAINTENANCE_RELOCATION', 'Maintenance Relocation')], default='INITIAL_INTAKE', max_length=30)),
                ('reason', models.TextField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('guard', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='shelf_assignments', to=settings.AUTH_USER_MODEL)),
                ('new_shelf', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='relocations_to', to='api.storageshelf')),
                ('parcel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shelf_history', to='api.parcel')),
                ('previous_shelf', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='relocations_from', to='api.storageshelf')),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
    ]

