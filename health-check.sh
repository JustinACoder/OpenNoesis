#!/bin/bash
# Health check script to verify all services are running correctly

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Debate Arena Health Check ===${NC}\n"

# Check PostgreSQL
echo -n "PostgreSQL: "
if sudo systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

# Check Redis
echo -n "Redis: "
if sudo systemctl is-active --quiet redis; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

# Check Nginx
echo -n "Nginx: "
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
fi

# Check Docker containers
echo -e "\n${YELLOW}Docker Containers:${NC}"
docker ps --filter "name=debate" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || echo "No containers running"

# Check disk space
echo -e "\n${YELLOW}Disk Usage:${NC}"
df -h / | tail -1 | awk '{print "Used: " $3 " / " $2 " (" $5 ")"}'

# Check memory
echo -e "\n${YELLOW}Memory Usage:${NC}"
free -h | grep Mem | awk '{print "Used: " $3 " / " $2}'

# Test backend health endpoint
echo -e "\n${YELLOW}Application Health:${NC}"
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/ 2>/dev/null || echo "000")
echo -n "Backend API: "
if [ "$BACKEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy (HTTP $BACKEND_RESPONSE)${NC}"
fi

FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
echo -n "Frontend: "
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy (HTTP $FRONTEND_RESPONSE)${NC}"
fi

echo ""

