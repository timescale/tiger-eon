#!/bin/bash
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

print_usage() {
    echo "Usage: $0 <slack-export-directory>"
    echo ""
    echo "Import Slack export data into the database."
    echo ""
    echo "Arguments:"
    echo "  <slack-export-directory>  Path to the Slack export directory"
}

# Check if help is requested or no argument provided
if [ $# -eq 0 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    print_usage
    exit 0
fi

SLACK_DIR="$1"

# Validate that the directory exists
if [ ! -d "$SLACK_DIR" ]; then
    log_error "Error: Directory '$SLACK_DIR' does not exist."
    echo ""
    print_usage
    exit 1
fi

# Convert to absolute path
SLACK_DIR="$(cd "$SLACK_DIR" && pwd)"

log_info "Importing Slack data from: ${SLACK_DIR}"

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Extract image from docker-compose.yml
IMAGE=$(grep -A 2 "tiger-slack-ingest:" docker-compose.yml | grep "image:" | awk '{print $2}')

log_info "Pulling Docker image: ${IMAGE}"
docker pull "$IMAGE"

log_info "Running import..."
docker run --rm \
    -v "$SLACK_DIR:/slack-data:ro" \
    -e PGHOST="${PGHOST}" \
    -e PGPORT="${PGPORT}" \
    -e PGDATABASE="${PGDATABASE}" \
    -e PGUSER="${PGUSER}" \
    -e PGPASSWORD="${PGPASSWORD}" \
    -e LOGFIRE_IGNORE_NO_CONFIG=1 \
    --network host \
    "$IMAGE" \
    uv run python -m tiger_slack.import /slack-data

log_success "Import completed successfully."
