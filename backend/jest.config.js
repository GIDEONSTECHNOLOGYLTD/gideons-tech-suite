module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Look for test files in these locations
  roots: ['<rootDir>/tests'],
  
  // Test file patterns
  testMatch: [
    '**/integration/**/*.test.js',
    '**/unit/**/*.test.js',
    '**/__tests__/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/tests/**',
    '!jest.config.js',
    '!server.js',
    '!**/scripts/**'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js'],
  
  // Other options
  verbose: true,
  testTimeout: 30000, // 30 seconds timeout for tests
  
  // Use this to handle ES modules if needed
  transform: {}
};
