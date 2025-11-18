#!/usr/bin/env bash
set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname $(dirname $(realpath "$0")))
else
	ROOT=$(dirname $(dirname $(readlink -f $0)))
fi

MINTMINDUSERDATADIR=`mktemp -d 2>/dev/null`
MINTMINDCRASHDIR=$ROOT/.build/crashes
MINTMINDLOGSDIR=$ROOT/.build/logs/integration-tests-remote
TESTRESOLVER_DATA_FOLDER=`mktemp -d 2>/dev/null`

cd $ROOT

if [[ "$1" == "" ]]; then
	AUTHORITY=vscode-remote://test+test
	EXT_PATH=$ROOT/extensions
	# Load remote node
	bun run gulp node
else
	AUTHORITY=$1
	EXT_PATH=$2
	MINTMINDUSERDATADIR=${3:-$MINTMINDUSERDATADIR}
fi

export REMOTE_MINTMIND=$AUTHORITY$EXT_PATH

# Figure out which Electron to use for running tests
if [ -z "$INTEGRATION_TEST_TAURI_PATH" ]
then
	INTEGRATION_TEST_TAURI_PATH="./scripts/code.sh"

	# No extra arguments when running out of sources
	EXTRA_INTEGRATION_TEST_ARGUMENTS=""

	echo "Running remote integration tests out of sources."
else
	export MINTMIND_CLI=1
	export TAURI_ENABLE_LOGGING=1

	# Running from a build, we need to enable the vscode-test-resolver extension
	EXTRA_INTEGRATION_TEST_ARGUMENTS="--extensions-dir=$EXT_PATH  --enable-proposed-api=vscode.vscode-test-resolver --enable-proposed-api=vscode.vscode-api-tests"

	echo "Running remote integration tests with $INTEGRATION_TEST_TAURI_PATH as build."
fi

export TESTRESOLVER_DATA_FOLDER=$TESTRESOLVER_DATA_FOLDER
export TESTRESOLVER_LOGS_FOLDER=$MINTMINDLOGSDIR/server

# Figure out which remote server to use for running tests
if [ -z "$MINTMIND_REMOTE_SERVER_PATH" ]
then
	echo "Using remote server out of sources for integration tests"
else
	echo "Using $MINTMIND_REMOTE_SERVER_PATH as server path for integration tests"
	export TESTRESOLVER_INSTALL_BUILTIN_EXTENSION='ms-vscode.vscode-smoketest-check'
fi

if [ -z "$INTEGRATION_TEST_APP_NAME" ]; then
	kill_app() { true; }
else
	kill_app() { killall $INTEGRATION_TEST_APP_NAME || true; }
fi

API_TESTS_EXTRA_ARGS="--disable-experiments --skip-welcome --skip-release-notes --crash-reporter-directory=$MINTMINDCRASHDIR --logsPath=$MINTMINDLOGSDIR --no-cached-data --disable-updates --use-inmemory-secretstorage --disable-workspace-trust --user-data-dir=$MINTMINDUSERDATADIR"

echo "Storing crash reports into '$MINTMINDCRASHDIR'."
echo "Storing log files into '$MINTMINDLOGSDIR'."


# Tests in the extension host

echo
echo "### API tests (folder)"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$REMOTE_MINTMIND/vscode-api-tests/testWorkspace --extensionDevelopmentPath=$REMOTE_MINTMIND/vscode-api-tests --extensionTestsPath=$REMOTE_MINTMIND/vscode-api-tests/out/singlefolder-tests $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### API tests (workspace)"
echo
"$INTEGRATION_TEST_TAURI_PATH" --file-uri=$REMOTE_MINTMIND/vscode-api-tests/testworkspace.code-workspace --extensionDevelopmentPath=$REMOTE_MINTMIND/vscode-api-tests --extensionTestsPath=$REMOTE_MINTMIND/vscode-api-tests/out/workspace-tests $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### TypeScript tests"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$REMOTE_MINTMIND/typescript-language-features/test-workspace --extensionDevelopmentPath=$REMOTE_MINTMIND/typescript-language-features --extensionTestsPath=$REMOTE_MINTMIND/typescript-language-features/out/test/unit $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### Markdown tests"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$REMOTE_MINTMIND/markdown-language-features/test-workspace --extensionDevelopmentPath=$REMOTE_MINTMIND/markdown-language-features --extensionTestsPath=$REMOTE_MINTMIND/markdown-language-features/out/test $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### Emmet tests"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$REMOTE_MINTMIND/emmet/test-workspace --extensionDevelopmentPath=$REMOTE_MINTMIND/emmet --extensionTestsPath=$REMOTE_MINTMIND/emmet/out/test $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### Git tests"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$AUTHORITY$(mktemp -d 2>/dev/null) --extensionDevelopmentPath=$REMOTE_MINTMIND/git --extensionTestsPath=$REMOTE_MINTMIND/git/out/test $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### Ipynb tests"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$AUTHORITY$(mktemp -d 2>/dev/null) --extensionDevelopmentPath=$REMOTE_MINTMIND/ipynb --extensionTestsPath=$REMOTE_MINTMIND/ipynb/out/test $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

echo
echo "### Configuration editing tests"
echo
"$INTEGRATION_TEST_TAURI_PATH" --folder-uri=$AUTHORITY$(mktemp -d 2>/dev/null) --extensionDevelopmentPath=$REMOTE_MINTMIND/configuration-editing --extensionTestsPath=$REMOTE_MINTMIND/configuration-editing/out/test $API_TESTS_EXTRA_ARGS $EXTRA_INTEGRATION_TEST_ARGUMENTS
kill_app

# Cleanup

if [[ "$3" == "" ]]; then
	rm -rf $MINTMINDUSERDATADIR
fi

rm -rf $TESTRESOLVER_DATA_FOLDER
