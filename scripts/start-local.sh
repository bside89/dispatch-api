#!/bin/bash

echo "Setting up local environment..."

export NODE_ENV="local"
cp .env.local .env

compose_cmd() {
    docker compose "$@"
}

if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running."
    exit 1
fi

if ! (compose_cmd ps --services --filter "status=running" | grep -q postgres &&
            compose_cmd ps --services --filter "status=running" | grep -q redis && 
            compose_cmd ps --services --filter "status=running" | grep -q promtail &&
            compose_cmd ps --services --filter "status=running" | grep -q loki &&
            compose_cmd ps --services --filter "status=running" | grep -q grafana &&
            compose_cmd ps --services --filter "status=running" | grep -q stripe-mock
    ); then
    echo "Starting infrastructure services (PostgreSQL, Redis)..."
    compose_cmd up -d postgres redis promtail loki grafana stripe-mock
    
    echo "Waiting for services to be ready..."
    sleep 5
    
    # Wait for PostgreSQL
    until docker exec $(compose_cmd ps -q postgres) pg_isready -U postgres > /dev/null 2>&1; do
        echo "Waiting for PostgreSQL..."
        sleep 3
    done
    
    # Wait for Redis
    until docker exec $(compose_cmd ps -q redis) redis-cli ping > /dev/null 2>&1; do
        echo "Waiting for Redis..."
        sleep 2
    done
    
    echo "All infrastructure services are ready."
else
    echo "Infrastructure services are already running."
fi

echo ""
echo "Local Dev Environment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Debug tips:"
echo "- Set LOG_LEVEL=debug in .env.local for more verbose logging"
echo "- Use 'npm run docker:logs' to see infrastructure logs"
echo "- Use 'npm run docker:status' to check service status"
echo ""

read -p "Start the application now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting NestJS in Local mode..."
    nest start --debug --watch
fi