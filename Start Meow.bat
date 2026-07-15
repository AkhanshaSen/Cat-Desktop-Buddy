@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install from https://nodejs.org then try again.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Installing dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 (
    echo Install failed.
    pause
    exit /b 1
  )
)

echo Starting AI Meow...
call npm start
