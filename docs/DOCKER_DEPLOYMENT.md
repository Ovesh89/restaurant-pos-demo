# Docker Deployment Guide — Restaurant POS MERN

## 1. Architecture Overview

The Restaurant POS MERN application is containerized using a secure multi-container architecture orchestrated with **Docker Compose**:

```text
[ Browser / Mobile Client ]
             │
             ▼
  ┌────────────────────────────────────────────────────────┐
  │ Ubuntu EC2 Host (Public IP / Domain)                  │
  │                                                        │
  │   Host Port: 80 (and optional 443)                     │
  │         │                                              │
  │         ▼                                              │
  │   ┌──────────────────────────────────────────────┐     │
  │   │  Web Container (restaurant-pos-web)          │     │
  │   │  - Base: nginx:alpine                        │     │
  │   │  - Serves: Pre-compiled React 18 SPA         │     │
  │   │  - Location /      -> Static HTML/JS Assets  │     │
  │   │  - Location /api/* -> Reverse Proxy          │     │
  │   └───────────────────────┬──────────────────────┘     │
  │                           │ (Internal Docker Network)  │
  │                           │ pos-network:8001           │
  │                           ▼                            │
  │   ┌──────────────────────────────────────────────┐     │
  │   │  Backend Container (restaurant-pos-backend)  │     │
  │   │  - Base: node:20-alpine                      │     │
  │   │  - User: node (non-root)                     │     │
  │   │  - Port: 8001 (INTERNAL ONLY)                │     │
  │   │  - Health: /api/health                       │     │
  │   └───────────────────────┬──────────────────────┘     │
  │                           │                            │
  └───────────────────────────┼────────────────────────────┘
                              │ TLS (mongodb+srv://)
                              ▼
                   [ MongoDB Atlas Free Tier ]
```

### Key Security & Isolation Features

1. **Backend Port Isolation**: Port `8001` is defined with `expose: ["8001"]` inside `compose.yaml` and is **never mapped to host ports**. External clients cannot reach the Express API directly; all traffic passes through Nginx.
2. **Same-Origin API Routing**: The frontend communicates via relative `/api/v1` paths. Nginx terminates requests and proxies `/api/*` to `http://backend:8001/api/*`, eliminating CORS complexities in production.
3. **Non-Root Execution**: The backend container runs under the unprivileged `node` user (UID/GID 1000).
4. **Lean Multi-Stage Builds**: The frontend image discards build tools (`npm`, `node_modules`, `vite`) and serves only compiled static assets from a lightweight Alpine Nginx runner (~25MB).
5. **No Embedded Secrets**: Frontend build arguments contain only public configuration (`VITE_API_BASE_URL=/api/v1`). Backend secrets (`MONGODB_URI`, `SECRET_KEY`) reside exclusively in server-side untracked `.env`.

---

## 2. Directory Structure of Docker Assets

```text
restaurant-pos-demo/
├── compose.yaml                # Production Docker Compose specification
├── .env.example                # Template with configuration placeholders
├── scripts/
│   ├── deploy.sh               # Safe deployment automation script
│   ├── health-check.sh         # Live endpoint health validation script
│   └── rollback.sh             # Instant image rollback script
├── apps/
│   ├── backend/
│   │   ├── Dockerfile          # Node 20 LTS Alpine runtime
│   │   └── .dockerignore       # Excludes tests, node_modules, local .env
│   └── web/
│       ├── Dockerfile          # Multi-stage: Node build -> Nginx runner
│       ├── nginx.conf          # Nginx reverse proxy and SPA routing
│       └── .dockerignore       # Excludes node_modules, dist, local .env
```

---

## 3. Prerequisites on Ubuntu EC2

1. **Docker Engine & Compose Plugin**:
   ```bash
   docker --version          # Docker version 24.0+ recommended
   docker compose version    # Docker Compose version v2.20+ recommended
   ```
2. **User Permissions**:
   The deploy user (`ubuntu`) should belong to the `docker` group so sudo is not required:
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```
3. **AWS Security Group**:
   - Inbound TCP `80` (HTTP): `0.0.0.0/0`
   - Inbound TCP `443` (HTTPS): `0.0.0.0/0`
   - Inbound TCP `22` (SSH): Restrict to your specific IP address.
   - **Do NOT open port 8001 or 27017**.

---

## 4. Initial Step-by-Step Deployment

### Step 4.1: Clone the Repository
```bash
git clone -b master https://github.com/Ovesh89/restaurant-pos-demo.git ~/restaurant-pos-demo
cd ~/restaurant-pos-demo
```

### Step 4.2: Configure Environment Variables
Copy the template and configure your production credentials:
```bash
cp .env.example .env
nano .env
```
Ensure the following variables are configured:
```ini
NODE_ENV=production
PORT=8001
HTTP_PORT=80
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=restaurant_pos_demo
SECRET_KEY=generate-a-strong-random-64-character-secret-key-here
LOG_LEVEL=info
```
> [!IMPORTANT]
> Verify that the MongoDB Atlas Network Access whitelist contains the public IP of your EC2 instance (or `0.0.0.0/0` with strong password authentication).

### Step 4.3: Deploy Using Automation Script
Run the automated deployment script:
```bash
bash scripts/deploy.sh
```
This script will:
1. Validate system prerequisites and `.env` presence.
2. Verify Compose configuration syntax.
3. Back up currently running images (if any) as `:previous` tags.
4. Build the latest images reproducibly from lockfiles.
5. Launch the containers in the background (`docker compose up -d`).
6. Poll `/api/health` until both the service and MongoDB Atlas report `ok` and `connected`.

---

## 5. Routine Operations & Maintenance

### Check Container Status
```bash
docker compose ps
```
Expected output:
```text
NAME                     IMAGE                          STATUS                   PORTS
restaurant-pos-backend   restaurant-pos-backend:latest   Up 5 minutes (healthy)   8001/tcp
restaurant-pos-web       restaurant-pos-web:latest       Up 5 minutes (healthy)   0.0.0.0:80->80/tcp
```

### Inspect Container Logs
```bash
# Follow logs for all services:
docker compose logs -f

# Follow backend only:
docker compose logs -f backend

# Follow web/nginx only:
docker compose logs -f web
```

### Run Health Check Manually
```bash
bash scripts/health-check.sh
```

### Stop / Restart the Application
```bash
# Graceful restart:
docker compose restart

# Graceful stop:
docker compose down
```

---

## 6. Safe Rollback Procedure

If a newly deployed image fails or behaves unexpectedly:

```bash
bash scripts/rollback.sh
```

The rollback script automatically:
1. Inspects the local Docker registry for `restaurant-pos-backend:previous` and `restaurant-pos-web:previous`.
2. Re-tags them back to `:latest`.
3. Restarts the containers with the previous image release.
4. Verifies health via `/api/health`.
5. Preserves all database data and `.env` configurations intact.

---

## 7. Resource Constraints for Small EC2 Instances (t2.micro / t3.micro)

Small EC2 instances have 1 GB RAM. Multi-stage Docker builds (specifically `npm run build` with Vite) can spike memory usage.

### Recommended Swap Configuration (Essential for 1 GB Instances)
To prevent the Linux OOM killer from terminating the build:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
Verify swap:
```bash
free -h
```
