const mongoose = require('mongoose');
const authController = require('../../../controllers/auth');
const User = require('../../../models/User');
const ErrorResponse = require('../../../utils/errorResponse');

// Mock the User model methods
const mockUser = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  isActive: true,
  password: 'hashedpassword123',
  matchPassword: jest.fn().mockResolvedValue(true),
  getSignedJwtToken: jest.fn().mockReturnValue('testToken123'),
  save: jest.fn().mockResolvedValue(this)
};

// Mock the User model static methods
jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn()
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

describe('Auth Controller', () => {
  let req, res, next;

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

      // Mock the query chain
      const mockSelect = jest.fn().mockResolvedValue(mockUser);
      const mockFindById = jest.spyOn(User, 'findById').mockImplementation(() => ({
        select: mockSelect
      }));

      // Act
      await authController.getMe(req, res, next);

      // Assert
      expect(mockFindById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockSelect).toHaveBeenCalledWith('-password');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
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

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        password: 'hashedpassword123',
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: jest.fn().mockReturnValue('testToken123')
      };

      // Mock the query chain
      const mockSelect = jest.fn().mockResolvedValue(mockUser);
      const mockFindOne = jest.spyOn(User, 'findOne').mockImplementation(() => ({
        select: mockSelect
      }));

      // Act
      await authController.login(req, res, next);

      // Assert
      expect(mockFindOne).toHaveBeenCalledWith({
        email: { $regex: /^test@example\.com$/i }
      });
      expect(mockSelect).toHaveBeenCalledWith('+password');
      expect(mockUser.matchPassword).toHaveBeenCalledWith('Test123!');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'testToken123'
      });
    });
  });

  describe('register', () => {
    it('should register a new user with valid data', async () => {
      // Arrange
      req.body = {
        name: 'New User',
        email: 'new@example.com',
        password: 'Test123!',
        role: 'admin' // Should be ignored
      };

      // Mock User.findOne to return null (user doesn't exist)
      jest.spyOn(User, 'findOne').mockResolvedValueOnce(null);

      // Mock the created user
      const createdUser = {
        _id: '507f1f77bcf86cd799439012',
        name: 'New User',
        email: 'new@example.com',
        role: 'user', // Should be forced to 'user'
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: jest.fn().mockReturnValue('testToken123')
      };
      jest.spyOn(User, 'create').mockResolvedValueOnce(createdUser);

      // Act
      await authController.register(req, res, next);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: 'new@example.com' });
      expect(User.create).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password: 'Test123!',
        role: 'user' // Should be forced to 'user'
      });
    });
  });
});
