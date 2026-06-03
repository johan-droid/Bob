#!/bin/bash

# Bob - Local Development Setup Script
# This script sets up your local development environment

echo "🤖 Bob - Local Development Setup (Node.js Unified Stack)"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "Please create .env file from .env.example:"
    echo "  cp .env.example .env"
    echo ""
    echo "Then edit .env with your credentials:"
    echo "  - GITHUB_TOKEN"
    echo "  - TARGET_REPOS"
    echo "  - GITHUB_CLIENT_ID"
    echo "  - GITHUB_CLIENT_SECRET"
    echo "  - SECRET_KEY"
    echo ""
    exit 1
fi

echo "✅ Found .env file"
echo ""

# Install Node dependencies
echo "📦 Installing Node.js dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

echo "=================================="
echo "✅ Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo "=================================="
