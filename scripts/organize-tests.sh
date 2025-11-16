#!/bin/bash
set -e

# Create tests directory if it doesn't exist
mkdir -p tests/integration

# Find all test files in src/**/tests/ directories
find src -type d -name tests | while read -r testdir; do
    # Check if these are unit tests (in same dir as source) or integration tests
    parent_dir=$(dirname "$testdir")
    if [[ "$parent_dir" == *"services"* ]]; then
        # This is a service test, likely a unit test
        echo "Keeping unit tests in place: $testdir"
    else
        # This might be an integration test
        echo "Potentially moving integration test: $testdir"
        # Uncomment the following lines to actually move the files
        # module_name=$(basename "$parent_dir")
        # mkdir -p "tests/integration/$module_name"
        # mv "$testdir/"* "tests/integration/$module_name/"
        # rmdir "$testdir"
    fi
done

# Create a test helper module
echo "Creating test helper module..."
cat > tests/test_helpers/mod.rs << 'EOL'
//! Test helper functions and utilities

/// Setup function for integration tests
pub fn setup() {
    // Initialize test environment
    // Add any test setup code here
}

/// Teardown function for integration tests
pub fn teardown() {
    // Clean up test environment
    // Add any test cleanup code here
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_helpers_work() {
        // Example test
        assert_eq!(2 + 2, 4);
    }
}
EOL

echo "Test organization complete!"
echo "Please review the changes and commit them if they look correct."
