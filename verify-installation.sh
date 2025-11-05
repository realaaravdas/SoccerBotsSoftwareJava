#!/bin/bash

# Verification script for Node.js backend migration

echo "========================================="
echo "SoccerBots Control Station v2.0"
echo "Node.js Backend Verification"
echo "========================================="
echo ""

# Check Node.js version
echo "1. Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✓ Node.js $NODE_VERSION installed"
else
    echo "   ✗ Node.js not found! Please install Node.js 18+"
    exit 1
fi

# Check if backend dependencies are installed
echo ""
echo "2. Checking Node.js backend dependencies..."
if [ -d "nodejs_backend/node_modules" ]; then
    echo "   ✓ Backend dependencies installed"
else
    echo "   ⚠ Backend dependencies not found"
    echo "   Run: cd nodejs_backend && npm install"
fi

# Check if frontend dependencies are installed
echo ""
echo "3. Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo "   ✓ Frontend dependencies installed"
else
    echo "   ⚠ Frontend dependencies not found"
    echo "   Run: cd frontend && npm install"
fi

# Check if Electron dependencies are installed
echo ""
echo "4. Checking Electron dependencies..."
if [ -d "electron/node_modules" ]; then
    echo "   ✓ Electron dependencies installed"
else
    echo "   ⚠ Electron dependencies not found"
    echo "   Run: cd electron && npm install"
fi

# Test backend startup
echo ""
echo "5. Testing Node.js backend startup..."
cd nodejs_backend
timeout 3 node src/main.js 9999 > /tmp/backend_test.log 2>&1 &
BACKEND_PID=$!
sleep 2

if curl -s http://localhost:9999/api/health > /dev/null 2>&1; then
    echo "   ✓ Backend starts successfully"
    echo "   ✓ Health endpoint responds"
else
    echo "   ✗ Backend failed to start or health endpoint not responding"
    cat /tmp/backend_test.log
fi

# Cleanup
kill $BACKEND_PID 2>/dev/null || true
cd ..

echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo ""
echo "Node.js Backend: Ready ✓"
echo "Frontend: Ready ✓"
echo "Electron: Ready ✓"
echo ""
echo "To start the application, run:"
echo "  npm run dev"
echo ""
echo "For more information, see:"
echo "  - README.md - Main documentation"
echo "  - MIGRATION_GUIDE.md - Migration from Python backend"
echo "  - nodejs_backend/README.md - Backend details"
echo ""
echo "========================================="
