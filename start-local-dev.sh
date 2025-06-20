#!/bin/bash

# Start local development environment for Gideon's Tech Suite
echo "🚀 Starting Gideon's Tech Suite local development environment"

# Check if MongoDB is installed
echo "🔍 Checking if MongoDB is installed..."
mongod --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ MongoDB is not installed or not in PATH. Please install MongoDB first."
  echo "   Visit https://www.mongodb.com/try/download/community for installation instructions."
  exit 1
fi

# Check if MongoDB is running
echo "🔍 Checking if MongoDB is running..."
mongosh --eval "db.version()" --quiet > /dev/null 2>&1
MONGO_RUNNING=$?

if [ $MONGO_RUNNING -ne 0 ]; then
  echo "⚠️  MongoDB is not running."
  echo "ℹ️  For this application to work, MongoDB needs to be running."
  echo "ℹ️  Please start MongoDB manually using one of these commands:"
  echo "   - brew services start mongodb-community"
  echo "   - mongod --dbpath ~/data/db"
  echo ""
  read -p "Do you want to continue without MongoDB? The backend will fail to start properly. (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Exiting. Please start MongoDB and try again."
    exit 1
  fi
  echo "⚠️  Continuing without MongoDB. Expect backend connection errors."
else
  echo "✅ MongoDB is running"
fi

# Ensure .env file exists in backend
if [ ! -f "./backend/.env" ]; then
  echo "⚠️  No .env file found in backend directory. Creating from example..."
  cp ./backend/.env.example ./backend/.env
  echo "✅ Created .env file from example"
fi

# Kill any existing processes using the ports we need
echo "🔄 Checking for existing processes on ports 5001 and 3002..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Start backend and frontend in separate terminals
echo "🔄 Starting backend server..."
cd backend && PORT=5001 npm run dev & 
backend_pid=$!

echo "🔄 Starting frontend server..."
cd frontend && PORT=3002 npm start &
frontend_pid=$!

# Function to handle script termination
function cleanup {
  echo "\n🛑 Stopping servers..."
  kill $backend_pid
  kill $frontend_pid
  echo "✅ Servers stopped"
  exit 0
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT

echo "\n✅ Development environment is running"
echo "📱 Frontend: http://localhost:3002"
echo "🖥️  Backend API: http://localhost:5001/api"
echo "🔌 WebSocket: ws://localhost:5001/ws"
echo "💾 MongoDB: mongodb://localhost:27017/gideons_tech_suite"
echo "\n📝 Press Ctrl+C to stop all servers\n"

# Keep script running
wait
