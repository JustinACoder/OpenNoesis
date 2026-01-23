# Production Deployment Guide

Complete guide for deploying the Debate Arena platform on a VPS using Docker with automated CI/CD.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial VPS Setup](#initial-vps-setup)
4. [Configure Services](#configure-services)
5. [Environment Configuration](#environment-configuration)
6. [Nginx & SSL Setup](#nginx--ssl-setup)
7. [First Deployment](#first-deployment)
8. [Deployment Scripts](#deployment-scripts)
9. [Daily Operations](#daily-operations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

**Docker Containers (via docker-compose.yml):**
- `debate-backend` - Django + Daphne ASGI server (port 8000)
- `debate-frontend` - Next.js standalone server (port 3000)
- `debate-celery-worker` - Background task processor
- `debate-celery-beat` - Periodic task scheduler

**System Services:**
- PostgreSQL - Database (standalone on host)
- Redis - Cache & message broker (standalone on host)
- Nginx - Reverse proxy with SSL termination

**Deployment Features:**
- Multi-stage Docker builds for optimized images
- Health checks on all containers
- Automatic rollback on deployment failure
- Maintenance mode during deployments
- State tracking (git commit + migration state)

### Deployment Strategy

**Maintenance Mode Deployment:**
1. Enable maintenance page via nginx
2. Save current state (commit hash + migrations)
3. Stop containers → Pull code → Build → Start containers
4. Wait for health checks to pass
5. Run migrations & smoke tests
6. Disable maintenance mode
7. If any step fails → automatic rollback to saved state

**Downtime:** ~2-3 minutes during deployment

---

## Prerequisites

- **VPS**: Ubuntu 22.04+ with root access
- **Domain**: DNS pointing to VPS IP
- **Resources**: Minimum 2 GB RAM, 2 CPU cores, 20 GB storage
- **Repository**: GitHub repo with SSH access

---

## Initial VPS Setup

### 1. Install Required Software

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install other dependencies
apt-get install -y nginx postgresql postgresql-contrib redis-server git curl
```

### 2. Create Project Directory

```bash
mkdir -p /opt/opennoesis
cd /opt/opennoesis
```

### 3. Create Non-Root User (Optional but Recommended)

```bash
adduser deploy
usermod -aG sudo,docker deploy
# Continue as deploy user or use sudo for Docker commands
```

---

## Configure Services

### PostgreSQL Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE debate_prod;
CREATE USER debate_user WITH PASSWORD 'your-secure-password';
ALTER ROLE debate_user SET client_encoding TO 'utf8';
ALTER ROLE debate_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE debate_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE debate_prod TO debate_user;
\q

# Allow Docker containers to access PostgreSQL
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Add this line:
host    debate_prod     debate_user     172.16.0.0/12   md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Redis Setup

```bash
# Set Redis password
sudo nano /etc/redis/redis.conf
# Find and uncomment: requirepass your-redis-password

# Restart Redis
sudo systemctl restart redis-server

# Test connection
redis-cli -a your-redis-password ping
# Should return: PONG
```

---

## Environment Configuration

### 1. Clone Repository

```bash
cd /opt/opennoesis
git clone git@github.com:yourusername/ProjectOpenDebate.git .
# Or: git clone https://github.com/yourusername/ProjectOpenDebate.git .
```

### 2. Backend Environment

```bash
cd /opt/opennoesis/backend
cp .env.prod.example .env.prod
nano .env.prod
```

**Required Variables:**
```bash
# Django Settings
SECRET_KEY=your-super-secret-key-here-change-this
ENV=prod
ADMIN_EMAIL=admin@yourdomain.com

# Database (PostgreSQL on host)
DB_HOST=172.17.0.1  # Docker bridge gateway
DB_PORT=5432
DB_NAME=debate_prod
DB_USER=debate_user
DB_PASSWORD=your-db-password

# Redis (on host)
REDIS_HOST=172.17.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your-redis-password

# Email Configuration
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Security
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 3. Frontend Environment

```bash
cd /opt/opennoesis/frontend
cp .env.prod.example .env.prod
nano .env.prod
```

**Required Variables:**
```bash
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
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

# Obtain certificate (temporarily disable HTTPS in nginx first)
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

### 1. Build Docker Images

```bash
cd /opt/opennoesis
docker compose build
```

### 2. Start Services

```bash
docker compose up -d
```

### 3. Run Migrations

```bash
docker exec debate-backend python manage.py migrate
docker exec debate-backend python manage.py collectstatic --noinput
```

### 4. Create Superuser

```bash
docker exec -it debate-backend python manage.py createsuperuser
```

### 5. Verify Deployment

```bash
# Check container status
docker ps

# Check health
./health-check.sh

# Test endpoints
curl http://localhost:8000/api/health/
curl http://localhost:3000/
```

---

## Deployment Scripts

All deployment scripts are in the project root:

### deploy.sh

**Purpose:** Main deployment script with automatic rollback on failure

**What it does:**
1. Enables maintenance mode (shows maintenance.html)
2. Saves current state (git commit + migration state)
3. Stops containers → Pulls latest code from GitHub
4. Builds new Docker images
5. Starts containers and waits for health checks (max 120s)
6. Runs database migrations
7. Performs smoke tests (backend & frontend)
8. Disables maintenance mode
9. Cleans up old images
10. **If any step fails:** Automatically rolls back to saved state

**Usage:**
```bash
cd /opt/opennoesis
./deploy.sh
```

**Requirements:**
- Git remote configured (origin/master)
- Nginx config with maintenance mode markers
- Docker Compose running

---

### rollback.sh

**Purpose:** Manual rollback to previous deployment state

**What it does:**
1. Enables maintenance mode
2. Reads saved state from `.deploy_state`
3. Stops containers → Checks out previous git commit
4. Rebuilds and restarts containers
5. Waits for health checks (max 120s)
6. Restores migration state if available
7. Performs smoke test
8. Disables maintenance mode

**Usage:**
```bash
cd /opt/opennoesis
./rollback.sh
```

**State File (`.deploy_state`):**
```
COMMIT=abc123def456...
MIGRATION=app_name.0042_migration_name
```

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
- Toggles comments on maintenance mode block
- Reloads nginx configuration

---

### health-check.sh

**Purpose:** Verify all services are running correctly

**What it checks:**
- PostgreSQL status
- Redis status
- Nginx status
- Docker container status
- Disk usage
- Memory usage
- Backend API health endpoint (http://localhost:8000/api/health/)
- Frontend health (http://localhost:3000/)

**Usage:**
```bash
./health-check.sh
```

**Output:**
```
PostgreSQL: ✓ Running
Redis: ✓ Running
Nginx: ✓ Running

Docker Containers:
debate-backend      Up 2 hours (healthy)
debate-frontend     Up 2 hours (healthy)
...

Backend API: ✓ Healthy
Frontend: ✓ Healthy
```

---

### test-builds.sh

**Purpose:** Test Docker builds before deploying

**What it does:**
1. Builds backend Docker image (tagged as test)
2. Builds frontend Docker image (tagged as test)
3. Reports success/failure
4. Cleans up test images

**Usage:**
```bash
./test-builds.sh
```

**Use case:** Run before `deploy.sh` to verify builds work

---

### quick-ref.sh

**Purpose:** Quick reference for common operations

**Commands:**
```bash
./quick-ref.sh deploy          # Deploy latest version
./quick-ref.sh rollback        # Rollback to previous
./quick-ref.sh health          # Check system health
./quick-ref.sh logs [service]  # View logs
./quick-ref.sh status          # Show deployment status
./quick-ref.sh migrate         # Run migrations manually
./quick-ref.sh shell           # Open Django shell
./quick-ref.sh restart         # Restart all services
./quick-ref.sh cleanup         # Clean Docker images
```

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
```

### Restart Services

```bash
# All services
docker compose restart

# Specific service
docker compose restart backend
docker compose restart celery-worker
```

### Run Django Management Commands

```bash
# Django shell
docker exec -it debate-backend python manage.py shell

# Create superuser
docker exec -it debate-backend python manage.py createsuperuser

# Run migrations
docker exec debate-backend python manage.py migrate

# Collect static files
docker exec debate-backend python manage.py collectstatic --noinput
```

### Database Backup

```bash
# Create backup
docker exec debate-backend python manage.py dumpdata > backup_$(date +%Y%m%d).json

# Or use PostgreSQL directly
sudo -u postgres pg_dump debate_prod > /opt/opennoesis/backups/db_$(date +%Y%m%d).sql
```

### Monitor Resources

```bash
# Docker stats
docker stats

# System resources
htop

# Disk usage
df -h
du -sh /opt/opennoesis/*
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend
docker compose logs frontend

# Check health
docker inspect --format='{{.State.Health.Status}}' debate-backend

# Rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection from container
docker exec -it debate-backend psql -h 172.17.0.1 -U debate_user -d debate_prod

# Check pg_hba.conf allows Docker network
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Should have: host debate_prod debate_user 172.16.0.0/12 md5
```

### Redis Connection Issues

```bash
# Check Redis is running
sudo systemctl status redis-server

# Test connection from host
redis-cli -a your-password ping

# Test from container
docker exec -it debate-backend redis-cli -h 172.17.0.1 -a your-password ping
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
```

### Deployment Failed, Stuck in Maintenance Mode

```bash
# Check what went wrong
docker compose logs

# Manual rollback
./rollback.sh

# Or manually disable maintenance
./maintenance.sh disable
```

### Health Checks Failing

```bash
# Check backend health endpoint
curl http://localhost:8000/api/health/

# Check container logs
docker logs debate-backend
docker logs debate-frontend

# Inspect health check status
docker inspect debate-backend | grep -A 20 Health
```

### Out of Disk Space

```bash
# Clean Docker resources
docker system prune -a -f

# Check disk usage
df -h
du -sh /var/lib/docker/*

# Clean old logs
sudo find /var/log -type f -name "*.log" -mtime +30 -delete
```

### Celery Tasks Not Running

```bash
# Check worker is running
docker ps | grep celery

# Check worker logs
docker logs debate-celery-worker

# Inspect Celery
docker exec debate-celery-worker celery -A ProjectOpenDebate inspect active
docker exec debate-celery-worker celery -A ProjectOpenDebate inspect stats
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew --nginx

# Check certificate expiration
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Docker Configuration Files

### docker-compose.yml

Orchestrates 4 services:

**backend:**
- Built from `backend/Dockerfile`
- Runs Daphne ASGI server on port 8000
- Uses `backend/.env.prod` for configuration
- Health check: `curl http://localhost:8000/api/health/`
- Volume: staticfiles directory

**celery-worker:**
- Uses same image as backend
- Runs Celery worker process
- 10-minute graceful shutdown timeout
- Health check: `celery inspect ping`

**celery-beat:**
- Uses same image as backend
- Runs Celery beat scheduler
- 10-minute graceful shutdown timeout

**frontend:**
- Built from `frontend/Dockerfile`
- Runs Next.js standalone server on port 3000
- Uses `frontend/.env.prod` for configuration
- Health check: `wget http://localhost:3000/`

**Network:**
- All services connected via `debate-network` bridge

### backend/Dockerfile

Multi-stage build:

**Stage 1 (builder):**
- Base: python:3.12-slim
- Installs build dependencies (gcc, postgresql-client)
- Creates virtualenv in `/opt/venv`
- Installs Python packages from requirements.txt

**Stage 2 (runtime):**
- Base: python:3.12-slim
- Copies virtualenv from builder
- Installs runtime dependencies only
- Copies application code
- Runs `collectstatic` during build
- Creates non-root user (appuser)
- Exposes port 8000
- CMD: `daphne -b 0.0.0.0 -p 8000 ProjectOpenDebate.asgi:application`

### frontend/Dockerfile

Multi-stage build:

**Stage 1 (builder):**
- Base: node:20-alpine
- Installs dependencies with `npm ci`
- Generates Orval API client from openapi.json
- Builds Next.js application

**Stage 2 (runner):**
- Base: node:20-alpine
- Installs wget for health checks
- Copies built assets (public, .next/standalone, .next/static)
- Creates non-root user (nextjs)
- Exposes port 3000
- Healthcheck: `wget --spider http://localhost:3000/`
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

## Quick Migration Checklist

When deploying code with database changes:

1. **Before deployment:**
   - ✅ Test migrations locally
   - ✅ Backup database: `pg_dump debate_prod > backup.sql`
   - ✅ Review migration files for issues

2. **During deployment:**
   - Automatic via `deploy.sh` (migrations run after health checks)
   - Rollback available if migrations fail

3. **After deployment:**
   - ✅ Verify migrations: `docker exec debate-backend python manage.py showmigrations`
   - ✅ Test application functionality
   - ✅ Monitor logs for errors

4. **If migrations fail:**
   - `./rollback.sh` will restore previous state
   - Or manually: `docker exec debate-backend python manage.py migrate <app_name> <migration_number>`

---

## Security Best Practices

1. **Environment variables:** Never commit `.env.prod` files
2. **Database passwords:** Use strong, unique passwords
3. **SSH keys:** Use SSH keys instead of passwords for GitHub
4. **Firewall:** Enable UFW and allow only necessary ports
   ```bash
   ufw allow 22/tcp   # SSH
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```
5. **Regular updates:** Keep system and Docker updated
   ```bash
   apt-get update && apt-get upgrade -y
   docker system prune -af --volumes  # Careful with this!
   ```
6. **Monitoring:** Set up log monitoring and alerts
7. **Backups:** Automate database backups
8. **Non-root user:** Run deployment as non-root user when possible

---

## Summary

**To deploy latest code:**
```bash
cd /opt/opennoesis && ./deploy.sh
```

**To rollback:**
```bash
cd /opt/opennoesis && ./rollback.sh
```

**To check health:**
```bash
./health-check.sh
```

**To view logs:**
```bash
docker compose logs -f [service-name]
```

**Deployment time:** ~2-3 minutes with maintenance mode
**Automatic rollback:** Yes, on any failure
**Zero-downtime:** No (maintenance mode shown during deployment)
**Database migrations:** Automatic during deployment

---

**Need help?** Check logs with `docker compose logs` or open an issue on GitHub.

