#!/bin/bash
# Development environment startup script
# This script starts the development environment with live reloading

set -e

echo "🚀 Starting Development Environment..."
echo ""

# Check if .env.dev exists
if [ ! -f "./.env.dev" ]; then
    echo "❌ Error: .env.dev not found in root folder"
    echo "   Please create it with your development environment variables"
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
echo "📦 Building development containers (if needed)..."
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml build

echo ""
echo "Starting services..."
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d

echo ""
echo "Running migrations..."
docker exec debate-backend python manage.py migrate --noinput

echo ""
echo "Collecting static files..."
docker exec debate-backend python manage.py collectstatic --noinput

echo ""
echo "🎯 Starting services with live reloading..."
echo ""
echo "   Backend:  http://localhost:8000 (Django runserver)"
echo "   Frontend: http://localhost:3000 (Next.js dev server)"
echo ""
echo "   Press Ctrl+C to stop all services"
echo ""

# Run the the up command to start all services in the foreground
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up
