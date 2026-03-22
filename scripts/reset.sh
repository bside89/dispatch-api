#!/bin/bash

# Event-Driven Order Processing API - Reset Script

echo "🧽 Resetting development environment..."

read -p "This will remove all data. Are you sure? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reset cancelled."
    exit 1
fi

# Stop and remove containers with volumes
echo "🛑 Stopping and removing containers..."
docker-compose down -v

# Remove Docker volumes
echo "🗑️ Removing volumes..."
docker volume prune -f

# Start fresh
echo "🎆 Starting fresh environment..."
docker-compose up -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 30

echo "✅ Environment reset completed!"
echo "You can now run 'npm run start:dev' to start the application."