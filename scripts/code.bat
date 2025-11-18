@echo off
setlocal

title MintMind Dev

pushd %~dp0\..

REM Use Tauri development server
echo Launching Tauri development server...
call npm run tauri:dev %*

popd

endlocal
