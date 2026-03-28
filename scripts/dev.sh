#!/bin/bash

echo "Starting development environment..."

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "Starting infrastructure services..."
    docker-compose up -d
    echo "Waiting for services to be ready..."
    sleep 15
fi

# Check PostgreSQL
if ! docker exec $(docker-compose ps -q postgres 2>/dev/null || echo "none") pg_isready -U postgres > /dev/null 2>&1; then
    echo "PostgreSQL not ready. Please run 'npm run setup' first."
    exit 1
fi

# Check Redis
if ! docker exec $(docker-compose ps -q redis 2>/dev/null || echo "none") redis-cli ping > /dev/null 2>&1; then
    echo "Redis not ready."
    exit 1
fi

echo "Starting NestJS in Dev Mode..."
npm run start:dev