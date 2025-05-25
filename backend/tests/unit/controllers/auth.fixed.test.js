const mongoose = require('mongoose');
const authController = require('../../../controllers/auth');
const User = require('../../../models/User');

// Mock the User model methods
const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  isActive: true,
  matchPassword: jest.fn().mockResolvedValue(true),
  getSignedJwtToken: jest.fn().mockReturnValue('testToken123'),
  save: jest.fn().mockResolvedValue(this)
};

describe('Auth Controller', () => {
  let req, res, next;
  let findOneSpy, createSpy;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup request
    req = {
      body: {},
      user: { id: '507f1f77bcf86cd799439011' },
      cookies: {}
    };
    
    // Setup response
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn().mockReturnThis()
    };
    
    // Setup next function
    next = jest.fn();

    // Mock User static methods
    findOneSpy = jest.spyOn(User, 'findOne');
    createSpy = jest.spyOn(User, 'create');
  });

  afterEach(() => {
    // Clean up spies
    findOneSpy.mockRestore();
    createSpy.mockRestore();
  });

  describe('register', () => {
    it('should register a new user with valid data', async () => {
      try {
        // Test data - don't include role in the request
        req.body = {
          name: 'Test User',
          email: 'test@example.com',
          password: 'Test123!'
        };

        // Mock User.findOne to return null (user doesn't exist)
        findOneSpy.mockResolvedValueOnce(null);

        // Mock the created user with all required methods
        const createdUser = {
          _id: '507f1f77bcf86cd799439011',
          name: 'Test User',
          email: 'test@example.com',
          password: 'Test123!',
          role: 'user',
          isActive: true,
          matchPassword: jest.fn().mockResolvedValue(true),
          getSignedJwtToken: jest.fn().mockReturnValue('testToken123'),
          save: jest.fn().mockResolvedValue(this)
        };

        // Mock User.create to return the created user
        createSpy.mockResolvedValueOnce(createdUser);

        // Mock the response methods
        res.status = jest.fn().mockReturnThis();
        res.json = jest.fn();
        res.cookie = jest.fn().mockReturnThis();
        
        // Mock the asyncHandler to call the handler directly
        const originalAsyncHandler = require('../../../middleware/async');
        jest.mock('../../../middleware/async', () => (handler) => {
          return async (req, res, next) => {
            try {
              await handler(req, res, next);
            } catch (error) {
              next(error);
            }
          };
        });
        
        // Re-import the auth controller to use the mocked asyncHandler
        jest.resetModules();
        const testAuthController = require('../../../controllers/auth');
        
        // Act
        await testAuthController.register(req, res, next);

        // Assert
        expect(findOneSpy).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(createSpy).toHaveBeenCalledWith({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Test123!',
          role: 'user' // Should be forced to 'user'
        });
        
        // Check if next was called with an error
        if (next.mock.calls.length > 0) {
          const error = next.mock.calls[0][0];
          console.error('Next was called with error:', error);
          throw error; // Re-throw to fail the test
        }
        
        // Verify the response
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.cookie).toHaveBeenCalledWith(
          'token',
          'testToken123',
          expect.objectContaining({
            httpOnly: true,
            expires: expect.any(Date)
          })
        );
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          token: 'testToken123'
        });
      } catch (error) {
        console.error('Test failed with error:', error);
        throw error;
      }
    });
  });
});
