@echo off
setlocal
cd /d "%~dp0"
title AO Loot Logger (debug)

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

if not exist "%SystemRoot%\System32\Npcap\wpcap.dll" if not exist "%SystemRoot%\System32\wpcap.dll" (
  echo Npcap is not installed. Opening the download page.
  start "" "https://npcap.com/#download"
  pause
  exit /b 1
)

rem Debug mode writes debug-logs.txt and unknown-events.txt next to this file.
set LOOT_LOGGER_DEBUG=1
echo DEBUG MODE. Play for a minute, then send debug-logs.txt and unknown-events.txt to an admin.
echo.
"%~dp0node_modules\.bin\node.exe" "%~dp0src\index.js"

echo.
echo Loot Logger stopped.
pause
