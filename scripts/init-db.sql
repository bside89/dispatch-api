-- SQL script to initialize the order_processing database
-- This will be executed by the init-db.sql script

-- Create database if it doesn't exist (PostgreSQL doesn't have IF NOT EXISTS for databases)
SELECT 'CREATE DATABASE order_processing' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'order_processing')\gexec

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE order_processing TO postgres;