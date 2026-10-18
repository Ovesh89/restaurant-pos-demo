#!/usr/bin/env bash
# ==============================================================================
# Restaurant POS MERN — Production Docker Deployment Script
# Safe, repeatable, automated rollout with health validation and auto-rollback.
# ==============================================================================

set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo -e "${BOLD}${BLUE}======================================================${NC}"
echo -e "${BOLD}${BLUE}  Restaurant POS MERN — Production Deployment        ${NC}"
echo -e "${BOLD}${BLUE}======================================================${NC}"

# --- Step 1: Pre-flight Verification ---
echo -e "\n${BLUE}[Step 1/6] Validating Prerequisites...${NC}"

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Docker is not installed or not in PATH.${NC}"
    echo -e "Please install Docker Engine: https://docs.docker.com/engine/install/ubuntu/"
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Docker Compose plugin is not installed.${NC}"
    echo -e "Please install compose plugin: sudo apt-get install docker-compose-plugin"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Cannot connect to Docker daemon. Is the service running?${NC}"
    echo -e "Try: sudo systemctl start docker (or ensure your user is in the 'docker' group)"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${RED}[ERROR] Production environment file (.env) is missing in ${PROJECT_ROOT}!${NC}"
    echo -e "${YELLOW}Please create .env from .env.example:${NC}"
    echo -e "  cp .env.example .env"
    echo -e "  nano .env  # Configure MONGODB_URI, SECRET_KEY, etc."
    exit 1
fi

# Basic sanity check on .env contents
if grep -q "replace-with-a-secure-random" .env || grep -q "<username>:<password>" .env; then
    echo -e "${YELLOW}[WARNING] .env contains unconfigured default placeholders! Verify before deploying.${NC}"
fi

echo -e "${GREEN}[OK] Prerequisites verified.${NC}"

# --- Step 2: Validate Compose Configuration ---
echo -e "\n${BLUE}[Step 2/6] Validating Docker Compose Configuration...${NC}"
docker compose config --quiet
echo -e "${GREEN}[OK] Compose syntax and environment variables are valid.${NC}"

# --- Step 3: Backup Currently Running Images for Safe Rollback ---
echo -e "\n${BLUE}[Step 3/6] Backing Up Current Image Tags for Rollback...${NC}"
if docker image inspect restaurant-pos-backend:latest >/dev/null 2>&1; then
    docker tag restaurant-pos-backend:latest restaurant-pos-backend:previous
    echo -e "  Tagged restaurant-pos-backend:previous"
fi
if docker image inspect restaurant-pos-web:latest >/dev/null 2>&1; then
    docker tag restaurant-pos-web:latest restaurant-pos-web:previous
    echo -e "  Tagged restaurant-pos-web:previous"
fi

# --- Step 4: Build New Application Images ---
echo -e "\n${BLUE}[Step 4/6] Building Production Container Images...${NC}"
docker compose build --progress=plain
echo -e "${GREEN}[OK] Container images built successfully.${NC}"

# --- Step 5: Start / Update Services ---
echo -e "\n${BLUE}[Step 5/6] Starting Services with Docker Compose...${NC}"
docker compose up -d --remove-orphans
echo -e "${GREEN}[OK] Containers launched.${NC}"

# --- Step 6: Health Validation ---
echo -e "\n${BLUE}[Step 6/6] Verifying Live Application Health...${NC}"
if bash "${SCRIPT_DIR}/health-check.sh"; then
    echo -e "\n${BOLD}${GREEN}======================================================${NC}"
    echo -e "${BOLD}${GREEN} [DEPLOYMENT SUCCESSFUL] All services are operational!${NC}"
    echo -e "${BOLD}${GREEN}======================================================${NC}"
    docker compose ps
    exit 0
else
    echo -e "\n${BOLD}${RED}======================================================${NC}"
    echo -e "${BOLD}${RED} [DEPLOYMENT FAILED] Health check failed after update!${NC}"
    echo -e "${BOLD}${RED}======================================================${NC}"

    # Check if rollback is feasible
    if [ -f "${SCRIPT_DIR}/rollback.sh" ] && docker image inspect restaurant-pos-backend:previous >/dev/null 2>&1; then
        echo -e "${YELLOW}[NOTICE] Attempting automatic rollback to previous release...${NC}"
        bash "${SCRIPT_DIR}/rollback.sh" || {
            echo -e "${RED}[FATAL] Rollback also encountered errors. Inspect manually!${NC}"
            exit 1
        }
    else
        echo -e "${RED}No previous backup image found to roll back to.${NC}"
        echo -e "Inspect logs with: docker compose logs -f"
        exit 1
    fi
fi
