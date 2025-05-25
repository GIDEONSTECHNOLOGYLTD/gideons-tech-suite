// Set environment to test
process.env.NODE_ENV = 'test';

// Mock console methods to keep test output clean
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console output during tests
  console.log = jest.fn();
  console.error = jest.fn();
  
  // Set test database URI
  process.env.MONGODB_URI = 'mongodb://localhost:27017/gideons-tech-suite-test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRE = '30d';
  process.env.PORT = 5005;
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test timeout (10 seconds)
jest.setTimeout(10000);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
