@echo off
rem Debug mode: writes detailed event logs to debug-logs.txt in this folder.
rem Use this if loot stops appearing after an Albion update, then share debug-logs.txt.
set LOOT_LOGGER_DEBUG=1
set PACKAGE=%~dp0_
"%PACKAGE%/node_modules/.bin/node" "%PACKAGE%/build/index.mjs" %*
pause
