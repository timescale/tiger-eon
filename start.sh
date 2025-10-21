#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if Docker is running
if docker info >/dev/null 2>&1; then
    echo "Docker daemon is running."
else
    echo "Docker daemon is not running."
    echo -n "Please start Docker and press Enter to continue... "
    read -r
    # Re-check after user input
    if ! docker info >/dev/null 2>&1; then
        echo "Docker is still not running. Exiting."
        exit 1
    fi
    echo "Docker is now running. Continuing..."
fi

read -r
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
if [ $? -ne 0 ]; then
    echo "Error: Failed to pull Docker images. Exiting."
    exit 1
fi

# Start only the enabled services
echo "Starting services..."
docker compose up -d $SERVICES
if [ $? -ne 0 ]; then
    echo "Error: Failed to start Docker services. Exiting."
    exit 1
fi

echo "Services started successfully!"
echo "Use 'docker compose ps' to see running services"
