#!/bin/bash

# Start local development environment for Gideon's Tech Suite
echo "🚀 Starting Gideon's Tech Suite local development environment"

# Check if MongoDB is running
echo "🔍 Checking if MongoDB is running..."
mongod --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ MongoDB is not installed or not in PATH. Please install MongoDB first."
  echo "   Visit https://www.mongodb.com/try/download/community for installation instructions."
  exit 1
fi

# Check if MongoDB is running
mongo --eval "db.version()" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️  MongoDB is not running. Starting MongoDB..."
  # Try to start MongoDB (this might not work on all systems)
  if [ -d "/usr/local/var/mongodb" ]; then
    # macOS Homebrew installation
    mongod --config /usr/local/etc/mongod.conf --fork
  else
    echo "❌ Could not start MongoDB automatically. Please start it manually."
    echo "   Typically: 'mongod --dbpath=/data/db' or 'brew services start mongodb-community'"
    exit 1
  fi
else
  echo "✅ MongoDB is running"
fi

# Ensure .env file exists in backend
if [ ! -f "./backend/.env" ]; then
  echo "⚠️  No .env file found in backend directory. Creating from example..."
  cp ./backend/.env.example ./backend/.env
  echo "✅ Created .env file from example"
fi

# Start backend and frontend in separate terminals
echo "🔄 Starting backend server..."
cd backend && npm run dev & 
backend_pid=$!

echo "🔄 Starting frontend server..."
cd frontend && npm start &
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
echo "📱 Frontend: http://localhost:3000"
echo "🖥️  Backend API: http://localhost:5000/api"
echo "🔌 WebSocket: ws://localhost:5000/ws"
echo "💾 MongoDB: mongodb://localhost:27017/gideons_tech_suite"
echo "\n📝 Press Ctrl+C to stop all servers\n"

# Keep script running
wait
