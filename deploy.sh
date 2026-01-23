#!/bin/bash
# Simplified Deployment Script with Maintenance Mode
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/opennoesis"
BACKUP_DIR="$PROJECT_DIR/backups"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
STATE_FILE="$PROJECT_DIR/.deploy_state"

echo -e "${YELLOW}Starting deployment...${NC}"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

# Function to enable maintenance mode
enable_maintenance() {
    echo -e "${YELLOW}Enabling maintenance mode...${NC}"
    # Update nginx to serve maintenance page
    sed -i 's/# MAINTENANCE_MODE_DISABLED/# MAINTENANCE_MODE_ENABLED/' /etc/nginx/sites-available/opennoesis
    sed -i '/# MAINTENANCE_MODE_ENABLED/,/# END_MAINTENANCE_MODE/ s/^#//' /etc/nginx/sites-available/opennoesis
    nginx -t && systemctl reload nginx
}

# Function to disable maintenance mode
disable_maintenance() {
    echo -e "${YELLOW}Disabling maintenance mode...${NC}"
    # Revert nginx to serve the application
    sed -i 's/# MAINTENANCE_MODE_ENABLED/# MAINTENANCE_MODE_DISABLED/' /etc/nginx/sites-available/opennoesis
    sed -i '/# MAINTENANCE_MODE_DISABLED/,/# END_MAINTENANCE_MODE/ s/^/#/' /etc/nginx/sites-available/opennoesis
    nginx -t && systemctl reload nginx
}

# Function to save current state
save_state() {
    echo -e "${YELLOW}Saving current state...${NC}"
    CURRENT_COMMIT=$(git rev-parse HEAD)
    CURRENT_MIGRATION=$(docker exec debate-backend python manage.py showmigrations --plan | grep '\[X\]' | tail -n 1 | awk '{print $2}' 2>/dev/null || echo "")

    echo "COMMIT=$CURRENT_COMMIT" > "$STATE_FILE"
    echo "MIGRATION=$CURRENT_MIGRATION" >> "$STATE_FILE"

    echo -e "${GREEN}State saved: commit=$CURRENT_COMMIT${NC}"
}

# Function to restore previous state
restore_state() {
    echo -e "${YELLOW}Restoring previous state...${NC}"

    if [ ! -f "$STATE_FILE" ]; then
        echo -e "${RED}No state file found! Cannot restore.${NC}"
        return 1
    fi

    source "$STATE_FILE"

    # Restore git commit
    if [ -n "$COMMIT" ]; then
        echo -e "${YELLOW}Restoring to commit: $COMMIT${NC}"
        git checkout -f "$COMMIT"
    fi

    # Rebuild and restart containers
    docker compose -f "$COMPOSE_FILE" build
    docker compose -f "$COMPOSE_FILE" up -d

    # Wait for backend to be ready
    sleep 10

    # Restore migrations
    if [ -n "$MIGRATION" ]; then
        echo -e "${YELLOW}Restoring migrations to: $MIGRATION${NC}"
        docker exec debate-backend python manage.py migrate $MIGRATION --noinput || echo -e "${YELLOW}Warning: Could not restore migrations${NC}"
    fi

    # Try to verify it's working
    BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/ || echo "000")
    if [ "$BACKEND_RESPONSE" = "200" ]; then
        echo -e "${GREEN}Restore successful!${NC}"
        return 0
    else
        echo -e "${RED}Restore failed! Backend not responding.${NC}"
        return 1
    fi
}

# Enable maintenance mode
enable_maintenance

# Save current state before making changes
if docker ps | grep -q "debate-backend"; then
    save_state
else
    echo -e "${YELLOW}No running containers found, skipping state save${NC}"
fi

# Stop current containers
echo -e "${YELLOW}Stopping current containers...${NC}"
docker compose -f "$COMPOSE_FILE" down || true

# Pull latest code
echo -e "${YELLOW}Pulling latest code from GitHub...${NC}"
git fetch origin master
git reset --hard origin/master

# Build new Docker images
echo -e "${YELLOW}Building Docker images...${NC}"
if ! docker compose -f "$COMPOSE_FILE" build; then
    echo -e "${RED}Docker build failed! Restoring previous state...${NC}"
    if restore_state; then
        disable_maintenance
    else
        echo -e "${RED}Restore failed! Keeping maintenance mode active.${NC}"
    fi
    exit 1
fi

# Start new containers
echo -e "${YELLOW}Starting new containers...${NC}"
if ! docker compose -f "$COMPOSE_FILE" up -d; then
    echo -e "${RED}Failed to start containers! Restoring previous state...${NC}"
    if restore_state; then
        disable_maintenance
    else
        echo -e "${RED}Restore failed! Keeping maintenance mode active.${NC}"
    fi
    exit 1
fi

# Wait for containers to be ready
echo -e "${YELLOW}Waiting for containers to be healthy...${NC}"
MAX_WAIT=120
WAITED=0
HEALTH_CHECK_INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
    BACKEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' debate-backend 2>/dev/null || echo "unhealthy")
    FRONTEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' debate-frontend 2>/dev/null || echo "unhealthy")

    if [ "$BACKEND_HEALTH" = "healthy" ] && [ "$FRONTEND_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}All containers are healthy!${NC}"
        break
    fi

    echo "Waiting for health checks... (${WAITED}s/${MAX_WAIT}s)"
    sleep $HEALTH_CHECK_INTERVAL
    WAITED=$((WAITED + HEALTH_CHECK_INTERVAL))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}Health check timeout! Restoring previous state...${NC}"
    if restore_state; then
        disable_maintenance
    else
        echo -e "${RED}Restore failed! Keeping maintenance mode active.${NC}"
    fi
    exit 1
fi

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
if ! docker exec debate-backend python manage.py migrate --noinput; then
    echo -e "${RED}Migration failed! Restoring previous state...${NC}"
    if restore_state; then
        disable_maintenance
    else
        echo -e "${RED}Restore failed! Keeping maintenance mode active.${NC}"
    fi
    exit 1
fi

# Collect static files
echo -e "${YELLOW}Collecting static files...${NC}"
docker exec debate-backend python manage.py collectstatic --noinput || echo -e "${YELLOW}Warning: collectstatic failed${NC}"

# Perform smoke tests
echo -e "${YELLOW}Performing smoke tests...${NC}"
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/ || echo "000")
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "000")

if [ "$BACKEND_RESPONSE" != "200" ] || [ "$FRONTEND_RESPONSE" != "200" ]; then
    echo -e "${RED}Smoke tests failed! Backend: $BACKEND_RESPONSE, Frontend: $FRONTEND_RESPONSE${NC}"
    echo -e "${RED}Restoring previous state...${NC}"
    if restore_state; then
        disable_maintenance
    else
        echo -e "${RED}Restore failed! Keeping maintenance mode active.${NC}"
    fi
    exit 1
fi

echo -e "${GREEN}Smoke tests passed!${NC}"

# Disable maintenance mode
disable_maintenance

# Clean up old images
echo -e "${YELLOW}Cleaning up old Docker images...${NC}"
docker image prune -f

echo -e "${GREEN}Deployment completed successfully!${NC}"


