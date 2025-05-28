const asyncHandler = require('../../../middleware/async');
const ErrorResponse = require('../../../utils/errorResponse');
const User = require('../../../models/User');
const authController = require('../../../controllers/auth');

// Mock the User model
jest.mock('../../../models/User');

// Mock the asyncHandler middleware
jest.mock('../../../middleware/async', () => fn => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
});

describe('Auth Controller', () => {
  let req, res, next;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock request object
    req = {
      body: {},
      user: { id: 'user123' },
      get: jest.fn().mockReturnValue('localhost')
    };
    
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    };
    
    // Mock next function
    next = jest.fn();
  });
  
  describe('register', () => {
    it('should register a new user and return a token', async () => {
      // Setup
      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'newuser@example.com',
        getSignedJwtToken: jest.fn().mockReturnValue('testtoken123')
      };
      
      // Mock User.findOne to return null (user doesn't exist)
      User.findOne.mockResolvedValue(null);
      
      // Mock User.create to return the mock user
      User.create.mockResolvedValue(mockUser);
      
      // Set request body
      req.body = {
        name: 'Test User',
        email: 'newuser@example.com',
        password: 'password123'
      };
      
      // Call the controller method
      await authController.register(req, res, next);
      
      // Assertions
      expect(User.findOne).toHaveBeenCalledWith({ email: 'newuser@example.com' });
      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user'
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'testtoken123'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should return 400 if user already exists', async () => {
      // Setup
      const existingUser = {
        _id: 'user123',
        email: 'existing@example.com'
      };
      
      // Mock User.findOne to return an existing user
      User.findOne.mockResolvedValue(existingUser);
      
      // Set request body
      req.body = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'password123'
      };
      
      // Call the controller method
      await authController.register(req, res, next);
      
      // Assertions
      expect(User.findOne).toHaveBeenCalledWith({ email: 'existing@example.com' });
      expect(User.create).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ErrorResponse);
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });
  
  describe('login', () => {
    it('should login user and return a token', async () => {
      // Setup
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: jest.fn().mockReturnValue('testtoken123')
      };
      
      // Mock User.findOne to return the mock user
      User.findOne.mockImplementation(() => ({
        select: jest.fn().mockReturnValue(mockUser)
      }));
      
      // Set request body
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      // Call the controller method
      await authController.login(req, res, next);
      
      // Assertions
      expect(User.findOne).toHaveBeenCalledWith({ 
        email: { $regex: new RegExp('^test@example\.com$', 'i') } 
      });
      expect(mockUser.matchPassword).toHaveBeenCalledWith('password123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'testtoken123'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should return 401 if user does not exist', async () => {
      // Mock User.findOne to return null
      User.findOne.mockImplementation(() => ({
        select: jest.fn().mockReturnValue(null)
      }));
      
      // Set request body
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };
      
      // Call the controller method
      await authController.login(req, res, next);
      
      // Assertions
      expect(User.findOne).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0]).toBeInstanceOf(ErrorResponse);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });
  
  describe('getMe', () => {
    it('should return the current user', async () => {
      // Setup
      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com'
      };
      
      // Mock User.findById to return the mock user
      User.findById.mockResolvedValue(mockUser);
      
      // Set request user
      req.user = { id: 'user123' };
      
      // Call the controller method
      await authController.getMe(req, res, next);
      
      // Assertions
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });
  });
});
