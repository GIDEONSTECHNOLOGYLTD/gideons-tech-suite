const mongoose = require('mongoose');
const authController = require('../../../controllers/auth');
const ErrorResponse = require('../../../utils/errorResponse');

// Mock the User model
const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  isActive: true,
  matchPassword: jest.fn().mockResolvedValue(true),
  getSignedJwtToken: jest.fn().mockReturnValue('testToken123')
};

// Mock Mongoose model
jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

// Mock the ErrorResponse
jest.mock('../../../utils/errorResponse', () => {
  return jest.fn((message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
  });
});

// Mock the sendTokenResponse
const mockSendTokenResponse = jest.fn((user, statusCode, res) => {
  res.status(statusCode).json({
    success: true,
    token: 'testToken123'
  });
});

authController.sendTokenResponse = mockSendTokenResponse;

// Get the mocked User model
const User = require('../../../models/User');

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup request
    req = {
      body: {},
      user: { id: '507f1f77bcf86cd799439011' }
    };
    
    // Setup response
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn().mockReturnThis()
    };
    
    // Setup next function
    next = jest.fn();
  });

  describe('register', () => {
    it('should register a new user with valid data and default to user role', async () => {
      // Arrange
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'admin' // Should be ignored
      };

      // Mock User.findOne to return null (user doesn't exist)
      User.findOne.mockResolvedValueOnce(null);
      
      // Mock User.create to return a new user
      User.create.mockResolvedValueOnce({
        ...mockUser,
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'user'
      });

      // Mock the query chain for findOne
      const mockQuery = {
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          email: 'test@example.com',
          password: 'hashedpassword'
        })
      };
      User.findOne.mockReturnValueOnce(mockQuery);

      // Act
      await authController.register(req, res, next);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'user'
      });
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // Arrange
      req.body = {
        email: 'test@example.com',
        password: 'Test123!'
      };

      // Mock the query chain for findOne
      const mockQuery = {
        select: jest.fn().mockResolvedValue({
          ...mockUser,
          email: 'test@example.com',
          password: 'hashedpassword',
          matchPassword: jest.fn().mockResolvedValue(true)
        })
      };
      
      // First call for login, second call for register test
      User.findOne
        .mockResolvedValueOnce(null) // For register test
        .mockReturnValueOnce(mockQuery); // For login test

      // Act
      await authController.login(req, res, next);

      // Assert
      expect(User.findOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'testToken123'
      });
    });
  });

  describe('getMe', () => {
    it('should return current user data', async () => {
      // Arrange
      // Mock the query chain for findById
      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockUser)
      };
      User.findById.mockReturnValue(mockQuery);

      // Act
      await authController.getMe(req, res, next);

      // Assert
      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(User.findById().select).toHaveBeenCalledWith('-password');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });
  });
});
