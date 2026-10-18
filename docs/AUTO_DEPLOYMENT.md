# Automated Deployment with GitHub Actions — Restaurant POS MERN

This document describes how to configure and operate the automated Continuous Deployment (CD) pipeline using GitHub Actions and SSH on Ubuntu EC2.

---

## 1. Overview of the Pipeline

The workflow file is located at:
[`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml)

### Workflow Lifecycle

```text
Developer pushes to 'master' branch
               │
               ▼
  ┌─────────────────────────────────────────────────────────┐
  │ Job 1: Build & Validate (GitHub-hosted ubuntu-latest)   │
  │ - Checkout repository                                   │
  │ - Setup Node.js 20 & cache npm                          │
  │ - Check backend syntax: node --check src/server.js      │
  │ - Install Web dependencies: npm ci                      │
  │ - Verify frontend production build: npm run build       │
  └────────────────────────────┬────────────────────────────┘
                               │ (Only runs if Job 1 passes)
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │ Job 2: Deploy to Ubuntu EC2 (via SSH)                   │
  │ - Establish encrypted SSH connection to EC2 instance    │
  │ - Navigate to application directory (APP_DIR)           │
  │ - Pull latest changes: git pull --ff-only origin master │
  │ - Execute: bash scripts/deploy.sh                       │
  │   - Re-tags current images to :previous                 │
  │   - Builds new Docker images                            │
  │   - Updates containers with zero downtime               │
  │ - Execute: bash scripts/health-check.sh                 │
  │   - Verifies /api/health returns HTTP 200               │
  │   - Automatically rolls back if health check fails      │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. Step 1: Generate a Dedicated Deployment SSH Key

On your local development machine or on the EC2 host:

```bash
# Generate dedicated Ed25519 deploy key
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key -N ""
```

This creates:
- `~/.ssh/github_deploy_key` (Private key — paste into GitHub Secrets)
- `~/.ssh/github_deploy_key.pub` (Public key — append to EC2 authorized_keys)

### Add Public Key to EC2 Server
Log into your EC2 server and append the public key:
```bash
cat >> ~/.ssh/authorized_keys << 'EOF'
<PASTE_CONTENTS_OF_github_deploy_key.pub_HERE>
EOF
chmod 600 ~/.ssh/authorized_keys
```

---

## 3. Step 2: Configure GitHub Repository Secrets

In your GitHub repository:
1. Navigate to **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret** and add the following:

| Secret Name | Value Example | Description |
|---|---|---|
| `EC2_HOST` | `54.123.45.67` or `pos.yourdomain.com` | Public IP or DNS of the EC2 instance |
| `EC2_USER` | `ubuntu` | Ubuntu system username |
| `EC2_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | Complete private key generated above |
| `EC2_SSH_PORT` | `22` (Optional, defaults to 22) | Custom SSH port if modified |
| `APP_DIR` | `~/restaurant-pos-demo` | Absolute path to cloned repository on EC2 |

> [!CAUTION]
> Never commit SSH private keys, `.pem` files, or `.env` files into the Git repository.

---

## 4. Step 3: Server-side Repository Setup

Ensure the server repository is cloned and clean before enabling automated CI/CD:

```bash
# SSH into EC2
ssh -i ~/.ssh/your-original-key.pem ubuntu@<EC2_IP>

# Clone repository to the expected APP_DIR if not already present:
git clone -b master https://github.com/Ovesh89/restaurant-pos-demo.git ~/restaurant-pos-demo
cd ~/restaurant-pos-demo

# Ensure .env is present
cp .env.example .env
nano .env # configure live credentials

# Ensure scripts have executable permissions:
chmod +x scripts/*.sh

# Initial manual run to verify everything works:
bash scripts/deploy.sh
```

---

## 5. Step 4: Triggering Deployments

### Automatic Trigger
Every `git push origin master` automatically triggers the workflow.

### Manual Trigger (Workflow Dispatch)
You can also trigger the deployment manually at any time without pushing code:
1. Go to the **Actions** tab on GitHub.
2. Select **Production Docker Deployment** in the left sidebar.
3. Click **Run workflow** -> Select `Branch: master` -> Click **Run workflow**.

---

## 6. Failure Recovery & Auto-Rollback

If a commit introduces an issue:
1. The **Build & Validate** job will catch syntax errors or Vite compile failures before touching the EC2 server.
2. If the build succeeds but the runtime fails on EC2 (e.g. database timeout or misconfigured environment):
   - `scripts/deploy.sh` detects that `scripts/health-check.sh` failed.
   - It invokes `scripts/rollback.sh`.
   - `scripts/rollback.sh` retags `:previous` Docker images back to `:latest` and restarts the healthy containers.
   - The GitHub Actions workflow fails with an error and logs the container output for immediate inspection.
