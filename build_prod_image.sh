#!/bin/bash
# Builds and push production images to the container registry
# This does not start/deploy the application
# This is meant to be run locally or in a CI/CD pipeline before deploying

set -e

# Check if .env.prod exists
if [ ! -f "./.env.prod" ]; then
    echo "❌ Error: .env.prod not found in root folder"
    echo "   Please create it with your production environment variables"
    exit 1
fi

echo ""
echo "Building production containers..."
docker compose --env-file .env.prod -f docker-compose.build.yml build

echo ""
echo "Pushing production images to registry..."
docker compose --env-file .env.prod -f docker-compose.build.yml push

echo ""
echo "✅ Production images built and pushed successfully!"
echo ""
