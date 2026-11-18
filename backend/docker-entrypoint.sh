#!/bin/sh
set -e

echo "========================================================"
echo "    GateVault Backend - Starting Container Services     "
echo "========================================================"

# Create media, backups, and staticfiles directories if they do not exist
mkdir -p /app/media /app/backups /app/staticfiles

# Apply database migrations
echo "[1/3] Applying database migrations..."
python manage.py migrate --noinput

# Seed initial GateVault community structure (idempotent)
echo "[2/3] Seeding GateVault community data..."
python manage.py seed_gatevault_community || true

# Collect static files for WhiteNoise / Django admin
echo "[3/3] Collecting static files..."
python manage.py collectstatic --noinput || true

echo "========================================================"
echo "    GateVault Backend is ready. Launching server...     "
echo "========================================================"

# Execute the passed command (default: Gunicorn)
exec "$@"

