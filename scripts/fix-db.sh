#!/bin/bash

DB_NAME="order_flow"

echo "Fixing database connection issue..."

echo "Force stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker-compose down -v --remove-orphans 2>/dev/null || true

echo "Cleaning all volumes..."
docker volume prune -f
docker system prune -f

echo "Starting fresh containers..."
docker-compose up -d

echo "Waiting 30 seconds for PostgreSQL..."
sleep 30

echo "Creating database with multiple attempts..."

for i in {1..5}; do
    echo "Attempt $i to create database..."
    
    # Try to create database directly
    docker exec -i $(docker-compose ps -q postgres 2>/dev/null | head -1) psql -U postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null && {
        echo "Database $DB_NAME created successfully."
        break
    }
    
    # Check if it already exists
    docker exec -i $(docker-compose ps -q postgres 2>/dev/null | head -1) psql -U postgres -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME && {
        echo "Database $DB_NAME already exists."
        break
    }
    
    if [ $i -lt 5 ]; then
        echo "Attempt $i failed, waiting 5 seconds..."
        sleep 5
    else
        echo "Failed to create database $DB_NAME after all attempts"
        docker-compose logs postgres | tail -20
        echo ""
        echo "Container status:"
        docker-compose ps
        exit 1
    fi
done

echo ""
echo "Database $DB_NAME fix completed."