#!/bin/bash
# Rollback script - restores to previous deployment state (APP_TAG-based)
# Assumes:
# - deploy.sh saves: PREV_APP_TAG, PREV_BACKEND_IMAGE, PREV_FRONTEND_IMAGE, DB_BACKUP in /opt/opennoesis/.deploy_state
# - docker-compose.yml uses the SAME APP_TAG for backend+frontend images, e.g.:
#     backend:  image: ghcr.io/justinacoder/debate-backend:${APP_TAG}
#     frontend: image: ghcr.io/justinacoder/debate-frontend:${APP_TAG}
#
# Usage:
#   ./rollback.sh            # roll back to PREV_APP_TAG from state file
#   APP_TAG=<tag> ./rollback.sh  # optionally force a specific tag
#
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/opt/opennoesis"
STATE_FILE="$PROJECT_DIR/.deploy_state"
BACKUP_DIR="$PROJECT_DIR/backups"

NGINX_SITE="/etc/nginx/sites-available/opennoesis"

DB_CONTAINER="debate-db"
DB_NAME="debate_prod"
DB_USER="debate_prod_user"

echo -e "${YELLOW}Starting rollback...${NC}"

cd "$PROJECT_DIR" >/dev/null 2>&1 || {
  echo -e "${RED}Error: cannot cd to $PROJECT_DIR${NC}"
  exit 1
}

# --- helpers ---
enable_maintenance() {
  echo -e "${YELLOW}Enabling maintenance mode...${NC}"
  # Idempotent enable
  if grep -q "# MAINTENANCE_MODE_DISABLED" "$NGINX_SITE"; then
    sed -i 's/# MAINTENANCE_MODE_DISABLED/# MAINTENANCE_MODE_ENABLED/' "$NGINX_SITE"
    sed -i '/# MAINTENANCE_MODE_ENABLED/,/# END_MAINTENANCE_MODE/ s/^#//' "$NGINX_SITE"
  fi
  nginx -t && systemctl reload nginx
}

disable_maintenance() {
  echo -e "${YELLOW}Disabling maintenance mode...${NC}"
  # Idempotent disable
  if grep -q "# MAINTENANCE_MODE_ENABLED" "$NGINX_SITE"; then
    sed -i 's/# MAINTENANCE_MODE_ENABLED/# MAINTENANCE_MODE_DISABLED/' "$NGINX_SITE"
    sed -i '/# MAINTENANCE_MODE_DISABLED/,/# END_MAINTENANCE_MODE/ s/^/#/' "$NGINX_SITE"
  fi
  nginx -t && systemctl reload nginx
}

wait_for_db() {
  echo -e "${YELLOW}Waiting for database to be ready...${NC}"
  local max_wait=60
  local waited=0
  while (( waited < max_wait )); do
    if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      echo -e "${GREEN}Database is ready!${NC}"
      return 0
    fi
    sleep 2
    waited=$(( waited + 2 ))
    echo "  ... (${waited}s/${max_wait}s)"
  done
  echo -e "${RED}Database not ready after ${max_wait}s${NC}"
  return 1
}

restore_database() {
  local backup_file="$1"
  if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
    echo -e "${YELLOW}No database backup found, skipping DB restore${NC}"
    return 0
  fi

  echo -e "${YELLOW}Restoring database from backup: $backup_file${NC}"
  # Custom-format restore (pg_dump -Fc) with clean-up
  if cat "$backup_file" | docker exec -i "$DB_CONTAINER" pg_restore \
      -U "$DB_USER" -d "$DB_NAME" --clean --if-exists; then
    echo -e "${GREEN}Database restored successfully!${NC}"
    return 0
  else
    echo -e "${RED}Database restore failed!${NC}"
    return 1
  fi
}

smoke_test() {
  echo -e "${YELLOW}Performing smoke test...${NC}"

  # Test nginx -> backend routing locally (Origin CA => -k)
  BACKEND_OK=0
  if curl -sk -H "Host: opennoesis.com" --max-time 5 https://127.0.0.1/api/health/ >/dev/null; then
    BACKEND_OK=1
  fi

  # Frontend direct port test (adjust if you proxy frontend via nginx later)
  FRONTEND_OK=0
  if curl -fsS --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    FRONTEND_OK=1
  fi

  if [[ "$BACKEND_OK" -eq 1 && "$FRONTEND_OK" -eq 1 ]]; then
    echo -e "${GREEN}Smoke tests passed!${NC}"
    return 0
  fi

  echo -e "${RED}Smoke test failed!${NC}"
  echo -e "${YELLOW}Hints:${NC}"
  echo "  - Check logs: docker compose logs -f backend frontend"
  echo "  - Check nginx: sudo tail -n 100 /var/log/nginx/opennoesis-error.log"
  return 1
}

# --- load state ---
if [[ ! -f "$STATE_FILE" ]]; then
  echo -e "${RED}No deployment state found ($STATE_FILE)! Cannot rollback.${NC}"
  exit 1
fi

# shellcheck disable=SC1090
source "$STATE_FILE"

# If user didn't pass APP_TAG explicitly, use the saved previous tag.
if [[ -z "${APP_TAG:-}" ]]; then
  if [[ -z "${PREV_APP_TAG:-}" ]]; then
    echo -e "${RED}State file does not contain PREV_APP_TAG. Cannot rollback automatically.${NC}"
    echo -e "${YELLOW}You can force a rollback tag like:${NC} APP_TAG=<tag> ./rollback.sh"
    exit 1
  fi
  APP_TAG="$PREV_APP_TAG"
fi

echo -e "${YELLOW}Rolling back to APP_TAG:${NC} ${GREEN}${APP_TAG}${NC}"

# --- do rollback ---
enable_maintenance

# Stop only app services; keep db/redis running
echo -e "${YELLOW}Stopping application services (keeping db/redis)...${NC}"
docker compose stop backend celery-worker celery-beat frontend >/dev/null 2>&1 || true
docker compose rm -f backend celery-worker celery-beat frontend >/dev/null 2>&1 || true

# Ensure infra is up
echo -e "${YELLOW}Ensuring database and redis are running...${NC}"
docker compose up -d db redis
wait_for_db

# Restore DB if backup exists in state file
# (Your deploy writes DB_BACKUP path; if empty, this step is skipped)
restore_database "${DB_BACKUP:-}" || {
  echo -e "${RED}Database restore failed. Keeping maintenance mode active.${NC}"
  exit 1
}

# Pull and start previous app version
export APP_TAG
echo -e "${YELLOW}Pulling images for APP_TAG=${APP_TAG}...${NC}"
docker compose pull backend frontend || echo -e "${YELLOW}Warning: image pull failed (continuing)${NC}"

echo -e "${YELLOW}Starting application services...${NC}"
docker compose up -d backend celery-worker celery-beat frontend

# Give it a moment, then smoke test
sleep 5
if ! smoke_test; then
  echo -e "${YELLOW}Keeping maintenance mode active. Fix the issue then re-run smoke tests.${NC}"
  exit 1
fi

disable_maintenance

echo -e "${GREEN}Rollback completed successfully!${NC}"
echo -e "${GREEN}Restored to APP_TAG:${NC} ${GREEN}${APP_TAG}${NC}"
