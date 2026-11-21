@echo off
set PACKAGE=%~dp0_
"%PACKAGE%/node_modules/.bin/node" "%PACKAGE%/build/index.mjs" %*