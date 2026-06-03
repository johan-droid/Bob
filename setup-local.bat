@echo off
REM Bob - Local Development Setup Script (Windows)
REM This script sets up your local development environment

echo ========================================
echo Bob - Local Development Setup (Node.js Unified Stack)
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Error: .env file not found!
    echo.
    echo Please create .env file from .env.example:
    echo   copy .env.example .env
    echo.
    echo Then edit .env with your credentials:
    echo   - GITHUB_TOKEN
    echo   - TARGET_REPOS
    echo   - GITHUB_CLIENT_ID
    echo   - GITHUB_CLIENT_SECRET
    echo   - SECRET_KEY
    echo.
    pause
    exit /b 1
)

echo Found .env file
echo.

REM Install Node.js dependencies
echo Installing Node.js dependencies...
call npm install
echo Dependencies installed
echo.

echo ========================================
echo Setup complete!
echo.
echo To start the development server:
echo   npm run dev
echo.
echo Then open: http://localhost:3000
echo ========================================
pause
