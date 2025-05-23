# Gideon's Tech Suite - Backend

Backend server for Gideon's Tech Suite, built with Node.js, Express, and MongoDB.

## Prerequisites

- Node.js 14.x or higher
- MongoDB Atlas account (for production) or local MongoDB instance (for development)
- Git

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp config/config.example.env config/config.local.env
   ```

2. Update the environment variables in `config/config.local.env` for development.

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Environment Variables

Create a `.env` file in the root directory or use environment-specific files:

- `config/config.local.env` - For local development
- `config/config.prod.env` - For production (DO NOT commit this file)

Required variables:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/gideons-tech-suite
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRE=30d
FRONTEND_URL=http://localhost:3000
```

## Deployment to Render.com

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Configure the following:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
   - **Region**: Choose the one closest to your users

### Environment Variables in Render

Add these environment variables in the Render dashboard:

- `NODE_ENV=production`
- `PORT=10000` (or let Render set this)
- `MONGODB_URI=your_mongodb_atlas_connection_string`
- `JWT_SECRET=your_secure_jwt_secret`
- `JWT_EXPIRE=30d`
- `FRONTEND_URL=https://your-frontend-app.vercel.app`
- `WEBSOCKET_PATH=/ws`

## MongoDB Atlas Setup

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user
3. Add your current IP to the IP whitelist
4. Get your connection string (it will look like `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/yourdbname`)

## Security

- Always use HTTPS in production
- Keep your JWT_SECRET secure
- Use environment variables for sensitive data
- Keep dependencies up to date

## License

Proprietary - Gideon's Technology Ltd.
