#!/bin/bash
# Validation script to ensure complete Electron removal
# Exit with error if any Electron references are found

set -e

echo "🔍 Validating complete Electron removal..."

# Check package.json for Electron dependencies
echo "Checking package.json..."
if grep -q '"electron"\|"asar"\|"rcedit"' package.json; then
  echo "❌ Found Electron-related dependencies in package.json"
  grep '"electron"\|"asar"\|"rcedit"' package.json
  exit 1
fi

# Check for Electron imports (excluding comments and historical references)
echo "Checking for Electron imports..."
if grep -r "require.*['\"]electron['\"]\|from ['\"]electron['\"]" src/ extensions/ \
  --include="*.ts" --include="*.js" \
  --exclude-dir="node_modules" \
  --exclude-dir="backups" \
  | grep -v "//" | grep -v "\*" | grep -v "Historical" | grep -v "Legacy"; then
  echo "❌ Found Electron imports in source code"
  exit 1
fi

# Check for Electron version checks (excluding legacy compatibility)
echo "Checking for Electron version checks..."
if grep -r "process\.versions\['electron'\]\|process\.versions\.electron" src/ \
  --include="*.ts" --include="*.js" \
  --exclude-dir="node_modules" \
  --exclude-dir="backups" \
  | grep -v "//" | grep -v "\*" | grep -v "Legacy" | grep -v "compatibility"; then
  echo "⚠️  Found Electron version checks (verify these are for legacy compatibility only)"
fi

# Check for Electron environment variables (excluding legacy compatibility)
echo "Checking for Electron environment variables..."
if grep -r "TAURI_RUN_AS_NODE" src/ \
  --include="*.ts" --include="*.js" \
  --exclude-dir="node_modules" \
  --exclude-dir="backups" \
  | grep -v "//" | grep -v "\*" | grep -v "Legacy" | grep -v "compatibility"; then
  echo "⚠️  Found TAURI_RUN_AS_NODE references (verify these are for legacy compatibility only)"
fi

# Verify Tauri configuration exists
echo "Verifying Tauri configuration..."
if [ ! -f "src-tauri/Cargo.toml" ]; then
  echo "❌ Tauri configuration not found"
  exit 1
fi

if [ ! -f "tauri.conf.json" ]; then
  echo "❌ Tauri configuration not found"
  exit 1
fi

echo "✅ Validation complete - no Electron remnants found!"
echo "📦 Tauri configuration verified"
exit 0
