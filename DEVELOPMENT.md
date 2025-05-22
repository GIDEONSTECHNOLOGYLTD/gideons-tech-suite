# Development and Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Testing](#testing)
5. [Building for Production](#building-for-production)
6. [Deployment](#deployment)
7. [Environment Variables](#environment-variables)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)
10. [Useful Scripts](#useful-scripts)

## Prerequisites

### System Requirements
- Node.js 14.x or higher
- npm 6.x or higher (or yarn)
- MongoDB 4.4 or higher
- Git

### Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile Safari (iOS 12+)
- Chrome for Android (latest)

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/gideons-tech-suite.git
cd gideons-tech-suite
```

### 2. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd ../backend
npm install
```

### 3. Set Up Environment Variables

Create `.env` files in both frontend and backend directories with the required environment variables (see [Environment Variables](#environment-variables)).

### 4. Start Development Servers

#### Frontend (in development mode)
```bash
cd frontend
npm start
```

#### Backend (in development mode)
```bash
cd backend
npm run dev
```

The application should now be running at `http://localhost:3000`.

## Development Workflow

### Branching Strategy
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature branches (e.g., `feature/search-functionality`)
- `bugfix/*` - Bug fixes
- `release/*` - Release preparation

### Commit Message Format
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks

### Code Style
- Follow the existing code style
- Use ESLint and Prettier for code formatting
- Maximum line length: 100 characters
- Use 2 spaces for indentation
- Use single quotes for strings

## Testing

### Running Tests

#### Unit Tests
```bash
# Frontend
cd frontend
npm test

# Backend
cd ../backend
npm test
```

#### Integration Tests
```bash
# Frontend
cd frontend
npm run test:integration
```

#### Cross-Browser Testing
```bash
# Make sure to set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables
cd frontend
npm run test:cross-browser
```

#### Test Coverage
```bash
# Frontend
cd frontend
npm run test:coverage

# Backend
cd ../backend
npm run test:coverage
```

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```

The production build will be created in the `build` directory.

### Backend
```bash
cd backend
npm run build
```

The production build will be created in the `dist` directory.

## Deployment

### Prerequisites
- Docker and Docker Compose (for containerized deployment)
- Nginx (for production)
- PM2 (for process management)

### Environment Setup
1. Set up a production server (e.g., AWS EC2, DigitalOcean, etc.)
2. Install Docker and Docker Compose
3. Clone the repository
4. Set up environment variables in `.env.production`

### Deployment with Docker Compose

1. Build and start the containers:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

2. View logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

3. Stop the services:
```bash
docker-compose -f docker-compose.prod.yml down
```

### Manual Deployment

1. Build the frontend:
```bash
cd frontend
npm install --production
npm run build
```

2. Build the backend:
```bash
cd ../backend
npm install --production
npm run build
```

3. Start the backend server:
```bash
NODE_ENV=production node dist/server.js
```

4. Set up Nginx to serve the frontend and proxy API requests to the backend.

## Environment Variables

### Frontend (`.env`)
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENV=development
REACT_APP_GA_TRACKING_ID=your-ga-tracking-id
```

### Backend (`.env`)
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/document-search
JWT_SECRET=your-jwt-secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
```

## Troubleshooting

### Common Issues

#### Frontend won't start
- Check if port 3000 is in use: `lsof -i :3000`
- Clear node modules and reinstall: `rm -rf node_modules package-lock.json && npm install`

#### Backend connection issues
- Verify MongoDB is running
- Check backend logs for errors
- Ensure CORS is properly configured

#### Test failures
- Clear Jest cache: `npx jest --clearCache`
- Make sure all dependencies are installed
- Check for environment-specific issues

### Using the Error Fixing Script
Run the error fixing script to automatically diagnose and fix common issues:

```bash
./scripts/fix-issues.sh
```

## Maintenance

### Updating Dependencies
To update dependencies:

1. Update package.json with the latest versions
2. Run `npm install`
3. Test the application thoroughly
4. Commit the updated package.json and package-lock.json

### Database Migrations
Use MongoDB migration tools like `migrate-mongo` for database schema changes.

### Monitoring
- Set up monitoring for the Node.js application using PM2 or similar
- Monitor MongoDB performance
- Set up error tracking (e.g., Sentry, LogRocket)

## Useful Scripts

### Frontend
- `npm start` - Start development server
- `npm test` - Run tests
- `npm run build` - Create production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Backend
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run seed` - Seed the database with test data

### Docker
- `docker-compose up -d` - Start development environment
- `docker-compose down` - Stop development environment
- `docker-compose -f docker-compose.prod.yml up -d` - Start production environment

## Support
For support, please contact the development team at support@example.com.
