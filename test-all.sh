#!/bin/bash

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}===== Testing Gideon's Tech Suite =====${NC}"

# Test Backend
echo -e "\n${YELLOW}Testing Backend...${NC}"
cd backend
echo -e "${YELLOW}Running unit tests...${NC}"
npm run test:unit
BACKEND_UNIT_RESULT=$?

# Test Frontend
echo -e "\n${YELLOW}Testing Frontend...${NC}"
cd ../frontend
npm test -- --watchAll=false
FRONTEND_RESULT=$?

# Print summary
echo -e "\n${YELLOW}===== Test Summary =====${NC}"
if [ $BACKEND_UNIT_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ Backend Unit Tests: PASSED${NC}"
else
  echo -e "${RED}✗ Backend Unit Tests: FAILED${NC}"
fi

if [ $FRONTEND_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ Frontend Tests: PASSED${NC}"
else
  echo -e "${RED}✗ Frontend Tests: FAILED${NC}"
fi

# Overall result
if [ $BACKEND_UNIT_RESULT -eq 0 ] && [ $FRONTEND_RESULT -eq 0 ]; then
  echo -e "\n${GREEN}All tests passed successfully!${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed. See above for details.${NC}"
  exit 1
fi
