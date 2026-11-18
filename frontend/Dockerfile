# ==========================================
# Stage 1: Build the React Application
# ==========================================
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

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Compile production Vite bundle
RUN npm run build

# ==========================================
# Stage 2: Production Nginx Server
# ==========================================
FROM nginx:alpine

# Copy custom Nginx configuration with SPA fallback and API reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build from builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose frontend port
EXPOSE 3000

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]

