#!/bin/bash

# Fix Database Script - Event-Driven Order Processing API

echo "🔧 Fixing database connection issue..."

# Force stop and cleanup
echo "🛑 Force stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker-compose down -v --remove-orphans 2>/dev/null || true

# Clean up volumes completely
echo "🗑️  Cleaning all volumes..."
docker volume prune -f
docker system prune -f

# Start fresh
echo "🆕 Starting fresh containers..."
docker-compose up -d

# Wait longer for PostgreSQL
echo "⏳ Waiting 30 seconds for PostgreSQL..."
sleep 30

# Multiple attempts to connect and create database
echo "🔧 Creating database with multiple attempts..."

for i in {1..5}; do
    echo "Attempt $i to create database..."
    
    # Try to create database directly
    docker exec -i $(docker-compose ps -q postgres 2>/dev/null | head -1) psql -U postgres -c "CREATE DATABASE order_processing;" 2>/dev/null && {
        echo "✅ Database 'order_processing' created successfully!"
        break
    }
    
    # Check if it already exists
    docker exec -i $(docker-compose ps -q postgres 2>/dev/null | head -1) psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw order_processing && {
        echo "✅ Database 'order_processing' already exists!"
        break
    }
    
    if [ $i -lt 5 ]; then
        echo "❌ Attempt $i failed, waiting 5 seconds..."
        sleep 5
    else
        echo "❌ Failed to create database after all attempts"
        echo "🔍 Let's check what's happening..."
        docker-compose logs postgres | tail -20
        echo ""
        echo "🔍 Container status:"
        docker-compose ps
        exit 1
    fi
done

echo ""
echo "🎉 Database fix completed!"
echo "Now you can run: npm run start:dev"