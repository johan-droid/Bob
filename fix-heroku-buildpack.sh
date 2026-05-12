#!/bin/bash

# Heroku Buildpack Fix Script
# Run this script to fix the buildpack issue

echo "🔧 Fixing Heroku Buildpack Configuration"
echo "=========================================="
echo ""

# Check if app name is provided
if [ -z "$1" ]; then
    echo "Usage: ./fix-heroku-buildpack.sh YOUR_APP_NAME"
    echo ""
    echo "Example: ./fix-heroku-buildpack.sh bob-pr-monitor"
    echo ""
    exit 1
fi

APP_NAME=$1

echo "App Name: $APP_NAME"
echo ""

# Clear all buildpacks
echo "1. Clearing existing buildpacks..."
heroku buildpacks:clear -a $APP_NAME

# Set Python buildpack
echo "2. Setting Python buildpack..."
heroku buildpacks:set heroku/python -a $APP_NAME

# Verify buildpack
echo "3. Verifying buildpack configuration..."
heroku buildpacks -a $APP_NAME

echo ""
echo "=========================================="
echo "✅ Buildpack fixed!"
echo ""
echo "Now deploy with:"
echo "  git push heroku main"
echo ""
echo "Or force redeploy:"
echo "  git commit --allow-empty -m 'Redeploy with Python buildpack'"
echo "  git push heroku main"
echo "=========================================="
