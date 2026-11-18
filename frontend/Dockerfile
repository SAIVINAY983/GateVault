# ==============================================================================
# GateVault Frontend - Hardened Multi-Stage Production Dockerfile
# Stage 1: Build React 19 + Vite static assets
# Stage 2: Serve via hardened, unprivileged Nginx on Alpine Linux
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build the React Application
# ------------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Cache package dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build-time environment variables
# In Docker, Nginx acts as reverse proxy on port 3000, so /api/ routes to backend:8000
ARG VITE_API_URL=/api/
ARG VITE_GOOGLE_CLIENT_ID=""

ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Compile production Vite bundle
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Hardened Unprivileged Nginx Runtime
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default configuration and static welcome page
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom Nginx configuration with SPA fallback, security headers, and reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build from builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Configure ownership and permissions for unprivileged non-root nginx execution
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html /etc/nginx/conf.d

# Switch to unprivileged non-root user (UID 101)
USER nginx

# Expose frontend port (unprivileged port > 1024)
EXPOSE 3000

# Healthcheck validating local web server availability
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
