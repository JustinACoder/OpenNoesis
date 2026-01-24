#!/bin/bash
# Deploy with maintenance mode + pre-migration DB backup + rollback
#
# Assumptions:
# - Run on the VPS as root (or via sudo).
# - docker-compose.yml is in /opt/opennoesis (PROJECT_DIR).
# - docker-compose.yml uses APP_TAG for BOTH images, e.g.:
#     backend:  image: ghcr.io/justinacoder/debate-backend:${APP_TAG}
#     frontend: image: ghcr.io/justinacoder/debate-frontend:${APP_TAG}
#
# Usage:
#   APP_TAG=2026-01-24_01 ./deploy.sh
#
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/opt/opennoesis"
BACKUP_DIR="$PROJECT_DIR/backups"
STATE_FILE="$PROJECT_DIR/.deploy_state"

NGINX_SITE="/etc/nginx/sites-available/opennoesis"

DB_CONTAINER="debate-db"         # container_name in compose
DB_NAME="debate_db"
DB_USER="debate_user"

BACKEND_CONTAINER="debate-backend"
FRONTEND_CONTAINER="debate-frontend"

DB_BACKUP_FILE="$BACKUP_DIR/pre_deploy_$(date +%Y%m%d_%H%M%S).dump"

log()  { echo -e "$1"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
ok()   { echo -e "${GREEN}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}" >&2; }

require_env() {
  if [[ -z "${APP_TAG:-}" ]]; then
    err "Missing required env var APP_TAG."
    err "Usage: APP_TAG=<tag> $0"
    exit 1
  fi
}

enable_maintenance() {
  warn "Enabling maintenance mode..."
  # Idempotent: only enable if not already enabled
  if grep -q "# MAINTENANCE_MODE_DISABLED" "$NGINX_SITE"; then
    sed -i 's/# MAINTENANCE_MODE_DISABLED/# MAINTENANCE_MODE_ENABLED/' "$NGINX_SITE"
    sed -i '/# MAINTENANCE_MODE_ENABLED/,/# END_MAINTENANCE_MODE/ s/^#//' "$NGINX_SITE"
  fi
  nginx -t
  systemctl reload nginx
}

disable_maintenance() {
  warn "Disabling maintenance mode..."
  # Idempotent: only disable if currently enabled
  if grep -q "# MAINTENANCE_MODE_ENABLED" "$NGINX_SITE"; then
    sed -i 's/# MAINTENANCE_MODE_ENABLED/# MAINTENANCE_MODE_DISABLED/' "$NGINX_SITE"
    sed -i '/# MAINTENANCE_MODE_DISABLED/,/# END_MAINTENANCE_MODE/ s/^/#/' "$NGINX_SITE"
  fi
  nginx -t
  systemctl reload nginx
}

save_state() {
  warn "Saving current state..."
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR" || true

  local cur_backend_image cur_frontend_image
  cur_backend_image="$(docker inspect "$BACKEND_CONTAINER" --format='{{.Config.Image}}' 2>/dev/null || true)"
  cur_frontend_image="$(docker inspect "$FRONTEND_CONTAINER" --format='{{.Config.Image}}' 2>/dev/null || true)"

  # Extract tags (best-effort). If image uses digest, tag extraction will be empty-ish; rollback will fallback.
  local prev_tag=""
  if [[ -n "$cur_backend_image" && "$cur_backend_image" != *@sha256:* && "$cur_backend_image" == *:* ]]; then
    prev_tag="${cur_backend_image##*:}"
  fi

  {
    echo "PREV_APP_TAG=$prev_tag"
    echo "PREV_BACKEND_IMAGE=$cur_backend_image"
    echo "PREV_FRONTEND_IMAGE=$cur_frontend_image"
    echo "DB_BACKUP="
  } > "$STATE_FILE"

  ok "State saved to $STATE_FILE"
}

backup_database() {
  warn "Creating database backup (custom format)..."
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR" || true

  docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER" || {
    err "DB container '$DB_CONTAINER' not running. Cannot backup."
    return 1
  }

  if docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DB_BACKUP_FILE"; then
    ok "DB backup created: $DB_BACKUP_FILE"
    sed -i "s|^DB_BACKUP=.*|DB_BACKUP=$DB_BACKUP_FILE|" "$STATE_FILE"
    return 0
  else
    err "DB backup failed!"
    return 1
  fi
}

restore_database() {
  local backup_file="$1"
  [[ -f "$backup_file" ]] || { err "Backup file not found: $backup_file"; return 1; }

  warn "Restoring database from backup: $backup_file"
  if cat "$backup_file" | docker exec -i "$DB_CONTAINER" pg_restore \
      -U "$DB_USER" -d "$DB_NAME" --clean --if-exists; then
    ok "Database restore successful."
    return 0
  else
    err "Database restore failed."
    return 1
  fi
}

wait_for_db() {
  warn "Waiting for database to be ready..."
  local max_wait=60
  local waited=0
  while (( waited < max_wait )); do
    if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      ok "Database is ready."
      return 0
    fi
    sleep 2
    waited=$(( waited + 2 ))
    echo "  ... (${waited}s/${max_wait}s)"
  done
  err "Database not ready after ${max_wait}s."
  return 1
}

stop_app_services() {
  warn "Stopping app services (keeping db/redis)..."
  docker compose stop backend celery-worker celery-beat frontend >/dev/null 2>&1 || true
  docker compose rm -f backend celery-worker celery-beat frontend >/dev/null 2>&1 || true
}

start_infra() {
  warn "Ensuring db/redis are up..."
  docker compose up -d db redis
  wait_for_db
}

pull_images() {
  warn "Pulling new images for APP_TAG=${APP_TAG}"
  export APP_TAG
  docker compose pull backend frontend
}

run_migrations() {
  warn "Running migrations (one-off container)..."
  docker compose run --rm backend python manage.py migrate --noinput
  ok "Migrations completed."
}

collect_static() {
  warn "Collecting static files..."
  docker compose run --rm backend python manage.py collectstatic --noinput || warn "collectstatic failed (continuing)"
}

start_app_services() {
  warn "Starting app services..."
  docker compose up -d backend celery-worker celery-beat frontend
}

smoke_tests() {
  warn "Smoke tests..."
  # Validate nginx routing to backend (Origin CA => -k)
  if ! curl -sk -H "Host: opennoesis.com" --max-time 5 https://127.0.0.1/api/health/ >/dev/null; then
    err "Backend smoke test failed (nginx -> backend)."
    return 1
  fi

  # Frontend direct (adjust to nginx if/when you proxy it there)
  if ! curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    err "Frontend smoke test failed (port 3000)."
    return 1
  fi

  ok "Smoke tests passed."
}

rollback() {
  err "Rolling back..."

  if [[ ! -f "$STATE_FILE" ]]; then
    err "No state file; cannot rollback safely. Keeping maintenance mode ON."
    return 1
  fi

  # shellcheck disable=SC1090
  source "$STATE_FILE" || true

  # Restore DB if we have a backup
  if [[ -n "${DB_BACKUP:-}" && -f "${DB_BACKUP:-}" ]]; then
    restore_database "$DB_BACKUP" || err "DB restore failed; continuing rollback of containers anyway."
  fi

  stop_app_services
  start_infra

  if [[ -n "${PREV_APP_TAG:-}" ]]; then
    warn "Reverting APP_TAG to previous tag: ${PREV_APP_TAG}"
    export APP_TAG="$PREV_APP_TAG"
    docker compose pull backend frontend || true
    start_app_services
  else
    warn "No previous tag detected. Attempting best-effort restart of existing containers."
    start_app_services
  fi

  if smoke_tests; then
    ok "Rollback successful."
    disable_maintenance
    return 0
  fi

  err "Rollback failed. Keeping maintenance mode ON."
  return 1
}

on_error() {
  err "Deployment failed (line $1)."
  rollback || true
  exit 1
}
trap 'on_error $LINENO' ERR

main() {
  require_env

  cd "$PROJECT_DIR"
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR" || true

  warn "Starting deployment with APP_TAG=${APP_TAG}"
  enable_maintenance

  save_state

  start_infra

  # Backup BEFORE applying migrations / starting new app code
  backup_database

  # Pull new images for requested tag
  pull_images

  # Stop app services (db/redis stay)
  stop_app_services

  # Apply schema first, while app is down
  run_migrations

  # Collect static files
  collect_static

  # Start everything
  start_app_services

  # Smoke tests (includes nginx->backend)
  smoke_tests

  disable_maintenance

  # Keep only last 10 backups
  warn "Cleaning old backups (keeping last 10)..."
  ls -t "$BACKUP_DIR"/pre_deploy_*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f

  ok "Deployment completed successfully."
  ok "Deployed APP_TAG=${APP_TAG}"
}

main
