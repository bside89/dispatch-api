#!/bin/bash

# Order Flow - Setup Script

echo "🚀 Setting up Order Flow..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📁 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please review and update if necessary."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infrastructure services
echo "🐳 Starting infrastructure services (PostgreSQL, Redis)..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check if PostgreSQL is ready
echo "🔗 Checking PostgreSQL connection..."
until docker exec $(docker-compose ps -q postgres) pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 5
done

# Check if Redis is ready
echo "🔗 Checking Redis connection..."
until docker exec $(docker-compose ps -q redis) redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "✅ All services are ready!"

echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run start:dev' to start the development server"
echo "2. Open http://localhost:3000/api/docs for Swagger documentation"
echo "3. Use api-examples.http file to test the endpoints"
echo ""
echo "Service URLs:"
echo "- API: http://localhost:3000"
echo "- Swagger UI: http://localhost:3000/api/docs"
echo "- PostgreSQL: localhost:5432 (postgres/postgres)"
echo "- Redis: localhost:6379"