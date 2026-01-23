#!/bin/bash
# Rollback script - restores to previous deployment state
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/opt/opennoesis"
STATE_FILE="$PROJECT_DIR/.deploy_state"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

echo -e "${YELLOW}Starting rollback...${NC}"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
    echo -e "${RED}No deployment state found! Cannot rollback.${NC}"
    exit 1
fi

# Load previous state
source "$STATE_FILE"

if [ -z "$COMMIT" ]; then
    echo -e "${RED}Invalid state file! No commit hash found.${NC}"
    exit 1
fi

echo -e "${YELLOW}Rolling back to commit: $COMMIT${NC}"

# Enable maintenance mode
echo -e "${YELLOW}Enabling maintenance mode...${NC}"
sed -i 's/# MAINTENANCE_MODE_DISABLED/# MAINTENANCE_MODE_ENABLED/' /etc/nginx/sites-available/opennoesis
sed -i '/# MAINTENANCE_MODE_ENABLED/,/# END_MAINTENANCE_MODE/ s/^#//' /etc/nginx/sites-available/opennoesis
nginx -t && systemctl reload nginx

# Stop current containers
echo -e "${YELLOW}Stopping current containers...${NC}"
docker compose -f "$COMPOSE_FILE" down

# Restore git commit
echo -e "${YELLOW}Restoring code to previous version...${NC}"
git checkout -f "$COMMIT"

# Rebuild containers
echo -e "${YELLOW}Building containers...${NC}"
docker compose -f "$COMPOSE_FILE" build

# Start containers
echo -e "${YELLOW}Starting containers...${NC}"
docker compose -f "$COMPOSE_FILE" up -d

# Wait for containers to be healthy
echo -e "${YELLOW}Waiting for containers to be healthy...${NC}"
MAX_WAIT=120
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
    BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' debate-backend 2>/dev/null || echo "unhealthy")
    FRONTEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' debate-frontend 2>/dev/null || echo "unhealthy")

    if [ "$BACKEND_HEALTH" = "healthy" ] && [ "$FRONTEND_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}All containers are healthy!${NC}"
        break
    fi

    echo "Waiting for health checks... (${WAITED}s/120s)"
    sleep 5
    WAITED=$((WAITED + 5))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}Health check timeout! Containers may not be working properly.${NC}"
    echo -e "${YELLOW}Keeping maintenance mode active. Check logs with: docker compose logs${NC}"
    exit 1
fi

# Restore migrations if available
if [ -n "$MIGRATION" ]; then
    echo -e "${YELLOW}Restoring migrations to: $MIGRATION${NC}"
    docker exec debate-backend python manage.py migrate $MIGRATION --noinput || echo -e "${YELLOW}Warning: Could not restore exact migration state${NC}"
fi

# Verify with smoke test
echo -e "${YELLOW}Performing smoke test...${NC}"
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/ || echo "000")

if [ "$BACKEND_RESPONSE" != "200" ]; then
    echo -e "${RED}Smoke test failed! Response: $BACKEND_RESPONSE${NC}"
    echo -e "${YELLOW}Keeping maintenance mode active. Check logs with: docker compose logs${NC}"
    exit 1
fi

# Disable maintenance mode
echo -e "${YELLOW}Disabling maintenance mode...${NC}"
sed -i 's/# MAINTENANCE_MODE_ENABLED/# MAINTENANCE_MODE_DISABLED/' /etc/nginx/sites-available/opennoesis
sed -i '/# MAINTENANCE_MODE_DISABLED/,/# END_MAINTENANCE_MODE/ s/^/#/' /etc/nginx/sites-available/opennoesis
nginx -t && systemctl reload nginx

echo -e "${GREEN}Rollback completed successfully!${NC}"
echo -e "Restored to commit: ${GREEN}$COMMIT${NC}"

