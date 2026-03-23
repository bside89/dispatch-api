#!/bin/bash

# Order Flow - Development Script

echo "🛠️ Starting development environment..."

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "🚀 Starting infrastructure services..."
    docker-compose up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 15
fi

# Check PostgreSQL
if ! docker exec $(docker-compose ps -q postgres 2>/dev/null || echo "none") pg_isready -U postgres > /dev/null 2>&1; then
    echo "⚠️ PostgreSQL not ready. Please run 'npm run setup' first."
    exit 1
fi

# Start the development server
echo "🎆 Starting NestJS development server..."
npm run start:dev