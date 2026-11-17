@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or newer, then reopen this launcher.
  pause
  exit /b 1
)
node "local-writer.mjs" --open
if errorlevel 1 pause
