@echo off
setlocal

title MintMind Dev

pushd %~dp0..

:: Get electron, compile, built-in extensions
if "%MINTMIND_SKIP_PRELAUNCH%"=="" node build/lib/preLaunch.js

for /f "delims=" %%i in ('node -p "require('./product.json').applicationName"') do set NAME=%%i
set CODE=src-tauri\target\release\%NAME%.exe

if not exist "%CODE%" (
    echo Release build not found. Run 'npm run tauri:build:windows' first.
    exit /b 1
)

:: Manage built-in extensions
if "%~1"=="--builtin" goto builtin

:: Configuration
set NODE_ENV=development
set MINTMIND_DEV=1

set DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"
for %%A in (%*) do (
	if "%%~A"=="--extensionTestsPath" (
		set DISABLE_TEST_EXTENSION=""
	)
)

:: Launch Code
%CODE% %*

popd

endlocal
