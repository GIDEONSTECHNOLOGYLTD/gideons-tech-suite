#!/bin/bash

# Exit on error
set -e

echo "Building frontend..."
cd frontend
npm install
npm run build

# Create the backend public directory if it doesn't exist
mkdir -p ../backend/public

# Copy the built files to the backend public directory
echo "Copying files to backend public directory..."
cp -r build/* ../backend/public/

echo "Build and copy completed successfully!"
