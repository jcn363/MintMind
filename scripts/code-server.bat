@echo off
setlocal

title MintMind Server

set ROOT_DIR=%~dp0..

pushd %ROOT_DIR%

:: Configuration
set NODE_ENV=development
set MINTMIND_DEV=1

:: Get electron, compile, built-in extensions
if "%MINTMIND_SKIP_PRELAUNCH%"=="" node build/lib/preLaunch.js

:: Node executable
FOR /F "tokens=*" %%g IN ('node build/lib/node.js') do (SET NODE=%%g)

if not exist "%NODE%" (
	:: Download nodejs executable for remote
	call npm run gulp node
)

popd

:: Launch Server
call "%NODE%" %ROOT_DIR%\scripts\code-server.js %*


endlocal
