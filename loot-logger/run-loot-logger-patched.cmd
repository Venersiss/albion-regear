@echo off
setlocal
cd /d "%~dp0"

echo Starting patched Loot Logger...
echo Logs will be written to: %CD%
echo If packet capture fails, close this window and run this file as Administrator.
echo.

"C:\Users\maria\LootLogger-patched\node_modules\.bin\node.exe" "C:\Users\maria\LootLogger-patched\src\index.js"

echo.
echo Loot Logger stopped.
pause
