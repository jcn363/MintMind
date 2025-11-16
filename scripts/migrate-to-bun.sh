#!/bin/bash
set -e

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: bun is not installed. Please install bun first: https://bun.sh/"
    exit 1
fi

# Check if node-gyp is installed
if ! command -v node-gyp &> /dev/null; then
    echo "Installing node-gyp..."
    npm install -g node-gyp
fi

# Install build dependencies
echo "Installing build dependencies..."
sudo apt-get update
sudo apt-get install -y build-essential python3

# Backup existing package files
echo "Backing up existing package files..."
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mv package-lock.json package-lock.json.bak.$TIMESTAMP 2>/dev/null || true
rm -rf node_modules.bak 2>/dev/null || true
mv node_modules node_modules.bak 2>/dev/null || true

# Install dependencies using bun
echo "Installing dependencies with bun (this may take a while)..."
bun install --ignore-scripts

# Manually rebuild native modules
echo "Rebuilding native modules..."
cd node_modules/node-pty
node-gyp rebuild
cd ../..

# Update package.json scripts
echo "Updating package.json scripts..."
npm pkg set scripts.start="bun run start"
npm pkg set scripts.dev="bun run dev"
npm pkg set scripts.test="bun run test"

# Update CI/CD configuration if exists
if [ -f ".github/workflows/ci.yml" ]; then
    echo "Updating GitHub Actions workflow..."
    sed -i.bak 's/npm ci/bun install/g' .github/workflows/ci.yml
    sed -i.bak 's/npm run test/bun run test/g' .github/workflows/ci.yml
    rm .github/workflows/ci.yml.bak
fi

echo ""
echo "Migration to bun completed successfully!"
echo "Please test your application thoroughly."
echo "Original files have been backed up with .bak.$TIMESTAMP extension."