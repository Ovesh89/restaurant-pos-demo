#!/usr/bin/env bash
# ==============================================================================
# Restaurant POS MERN — Production Health Check Script
# Validates both container runtime state and API endpoint responses.
# ==============================================================================

set -euo pipefail

# ANSI color codes for readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_ATTEMPTS="${MAX_ATTEMPTS:-12}"
SLEEP_INTERVAL="${SLEEP_INTERVAL:-5}"
PORT="${HTTP_PORT:-80}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"

echo -e "${BLUE}[INFO] Starting Restaurant POS Health Check...${NC}"
echo -e "${BLUE}[INFO] Target Endpoint: ${HEALTH_URL}${NC}"
echo -e "${BLUE}[INFO] Max Attempts: ${MAX_ATTEMPTS} (interval: ${SLEEP_INTERVAL}s)${NC}"

# Step 1: Verify Docker containers are running
echo -e "\n${BLUE}--- Step 1: Checking Docker Container Status ---${NC}"
if ! docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.State}}" 2>/dev/null; then
    echo -e "${RED}[ERROR] Failed to query Docker Compose services. Is Docker running?${NC}"
    exit 1
fi

# Step 2: Poll Health Endpoint through Nginx Reverse Proxy
echo -e "\n${BLUE}--- Step 2: Probing Public API Health Endpoint ---${NC}"
attempt=1
success=false

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    echo -n "Attempt ${attempt}/${MAX_ATTEMPTS}: Requesting ${HEALTH_URL}... "

    response=$(curl -sS -m 5 -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null || echo -e "\n000")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        if echo "$body" | grep -q '"status":"ok"' || echo "$body" | grep -q '"database":"connected"'; then
            echo -e "${GREEN}SUCCESS (HTTP 200)${NC}"
            echo -e "${GREEN}[OK] Response Payload: ${body}${NC}"
            success=true
            break
        else
            echo -e "${YELLOW}HTTP 200 received but database not connected: ${body}${NC}"
        fi
    else
        echo -e "${YELLOW}Pending (HTTP ${http_code})${NC}"
    fi

    attempt=$((attempt + 1))
    if [ "$attempt" -le "$MAX_ATTEMPTS" ]; then
        sleep "$SLEEP_INTERVAL"
    fi
done

if [ "$success" = true ]; then
    echo -e "\n${GREEN}======================================================${NC}"
    echo -e "${GREEN} [HEALTH CHECK PASSED] All services healthy & online!${NC}"
    echo -e "${GREEN}======================================================${NC}"
    exit 0
else
    echo -e "\n${RED}======================================================${NC}"
    echo -e "${RED} [HEALTH CHECK FAILED] API did not become healthy in time!${NC}"
    echo -e "${RED}======================================================${NC}"
    echo -e "${YELLOW}[DEBUG] Inspecting Backend Logs:${NC}"
    docker compose logs --tail=50 backend || true
    echo -e "${YELLOW}[DEBUG] Inspecting Web/Nginx Logs:${NC}"
    docker compose logs --tail=50 web || true
    exit 1
fi
