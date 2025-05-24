#!/bin/bash

# Stop on error
set -e

# Create test environment variables
cat > backend/.env <<EOL
NODE_ENV=test
PORT=5005
MONGODB_URI=mongodb://localhost:27017/gideons_tech_suite_test
JWT_SECRET=test_jwt_secret_key_for_development_only
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
MAX_FILE_UPLOAD=5242880
FRONTEND_URL=http://localhost:3000
CORS_WHITELIST=http://localhost:3000,http://localhost:5005
EOL

echo "Test environment file created at backend/.env"
echo "You can now start the server with: npm run dev"
