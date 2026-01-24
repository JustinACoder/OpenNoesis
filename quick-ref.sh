#!/bin/bash
# Quick reference script for common deployment operations
# Usage: ./quick-ref.sh [command] [args...]

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/opt/opennoesis"
STATE_FILE="$PROJECT_DIR/.deploy_state"

cd "$PROJECT_DIR" >/dev/null 2>&1 || {
  echo -e "${RED}Error: cannot cd to $PROJECT_DIR${NC}"
  exit 1
}

show_help() {
  echo -e "${BLUE}=== Debate Arena Deployment - Quick Reference ===${NC}\n"
  echo "Usage: ./quick-ref.sh [command] [args...]"
  echo ""
  echo "Commands:"
  echo "  rollback            - Rollback to previous deployment (uses ./rollback.sh)"
  echo "  logs [service]      - View logs (backend, frontend, celery-worker, celery-beat, db, redis)"
  echo "  status              - Show deployment status"
  echo "  migrate             - Run database migrations (one-off container)"
  echo "  shell               - Open Django shell (interactive)"
  echo "  restart [service]   - Restart all services or one service"
  echo "  cleanup             - Clean up dangling Docker images"
  echo "  pull                - Pull images (according to current env/compose)"
  echo ""
}

case "${1:-}" in
  rollback)
    echo -e "${YELLOW}Rolling back...${NC}"
    ./rollback.sh
    ;;

  logs)
    if [[ -z "${2:-}" ]]; then
      docker compose logs -f
    else
      docker compose logs -f "$2"
    fi
    ;;

  status)
    echo -e "${YELLOW}Current deployment status:${NC}"

    echo -e "\n${YELLOW}Running containers:${NC}"
    docker ps --filter "name=debate" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

    if [[ -f "$STATE_FILE" ]]; then
      # shellcheck disable=SC1090
      source "$STATE_FILE"
      echo -e "\n${YELLOW}Last saved deploy state (${STATE_FILE}):${NC}"
      echo -e "Prev APP_TAG:       ${GREEN}${PREV_APP_TAG:-<unknown>}${NC}"
      echo -e "Prev backend image: ${GREEN}${PREV_BACKEND_IMAGE:-<unknown>}${NC}"
      echo -e "Prev frontend image:${GREEN}${PREV_FRONTEND_IMAGE:-<unknown>}${NC}"
      if [[ -n "${DB_BACKUP:-}" ]]; then
        echo -e "DB backup:          ${GREEN}${DB_BACKUP}${NC}"
      fi
    else
      echo -e "\n${YELLOW}No deploy state found at $STATE_FILE${NC}"
    fi
    ;;

  migrate)
    echo -e "${YELLOW}Running migrations (one-off container)...${NC}"
    docker compose run --rm backend python manage.py migrate --noinput
    ;;

  shell)
    echo -e "${YELLOW}Opening Django shell...${NC}"
    docker exec -it debate-backend python manage.py shell
    ;;

  restart)
    echo -e "${YELLOW}Restarting services...${NC}"
    if [[ -z "${2:-}" ]]; then
      docker compose restart
    else
      docker compose restart "$2"
    fi
    ;;

  cleanup)
    echo -e "${YELLOW}Cleaning up dangling Docker images...${NC}"
    # Safer than `docker system prune -a` (keeps non-dangling images for rollback)
    docker image prune -f
    ;;

  pull)
    echo -e "${YELLOW}Pulling images...${NC}"
    docker compose pull
    ;;

  *)
    show_help
    ;;
esac
