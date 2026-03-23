#!/bin/bash

# Order Flow - Quick Start

echo "🚀 Order Flow"
echo "====================================="
echo ""

# Check current directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Show available commands
echo "📋 Available Commands:"
echo ""
echo "🏗️  Setup & Development:"
echo "   npm run setup          # First time setup (installs deps + starts containers)"
echo "   npm run dev            # Development mode (infrastructure + app)"
echo ""
echo "🐞 Debug & Development:"
echo "   npm run debug          # Complete debug setup (recommended)"
echo "   npm run debug:local    # Quick: containers + app in debug mode"
echo "   npm run start:dev      # App only in watch mode"
echo "   npm run start:debug    # App only with debugger (port 9229)"
echo ""
echo "🐳 Docker Control:"
echo "   npm run docker:up      # Start infrastructure only"
echo "   npm run docker:down    # Stop containers"
echo "   npm run docker:status  # Check containers status"
echo "   npm run docker:logs    # View container logs"
echo ""
echo "🧪 Testing:"
echo "   npm test               # Unit tests"
echo "   npm run test:e2e       # End-to-end tests"
echo "   npm run test:cov       # Test coverage"
echo ""
echo "🛠️  Utility:"
echo "   npm run stop           # Stop all services"
echo "   npm run reset          # Complete reset (removes data)"
echo "   npm run lint           # Run ESLint"
echo "   npm run format         # Format code"
echo ""

# Check if Docker is running
if docker info > /dev/null 2>&1; then
    echo "✅ Docker is running"
else
    echo "⚠️  Docker is not running - needed for PostgreSQL, Redis and BullMQ"
fi

echo ""
echo "💡 Quick Start Options:"
echo ""
echo "1. For first time setup:"
echo "   npm run setup"
echo ""
echo "2. For development with auto-restart:"
echo "   npm run dev"
echo ""
echo "3. For debugging with breakpoints:"
echo "   npm run debug"
echo ""
echo "📖 For detailed debug instructions, see: DEBUG.md"
echo "📚 Full documentation in: README.md"
echo ""

read -p "🎯 Choose an option (1-3) or press Enter to exit: " choice

case $choice in
    1)
        echo "🏗️  Running setup..."
        npm run setup
        ;;
    2)
        echo "🔥 Starting development mode..."
        npm run dev
        ;;
    3)
        echo "🐞 Setting up debug environment..."
        npm run debug
        ;;
    *)
        echo "👋 Happy coding!"
        ;;
esac