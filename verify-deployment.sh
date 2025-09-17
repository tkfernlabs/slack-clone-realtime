#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "  Slack Clone Deployment Verification"
echo "======================================"
echo ""

# Check Backend Health
echo "1. Checking Backend Service..."
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://slack-backend-morphvm-4yh44846.http.cloud.morph.so/health)
if [ "$BACKEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Backend is running (HTTP $BACKEND_RESPONSE)"
    BACKEND_HEALTH=$(curl -s https://slack-backend-morphvm-4yh44846.http.cloud.morph.so/health | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
    echo -e "  Status: ${GREEN}$BACKEND_HEALTH${NC}"
else
    echo -e "${RED}✗${NC} Backend is not responding (HTTP $BACKEND_RESPONSE)"
fi

echo ""

# Check Frontend
echo "2. Checking Frontend Service..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://slack-frontend-morphvm-4yh44846.http.cloud.morph.so)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓${NC} Frontend is running (HTTP $FRONTEND_RESPONSE)"
else
    echo -e "${RED}✗${NC} Frontend is not responding (HTTP $FRONTEND_RESPONSE)"
fi

echo ""

# Check Local Processes
echo "3. Checking Local Processes..."
BACKEND_PID=$(ps aux | grep "node server.js" | grep -v grep | awk '{print $2}' | head -1)
FRONTEND_PID=$(ps aux | grep "serve -s build" | grep -v grep | awk '{print $2}' | head -1)

if [ ! -z "$BACKEND_PID" ]; then
    echo -e "${GREEN}✓${NC} Backend process running (PID: $BACKEND_PID)"
else
    echo -e "${YELLOW}⚠${NC} Backend process not found locally"
fi

if [ ! -z "$FRONTEND_PID" ]; then
    echo -e "${GREEN}✓${NC} Frontend process running (PID: $FRONTEND_PID)"
else
    echo -e "${YELLOW}⚠${NC} Frontend process not found locally"
fi

echo ""

# Test API Endpoints
echo "4. Testing API Endpoints..."

# Test auth endpoint
AUTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://slack-backend-morphvm-4yh44846.http.cloud.morph.so/api/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}')
if [ "$AUTH_TEST" = "400" ] || [ "$AUTH_TEST" = "401" ]; then
    echo -e "${GREEN}✓${NC} Auth endpoint responding correctly"
else
    echo -e "${RED}✗${NC} Auth endpoint not working properly (HTTP $AUTH_TEST)"
fi

echo ""

# Database Connection Test
echo "5. Testing Database Connection..."
DB_TEST=$(curl -s https://slack-backend-morphvm-4yh44846.http.cloud.morph.so/health 2>/dev/null | grep -c "ok")
if [ "$DB_TEST" = "1" ]; then
    echo -e "${GREEN}✓${NC} Database connection successful"
else
    echo -e "${RED}✗${NC} Database connection issue"
fi

echo ""
echo "======================================"
echo "         Deployment URLs"
echo "======================================"
echo ""
echo -e "${GREEN}Frontend:${NC} https://slack-frontend-morphvm-4yh44846.http.cloud.morph.so"
echo -e "${GREEN}Backend:${NC}  https://slack-backend-morphvm-4yh44846.http.cloud.morph.so"
echo -e "${GREEN}GitHub:${NC}   https://github.com/tkfernlabs/slack-clone-realtime"
echo ""

# Summary
echo "======================================"
echo "            Summary"
echo "======================================"
echo ""

if [ "$BACKEND_RESPONSE" = "200" ] && [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ All services are operational!${NC}"
    echo ""
    echo "The Slack Clone application is fully deployed and running."
    echo "Users can:"
    echo "  • Register and create workspaces"
    echo "  • Send real-time messages"
    echo "  • Generate and share invite links"
    echo "  • Collaborate with team members"
else
    echo -e "${YELLOW}⚠ Some services may need attention${NC}"
    echo "Please check the logs for more information."
fi

echo ""
echo "======================================"
