#!/usr/bin/env bash
# ==============================================================================
# Restaurant POS MERN — Safe Deployment Rollback Script
# Reverts to the previously tagged working Docker images and validates health.
# ==============================================================================

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo -e "${YELLOW}======================================================${NC}"
echo -e "${YELLOW}  Restaurant POS MERN — Deployment Rollback Tool     ${NC}"
echo -e "${YELLOW}======================================================${NC}"

# Check for existence of previous image backups
has_backend_backup=false
has_web_backup=false

if docker image inspect restaurant-pos-backend:previous >/dev/null 2>&1; then
    has_backend_backup=true
fi

if docker image inspect restaurant-pos-web:previous >/dev/null 2>&1; then
    has_web_backup=true
fi

if [ "$has_backend_backup" = false ] || [ "$has_web_backup" = false ]; then
    echo -e "${RED}[ERROR] Cannot perform automated rollback: previous backup images not found!${NC}"
    echo -e "${YELLOW}Current local images:${NC}"
    docker images | grep -E "restaurant-pos|REPOSITORY" || true
    echo -e "\n${YELLOW}Manual recovery options:${NC}"
    echo -e " 1. Inspect container logs: docker compose logs -f"
    echo -e " 2. Verify .env file: cat .env"
    echo -e " 3. Re-run deploy with previous Git commit: git checkout <commit-hash> && bash scripts/deploy.sh"
    exit 1
fi

echo -e "${BLUE}[INFO] Found backup images:${NC}"
echo -e " - restaurant-pos-backend:previous"
echo -e " - restaurant-pos-web:previous"

# Re-tag previous backup images as latest
echo -e "\n${BLUE}[INFO] Restoring previous images to latest tag...${NC}"
docker tag restaurant-pos-backend:previous restaurant-pos-backend:latest
docker tag restaurant-pos-web:previous restaurant-pos-web:latest

# Restart services with restored images
echo -e "\n${BLUE}[INFO] Restarting containers with previous image release...${NC}"
docker compose up -d --remove-orphans

# Validate restored deployment
echo -e "\n${BLUE}[INFO] Verifying health of restored deployment...${NC}"
if bash "${SCRIPT_DIR}/health-check.sh"; then
    echo -e "\n${GREEN}[SUCCESS] Deployment rolled back successfully to previous release!${NC}"
    exit 0
else
    echo -e "\n${RED}[CRITICAL] Health check failed even after rollback! Check docker compose logs.${NC}"
    exit 1
fi
