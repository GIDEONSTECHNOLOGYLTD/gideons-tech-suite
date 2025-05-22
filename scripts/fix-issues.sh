#!/bin/bash

# Error Fixing Script for Document Search Application
# This script helps diagnose and fix common issues with the application

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Document Search Application Error Fixing Script...${NC}"

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
echo -e "\n${YELLOW}Checking Node.js version...${NC}"
NODE_VERSION=$(node -v 2>/dev/null)
if [[ $NODE_VERSION =~ ^v(14|16|18|20)\. ]]; then
  echo -e "${GREEN}✓ Node.js version $NODE_VERSION is supported.${NC}"
else
  echo -e "${RED}✗ Unsupported Node.js version: $NODE_VERSION. Please use Node.js 14.x, 16.x, 18.x, or 20.x${NC}"
  exit 1
fi

# Check npm version
echo -e "\n${YELLOW}Checking npm version...${NC}"
NPM_VERSION=$(npm -v 2>/dev/null)
echo -e "npm version: $NPM_VERSION"

# Check directory structure
echo -e "\n${YELLOW}Checking project structure...${NC}"
if [ -d "frontend" ] && [ -d "backend" ]; then
  echo -e "${GREEN}✓ Project structure is correct.${NC}
"
  echo "Project structure:"
  echo "├── frontend/     # Frontend React application"
  echo "├── backend/      # Backend Node.js/Express server"
  echo "├── docs/         # Documentation"
  echo "└── scripts/      # Utility scripts"
else
  echo -e "${YELLOW}⚠ Unexpected project structure. Make sure you're in the project root.${NC}"
fi

# Check frontend dependencies
echo -e "\n${YELLOW}Checking frontend dependencies...${NC}"
if [ -d "frontend/node_modules" ]; then
  echo -e "${GREEN}✓ Frontend dependencies are installed.${NC}"
else
  echo -e "${YELLOW}⚠ Frontend dependencies not found. Installing...${NC}"
  cd frontend && npm install --legacy-peer-deps
  cd ..
fi

# Check backend dependencies
echo -e "\n${YELLOW}Checking backend dependencies...${NC}"
if [ -d "backend/node_modules" ]; then
  echo -e "${GREEN}✓ Backend dependencies are installed.${NC}"
else
  echo -e "${YELLOW}⚠ Backend dependencies not found. Installing...${NC}"
  cd backend && npm install
  cd ..
fi

# Check environment variables
echo -e "\n${YELLOW}Checking environment variables...${NC}"
if [ -f "frontend/.env" ]; then
  echo -e "${GREEN}✓ Frontend .env file exists.${NC}"
  
  # Check for required variables
  REQUIRED_VARS=("REACT_APP_API_URL" "REACT_APP_ENV")
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^$var=" frontend/.env; then
      echo -e "${GREEN}✓ $var is set${NC}"
    else
      echo -e "${YELLOW}⚠ $var is not set in frontend/.env${NC}"
    fi
  done
else
  echo -e "${YELLOW}⚠ frontend/.env file not found. Creating a template...${NC}"
  cat > frontend/.env <<EOL
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
EOL
  echo -e "${GREEN}✓ Created frontend/.env template. Please update with your configuration.${NC}"
fi

# Check backend .env
if [ -f "backend/.env" ]; then
  echo -e "\n${GREEN}✓ Backend .env file exists.${NC}"
else
  echo -e "\n${YELLOW}⚠ backend/.env file not found. Creating a template...${NC}"
  cat > backend/.env <<EOL
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/document-search
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
EOL
  echo -e "${GREEN}✓ Created backend/.env template. Please update with your configuration.${NC}"
fi

# Check MongoDB connection
echo -e "\n${YELLOW}Checking MongoDB connection...${NC}"
if command_exists mongod; then
  if pgrep -x "mongod" > /dev/null; then
    echo -e "${GREEN}✓ MongoDB is running.${NC}"
  else
    echo -e "${YELLOW}⚠ MongoDB is not running. Please start MongoDB.${NC}"
  fi
else
  echo -e "${YELLOW}⚠ MongoDB is not installed. Please install MongoDB.${NC}"
fi

# Check for port conflicts
echo -e "\n${YELLOW}Checking for port conflicts...${NC}"
PORTS=("3000" "5000")
for port in "${PORTS[@]}"; do
  if command_exists lsof; then
    if lsof -i :$port > /dev/null; then
      echo -e "${YELLOW}⚠ Port $port is in use by:${NC}"
      lsof -i :$port
    else
      echo -e "${GREEN}✓ Port $port is available${NC}"
    fi
  else
    echo -e "${YELLOW}⚠ lsof not available. Cannot check port $port.${NC}"
  fi
done

# Check disk space
echo -e "\n${YELLOW}Checking disk space...${NC}
df -h .

# Check memory usage
echo -e "\n${YELLOW}Checking memory usage...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  top -l 1 -s 0 | head -n 10
else
  # Linux
  free -h
fi

# Run tests
echo -e "\n${YELLOW}Running tests...${NC}"
cd frontend
npm test -- --watchAll=false
cd ..

# Final recommendations
echo -e "\n${YELLOW}=== Recommendations ===${NC}"
echo -e "1. Make sure all dependencies are installed: ${GREEN}npm install${NC} (in both frontend and backend directories)"
echo -e "2. Start the backend server: ${GREEN}cd backend && npm start${NC}"
echo -e "3. Start the frontend development server: ${GREEN}cd frontend && npm start${NC}"
echo -e "4. If you encounter build errors, try: ${GREEN}rm -rf node_modules package-lock.json && npm install${NC}"
echo -e "5. Clear browser cache if you're experiencing UI issues"

echo -e "\n${GREEN}Error fixing script completed!${NC}"
echo -e "If you're still experiencing issues, please check the documentation or contact support."
