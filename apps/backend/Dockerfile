# ==============================================================================
# Restaurant POS Backend — Production Dockerfile
# Node.js 20 LTS Alpine Image
# ==============================================================================

FROM node:20-alpine AS runtime

# Install wget for container healthchecks
RUN apk add --no-cache wget

# Set environment
ENV NODE_ENV=production
ENV PORT=8001

# Create and set working directory
WORKDIR /app

# Ensure proper permissions for the node user
RUN chown -R node:node /app

# Install production dependencies first (layer caching)
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source code
COPY --chown=node:node src ./src

# Expose internal port (never exposed directly to host / public internet)
EXPOSE 8001

# Container Healthcheck using native /api/health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8001/api/health || exit 1

# Start the production Express API server
CMD ["node", "src/server.js"]
