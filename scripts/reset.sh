#!/bin/bash

echo "Resetting containers..."

compose_cmd() {
    docker compose --env-file .env.production "$@"
}

read -p "This will remove all data. Are you sure? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Reset cancelled."
    exit 1
fi

echo "Stopping and removing containers..."
compose_cmd down -v

echo "Removing volumes..."
docker volume prune -f

echo "Building application from scratch..."
compose_cmd build --no-cache

echo "Environment reset completed."