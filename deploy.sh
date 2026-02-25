#!/bin/bash
# Deploy with maintenance mode + pre-migration DB backup + rollback
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
MAINT_FLAG="/etc/nginx/maintenance.on"

# ----- Compose files (prod) -----
COMPOSE_FILES=(
  -f docker-compose.yml
  -f docker-compose.prod.yml
)

# Optional extra compose file (used for rollback pinning)
EXTRA_COMPOSE_FILE=""

dc() {
  if [[ -n "${EXTRA_COMPOSE_FILE:-}" ]]; then
    docker compose "${COMPOSE_FILES[@]}" -f "$EXTRA_COMPOSE_FILE" "$@"
  else
    docker compose "${COMPOSE_FILES[@]}" "$@"
  fi
}

log()  { echo -e "$1"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
ok()   { echo -e "${GREEN}$1${NC}"; }
err()  { echo -e "${RED}$1${NC}" >&2; }

# ----- Compose service names -----
SVC_DB="db"
SVC_REDIS="redis"
SVC_BACKEND="backend"
SVC_CELERY_WORKER="celery-worker"
SVC_CELERY_BEAT="celery-beat"
SVC_FRONTEND="frontend"

SVC_INFRA=("$SVC_DB" "$SVC_REDIS")
SVC_APP=("$SVC_BACKEND" "$SVC_CELERY_WORKER" "$SVC_CELERY_BEAT" "$SVC_FRONTEND")

# ----- DB credentials (used inside the DB container) -----
DB_NAME="debate_db"
DB_USER="debate_user"

# State flags
DEPLOY_SUCCESS=0
ROLLBACK_SUCCESS=0

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    err "Missing required command: $cmd"
    exit 1
  }
}

require_env() {
  if [[ -z "${APP_TAG:-}" ]]; then
    err "Missing required env var APP_TAG."
    err "Usage: APP_TAG=<tag> $0"
    exit 1
  fi
}

enable_maintenance() {
  warn "Enabling maintenance mode..."
  touch "$MAINT_FLAG"
  nginx -t
  systemctl reload nginx
}

disable_maintenance() {
  warn "Disabling maintenance mode..."
  rm -f "$MAINT_FLAG"
  nginx -t
  systemctl reload nginx
}

atomic_write() {
  # atomic_write <path> <content>
  local path="$1"
  local content="$2"
  local tmp
  tmp="$(mktemp "${path}.XXXXXX")"
  printf "%s" "$content" > "$tmp"
  chmod 600 "$tmp"
  mv -f "$tmp" "$path"
}

save_state() {
  warn "Saving current state..."

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  # Try to record the currently running image refs (most robust)
  local cur_backend_image cur_frontend_image
  cur_backend_image="$(dc ps -q "$SVC_BACKEND" | xargs -r docker inspect --format='{{.Config.Image}}' 2>/dev/null | head -n 1 || true)"
  cur_frontend_image="$(dc ps -q "$SVC_FRONTEND" | xargs -r docker inspect --format='{{.Config.Image}}' 2>/dev/null | head -n 1 || true)"

  # Best-effort previous tags (may be empty if digest/no tag)
  local prev_backend_tag="" prev_frontend_tag=""
  if [[ -n "$cur_backend_image" && "$cur_backend_image" != *@sha256:* && "$cur_backend_image" == *:* ]]; then
    prev_backend_tag="${cur_backend_image##*:}"
  fi
  if [[ -n "$cur_frontend_image" && "$cur_frontend_image" != *@sha256:* && "$cur_frontend_image" == *:* ]]; then
    prev_frontend_tag="${cur_frontend_image##*:}"
  fi

  local content
  content=$(
    cat <<EOF
PREV_BACKEND_TAG=${prev_backend_tag}
PREV_FRONTEND_TAG=${prev_frontend_tag}
PREV_BACKEND_IMAGE=${cur_backend_image}
PREV_FRONTEND_IMAGE=${cur_frontend_image}
DB_BACKUP=
EOF
  )

  atomic_write "$STATE_FILE" "$content"
  ok "State saved to $STATE_FILE"
}

backup_database() {
  warn "Creating database backup (custom format) + verify..."
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  local ts backup_tmp backup_final
  ts="$(date +%Y%m%d_%H%M%S)"
  backup_tmp="$BACKUP_DIR/.pre_deploy_${ts}.dump.tmp"
  backup_final="$BACKUP_DIR/pre_deploy_${ts}.dump"

  # Dump to temp file (avoid treating partial dump as valid)
  if ! dc exec -T "$SVC_DB" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$backup_tmp"; then
    err "DB backup failed (pg_dump error)."
    rm -f "$backup_tmp" || true
    return 1
  fi

  # Basic sanity: non-empty
  if [[ ! -s "$backup_tmp" ]]; then
    err "DB backup file is empty; refusing to continue."
    rm -f "$backup_tmp" || true
    return 1
  fi

  # Verify dump can be read (list archive contents)
  if ! cat "$backup_tmp" | dc exec -T "$SVC_DB" pg_restore -l >/dev/null 2>&1; then
    err "DB backup verification failed (pg_restore -l)."
    rm -f "$backup_tmp" || true
    return 1
  fi

  mv -f "$backup_tmp" "$backup_final"
  ok "DB backup created: $backup_final"

  # Update state file atomically
  source "$STATE_FILE" >/dev/null 2>&1 || true
  local content
  content=$(
    cat <<EOF
PREV_BACKEND_TAG=${PREV_BACKEND_TAG:-}
PREV_FRONTEND_TAG=${PREV_FRONTEND_TAG:-}
PREV_BACKEND_IMAGE=${PREV_BACKEND_IMAGE:-}
PREV_FRONTEND_IMAGE=${PREV_FRONTEND_IMAGE:-}
DB_BACKUP=${backup_final}
EOF
  )
  atomic_write "$STATE_FILE" "$content"

  return 0
}

restore_database() {
  local backup_file="$1"
  [[ -f "$backup_file" ]] || { err "Backup file not found: $backup_file"; return 1; }

  warn "Restoring database from backup: $backup_file"

  # Try to kill other connections (best-effort; may fail if permissions differ)
  dc exec -T "$SVC_DB" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true

  if cat "$backup_file" | dc exec -T "$SVC_DB" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists; then
    ok "Database restore successful."
    return 0
  else
    err "Database restore failed."
    return 1
  fi
}

stop_app_services() {
  warn "Stopping app services (keeping db/redis)..."
  dc stop "${SVC_APP[@]}" >/dev/null 2>&1 || true
  dc rm -f "${SVC_APP[@]}" >/dev/null 2>&1 || true
}

start_infra() {
  warn "Ensuring db/redis are up..."
  dc up -d --wait "${SVC_INFRA[@]}"
}

pull_images() {
  warn "Pulling new images for APP_TAG=${APP_TAG}"
  export APP_TAG
  # Pull everything that runs your code
  dc pull "$SVC_BACKEND" "$SVC_CELERY_WORKER" "$SVC_CELERY_BEAT" "$SVC_FRONTEND"
}

run_migrations() {
  warn "Running migrations (backend container)..."
  dc exec -T "$SVC_BACKEND" python manage.py migrate --noinput
  ok "Migrations completed."
}

collect_static() {
  warn "Collecting static files (backend container)..."
  dc exec -T "$SVC_BACKEND" python manage.py collectstatic --noinput
  ok "collectstatic completed."
}

smoke_tests() {
  warn "Smoke tests..."

  local code

  # Backend health (nginx -> backend)
  code="$(curl -sk -o /dev/null -w "%{http_code}" -H "Host: opennoesis.com" --max-time 8 https://127.0.0.1/api/health || true)"
  if [[ "$code" != "200" ]]; then
    err "Backend smoke test failed (expected 200, got ${code})."
    return 1
  fi

  # Frontend root (nginx -> frontend)
  code="$(curl -sk -o /dev/null -w "%{http_code}" -H "Host: opennoesis.com" --max-time 8 https://127.0.0.1/ || true)"
  if [[ "$code" != "200" && "$code" != "304" ]]; then
    err "Frontend smoke test failed (expected 200/304, got ${code})."
    return 1
  fi

  ok "Smoke tests passed."
}

make_rollback_override_file() {
  # Creates a temporary compose override that pins images to previous image refs.
  # This avoids relying on tag extraction.
  local override="$PROJECT_DIR/.rollback-images.override.yml"

  source "$STATE_FILE" >/dev/null 2>&1 || true

  if [[ -z "${PREV_BACKEND_IMAGE:-}" && -z "${PREV_FRONTEND_IMAGE:-}" ]]; then
    warn "No previous image refs found; not creating rollback override file."
    return 1
  fi

  warn "Creating rollback image override file: $override"

  # Pin backend and frontend. If celery uses the same image as backend, pin those too.
  cat > "$override" <<EOF
services:
  ${SVC_BACKEND}:
    image: ${PREV_BACKEND_IMAGE}
  ${SVC_CELERY_WORKER}:
    image: ${PREV_BACKEND_IMAGE}
  ${SVC_CELERY_BEAT}:
    image: ${PREV_BACKEND_IMAGE}
  ${SVC_FRONTEND}:
    image: ${PREV_FRONTEND_IMAGE}
EOF

  EXTRA_COMPOSE_FILE="$override"
  return 0
}

rollback() {
  err "Rolling back..."

  if [[ ! -f "$STATE_FILE" ]]; then
    err "No state file; cannot rollback safely. Keeping maintenance mode ON."
    return 1
  fi

  source "$STATE_FILE" || true

  # Restore DB if we have a verified backup
  if [[ -n "${DB_BACKUP:-}" && -f "${DB_BACKUP:-}" ]]; then
    restore_database "$DB_BACKUP" || err "DB restore failed; continuing rollback of containers anyway."
  else
    warn "No DB backup recorded; skipping DB restore."
  fi

  stop_app_services
  start_infra

  # Preferred rollback: pin to previous image refs via override file
  if make_rollback_override_file; then
    warn "Starting services with pinned previous images..."
    dc up -d --wait "${SVC_APP[@]}"
  else
    # Fallback: try previous tags (only if present and you deploy by tag)
    if [[ -n "${PREV_BACKEND_TAG:-}" && -n "${PREV_FRONTEND_TAG:-}" && "${PREV_BACKEND_TAG}" == "${PREV_FRONTEND_TAG}" ]]; then
      warn "Reverting APP_TAG to previous tag: ${PREV_BACKEND_TAG}"
      export APP_TAG="$PREV_BACKEND_TAG"
      dc pull "${SVC_APP[@]}" || true
      dc up -d --wait "${SVC_APP[@]}"
    else
      warn "No reliable previous tag/image pin available. Attempting best-effort restart with whatever images are present."
      dc up -d --wait "${SVC_APP[@]}"
    fi
  fi

  if smoke_tests; then
    ok "Rollback successful."
    ROLLBACK_SUCCESS=1
    return 0
  fi

  err "Rollback failed. Keeping maintenance mode ON."
  return 1
}

on_err() {
  err "Deployment failed (line $1)."
  rollback || true
  exit 1
}
trap 'on_err $LINENO' ERR

on_exit() {
  # Only disable maintenance if deployment succeeded AND marker exists.
  if [[ "${DEPLOY_SUCCESS}" == "1" || "${ROLLBACK_SUCCESS}" == "1" ]]; then
    if [[ -f "$MAINT_FLAG" ]]; then
      disable_maintenance || true
    fi

    if [[ "${ROLLBACK_SUCCESS}" == "1" ]]; then
      warn "Deployment failed but rollback succeeded. Maintenance mode disabled, but please investigate the root cause."
    fi

  else
    if [[ -f "$MAINT_FLAG" ]]; then
      error "Leaving maintenance mode ON due to failed deployment AND failed rollback."
    fi
  fi
}
trap 'on_exit' EXIT

main() {
  require_cmd docker
  require_cmd nginx
  require_cmd systemctl
  require_cmd curl

  require_env

  cd "$PROJECT_DIR"

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

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

  # Start backend first (so we can exec migrate/collectstatic in it)
  warn "Starting backend container (only)..."
  dc up -d --wait "$SVC_BACKEND"

  run_migrations
  collect_static

  # Start the rest
  warn "Starting remaining app services..."
  dc up -d --wait "$SVC_CELERY_WORKER" "$SVC_CELERY_BEAT" "$SVC_FRONTEND"

  smoke_tests

  # Success: allow EXIT trap to disable maintenance
  DEPLOY_SUCCESS=1

  # Keep only last 10 backups
  warn "Cleaning old backups (keeping last 10)..."
  ls -t "$BACKUP_DIR"/pre_deploy_*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f

  ok "Deployment completed successfully."
  ok "Deployed APP_TAG=${APP_TAG}"
}

main