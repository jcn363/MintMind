#!/usr/bin/env bash

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

function code() {
	cd $ROOT

	# Tauri CLI access
	if [[ "$OSTYPE" == "darwin"* ]]; then
		NAME=`node -p "require('./product.json').applicationName"`
		CODE="./src-tauri/target/release/bundle/macos/$NAME.app/Contents/MacOS/$NAME"
	else
		NAME=`node -p "require('./product.json').applicationName"`
		CODE="./src-tauri/target/release/$NAME"
	fi

	# If release build doesn't exist, suggest building it
	if [ ! -f "$CODE" ]; then
		echo "Release build not found. Run 'npm run tauri:build' first."
		exit 1
	fi

	# Get electron, compile, built-in extensions
	if [[ -z "${MINTMIND_SKIP_PRELAUNCH}" ]]; then
		node build/lib/preLaunch.js
	fi

	# Manage built-in extensions
	if [[ "$1" == "--builtin" ]]; then
		exec "$CODE" build/builtin
		return
	fi

	# Disable test extension
	DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"
	if [[ "$@" == *"--extensionTestsPath"* ]]; then
		DISABLE_TEST_EXTENSION=""
	fi

	NODE_ENV=development \
	MINTMIND_DEV=1 \
	"$CODE" "$@"
}

code "$@"
