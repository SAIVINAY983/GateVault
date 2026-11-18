# ==============================================================================
# GateVault Backend - Production Multi-Stage Hardened Dockerfile
# Base: Official Python 3.13 Slim on Debian 12 (Bookworm)
# Security Features: Multi-stage build, no compilers in runtime, non-root user,
#                    minimal attack surface, unbuffered logging.
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Dependencies
# ------------------------------------------------------------------------------
FROM python:3.13-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /install

# Install build-time compilers and development headers required for C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages into isolated user directory
COPY requirements.txt /install/
RUN pip install --no-cache-dir --user -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 2: Hardened Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.13-slim-bookworm AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/gatevault/.local/bin:$PATH

WORKDIR /app

# Install ONLY shared runtime libraries (no build tools, minimal footprint)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    zlib1g \
    curl \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated unprivileged system user and group (UID/GID 10001)
RUN groupadd -g 10001 gatevault && \
    useradd -u 10001 -g gatevault -s /bin/sh -m -d /home/gatevault gatevault

# Copy Python packages from builder stage to unprivileged user's directory
COPY --from=builder --chown=gatevault:gatevault /root/.local /home/gatevault/.local

# Pre-create writable application directories with strict non-root ownership
RUN mkdir -p /app/media /app/backups /app/staticfiles && \
    chown -R gatevault:gatevault /app

# Copy application source code with non-root ownership
COPY --chown=gatevault:gatevault . /app/

# Normalize line endings and set execution permissions on entrypoint script
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && \
    chmod 755 /app/docker-entrypoint.sh

# Switch to unprivileged non-root user
USER gatevault

# Expose backend application port
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -f http://127.0.0.1:8000/api/towers/ || exit 1

# Define entrypoint and default execution command
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "backend.wsgi:application"]
