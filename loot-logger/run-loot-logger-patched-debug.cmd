@echo off
setlocal
cd /d "%~dp0"

set LOOT_LOGGER_DEBUG=1

echo Starting patched Loot Logger in DEBUG mode...
echo Logs will be written to: %CD%
echo Debug output will also be written to debug-logs.txt.
echo If packet capture fails, close this window and run this file as Administrator.
echo.

"C:\Users\maria\LootLogger-patched\node_modules\.bin\node.exe" "C:\Users\maria\LootLogger-patched\src\index.js"

echo.
echo Loot Logger stopped.
pause
