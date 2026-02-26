# Production Deployment Guide

Complete guide for deploying the Debate Arena platform on a VPS using Docker with GitHub Actions CI/CD.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial VPS Setup](#initial-vps-setup)
4. [GitHub Container Registry Setup](#github-container-registry-setup)
5. [Environment Configuration](#environment-configuration)
6. [Nginx & SSL Setup](#nginx--ssl-setup)
7. [First Deployment](#first-deployment)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Deployment Scripts](#deployment-scripts)
10. [Daily Operations](#daily-operations)
11. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

**Docker Containers (via docker-compose.yml):**
- `debate-db` - PostgreSQL 16 database
- `debate-redis` - Redis 7 cache & message broker
- `debate-backend` - Django + Daphne ASGI server (port 8000)
- `debate-frontend` - Next.js standalone server (port 3000)
- `debate-celery-worker` - Background task processor
- `debate-celery-beat` - Periodic task scheduler

**External Services:**
- Nginx - Reverse proxy with SSL termination
- GitHub Container Registry (GHCR) - Docker image registry

### Deployment Strategy

**CI/CD with GitHub Actions:**
1. **Build Phase** (GitHub Runner):
   - Run tests (backend + frontend)
   - Build Docker images with multi-stage builds
   - Tag images with git commit SHA (short) + "latest"
   - Push images to GitHub Container Registry (GHCR)

2. **Deploy Phase** (VPS):
   - Enable maintenance mode (nginx shows maintenance page)
   - Save current deployment state (image tags)
   - Pull new images from GHCR
   - Stop application containers (keep db/redis running)
   - Create database backup (pg_dump)
   - Start new containers and wait for health checks
   - Run database migrations
   - Perform smoke tests
   - Disable maintenance mode
   - **If any step fails:** Automatic rollback to previous images + restore database

**Deployment Features:**
- Image versioning with git commit SHA
- Database backup before migrations
- Health checks for all containers
- Automatic rollback on failure
- Maintenance mode during deployment (~2-3 minutes downtime)
- Database/Redis data persisted in Docker volumes

**Rollback Strategy:**
- **Container fails to start/unhealthy:** Restore previous images
- **Migration fails:** Restore database from pg_dump + restore previous images
- Previous database backup is automatically restored during rollback

---

## Prerequisites

- **VPS**: Ubuntu 22.04+ with root access
- **Domain**: DNS pointing to VPS IP
- **Resources**: Minimum 2 GB RAM, 2 CPU cores, 30 GB storage
- **GitHub**: Repository with GitHub Actions enabled
- **GitHub Packages**: Access to push to ghcr.io (included with GitHub account)

---

## Initial VPS Setup

### 1. Update System & Install Docker

Run `apt update`. Then, install Docker by following their official documentation.
You will also need `git` and `nginx`. You might want to install additional tools like `htop`, `curl`, etc.

```bash

### 2. Create Project Directory

```bash
mkdir -p /opt/opennoesis
cd /opt/opennoesis
```

### 3. Create Non-Root User (Recommended)

```bash
adduser deploy
usermod -aG sudo,docker deploy
# Continue as deploy user or use sudo for Docker commands
```

---

## GitHub Container Registry Setup

### 1. Create Personal Access Token (PAT)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with these scopes:
   - `read:packages` (for pulling images on VPS)
   - `write:packages` (for pushing images from GitHub Actions - automatic)
   - `repo` (for accessing private repositories if needed)
3. Save the token securely

### 2. Configure GHCR on VPS

```bash
# Login to GHCR on VPS
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Verify login
docker pull ghcr.io/YOUR_USERNAME/debate-backend:latest 2>&1 | grep -q "pull access denied" && echo "Login failed" || echo "Login successful"
```

---

## Environment Configuration

### 1. Clone Repository

```bash
cd /opt/opennoesis
git clone https://github.com/JustinACoder/ProjectOpenDebate.git .
# Or use SSH: git clone git@github.com:JustinACoder/ProjectOpenDebate.git .
```

### 2. Backend Environment

```bash
cd /opt/opennoesis/backend
cp .env.example .env
nano .env
```

**Required Variables:**
```bash
# Django Settings
SECRET_KEY=generate-a-secure-random-key-here-50-chars-minimum
ENV=prod
ADMIN_EMAIL=admin@yourdomain.com

# Database Configuration (PostgreSQL in Docker)
DB_PASSWORD=secure-database-password-here

# Redis Configuration (Redis in Docker)
REDIS_PASSWORD=secure-redis-password-here

# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Security
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Note:** DB_HOST, DB_PORT, DB_NAME, DB_USER, REDIS_HOST, etc. are configured in Django settings to use Docker service names (`debate-db`, `debate-redis`).

### 3. Frontend Environment

```bash
cd /opt/opennoesis/frontend
cp .env.example .env.prod
nano .env.prod
```

**Required Variables:**
```bash
NEXT_PUBLIC_API_URL=https://yourdomain.com
NEXT_PUBLIC_WS_URL=wss://yourdomain.com/ws/
DOCKER_API_URL=http://backend:8000
```

### 4. Create .env for Docker Compose

```bash
cd /opt/opennoesis
nano .env
```

Add these variables (used by docker-compose.yml):
```bash
DB_PASSWORD=same-as-backend-env-db-password
REDIS_PASSWORD=same-as-backend-env-redis-password
```

---

## Nginx & SSL Setup

### 1. Configure Nginx

```bash
# Copy nginx config
sudo cp /opt/opennoesis/nginx.conf /etc/nginx/sites-available/opennoesis

# Edit domain names
sudo nano /etc/nginx/sites-available/opennoesis
# Replace 'yourdomain.com' with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/opennoesis /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site

# Test configuration
sudo nginx -t
```

### 2. Setup SSL with Certbot

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Comment out SSL lines in nginx config temporarily
sudo nano /etc/nginx/sites-available/opennoesis
# Comment out the ssl_certificate lines

# Reload nginx
sudo systemctl reload nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot will auto-configure nginx for HTTPS
# Test auto-renewal
sudo certbot renew --dry-run

# Reload nginx
sudo systemctl reload nginx
```

### 3. Copy Maintenance Page

```bash
sudo cp /opt/opennoesis/maintenance.html /opt/opennoesis/
```

---

## First Deployment

### 1. Start Database and Redis

```bash
cd /opt/opennoesis
docker compose up -d db redis

# Wait for services to be ready
sleep 10

# Verify they're running
docker ps
docker compose logs db
docker compose logs redis
```

### 2. Pull Initial Images

Since GitHub Actions hasn't run yet, you'll need to build the initial images locally or wait for the first push to master:

**Option A: Build locally (for initial setup)**
```bash
cd /opt/opennoesis

# Build backend
docker build -t ghcr.io/YOUR_USERNAME/debate-backend:latest ./backend

# Build frontend
docker build -t ghcr.io/YOUR_USERNAME/debate-frontend:latest ./frontend

# Push to GHCR (optional, if you want to use GHCR from start)
docker push ghcr.io/YOUR_USERNAME/debate-backend:latest
docker push ghcr.io/YOUR_USERNAME/debate-frontend:latest
```

**Option B: Use local images temporarily**
```bash
# Temporarily modify docker-compose.yml to build locally
# Then deploy, then push to GitHub to trigger CI/CD
```

### 3. Deploy

```bash
cd /opt/opennoesis

# Set image tags
export DOCKER_IMAGE=ghcr.io/YOUR_USERNAME/debate-backend:latest
export DOCKER_IMAGE_FRONTEND=ghcr.io/YOUR_USERNAME/debate-frontend:latest

# Make scripts executable
chmod +x deploy.sh rollback.sh maintenance.sh

# Run deployment
./deploy.sh
```

### 4. Create Superuser

```bash
docker exec -it debate-backend python manage.py createsuperuser
```

### 5. Verify Deployment

```bash
# Check container status
docker ps

# Test endpoints
curl http://localhost:8000/api/health/
curl http://localhost:3000/

# Visit your domain
https://yourdomain.com
```

---

## CI/CD Pipeline

### 1. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:
- `VPS_SSH_KEY` - Your VPS SSH private key
- `VPS_KNOWN_HOSTS` - Output of `ssh-keyscan YOUR_VPS_IP`
- `VPS_HOST` - Your VPS IP address
- `VPS_USER` - SSH user (e.g., `root` or `deploy`)

**Generate SSH key on VPS (if not exists):**
```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy"
# Save to a file, e.g., ~/.ssh/github_actions

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_actions.pub USER@VPS_IP

# Get the private key content for GitHub secret
cat ~/.ssh/github_actions

# Get known_hosts for GitHub secret
ssh-keyscan YOUR_VPS_IP
```

### 2. Update Workflow File

Edit `.github/workflows/deploy.yml` and replace `${{ github.repository_owner }}` sections with your username if needed, or leave as is for automatic detection.

### 3. Trigger Deployment

```bash
# Make a change and push to master
git add .
git commit -m "Trigger deployment"
git push origin master
```

GitHub Actions will:
1. Run backend tests
2. Run frontend linting and build
3. Build Docker images (multi-stage, cached)
4. Push images to GHCR with SHA tag + latest tag
5. SSH to VPS and run `deploy.sh` with the new image tag

### 4. Monitor Deployment

- Watch GitHub Actions: `https://github.com/YOUR_USERNAME/ProjectOpenDebate/actions`
- Check VPS logs: `ssh USER@VPS_IP "cd /opt/opennoesis && docker compose logs -f"`

---

## Deployment Scripts

### deploy.sh

**Purpose:** Main deployment script with automatic rollback on failure

**What it does:**
1. Enables maintenance mode (nginx shows maintenance.html)
2. Saves current deployment state (current image tags)
3. Pulls new images from GHCR (tag passed via environment variable)
4. Stops application containers (keeps db/redis running)
5. Creates database backup (pg_dump to /opt/opennoesis/backups/)
6. Starts new containers and waits for health checks (max 120s)
7. Runs database migrations
8. Performs smoke tests (backend & frontend health endpoints)
9. Disables maintenance mode
10. Cleans up old images and backups (keeps last 10 backups)
11. **If any step fails:** Automatic rollback (restore images + database)

**Usage:**
```bash
# Triggered by GitHub Actions with specific image tag
DOCKER_IMAGE=ghcr.io/user/debate-backend:abc1234 \
DOCKER_IMAGE_FRONTEND=ghcr.io/user/debate-frontend:abc1234 \
./deploy.sh

# Or use latest
DOCKER_IMAGE=ghcr.io/user/debate-backend:latest \
DOCKER_IMAGE_FRONTEND=ghcr.io/user/debate-frontend:latest \
./deploy.sh
```

**State File (`.deploy_state`):**
```
BACKEND_IMAGE=ghcr.io/user/debate-backend:abc1234
FRONTEND_IMAGE=ghcr.io/user/debate-frontend:abc1234
DB_BACKUP=/opt/opennoesis/backups/pre_deploy_20260123_143022.sql
```

**Rollback Triggers:**
- Failed to pull images → abort
- Database backup failed → abort
- Failed to start containers → rollback
- Health checks timeout → rollback
- Migrations failed → restore database + rollback images
- Smoke tests failed → restore database + rollback images

---

### rollback.sh

**Purpose:** Manual rollback to previous deployment state

**What it does:**
1. Enables maintenance mode
2. Reads saved state from `.deploy_state`
3. Stops current containers
4. Restores database from backup (if exists)
5. Pulls and starts previous images
6. Waits for health checks (max 120s)
7. Performs smoke tests
8. Disables maintenance mode

**Usage:**
```bash
cd /opt/opennoesis
./rollback.sh
```

**When to use:**
- If you discover issues after a successful deployment
- To revert to last known good state
- After failed deployment (if automatic rollback didn't work)

**Note:** Can only rollback to the immediately previous deployment (the one saved in `.deploy_state`)

---

### maintenance.sh

**Purpose:** Manually control maintenance mode

**What it does:**
- `enable` - Shows maintenance page (edits nginx config)
- `disable` - Shows application (reverts nginx config)
- `status` - Checks current maintenance mode state

**Usage:**
```bash
./maintenance.sh enable   # Show maintenance page
./maintenance.sh disable  # Show application
./maintenance.sh status   # Check status
```

**How it works:**
- Edits `/etc/nginx/sites-available/opennoesis`
- Toggles comments on maintenance mode block (between markers)
- Reloads nginx configuration

**Use cases:**
- Manual maintenance window
- Database maintenance
- Testing deployment scripts
- Emergency disable of application

---

## Daily Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f celery-worker
docker compose logs -f celery-beat
docker compose logs -f db
docker compose logs -f redis

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart Services

```bash
# All services
docker compose restart

# Specific service
docker compose restart backend
docker compose restart celery-worker

# Restart with downtime (stop then up)
docker compose down backend
docker compose up -d backend
```

### Run Django Management Commands

```bash
# Django shell
docker exec -it debate-backend python manage.py shell

# Create superuser
docker exec -it debate-backend python manage.py createsuperuser

# Run migrations manually
docker exec debate-backend python manage.py migrate

# Show migrations
docker exec debate-backend python manage.py showmigrations

# Collect static files
docker exec debate-backend python manage.py collectstatic --noinput

# Run custom management commands
docker exec debate-backend python manage.py YOUR_COMMAND
```

### Database Operations

```bash
# Create backup
docker exec debate-db pg_dump -U debate_prod_user debate_prod > /opt/opennoesis/backups/manual_backup_$(date +%Y%m%d).sql

# Restore from backup
cat /opt/opennoesis/backups/backup.sql | docker exec -i debate-db psql -U debate_prod_user -d debate_prod

# Access database shell
docker exec -it debate-db psql -U debate_prod_user -d debate_prod

# Check database size
docker exec debate-db psql -U debate_prod_user -d debate_prod -c "SELECT pg_size_pretty(pg_database_size('debate_prod'));"
```

### Redis Operations

```bash
# Access Redis CLI (without password)
docker exec -it debate-redis redis-cli

# With password
docker exec -it debate-redis redis-cli -a YOUR_REDIS_PASSWORD

# Check memory usage
docker exec debate-redis redis-cli -a YOUR_PASSWORD INFO memory

# Flush cache (careful!)
docker exec debate-redis redis-cli -a YOUR_PASSWORD FLUSHALL
```

### Monitor Resources

```bash
# Docker stats
docker stats

# Disk usage
df -h
docker system df

# Check volumes
docker volume ls
docker volume inspect opennoesis_pgdata
docker volume inspect opennoesis_redisdata

# System resources
htop
free -h
```

### Pull Latest Images

```bash
cd /opt/opennoesis

# Pull specific version
export DOCKER_IMAGE=ghcr.io/YOUR_USERNAME/debate-backend:abc1234
export DOCKER_IMAGE_FRONTEND=ghcr.io/YOUR_USERNAME/debate-frontend:abc1234

docker compose pull

# Or pull latest
export DOCKER_IMAGE=ghcr.io/YOUR_USERNAME/debate-backend:latest
export DOCKER_IMAGE_FRONTEND=ghcr.io/YOUR_USERNAME/debate-frontend:latest

docker compose pull
```

---

## Troubleshooting

### Deployment Failed

**Check GitHub Actions logs:**
```bash
# Visit: https://github.com/YOUR_USERNAME/ProjectOpenDebate/actions
```

**Check VPS deployment logs:**
```bash
ssh USER@VPS_IP
cd /opt/opennoesis
docker compose logs -f

# Check if maintenance mode is still active
./maintenance.sh status

# If stuck in maintenance, disable manually
./maintenance.sh disable
```

**Rollback manually:**
```bash
./rollback.sh
```

### Container Won't Start

```bash
# Check logs
docker compose logs backend
docker compose logs frontend

# Check health status
docker inspect debate-backend --format='{{.State.Health.Status}}'
docker inspect debate-backend --format='{{range .State.Health.Log}}{{.Output}}{{end}}'

# Try restarting
docker compose restart backend

# Try rebuilding (if using local build)
docker compose down backend
docker compose up -d backend
```

### Database Connection Issues

```bash
# Check database is running
docker ps | grep debate-db

# Check database logs
docker compose logs db

# Test connection from backend
docker exec -it debate-backend python manage.py dbshell

# Check environment variables
docker exec debate-backend env | grep DB_

# Restart database (careful, may cause downtime)
docker compose restart db
```

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep debate-redis

# Check Redis logs
docker compose logs redis

# Test connection
docker exec debate-redis redis-cli -a YOUR_PASSWORD ping

# Test from backend
docker exec -it debate-backend python manage.py shell
# >>> from django.core.cache import cache
# >>> cache.set('test', 'value')
# >>> cache.get('test')
```

### Health Checks Failing

```bash
# Check backend health endpoint
curl http://localhost:8000/api/health/

# Check frontend
curl http://localhost:3000/

# Check container logs
docker logs debate-backend --tail=50
docker logs debate-frontend --tail=50

# Check container health
docker inspect debate-backend | grep -A 20 Health
docker inspect debate-frontend | grep -A 20 Health

# Disable health check temporarily (edit docker-compose.yml)
# Remove healthcheck: section and restart
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/opennoesis-error.log
sudo tail -f /var/log/nginx/opennoesis-access.log

# Reload configuration
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# Check if maintenance mode is stuck
cat /etc/nginx/sites-available/opennoesis | grep MAINTENANCE_MODE
```

### Out of Disk Space

```bash
# Check disk usage
df -h
du -sh /var/lib/docker/*
du -sh /opt/opennoesis/*

# Clean Docker resources
docker system prune -a -f

# Clean old backups (keeps last 10)
cd /opt/opennoesis/backups
ls -t pre_deploy_*.sql | tail -n +11 | xargs rm -f

# Clean old images
docker image prune -a -f

# Clean logs
sudo journalctl --vacuum-time=7d
```

### Migration Failed

**If deployment failed and rolled back:**
```bash
# Check what happened
docker compose logs backend | grep migration

# Check database state
docker exec debate-backend python manage.py showmigrations

# If needed, manually rollback was already done by deploy.sh
```

**If you need to manually fix migrations:**
```bash
# Enable maintenance mode
./maintenance.sh enable

# Create database backup
docker exec debate-db pg_dump -U debate_prod_user debate_prod > /opt/opennoesis/backups/before_fix.sql

# Run migrations with --fake if needed (careful!)
docker exec debate-backend python manage.py migrate app_name migration_name --fake

# Or rollback specific migration
docker exec debate-backend python manage.py migrate app_name previous_migration_name

# Disable maintenance mode
./maintenance.sh disable
```

### SSL Certificate Issues

```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --nginx

# Test auto-renewal
sudo certbot renew --dry-run

# If renewal fails, check nginx config
sudo nginx -t

# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### GitHub Actions Failed to Push Images

**Check GHCR permissions:**
```bash
# Ensure repository has package access
# GitHub → Repository → Settings → Actions → General
# Workflow permissions: Read and write permissions
```

**Test GHCR login locally:**
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
docker pull ghcr.io/YOUR_USERNAME/debate-backend:latest
```

### Can't Pull Images on VPS

```bash
# Re-login to GHCR
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Check image exists
docker manifest inspect ghcr.io/YOUR_USERNAME/debate-backend:latest

# Try pulling manually
docker pull ghcr.io/YOUR_USERNAME/debate-backend:latest

# Check if package is public or private
# GitHub → Your profile → Packages → debate-backend → Package settings
# Make package public if needed
```

---

## Docker Configuration Files

### docker-compose.yml

**Services:**

**db:**
- Image: `postgres:16-alpine`
- Environment: Uses `DB_PASSWORD` from .env file
- Volume: `pgdata` for persistent data, `./backups` for dumps
- Ports: 5432 exposed to host
- Health check: `pg_isready`

**redis:**
- Image: `redis:7-alpine`
- Command: Includes password from `REDIS_PASSWORD` env var
- Volume: `redisdata` for persistent data
- Ports: 6379 exposed to host
- Health check: `redis-cli ping`

**backend, celery-worker, celery-beat:**
- Image: Uses `DOCKER_IMAGE` env var or defaults to latest
- Depends on: db and redis (waits for healthy state)
- Env file: `backend/.env.prod`
- Health checks on backend and worker

**frontend:**
- Image: Uses `DOCKER_IMAGE_FRONTEND` env var or defaults to latest
- Env file: `frontend/.env.prod`
- Ports: 3000 exposed to host
- Health check: `wget` to localhost:3000

**Volumes:**
- `pgdata` - PostgreSQL data (persistent)
- `redisdata` - Redis data (persistent)

**Image Tag Handling:**
```bash
# Default (if DOCKER_IMAGE not set)
ghcr.io/justinacoder/debate-backend:latest

# With environment variable (set by deploy.sh)
DOCKER_IMAGE=ghcr.io/justinacoder/debate-backend:abc1234

# Docker compose uses the env var
docker compose up -d
```

### backend/Dockerfile

Multi-stage build:

**Stage 1 (builder):**
- Base: `python:3.12-slim`
- Installs build dependencies (gcc, postgresql-client)
- Creates virtualenv in `/opt/venv`
- Installs Python packages from requirements.txt

**Stage 2 (runtime):**
- Base: `python:3.12-slim`
- Copies virtualenv from builder
- Installs runtime dependencies only (postgresql-client, curl)
- Copies application code
- Runs `collectstatic` during build
- Creates non-root user (appuser)
- Exposes port 8000
- CMD: `daphne -b 0.0.0.0 -p 8000 ProjectOpenDebate.asgi:application`

### frontend/Dockerfile

Multi-stage build:

**Stage 1 (builder):**
- Base: `node:20-alpine`
- Installs dependencies with `npm ci`
- Generates Orval API client from `openapi.json`
- Builds Next.js in standalone mode

**Stage 2 (runner):**
- Base: `node:20-alpine`
- Installs wget for health checks
- Copies built assets (public, .next/standalone, .next/static)
- Creates non-root user (nextjs)
- Exposes port 3000
- Health check: `wget --spider http://localhost:3000/`
- CMD: `node server.js`

### nginx.conf

**Upstream servers:**
- `backend_servers` → localhost:8000
- `frontend_servers` → localhost:3000

**Rate limiting:**
- `api_limit` → 10 req/s (burst 20)
- `general_limit` → 30 req/s (burst 50)

**HTTP (port 80):**
- Redirects to HTTPS
- Allows ACME challenge for Let's Encrypt

**HTTPS (port 443):**
- SSL certificates from Let's Encrypt
- Modern TLS protocols (1.2, 1.3)

**Location blocks:**
- `/static/` → Django static files (30-day cache)
- `/ws/` → WebSocket connections to backend (86400s timeout)
- `/api/` → Backend API (rate limited)
- `/admin/` → Django admin (rate limited)
- `/_allauth/` → Authentication endpoints (rate limited)
- `/accounts/` → Social login (rate limited)
- `/` → Next.js frontend (catch-all)

**Maintenance mode:**
- Controlled by `MAINTENANCE_MODE_DISABLED/ENABLED` markers
- When enabled, serves `maintenance.html` for all requests

---

## Architecture Differences from Original

**What changed:**

1. **Database & Redis:** Now in Docker containers instead of system-level services
   - Easier setup (no manual PostgreSQL/Redis configuration)
   - Data persisted in Docker volumes
   - Containers connected via Docker network

2. **Image Building:** Done in GitHub Actions instead of on VPS
   - Faster deployments (no building on VPS)
   - Consistent builds across environments
   - Build caching for faster CI/CD
   - VPS only pulls and runs pre-built images

3. **Image Registry:** GitHub Container Registry (GHCR) instead of local images
   - Images tagged with git commit SHA
   - Easy rollback to any previous version
   - Images available from anywhere

4. **Rollback Strategy:** Database dump instead of migration reversal
   - Works for all migrations (including one-way migrations)
   - Complete state restoration
   - Backup created before migrations

5. **Deployment Flow:** Pull-based instead of build-based
   - VPS doesn't need source code changes
   - Just pulls new images and restarts
   - Simpler VPS setup

**What stayed the same:**

- Maintenance mode during deployment
- Automatic rollback on failure
- Health checks and smoke tests
- Nginx reverse proxy setup
- SSL with Let's Encrypt

---

## Summary

**To deploy latest code:**
```bash
# Just push to master
git push origin master

# GitHub Actions will:
# 1. Run tests
# 2. Build images
# 3. Push to GHCR
# 4. Deploy to VPS
```

**To rollback:**
```bash
ssh USER@VPS_IP
cd /opt/opennoesis
./rollback.sh
```

**To view logs:**
```bash
docker compose logs -f [service-name]
```

**Deployment time:** ~2-3 minutes with maintenance mode (most time is in GitHub Actions build)

**Automatic rollback:** Yes, on any failure (container start, health checks, migrations, smoke tests)

**Database persistence:** Yes, data stored in Docker volumes

**Image versioning:** Git commit SHA (short) + latest tag

---

**Need help?** Check logs with `docker compose logs` or review GitHub Actions output.

