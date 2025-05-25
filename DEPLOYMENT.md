# Deployment Guide

## Environment Variables

### Required Variables
These must be set in your production environment:

```
# Server Configuration
PORT=5000
NODE_ENV=production

# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30

# Frontend URL (for CORS)
FRONTEND_URL=your_frontend_url
```

### Optional Variables
```
# Email Configuration (if using email features)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_EMAIL=your-email@example.com
SMTP_PASSWORD=your-email-password
SMTP_FROM_NAME=Your App Name
SMTP_FROM_EMAIL=noreply@example.com

# File Uploads
MAX_FILE_UPLOAD=1000000
FILE_UPLOAD_PATH=./public/uploads
```

## Deployment Steps

### 1. Set up environment variables
- For local development, copy `.env.example` to `.env` and fill in the values
- For production, set the environment variables in your hosting platform (Render, Heroku, etc.)

### 2. Install dependencies
```bash
# Install root dependencies
yarn

# Install backend dependencies
cd backend
yarn

# Install frontend dependencies and build
cd ../frontend
yarn
yarn build
```

### 3. Start the application

#### Development:
```bash
# Start backend (from project root)
cd backend
yarn dev

# In a separate terminal, start frontend
cd frontend
yarn start
```

#### Production:
```bash
# The start script will automatically serve the frontend build
cd backend
yarn start
```

## Troubleshooting

### Environment Variables Not Loading
- Ensure all required variables are set in your production environment
- Check for typos in variable names
- Make sure to restart your server after changing environment variables

### MongoDB Connection Issues
- Verify your MongoDB connection string is correct
- Ensure your MongoDB instance is accessible from your server
- Check if authentication is required and credentials are correct

### Frontend Not Connecting to Backend
- Verify the `FRONTEND_URL` and `REACT_APP_API_URL` are set correctly
- Check CORS settings in the backend
- Ensure both frontend and backend are using the same protocol (http/https)

## Security Considerations
- Never commit `.env` files to version control
- Use strong, unique secrets for `JWT_SECRET`
- Keep your dependencies up to date
- Use HTTPS in production
- Set appropriate CORS headers in production
