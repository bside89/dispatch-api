#!/bin/bash

echo "Setting up production environment..."

export NODE_ENV="production"
cp .env.production .env

if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running."
    exit 1
fi

echo ""
echo "Production Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Debug tips:"
echo "- Set LOG_LEVEL=debug in .env for more verbose logging"
echo "- Use 'npm run docker:logs' to see infrastructure logs"
echo "- Use 'npm run docker:status' to check service status"
echo ""

read -p "Start the application now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting NestJS in Production mode..."
    docker compose up -d
fi