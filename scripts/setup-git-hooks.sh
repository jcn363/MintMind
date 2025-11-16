#!/bin/bash
set -e

echo "Setting up Git hooks..."

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOL'
#!/bin/bash
set -e

# Run Rust format check
echo "Running cargo fmt..."
cargo fmt -- --check

# Run clippy
echo "Running cargo clippy..."
cargo clippy -- -D warnings

# Run tests
echo "Running tests..."
cargo test --lib

# If using bun for frontend
if [ -f "package.json" ]; then
    echo "Running bun lint..."
    bun run lint
    
    echo "Running bun test..."
    bun run test
fi

# Run Snyk security check if available
if command -v snyk &> /dev/null; then
    echo "Running Snyk security check..."
    snyk test --severity-threshold=high
fi
EOL

# Make the hook executable
chmod +x .git/hooks/pre-commit

echo "Git hooks set up successfully!"
echo "The following hooks are now active:"
ls -la .git/hooks/
