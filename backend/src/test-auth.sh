#!/bin/bash

# Script de test manuel pour AuthController
# Usage: ./test-auth.sh

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   🧪 Testing AuthController Endpoints ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

# Variables pour stocker les tokens
ACCESS_TOKEN=""
REFRESH_TOKEN=""
SESSION_ID=""

# Test 1: Health Check
echo -e "\n${YELLOW}[1] Testing Health Check...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/health")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}✗ Health check failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY"
fi

# Test 2: Register
echo -e "\n${YELLOW}[2] Testing User Registration...${NC}"
REGISTER_DATA='{
  "email": "testuser@example.com",
  "username": "testuser",
  "password": "SecurePass123!",
  "firstName": "Test",
  "lastName": "User",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-01"
}'

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$REGISTER_DATA" \
  "${BASE_URL}/api/auth/register")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "201" ]; then
    echo -e "${GREEN}✓ Registration successful${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}✗ Registration failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

# Test 3: Login
echo -e "\n${YELLOW}[3] Testing User Login...${NC}"
LOGIN_DATA='{
  "email": "testuser@example.com",
  "password": "SecurePass123!"
}'

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$LOGIN_DATA" \
  "${BASE_URL}/api/auth/login")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Login successful${NC}"
    echo "$BODY" | jq '.'
    
    # Extraire les tokens
    ACCESS_TOKEN=$(echo "$BODY" | jq -r '.data.accessToken')
    REFRESH_TOKEN=$(echo "$BODY" | jq -r '.data.refreshToken')
    SESSION_ID=$(echo "$BODY" | jq -r '.data.sessionId')
    
    echo -e "\n${GREEN}Access Token: ${ACCESS_TOKEN:0:50}...${NC}"
    echo -e "${GREEN}Session ID: $SESSION_ID${NC}"
else
    echo -e "${RED}✗ Login failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
    exit 1
fi

# Test 4: Get Profile (Protected Route)
echo -e "\n${YELLOW}[4] Testing Get Profile (Protected)...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "${BASE_URL}/api/auth/me")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Profile retrieved successfully${NC}"
    echo "$BODY" | jq '.data.user | {id, email, username, firstName, lastName}'
else
    echo -e "${RED}✗ Get profile failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

# Test 5: Update Profile
echo -e "\n${YELLOW}[5] Testing Update Profile...${NC}"
UPDATE_DATA='{
  "firstName": "Updated",
  "lastName": "Name"
}'

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X PUT \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_DATA" \
  "${BASE_URL}/api/auth/profile")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Profile updated successfully${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}✗ Update profile failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

# Test 6: Get Sessions
echo -e "\n${YELLOW}[6] Testing Get Active Sessions...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "${BASE_URL}/api/auth/sessions")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Sessions retrieved successfully${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}✗ Get sessions failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

# Test 7: Refresh Token
echo -e "\n${YELLOW}[7] Testing Token Refresh...${NC}"
REFRESH_DATA=$(jq -n --arg token "$REFRESH_TOKEN" '{refreshToken: $token}')

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$REFRESH_DATA" \
  "${BASE_URL}/api/auth/refresh")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Token refreshed successfully${NC}"
    echo "$BODY" | jq '.'
    
    # Update access token with new one
    NEW_ACCESS_TOKEN=$(echo "$BODY" | jq -r '.data.accessToken')
    echo -e "\n${GREEN}New Access Token: ${NEW_ACCESS_TOKEN:0:50}...${NC}"
else
    echo -e "${RED}✗ Token refresh failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

# Test 8: Logout
echo -e "\n${YELLOW}[8] Testing Logout...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "${BASE_URL}/api/auth/logout")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Logout successful${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}✗ Logout failed (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

# Test 9: Try to access protected route after logout (should fail)
echo -e "\n${YELLOW}[9] Testing Access After Logout (Should Fail)...${NC}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "${BASE_URL}/api/auth/me")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')

if [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ]; then
    echo -e "${GREEN}✓ Access correctly denied after logout${NC}"
    echo "$BODY" | jq '.'
else
    echo -e "${RED}✗ Security issue: Access allowed after logout! (Status: $HTTP_STATUS)${NC}"
    echo "$BODY" | jq '.'
fi

echo -e "\n${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║        ✅ All tests completed!         ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"