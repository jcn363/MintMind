@echo off
setlocal
SET MINTMIND_PATH=%~dp0..\..\..\..
SET MINTMIND_DEV=1
FOR /F "tokens=* USEBACKQ" %%g IN (`where /r "%MINTMIND_PATH%\.build\node" node.exe`) do (SET "NODE=%%g")
call "%NODE%" "%MINTMIND_PATH%\out\server-cli.js" "Code Server - Dev" "" "" "code.cmd" %*
endlocal
