#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Build services first
echo "Building services..."
docker compose build

if [[ "$PGHOST" == "db" ]]; then
    # We start the database service first to give it time to initialize as needed,
    # as the other services depend on it, but since it's optional we cannot rely
    # on the built-in depends_on with condition: service_healthy in docker-compose.yml.
    echo "Checking for database updates..."
    docker compose pull db

    echo "Starting database service..."
    docker compose up -d db

    echo -n "Waiting for database to be ready..."
    until PGHOST=127.0.0.1 PGPORT="${PGPORT}" PGDATABASE="${PGDATABASE}" PGUSER="${PGUSER}" pg_isready -q; do
        echo -n "."
        sleep 1
    done
    echo ""
    echo "Database is ready!"
fi

# Build list of services to start
SERVICES="tiger-agent tiger-slack-mcp-server tiger-slack-ingest"

# Add MCP services that are not disabled (check mcp_config.json)
check_service_enabled() {
    local service_name=$1
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available
        disabled=$(jq -r ".\"$service_name\".disabled // false" mcp_config.json 2>/dev/null)
        [ "$disabled" != "true" ]
    else
        # Fallback: check if "disabled": true exists for the service
        ! grep -A 5 "\"$service_name\":" mcp_config.json | grep -q "\"disabled\": true"
    fi
}

if check_service_enabled "github"; then
    SERVICES="$SERVICES tiger-gh-mcp-server"
fi

if check_service_enabled "linear"; then
    SERVICES="$SERVICES tiger-linear-mcp-server"
fi

echo "Configured services to start: $SERVICES"
echo "Checking for updates..."
docker compose pull $SERVICES

# Start only the enabled services
echo "Starting services..."
docker compose up -d $SERVICES

echo "Services started successfully!"
echo "Use 'docker compose ps' to see running services"
