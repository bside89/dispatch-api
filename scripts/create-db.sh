#!/bin/bash

# Simple Database Creation Script

echo "🔍 Creating order_processing database..."

# Get the postgres container ID
POSTGRES_CONTAINER=$(docker ps --filter "ancestor=postgres:15" --format "{{.ID}}" | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "❌ PostgreSQL container not found! Run 'docker-compose up -d' first."
    exit 1
fi

echo "📦 Found PostgreSQL container: $POSTGRES_CONTAINER"

# Create the database
echo "🔧 Creating database..."
docker exec -i $POSTGRES_CONTAINER psql -U postgres -c "
    SELECT 'Database order_processing already exists' 
    WHERE EXISTS (SELECT FROM pg_database WHERE datname = 'order_processing')
    UNION ALL
    SELECT 'Creating database order_processing...' 
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'order_processing');
"

docker exec -i $POSTGRES_CONTAINER psql -U postgres -c "
    SELECT 'CREATE DATABASE order_processing' 
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'order_processing')
    \\gexec
"

# Verify
echo "✅ Verifying database exists..."
docker exec -i $POSTGRES_CONTAINER psql -U postgres -c "\\l" | grep order_processing

if [ $? -eq 0 ]; then
    echo "🎉 Database 'order_processing' is ready!"
    echo "You can now run: npm run start:dev"
else
    echo "❌ Failed to create database"
    exit 1
fi