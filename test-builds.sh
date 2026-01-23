#!/bin/bash
# Test script to verify Docker builds work correctly before deployment

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Testing Docker Builds ===${NC}\n"

# Test backend build
echo -e "${YELLOW}Building backend image...${NC}"
if docker build -t debate-backend-test -f backend/Dockerfile backend/; then
    echo -e "${GREEN}✓ Backend build successful${NC}\n"
else
    echo -e "${RED}✗ Backend build failed${NC}"
    exit 1
fi

# Test frontend build
echo -e "${YELLOW}Building frontend image...${NC}"
if docker build -t debate-frontend-test -f frontend/Dockerfile frontend/; then
    echo -e "${GREEN}✓ Frontend build successful${NC}\n"
else
    echo -e "${RED}✗ Frontend build failed${NC}"
    exit 1
fi

# Clean up test images
echo -e "${YELLOW}Cleaning up test images...${NC}"
docker rmi debate-backend-test debate-frontend-test

echo -e "\n${GREEN}=== All builds successful! ===${NC}"

