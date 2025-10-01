#!/bin/bash
set -euo pipefail

# Tiger Agent Interactive Setup Script
# Replaces the interactive setup process described in CLAUDE.md

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
selected_services=()
disabled_services=()

# Token storage - using regular variables instead of associative array for compatibility
SLACK_AGENT_BOT_TOKEN_VAL=""
SLACK_AGENT_APP_TOKEN_VAL=""
SLACK_INGEST_BOT_TOKEN_VAL=""
SLACK_INGEST_APP_TOKEN_VAL=""
ANTHROPIC_API_KEY_VAL=""
LOGFIRE_TOKEN_VAL=""
GITHUB_ORG_VAL=""
GITHUB_TOKEN_VAL=""

# https://github.com/murrayju/build-strap-cli/blob/b2620ebcceffe0a905a0aa9b49b871aec6b4e6e8/bs#L17
if [ "$(getconf LONG_BIT)" == "64" ]; then
    arch=64
  else
    arch=86
fi
uname=$(uname -s)
downloadDir=$(pwd)/download
mkdir -p "$downloadDir"

jqCmd=$(which jq 2>/dev/null || echo "$downloadDir/jq")
if [ ! -f "$jqCmd" ]; then
    if [[ $uname =~ ^Darwin* ]]; then
        if [[ $(arch) == "arm64" ]]; then
        jqName=jq-macos-arm64
        else
        jqName=jq-macos-amd64
        fi
    elif [[ $uname =~ ^Linux* ]]; then
        jqName=jq-linux$arch
    else
        echo "Unknown os: $uname"
        exit
    fi
    jqDl=https://github.com/stedolan/jq/releases/download/jq-1.7.1/$jqName
    echo Downloading $jqDl to "$jqCmd"
    curl -L -o "$jqCmd" $jqDl
    chmod +x "$jqCmd"
fi

# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Browser opening function
open_browser() {
    local url="$1"
    log_info "Opening: $url"
    case "$OSTYPE" in
        darwin*) open "$url" 2>/dev/null || true ;;
        linux*) xdg-open "$url" 2>/dev/null || true ;;
        *) log_warning "Please manually open: $url" ;;
    esac
    sleep 2
}

# Introduction message
intro_message() {
    echo ""
    echo "=================================================="
    echo "     🐅 Tiger Agent Interactive Setup"
    echo "=================================================="
    echo ""
    echo "Hi! I'm eon, a TigerData agent!"
    echo "I'm going to guide you through the setup"
    echo "with the services you need."
    echo ""
    echo "This is the workflow that we will use:"
    echo "1. Create Slack App for Ingest & gather tokens"
    echo "2. Create Slack App for Agent & gather tokens"
    echo "3. Gather Anthropic API token"
    echo "4. Determine which optional MCP servers to configure"
    echo "5. Gather required variables for optional MCP servers"
    echo "6. Write the .env file"
    echo "7. Optionally, spin up the selected services"
    echo ""

    # Continue prompt
    read -p "Do you want to continue with the setup? [y/N]: " continue_choice
    if [[ ! $continue_choice =~ ^[Yy] ]]; then
        log_info "Setup cancelled by user."
        exit 0
    fi
    echo ""
}

# Check for existing configuration
check_resume_or_fresh_start() {
    if [[ -f .env ]]; then
        echo "Found existing .env file."
        read -p "Do you want to modify the existing configuration? [y/N]: " choice
        if [[ $choice =~ ^[Yy] ]]; then
            log_info "Resuming with existing configuration..."
            return 0
        else
            read -p "Start fresh? This will backup your current .env [y/N]: " choice
            if [[ $choice =~ ^[Yy] ]]; then
                cp .env ".env.backup.$(date +%s)"
                log_success "Backed up existing .env file"
            else
                log_info "Keeping existing configuration. Exiting."
                exit 0
            fi
        fi
    fi
}

# Validate tokens with API calls
validate_slack_tokens() {
    local bot_token="$1"
    local app_token="$2"

    log_info "Validating Slack tokens..."

    # Validate bot token
    local bot_response
    bot_response=$(curl -s -H "Authorization: Bearer $bot_token" \
        "https://slack.com/api/auth.test" | grep -o '"ok":[^,]*' | cut -d: -f2)

    if [[ "$bot_response" != "true" ]]; then
        log_error "Invalid Slack bot token"
        return 1
    fi

    # Note: App token validation is more complex, skipping for now
    log_success "Slack bot token validated"
    return 0
}

validate_anthropic_token() {
    local token="$1"
    log_info "Validating Anthropic API key..."

    local response
    response=$(
        curl -s \
        -H "x-api-key: $token" \
        -H "anthropic-version: 2023-06-01" \
        -H "Content-Type: application/json" \
        "https://api.anthropic.com/v1/models"
    )

    if echo "$response" | grep -q '"type":"error"'; then
        log_error "Invalid Anthropic API key"
        return 1
    fi

    log_success "Anthropic API key validated"
    return 0
}

validate_github_token() {
    local token="$1"
    local org="$2"

    log_info "Validating GitHub token..."

    local response
    response=$(curl -s -H "Authorization: token $token" \
        "https://api.github.com/user" | grep -o '"login"' || echo "")

    if [[ -z "$response" ]]; then
        log_error "Invalid GitHub token"
        return 1
    fi

    # Validate org access if provided
    if [[ -n "$org" ]]; then
        local org_response
        org_response=$(curl -s -H "Authorization: token $token" \
            "https://api.github.com/orgs/$org" | grep -o '"login"' || echo "")

        if [[ -z "$org_response" ]]; then
            log_warning "Cannot access GitHub org '$org' with this token"
        fi
    fi

    log_success "GitHub token validated"
    return 0
}

# Download ingest manifest from tiger-slack repository
get_ingest_manifest() {
    local ingest_manifest="/tmp/ingest-manifest-$$.json"

    log_info "Downloading ingest app manifest from tiger-slack repository..." >&2

    if curl -s -o "$ingest_manifest" "https://raw.githubusercontent.com/timescale/tiger-slack/main/slack-app-manifest.json"; then
        log_success "Ingest manifest downloaded successfully" >&2
        echo "$ingest_manifest"
    else
        log_error "Failed to download ingest manifest from GitHub" >&2
        exit 1
    fi
}

# Create Slack app with specified manifest file
create_slack_app() {
    local manifest_file="$1"
    local app_type="$2"
    local bot_token_var="$3"
    local app_token_var="$4"

    echo "**** Slack App Creation - $app_type ****"
    echo ""
    echo "This will guide you through the Slack app setup process."
    read -p "Press any key to open the Slack API site in your browser..."
    echo ""


    # Interactive Slack App Setup
    echo "Creating $app_type Slack App:"


    open_browser "https://api.slack.com/apps/"

    echo "1. Click 'Create New App' → 'From a manifest' → Choose your workspace"

    read -p "Press Enter after selecting your workspace and clicking Next..."

    # Show manifest file content
    if [[ -f "$manifest_file" ]]; then
        echo ""
        echo "App Manifest for $app_type:"
        echo "----------------------------------------"
        cat "$manifest_file"
        echo ""
        echo "----------------------------------------"
        echo ""
    else
        log_warning "$manifest_file not found - you'll need to create the app manually"
        return 1
    fi

    echo "2. Copy the manifest shown above and paste it into the App creation wizard (note: customize display_name and name), then click 'Next' and 'Create'"
    echo ""
    read -p "Press Enter after creating the $app_type app..."

    echo ""
    echo "3. Navigate to: Basic Information → App-Level Tokens"
    echo "4. Click 'Generate Token and Scopes' → Add 'connections:write' scope → Generate"
    echo ""

    local slack_app_token
    while true; do
        read -p "Please paste your $app_type App-Level Token (starts with 'xapp-'): " slack_app_token
        if [[ "$slack_app_token" =~ ^xapp- ]]; then
            break
        else
            log_error "App token should start with 'xapp-'"
        fi
    done

    echo ""
    echo "5. Navigate to: Install App → Click 'Install to [Workspace]'"
    echo "6. After installation, copy the 'Bot User OAuth Token'"
    echo ""

    local slack_bot_token
    while true; do
        read -p "Please paste your $app_type Bot User OAuth Token (starts with 'xoxb-'): " slack_bot_token
        if [[ "$slack_bot_token" =~ ^xoxb- ]]; then
            break
        else
            log_error "Bot token should start with 'xoxb-'"
        fi
    done

    # Validate tokens
    if validate_slack_tokens "$slack_bot_token" "$slack_app_token"; then
        # Store tokens in the specified variable names
        eval "${bot_token_var}=\"$slack_bot_token\""
        eval "${app_token_var}=\"$slack_app_token\""
        log_success "$app_type Slack tokens validated successfully"
    else
        log_error "$app_type token validation failed. Please check your tokens and try again."
        exit 1
    fi

    echo ""
}

# Collect required tokens
collect_required_tokens() {
    echo ""
    echo "=== Required Configuration ==="
    echo ""

    # Fetch the ingest manifest from https://github.com/timescale/tiger-slack/blob/main/slack-app-manifest.json
    local ingest_manifest_path=$(get_ingest_manifest)

    # Create both Slack apps (workspace name will be asked during first app creation)
    create_slack_app "$ingest_manifest_path" "ingest" "SLACK_INGEST_BOT_TOKEN_VAL" "SLACK_INGEST_APP_TOKEN_VAL"
    create_slack_app "slack-app-manifest.json" "agent" "SLACK_AGENT_BOT_TOKEN_VAL" "SLACK_AGENT_APP_TOKEN_VAL"

    # Clean up temporary manifest file
    rm -f "$ingest_manifest_path"

    # Anthropic API key
    echo "🤖 Anthropic Configuration"
    open_browser "https://console.anthropic.com/settings/keys"
    echo "Create an Anthropic API key"
    echo ""

    while true; do
        read -p "ANTHROPIC_API_KEY: " anthropic_key

        if validate_anthropic_token "$anthropic_key"; then
            ANTHROPIC_API_KEY_VAL="$anthropic_key"
            break
        else
            log_error "Please check your Anthropic API key and try again"
            read -p "Retry? [Y/n]: " retry
            [[ $retry =~ ^[Nn] ]] && exit 1
        fi
    done

    echo ""

    # Logfire token (optional)
    echo "📊 Logfire Configuration (Optional)"
    echo "Logfire provides observability and monitoring. Tiger Agent will work without it."
    read -p "LOGFIRE_TOKEN (or press Enter to skip): " logfire_token
    LOGFIRE_TOKEN_VAL="${logfire_token:-}"

    log_success "Required tokens collected"
}

# Service selection and conditional token collection
select_and_configure_mcp_services() {
    echo ""
    echo "=== MCP Service Configuration ==="
    echo ""
    echo "Tiger Agent can integrate with various services."
    echo "Select which services you want to enable:"
    echo ""

    # Service selection
    local services=("github")
    local service_descriptions=(
        "github: GitHub repository integration, allowing for fetching of PRs and commits"
    )

    for i in "${!services[@]}"; do
        local service="${services[$i]}"
        local description="${service_descriptions[$i]}"

        echo "  $description"
        read -p "  Enable $service MCP server? [y/N]: " choice

        if [[ $choice =~ ^[Yy] ]]; then
            selected_services+=("$service")
            log_success "$service MCP server enabled"
        else
            disabled_services+=("$service")
        fi
        echo ""
    done

    # Conditional token collection
    echo "=== Service Token Collection ==="

    if [[ ${#selected_services[@]} -eq 0 ]]; then
        return
    fi

    for service in "${selected_services[@]}"; do
        case $service in
            github)
                collect_github_tokens
                ;;
        esac
    done
}

collect_github_tokens() {
    echo ""
    echo "🐙 GitHub Configuration"

    # Ask for repository access type
    read -p "Do you want to include access to private repositories? [y/N]: " repo_access_choice

    if [[ "$repo_access_choice" =~ ^[Yy]$ ]]; then
        open_browser "https://github.com/settings/tokens/new?description=Tiger%20Agent&scopes=repo,read:org"
        echo "Create a GitHub personal access token with 'repo' and 'read:org' scopes"
    else
        open_browser "https://github.com/settings/tokens/new?description=Tiger%20Agent&scopes=repo:status,public_repo"
        echo "Create a GitHub personal access token with 'repo:status' and 'public_repo' scopes"
    fi
    echo ""

    while true; do
        read -p "GITHUB_ORG: " github_org
        read -p "GITHUB_TOKEN: " github_token

        if validate_github_token "$github_token" "$github_org"; then
            GITHUB_ORG_VAL="$github_org"
            GITHUB_TOKEN_VAL="$github_token"
            break
        else
            log_error "Please check your GitHub token and try again"
            read -p "Retry? [Y/n]: " retry
            [[ $retry =~ ^[Nn] ]] && break
        fi
    done
}

# Write environment file
write_env_file() {
    echo ""
    echo "=== Writing Configuration ==="

    # Start with .env.sample as template
    if [[ ! -f .env.sample ]]; then
        log_error ".env.sample not found!"
        exit 1
    fi

    cp .env.sample .env
    log_info "Copied .env.sample to .env"

    # Update tokens
    local token_vars=(
        "SLACK_AGENT_BOT_TOKEN:$SLACK_AGENT_BOT_TOKEN_VAL"
        "SLACK_AGENT_APP_TOKEN:$SLACK_AGENT_APP_TOKEN_VAL"
        "SLACK_INGEST_BOT_TOKEN:$SLACK_INGEST_BOT_TOKEN_VAL"
        "SLACK_INGEST_APP_TOKEN:$SLACK_INGEST_APP_TOKEN_VAL"
        "ANTHROPIC_API_KEY:$ANTHROPIC_API_KEY_VAL"
        "LOGFIRE_TOKEN:$LOGFIRE_TOKEN_VAL"
        "GITHUB_ORG:$GITHUB_ORG_VAL"
        "GITHUB_TOKEN:$GITHUB_TOKEN_VAL"
    )

    for token_var in "${token_vars[@]}"; do
        local key="${token_var%:*}"
        local value="${token_var#*:}"

        if [[ -n "$value" ]]; then
            # Use different sed syntax for macOS vs Linux
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^${key}=.*|${key}=${value}|" .env
            else
                sed -i "s|^${key}=.*|${key}=${value}|" .env
            fi
            log_success "Set $key"
        fi
    done

    # Update disabled status for all MCP servers in mcp_config.json
    # Use jq to get all service names and update their disabled status
    local all_services
    all_services=$($jqCmd -r 'keys[]' mcp_config.json)

    while IFS= read -r service; do
        # Check if service is in disabled_services array
        local should_disable=false
        for disabled_service in "${disabled_services[@]:-}"; do
            if [[ "$service" == "$disabled_service" ]]; then
                should_disable=true
                break
            fi
        done

        # Update the disabled status
        if [[ "$should_disable" == "true" ]]; then
            $jqCmd ".\"$service\".disabled = true" mcp_config.json > mcp_config.json.tmp && mv mcp_config.json.tmp mcp_config.json
            log_success "Disabled $service MCP server"
        else
            $jqCmd ".\"$service\".disabled = false" mcp_config.json > mcp_config.json.tmp && mv mcp_config.json.tmp mcp_config.json
            log_success "Enabled $service MCP server"
        fi
    done <<< "$all_services"


    log_success "Environment configuration written to .env & mcp_config.json"
}

# Start services
start_services() {
    echo ""
    echo "=== Starting Services ==="

    if [[ ! -f ./start.sh ]]; then
        log_error "start.sh not found!"
        exit 1
    fi

    # Ask if user wants to start services
    read -p "Do you want to start the selected services now? [Y/n]: " start_choice

    if [[ $start_choice =~ ^[Nn] ]]; then
        log_info "Skipping service startup."
        echo ""
        log_success "🎉 Tiger Agent setup complete!"
        echo ""
        echo "To start services later, run:"
        echo "• ./start.sh"
        echo ""
        echo "Once started, you can:"
        echo "• Check logs: docker compose logs -f tiger-agent"
        echo "• View services: docker compose ps"
        echo "• Stop services: docker compose down"
        return 0
    fi

    log_info "Starting Tiger Agent services..."

    if ./start.sh; then
        echo ""
        log_success "🎉 Tiger Agent setup complete!"
        echo ""
        echo "Services started. You can now:"
        echo "• Check logs: docker compose logs -f app"
        echo "• View services: docker compose ps"
        echo "• Stop services: docker compose down"
        echo ""
        echo "Your Tiger Agent is ready to use in Slack!"
    else
        log_error "Failed to start services. Check the logs above."
        exit 1
    fi
}

# Main function
main() {
    intro_message
    check_resume_or_fresh_start
    collect_required_tokens
    select_and_configure_mcp_services
    write_env_file
    start_services
}

# Check dependencies
check_dependencies() {
    local deps=("curl" "docker")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is required but not installed"
            exit 1
        fi
    done

    # Check for docker compose (either version)
    if docker compose version &> /dev/null 2>&1; then
        log_info "Found docker compose (v2)"
    else
        log_error "'docker compose' is not available"
        log_error "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_dependencies
    main "$@"
fi
