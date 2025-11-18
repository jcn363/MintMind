#!/bin/bash
set -e

# Script refactored to use secure API authentication and structured logging
# This script now uses Snyk REST API directly with token-based authentication
# instead of relying on the CLI's interactive auth mechanism.

# Import logging utilities from the MintMind logger system
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source the logger if it exists
if [ -f "$PROJECT_ROOT/src/vs/base/common/logger.js" ]; then
    # For Node.js execution, we'd import the logger, but for bash we'll use structured logging
    echo "Using structured logging for Snyk setup operations"
fi

# Configuration
SNYK_API_BASE="https://api.snyk.io"
SNYK_API_VERSION="2021-06-04"
RATE_LIMIT_DELAY=1  # seconds between API calls
MAX_RETRIES=3

# Logging function with structured output
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"component\":\"snyk-setup\",\"message\":\"$message\"}"
}

# Error handling function
handle_error() {
    local error_msg="$1"
    local exit_code="${2:-1}"
    log "ERROR" "$error_msg"
    echo "Error: $error_msg" >&2
    exit "$exit_code"
}

# Rate limiting function
rate_limit() {
    sleep "$RATE_LIMIT_DELAY"
}

# API call function with retry logic and rate limiting
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local token="$4"
    local attempt=1

    while [ $attempt -le $MAX_RETRIES ]; do
        log "INFO" "API call attempt $attempt: $method $endpoint"

        local response
        local http_code

        if [ "$method" = "GET" ]; then
            response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                -H "Authorization: token $token" \
                -H "Content-Type: application/vnd.api+json" \
                -H "Accept: application/vnd.api+json" \
                "${SNYK_API_BASE}${endpoint}?version=${SNYK_API_VERSION}")
        else
            response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                -X "$method" \
                -H "Authorization: token $token" \
                -H "Content-Type: application/vnd.api+json" \
                -H "Accept: application/vnd.api+json" \
                -d "$data" \
                "${SNYK_API_BASE}${endpoint}?version=${SNYK_API_VERSION}")
        fi

        http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        response_body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')

        if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
            echo "$response_body"
            rate_limit
            return 0
        elif [ "$http_code" = "429" ]; then
            log "WARN" "Rate limited (429). Waiting before retry..."
            sleep $((attempt * 5))
        elif [ "$http_code" = "401" ]; then
            handle_error "Authentication failed. Please check your SNYK_TOKEN."
        elif [ "$http_code" = "403" ]; then
            handle_error "Access forbidden. Please check your permissions."
        else
            log "WARN" "API call failed with status $http_code: $response_body"
        fi

        attempt=$((attempt + 1))
        if [ $attempt -le $MAX_RETRIES ]; then
            sleep $((attempt * 2))
        fi
    done

    handle_error "API call failed after $MAX_RETRIES attempts: $method $endpoint"
}

# Validate token function
validate_token() {
    local token="$1"
    log "INFO" "Validating Snyk API token..."

    local response
    response=$(api_call "GET" "/rest/self" "" "$token")
    if [ $? -eq 0 ]; then
        log "INFO" "Token validation successful"
        return 0
    else
        return 1
    fi
}

# Get organization ID
get_org_id() {
    local token="$1"
    log "INFO" "Retrieving organization information..."

    local response
    response=$(api_call "GET" "/rest/orgs" "" "$token")

    # Extract first org ID (user's default org)
    local org_id
    org_id=$(echo "$response" | jq -r '.data[0].id' 2>/dev/null)

    if [ -z "$org_id" ] || [ "$org_id" = "null" ]; then
        handle_error "Could not retrieve organization ID. Please check your Snyk account setup."
    fi

    log "INFO" "Using organization ID: $org_id"
    echo "$org_id"
}

# Import project to Snyk
import_project() {
    local token="$1"
    local org_id="$2"

    if [ ! -f "package.json" ]; then
        log "WARN" "No package.json found. Skipping project import."
        return 0
    fi

    log "INFO" "Importing project to Snyk..."

    # Create project data
    local project_data
    project_data=$(cat <<EOF
{
  "data": {
    "attributes": {
      "name": "$(basename "$(pwd)")",
      "origin": "cli",
      "type": "npm"
    },
    "relationships": {
      "organization": {
        "data": {
          "id": "$org_id",
          "type": "organization"
        }
      }
    },
    "type": "project"
  }
}
EOF
)

    local response
    response=$(api_call "POST" "/rest/orgs/$org_id/projects" "$project_data" "$token")

    local project_id
    project_id=$(echo "$response" | jq -r '.data.id' 2>/dev/null)

    if [ -n "$project_id" ] && [ "$project_id" != "null" ]; then
        log "INFO" "Project imported successfully with ID: $project_id"
    else
        log "WARN" "Project import response: $response"
    fi
}

# Main execution
log "INFO" "Starting secure Snyk setup process"

# Check for required tools
if ! command -v curl &> /dev/null; then
    handle_error "curl is required but not installed."
fi

if ! command -v jq &> /dev/null; then
    log "WARN" "jq is recommended for JSON processing. Installing..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y jq
    elif command -v yum &> /dev/null; then
        sudo yum install -y jq
    else
        handle_error "jq is required. Please install jq manually."
    fi
fi

# Get SNYK_TOKEN from environment variable (secure approach)
if [ -z "$SNYK_TOKEN" ]; then
    handle_error "SNYK_TOKEN environment variable is not set. Please set it with your Snyk API token."
fi

# Validate token
if ! validate_token "$SNYK_TOKEN"; then
    handle_error "Invalid SNYK_TOKEN provided."
fi

# Get organization ID
ORG_ID=$(get_org_id "$SNYK_TOKEN")

# Import project
import_project "$SNYK_TOKEN" "$ORG_ID"

# Create secure pre-commit hook
log "INFO" "Setting up secure pre-commit hook for Snyk..."

# Check if Snyk CLI is available for local testing (optional)
if command -v snyk &> /dev/null; then
    log "INFO" "Snyk CLI found. Setting up local testing hook."
else
    log "WARN" "Snyk CLI not found. Install with: npm install -g snyk"
fi

cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
set -e

# Secure pre-commit hook with proper error handling and logging
log_hook() {
    local level="$1"
    local message="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "{\"timestamp\":\"$timestamp\",\"level\":\"$level\",\"component\":\"snyk-pre-commit\",\"message\":\"$message\"}"
}

# Check if SNYK_TOKEN is available
if [ -z "$SNYK_TOKEN" ]; then
    log_hook "ERROR" "SNYK_TOKEN not set. Skipping security scan."
    exit 0
fi

# Run Snyk test with timeout and proper error handling
log_hook "INFO" "Running Snyk security scan..."
timeout 300 snyk test --severity-threshold=high --json 2>/dev/null || {
    exit_code=$?
    if [ $exit_code -eq 124 ]; then
        log_hook "ERROR" "Snyk scan timed out after 5 minutes"
        exit 1
    elif [ $exit_code -ne 0 ]; then
        log_hook "ERROR" "Snyk security scan failed"
        exit 1
    fi
}

log_hook "INFO" "Snyk security scan passed"
EOF

chmod +x .git/hooks/pre-commit

# Setup CI/CD workflow with secure token handling
log "INFO" "Setting up CI/CD workflow..."

if [ ! -d ".github/workflows" ]; then
    mkdir -p .github/workflows
    if [ $? -ne 0 ]; then
        handle_error "Failed to create .github/workflows directory"
    fi
fi

cat > .github/workflows/snyk-security-scan.yml << 'EOF'
name: Snyk Security Scan

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]
  schedule:
    # Weekly scan on Sundays at 00:00 UTC
    - cron: '0 0 * * 0'

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      continue-on-error: true
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high --sarif-file-output=snyk-results.sarif

    - name: Upload Snyk results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: snyk-results.sarif
EOF

log "INFO" "Snyk setup completed successfully"
log "INFO" "Next steps:"
log "INFO" "1. Ensure SNYK_TOKEN is set in your environment variables"
log "INFO" "2. Add SNYK_TOKEN to GitHub repository secrets for CI/CD"
log "INFO" "3. Commit and push the changes"
log "INFO" "4. Monitor your project at https://app.snyk.io"
log "INFO" "5. Review scan results in GitHub Security tab"
