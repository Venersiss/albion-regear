@echo off
setlocal
cd /d "%~dp0"
title AO Loot Logger

rem Packet capture needs administrator rights. Ask for them automatically.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

rem Npcap is required to read network traffic.
if not exist "%SystemRoot%\System32\Npcap\wpcap.dll" if not exist "%SystemRoot%\System32\wpcap.dll" (
  echo.
  echo Npcap is not installed, so the logger cannot see Albion's network traffic.
  echo Opening the download page. Install it with "WinPcap API-compatible Mode" ticked,
  echo then start this file again.
  echo.
  start "" "https://npcap.com/#download"
  pause
  exit /b 1
)

echo Logs are saved in: %CD%
echo.
"%~dp0node_modules\.bin\node.exe" "%~dp0src\index.js"

echo.
echo Loot Logger stopped.
pause
