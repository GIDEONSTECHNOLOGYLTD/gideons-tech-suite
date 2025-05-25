const mongoose = require('mongoose');
const authController = require('../../../controllers/auth');
const User = require('../../../models/User');

// Mock the User model
jest.mock('../../../models/User');

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

  describe('getMe', () => {
    it('should return current user data', async () => {
      // Arrange
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        isActive: true
      };

      // Mock User.findById with query chaining
      const mockQuery = {
        select: jest.fn().mockResolvedValue(mockUser)
      };
      User.findById.mockReturnValue(mockQuery);

      // Act
      await authController.getMe(req, res, next);

      // Assert
      expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockQuery.select).toHaveBeenCalledWith('-password');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });
  });
});
