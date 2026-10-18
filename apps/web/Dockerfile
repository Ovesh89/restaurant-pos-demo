# ==============================================================================
# Restaurant POS Web Frontend — Multi-stage Production Dockerfile
# Stage 1: Node.js 20 LTS Alpine (Build React + Vite SPA)
# Stage 2: Nginx Alpine (Serve static assets & reverse proxy API)
# ==============================================================================

# --- Stage 1: Build Static Assets ---
FROM node:20-alpine AS builder

WORKDIR /app

# Build arguments for frontend configuration (no secrets!)
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_DATA_PROVIDER=api
ARG VITE_DEFAULT_BRANCH_ID=branch-main

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_DATA_PROVIDER=${VITE_DATA_PROVIDER}
ENV VITE_DEFAULT_BRANCH_ID=${VITE_DEFAULT_BRANCH_ID}
ENV NODE_ENV=production

# Install dependencies using package-lock.json for deterministic builds
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build config
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY public ./public
COPY src ./src

# Build production assets into /app/dist
RUN npm run build

# --- Stage 2: Production Nginx Server ---
FROM nginx:alpine AS runner

# Install wget for container health check
RUN apk add --no-cache wget

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose web port (port 80)
EXPOSE 80

# Health check verifies Nginx serves frontend and proxies /api/health
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
