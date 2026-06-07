#!/bin/bash
set -e

DBNAME="${POSTGRES_DB:-dispatch_db}"
DBUSER="${POSTGRES_USER:-postgres}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    SELECT 'CREATE DATABASE "${DBNAME}"'
    WHERE NOT EXISTS (
        SELECT FROM pg_database WHERE datname = '${DBNAME}'
    )\gexec

    GRANT ALL PRIVILEGES ON DATABASE "${DBNAME}" TO "${DBUSER}";
EOSQL

echo "Database '${DBNAME}' is ready for user '${DBUSER}'"
