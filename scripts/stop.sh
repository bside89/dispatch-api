#!/bin/bash

# Event-Driven Order Processing API - Stop Script

echo "🛑 Stopping all services..."

# Stop Docker containers
docker-compose down

echo "✅ All services stopped."
echo ""
echo "To start again:"
echo "- Run 'npm run dev' to start development environment"
echo "- Run 'docker-compose up -d' to start only infrastructure services"