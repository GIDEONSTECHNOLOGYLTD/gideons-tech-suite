# Gideon's Tech Suite

A comprehensive business management application for tech companies.

## 🔒 Security Notice

**Important**: This project uses environment variables to store sensitive information like database credentials and API keys. Never commit these files to version control.

## Project Structure

- `/frontend` - React.js frontend application
- `/backend` - Node.js/Express backend API
- `/docs` - Project documentation
- `/scripts` - Utility scripts for project setup
- `/logs` - Application logs (created at runtime)

## 📊 Monitoring & Logging

The application includes comprehensive monitoring and logging:

### Health Checks
- `GET /health` - Comprehensive system health check
- `GET /api/health` - Lightweight API health check

### Logging
- Logs are stored in the `logs/` directory
- Log levels: error, warn, info, debug
- Log rotation: 5MB per file, max 5 files per log type

For detailed monitoring setup, see [MONITORING.md](MONITORING.md)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- MongoDB (local or MongoDB Atlas)

### 🔧 Environment Setup

1. **Setup Environment Variables**

   Run the interactive setup script to configure your environment:
   ```bash
   npm run env:setup
   ```
   This will guide you through setting up the required environment variables.

2. **Manual Setup (Alternative)**
   
   Copy the example environment file and update the values:
   ```bash
   cp backend/config/example.env backend/config/.env
   ```
   Then edit the `.env` file with your configuration.

### 🖥️ Backend Setup

1. Install dependencies:
   ```bash
   npm run install:backend
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### 💻 Frontend Setup

1. Install dependencies:
   ```bash
   npm run install:frontend
   ```

2. Start the development server:
   ```bash
   cd frontend && npm start
   ```

## 🔒 Security Best Practices

1. **Never commit sensitive data** to version control
2. Use strong, unique passwords for all services
3. Regularly rotate your secrets and API keys
4. Use environment variables for all configuration
5. Keep your dependencies up to date

## 🛡️ Production Deployment

1. Set up environment variables in your hosting provider
2. Use HTTPS in production
3. Enable CORS only for trusted domains
4. Set appropriate security headers
5. Monitor your application logs

## 🔄 Updating Environment Variables

If you need to update your environment variables:

1. Run the setup script again:
   ```bash
   npm run env:setup
   ```
2. Or manually update the appropriate `.env` file
3. Restart your application for changes to take effect

## Features (Planned)

- Dashboard with KPIs
- Team management
- Project tracking
- Document management
- Financial tracking
- Task management

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

## License

This project is proprietary and confidential.
