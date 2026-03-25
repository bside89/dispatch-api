#!/bin/bash

# Order Flow - Debug Local Script

echo "🐞 Setting up local debug environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Start infrastructure services if not running
if ! docker-compose ps --services --filter "status=running" | grep -q postgres; then
    echo "🐳 Starting infrastructure services (PostgreSQL, Redis)..."
    docker-compose up -d postgres redis promtail loki grafana
    
    echo "⏳ Waiting for services to be ready..."
    sleep 15
    
    # Wait for PostgreSQL
    until docker exec $(docker-compose ps -q postgres) pg_isready -U postgres > /dev/null 2>&1; do
        echo "Waiting for PostgreSQL..."
        sleep 3
    done
    
    # Wait for Redis
    until docker exec $(docker-compose ps -q redis) redis-cli ping > /dev/null 2>&1; do
        echo "Waiting for Redis..."
        sleep 2
    done
    
    echo "✅ All infrastructure services are ready!"
else
    echo "✅ Infrastructure services are already running"
fi

echo ""
echo "🎯 Local Debug Environment Ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo "1. Run 'npm run start:debug' to start with debugger"
echo "2. Or run 'npm run start:dev' for normal development"
echo "3. Set breakpoints in VS Code and use F5 to start debugging"
echo ""
echo "🌐 Service URLs:"
echo "- API: http://localhost:3000"
echo "- Swagger: http://localhost:3000/api/docs"
echo "- PostgreSQL: localhost:5432 (postgres/postgres)"
echo "- Redis: localhost:6379"
echo ""
echo "💡 Debug Tips:"
echo "- Use VS Code debugger configuration 'Debug NestJS'"
echo "- Set NEST_DEBUG=true in .env for more verbose logging"
echo "- Use 'npm run docker:logs' to see infrastructure logs"
echo "- Use 'npm run docker:status' to check service status"
echo ""

# Optional: Ask if user wants to start the app immediately
read -p "🚀 Start the application now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔥 Starting NestJS in debug mode..."
    npm run start:debug
fi