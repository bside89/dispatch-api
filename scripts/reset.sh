#!/bin/bash

echo "Resetting containers..."

read -p "This will remove all data. Are you sure? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Reset cancelled."
    exit 1
fi

echo "Stopping and removing containers..."
docker compose down -v

echo "Removing volumes..."
docker volume prune -f

echo "Building application from scratch..."
docker compose build --no-cache

echo "Starting fresh environment..."
docker compose up -d

echo "Waiting for services to be ready..."
sleep 10

echo "Environment reset completed. Applications should be running with a clean state."