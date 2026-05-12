@echo off
REM Heroku Buildpack Fix Script (Windows)
REM Run this script to fix the buildpack issue

echo ==========================================
echo Fixing Heroku Buildpack Configuration
echo ==========================================
echo.

REM Check if app name is provided
if "%1"=="" (
    echo Usage: fix-heroku-buildpack.bat YOUR_APP_NAME
    echo.
    echo Example: fix-heroku-buildpack.bat bob-pr-monitor
    echo.
    pause
    exit /b 1
)

set APP_NAME=%1

echo App Name: %APP_NAME%
echo.

REM Clear all buildpacks
echo 1. Clearing existing buildpacks...
heroku buildpacks:clear -a %APP_NAME%

REM Set Python buildpack
echo 2. Setting Python buildpack...
heroku buildpacks:set heroku/python -a %APP_NAME%

REM Verify buildpack
echo 3. Verifying buildpack configuration...
heroku buildpacks -a %APP_NAME%

echo.
echo ==========================================
echo Buildpack fixed!
echo.
echo Now deploy with:
echo   git push heroku main
echo.
echo Or force redeploy:
echo   git commit --allow-empty -m "Redeploy with Python buildpack"
echo   git push heroku main
echo ==========================================
pause
