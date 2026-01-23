#!/bin/bash
# Quick reference script for common deployment operations
# Usage: ./quick-ref.sh [command]

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo -e "${BLUE}=== Debate Arena Deployment - Quick Reference ===${NC}\n"
    echo "Usage: ./quick-ref.sh [command]"
    echo ""
    echo "Commands:"
    echo "  deploy          - Deploy latest version from GitHub"
    echo "  rollback        - Rollback to previous deployment"
    echo "  health          - Check system health"
    echo "  logs [service]  - View logs (backend, frontend, celery-worker, celery-beat)"
    echo "  status          - Show deployment status"
    echo "  migrate         - Run database migrations"
    echo "  shell           - Open Django shell"
    echo "  restart         - Restart all services"
    echo "  cleanup         - Clean up old Docker images"
    echo ""
}

case "$1" in
    deploy)
        echo -e "${YELLOW}Deploying...${NC}"
        cd /opt/opennoesis && ./deploy.sh
        ;;
    rollback)
        echo -e "${YELLOW}Rolling back...${NC}"
        cd /opt/opennoesis && ./rollback.sh
        ;;
    health)
        echo -e "${YELLOW}Checking health...${NC}"
        cd /opt/opennoesis && ./health-check.sh
        ;;
    logs)
        if [ -z "$2" ]; then
            docker compose logs -f
        else
            docker compose logs -f "$2"
        fi
        ;;
    status)
        echo -e "${YELLOW}Current deployment status:${NC}"
        if [ -f /opt/opennoesis/.deploy_state ]; then
            source /opt/opennoesis/.deploy_state
            echo -e "Last deployed commit: ${GREEN}$COMMIT${NC}"
            if [ -n "$MIGRATION" ]; then
                echo -e "Migration state: ${GREEN}$MIGRATION${NC}"
            fi
        else
            echo "No deployment state found"
        fi
        echo ""
        echo -e "${YELLOW}Running containers:${NC}"
        docker ps --filter "name=debate" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        ;;
    migrate)
        echo -e "${YELLOW}Running migrations...${NC}"
        docker exec debate-backend python manage.py migrate
        ;;
    shell)
        echo -e "${YELLOW}Opening Django shell...${NC}"
        docker exec -it debate-backend python manage.py shell
        ;;
    restart)
        echo -e "${YELLOW}Restarting services...${NC}"
        docker compose restart
        ;;
    cleanup)
        echo -e "${YELLOW}Cleaning up old Docker images...${NC}"
        docker system prune -a -f
        ;;
    *)
        show_help
        ;;
esac

