#!/bin/bash

# Cross-platform test runner for Tauri application
# Detects OS and runs appropriate test suites

set -e  # Exit on any error

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo "Running tests on $OS"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run command and check exit code
run_test() {
    local test_name="$1"
    local command="$2"

    echo -e "${YELLOW}Running $test_name...${NC}"
    if eval "$command"; then
        echo -e "${GREEN}$test_name PASSED${NC}"
        return 0
    else
        echo -e "${RED}$test_name FAILED${NC}"
        return 1
    fi
}

# Initialize test results
FAILED_TESTS=()
PASSED_TESTS=()

# Run Rust tests
if run_test "Rust tests" "(cd src-tauri && cargo test --release)"; then
    PASSED_TESTS+=("Rust")
else
    FAILED_TESTS+=("Rust")
fi

# Run TypeScript tests
if run_test "TypeScript tests" "(cd src-tauri && cargo test)"; then
    PASSED_TESTS+=("TypeScript")
else
    FAILED_TESTS+=("TypeScript")
fi

# Run E2E tests
if run_test "E2E tests" "(cd test/e2e && npx playwright test)"; then
    PASSED_TESTS+=("E2E")
else
    FAILED_TESTS+=("E2E")
fi

# Run performance benchmarks
if run_test "Performance benchmarks" "node scripts/performance-benchmark.js"; then
    PASSED_TESTS+=("Performance")
else
    FAILED_TESTS+=("Performance")
fi

# Aggregate results
echo ""
echo "=== Test Results Summary ==="
echo "Platform: $OS"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

if [ ${#PASSED_TESTS[@]} -gt 0 ]; then
    echo -e "${GREEN}PASSED TESTS:${NC}"
    for test in "${PASSED_TESTS[@]}"; do
        echo -e "${GREEN}  ✓ $test${NC}"
    done
    echo ""
fi

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo -e "${RED}FAILED TESTS:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}  ✗ $test${NC}"
    done
    echo ""
    echo -e "${RED}Total failed: ${#FAILED_TESTS[@]}${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
fi

# Optional: Save results to file for CI integration
RESULTS_FILE="test-results-${OS}.json"
cat > "$RESULTS_FILE" << EOF
{
  "platform": "$OS",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "passed": [$(printf '"%s",' "${PASSED_TESTS[@]}" | sed 's/,$//')],
  "failed": [$(printf '"%s",' "${FAILED_TESTS[@]}" | sed 's/,$//')],
  "total_passed": ${#PASSED_TESTS[@]},
  "total_failed": ${#FAILED_TESTS[@]}
}
EOF

echo "Results saved to $RESULTS_FILE"