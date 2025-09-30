#!/bin/bash

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Build services first
echo "Building services..."
docker compose build

# Build list of services to start
SERVICES="tiger-agent db tiger-slack-mcp-server tiger-slack-ingest"

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

# Start only the enabled services
echo "Starting services: $SERVICES"
docker compose up -d $SERVICES

echo "Services started successfully!"
echo "Use 'docker compose ps' to see running services"