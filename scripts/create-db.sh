#!/bin/bash

DB_NAME="order_flow"

POSTGRES_CONTAINER=$(docker ps --filter "ancestor=postgres:15" --format "{{.ID}}" | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "PostgreSQL container not found."
    exit 1
fi
echo "Found PostgreSQL container: $POSTGRES_CONTAINER"

echo "Creating database..."
docker exec -i $POSTGRES_CONTAINER psql -U postgres -c "
    SELECT 'Database $DB_NAME already exists' 
    WHERE EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
    UNION ALL
    SELECT 'Creating database $DB_NAME...' 
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME');
"

docker exec -i $POSTGRES_CONTAINER psql -U postgres -c "
    SELECT 'CREATE DATABASE $DB_NAME' 
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')
    \\gexec
"

echo "Verifying database exists..."
docker exec -i $POSTGRES_CONTAINER psql -U postgres -c "\\l" | grep $DB_NAME

if [ $? -eq 0 ]; then
    echo "Database '$DB_NAME' is ready."
else
    echo "Failed to create database."
    exit 1
fi