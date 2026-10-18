# Ubuntu Server Setup Guide — Restaurant POS MERN

This guide provides end-to-end instructions for provisioning a fresh Ubuntu 22.04 / 24.04 LTS server (such as an AWS EC2 instance) to run the containerized Restaurant POS application.

---

## 1. System Update and Swap Configuration

### 1.1 Update Package Index
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git ufw ca-certificates gnupg lsb-release
```

### 1.2 Enable 2 GB Swap (Critical for t2.micro / t3.micro with 1 GB RAM)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

---

## 2. Install Docker Engine & Docker Compose Plugin

Use the official Docker apt repository for stability and security:

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable --now docker

# Grant current user non-root Docker privileges
sudo usermod -aG docker $USER

# Apply group membership without logging out
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## 3. Configure Server Firewall (UFW) & AWS Security Groups

### 3.1 UFW Firewall Configuration
```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable UFW
sudo ufw enable
sudo ufw status verbose
```

### 3.2 AWS EC2 Security Group Rules
Ensure your AWS EC2 Security Group matches:
| Type | Protocol | Port Range | Source | Description |
|---|---|---|---|---|
| SSH | TCP | 22 | `<your-admin-ip>/32` | Administrative SSH |
| HTTP | TCP | 80 | `0.0.0.0/0` | Public Web traffic |
| HTTPS | TCP | 443 | `0.0.0.0/0` | Secure Web traffic |
| Custom TCP | TCP | 8001 | — | **DO NOT OPEN** (Internal only) |

---

## 4. Transitioning from Existing PM2 & Host Nginx (If Applicable)

If the server previously ran the backend via PM2 and frontend via host Nginx:

```bash
# Check existing PM2 status
pm2 status

# Stop and disable PM2 service to free port 8001
pm2 stop all || true
pm2 delete all || true
pm2 save || true

# Stop host Nginx to free port 80/443 for the Docker web container
sudo systemctl stop nginx
sudo systemctl disable nginx

# Verify ports 80, 443, and 8001 are free
sudo ss -ltnp | grep -E ':80 |:443 |:8001 '
```

---

## 5. Clone Repository and Configure Environment

### 5.1 Clone Target Branch
```bash
cd ~
git clone -b master https://github.com/Ovesh89/restaurant-pos-demo.git ~/restaurant-pos-demo
cd ~/restaurant-pos-demo
```

### 5.2 Configure Production `.env`
```bash
cp .env.example .env
nano .env
```
Provide the production secrets:
```ini
NODE_ENV=production
PORT=8001
HTTP_PORT=80
MONGODB_URI=mongodb+srv://pos_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=restaurant_pos_demo
SECRET_KEY=put-a-strong-random-key-here-min-32-chars
LOG_LEVEL=info
```

### 5.3 Verify MongoDB Atlas Whitelist
In MongoDB Atlas:
1. Navigate to **Network Access**.
2. Click **Add IP Address**.
3. Add your EC2 Elastic / Public IP address (or `0.0.0.0/0` for global access with strong database user credentials).

---

## 6. Build and Launch Containers

Run the production deployment script:
```bash
bash scripts/deploy.sh
```

Inspect output to confirm healthy status:
```bash
docker compose ps
```

---

## 7. Verify Application Endpoints

### 7.1 Backend Direct Health Check (via Nginx proxy on Port 80)
```bash
curl -i http://127.0.0.1/api/health
```
Expected response:
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"ok","service":"restaurant-pos-backend","database":"connected","mongodb":{"status":"connected","database":"restaurant_pos_demo","version":"MongoDB Atlas"}}
```

### 7.2 Frontend Static Assets
```bash
curl -i http://127.0.0.1/
```
Expected response: `HTTP/1.1 200 OK` with HTML title `Green Garden Pure Veg POS`.

---

## 8. Configure HTTPS with Domain and Let's Encrypt

When using a custom domain (e.g. `pos.greengardenveg.demo`):

### Option A: Certbot on Host with Reverse Proxy
If you prefer running host Nginx with Certbot:
1. Point your domain DNS A record to your EC2 public IP.
2. In `compose.yaml`, map web port to an alternative internal port (e.g. `8080:80`):
   ```yaml
   ports:
     - "127.0.0.1:8080:80"
   ```
3. Install host Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx nginx
   ```
4. Configure `/etc/nginx/sites-available/restaurant-pos`:
   ```nginx
   server {
       server_name yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
5. Obtain SSL Certificate:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Option B: Cloudflare / AWS Application Load Balancer (ALB)
Terminate SSL at Cloudflare or AWS ALB, proxying port 80 to the EC2 host. This requires zero certificate management on the server.

---

## 9. Troubleshooting & Recovery

| Issue | Diagnosis | Resolution |
|---|---|---|
| `502 Bad Gateway` on `/api/*` | Backend container is starting or crashed | Run `docker compose logs -f backend`. Verify `MONGODB_URI` and network access. |
| Container out-of-memory during build | Build failed during Vite compilation | Ensure 2 GB swap is active (`free -h`). |
| Health check returns 503 | MongoDB Atlas disconnected | Check Atlas IP whitelist and credentials in `.env`. |
| Port 80 conflict on startup | Another process is holding port 80 | Run `sudo ss -ltnp \| grep :80`. Stop host Nginx or Apache if running. |
| Rollback needed after bad deployment | Image failed health check | Run `bash scripts/rollback.sh`. |
