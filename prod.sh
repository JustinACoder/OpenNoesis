#!/bin/bash
# Production environment startup script, this is meant to be ran manually
# For the full deployment process, use deploy.sh

set -e

echo "🚀 Starting Production Environment..."
echo ""

# Check if .env.prod exists
if [ ! -f "./.env.prod" ]; then
    echo "❌ Error: .env.prod not found in root folder"
    echo "   Please create it with your production environment variables"
    exit 1
fi

# Check if backend/.env exists
if [ ! -f "./backend/.env" ]; then
    echo "⚠️  Warning: backend/.env not found"
    echo "   You may need to create it from .env.example"
fi

if [ ! -f "./frontend/.env" ]; then
    echo "⚠️  Warning: frontend/.env not found"
    echo "   You may need to create it from .env.example"
fi

echo ""
echo "Pull latest images..."
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml pull

echo ""
echo "Run services in background..."
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d

echo ""
echo "Running migrations..."
docker exec debate-backend python manage.py migrate --noinput

echo ""
echo "Collecting static files..."
docker exec debate-backend python manage.py collectstatic --noinput

echo ""
echo "🎯 Services are up and running!"
echo ""

watch docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml ps
