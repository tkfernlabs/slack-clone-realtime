#!/bin/bash

# Script to start all services for the Slack Clone application

echo "Starting Slack Clone Services..."
echo "================================"

# Kill any existing processes
echo "Cleaning up existing processes..."
pkill -f "node server.js" 2>/dev/null
pkill -f "serve -s build" 2>/dev/null
sleep 2

# Start Backend
echo "Starting Backend Service..."
cd /root/slack-clone/backend
nohup node server.js > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to be ready
echo "Waiting for backend to initialize..."
sleep 3

# Start Frontend
echo "Starting Frontend Service..."
cd /root/slack-clone/frontend
nohup npx serve -s build -l 3000 > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 3

# Verify services
echo ""
echo "Verifying Services..."
echo "====================="

BACKEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://slack-backend-morphvm-4yh44846.http.cloud.morph.so/health)
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://slack-frontend-morphvm-4yh44846.http.cloud.morph.so)

if [ "$BACKEND_CHECK" = "200" ]; then
    echo "✓ Backend is running"
else
    echo "✗ Backend failed to start (HTTP $BACKEND_CHECK)"
fi

if [ "$FRONTEND_CHECK" = "200" ]; then
    echo "✓ Frontend is running"
else
    echo "✗ Frontend failed to start (HTTP $FRONTEND_CHECK)"
fi

echo ""
echo "================================"
echo "Service URLs:"
echo "Frontend: https://slack-frontend-morphvm-4yh44846.http.cloud.morph.so"
echo "Backend:  https://slack-backend-morphvm-4yh44846.http.cloud.morph.so"
echo "================================"
echo ""
echo "To check logs:"
echo "  Backend:  tail -f /root/slack-clone/backend/backend.log"
echo "  Frontend: tail -f /root/slack-clone/frontend/frontend.log"
echo ""
echo "To verify deployment: /root/slack-clone/verify-deployment.sh"
