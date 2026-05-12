@echo off
REM Bob - Local Development Setup Script (Windows)
REM This script sets up your local development environment

echo ========================================
echo Bob - Local Development Setup
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

REM Copy .env to backend directory
echo Copying .env to backend directory...
copy .env backend\.env >nul
echo Created backend\.env
echo.

REM Install Python dependencies
echo Installing Python dependencies...
cd backend
pip install -r requirements.txt
echo Dependencies installed
echo.

cd ..

echo ========================================
echo Setup complete!
echo.
echo To start the server:
echo   cd backend
echo   python api_server.py
echo.
echo Then open: http://localhost:5000
echo ========================================
pause
