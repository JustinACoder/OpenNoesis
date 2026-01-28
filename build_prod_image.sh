#!/bin/bash
# Builds and push production images to the container registry
# This does not start/deploy the application
# This is meant to be run locally or in a CI/CD pipeline before deploying

set -e

echo ""
echo "Building production containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.build.yml build

echo ""
echo "Pushing production images to registry..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.build.yml push

echo ""
echo "✅ Production images built and pushed successfully!"
echo ""
