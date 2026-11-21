@echo off
setlocal
cd /d "%~dp0"

echo Starting AO Loot Logger Viewer...
echo Open this address in your browser: http://127.0.0.1:8765
echo Press Ctrl+C in this window to stop the viewer.
echo.

"C:\Users\maria\LootLogger-patched\node_modules\.bin\node.exe" "%~dp0server.js"

echo.
echo Viewer stopped.
pause
