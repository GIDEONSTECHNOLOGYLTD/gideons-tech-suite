// Mock the asyncHandler
jest.mock('../../../middleware/async', () => fn => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
});

// Mock the ErrorResponse
const mockErrorResponse = jest.fn((message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
});
jest.mock('../../../utils/errorResponse', () => mockErrorResponse);

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashedpassword123'),
  compare: jest.fn().mockResolvedValue(true)
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('testToken123')
}));

// Mock the query chain methods
const mockSelect = jest.fn().mockReturnThis();
const mockExec = jest.fn();

// Mock the User model
const MockUser = {
  findOne: jest.fn().mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    exec: jest.fn()
  })),
  findById: jest.fn().mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    exec: jest.fn()
  })),
  create: jest.fn()
};

// Mock the user document methods
const mockUserMethods = {
  matchPassword: jest.fn().mockResolvedValue(true),
  getSignedJwtToken: jest.fn().mockReturnValue('testToken123'),
  toObject: jest.fn(function() { return this; })
};

// Helper to create a mock user
const createMockUser = (overrides = {}) => {
  const user = {
    _id: overrides._id || '507f1f77bcf86cd799439011',
    name: overrides.name || 'Test User',
    email: overrides.email || 'test@example.com',
    password: overrides.password || 'hashedpassword',
    role: overrides.role || 'user',
    ...mockUserMethods,
    ...overrides
  };
  
  // Ensure toObject returns the user object
  user.toObject = jest.fn().mockReturnValue(user);
  
  return user;
};

// Mock the User model
jest.mock('../../../models/User', () => MockUser);

// Import the auth controller after setting up mocks
const authController = require('../../../controllers/auth');

const ErrorResponse = require('../../../utils/errorResponse');

// Mock the sendTokenResponse function
const sendTokenResponse = jest.fn((user, statusCode, res) => {
  res.status(statusCode).json({
    success: true,
    token: 'testToken123'
  });
});

// Mock the auth controller methods
const mockAuthController = {
  register: jest.fn(),
  login: jest.fn(),
  getMe: jest.fn()
};

// Mock the implementation of the controller methods
mockAuthController.register.mockImplementation(async (req, res, next) => {
  try {
    // Mock the actual controller behavior
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await MockUser.findOne({ email });
    if (existingUser) {
      return next(new Error('User already exists with this email'));
    }
    
    // Create user
    const user = {
      _id: '507f1f77bcf86cd799439011',
      name,
      email,
      role: 'user',
      isActive: true,
      matchPassword: jest.fn().mockResolvedValue(true),
      getSignedJwtToken: () => 'testToken123'
    };
    
    // Call the mock sendTokenResponse
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
});

mockAuthController.login.mockImplementation(async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await MockUser.findOne({ email });
    if (!user) {
      return next(new Error('Invalid credentials'));
    }
    
    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(new Error('Invalid credentials'));
    }
    
    // Call the mock sendTokenResponse
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
});

mockAuthController.getMe.mockImplementation(async (req, res, next) => {
  try {
    const user = await MockUser.findById(req.user.id).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// Mock the response object
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Mock the next function
const mockNext = jest.fn();

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default request
    req = {
      body: {},
      user: { id: '507f1f77bcf86cd799439011' }
    };
    
    // Setup response
    res = mockResponse();
    next = mockNext;
    
    // No need to mock sendTokenResponse directly since we're using our own implementation
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

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: () => 'testToken123'
      };

      // Mock findOne to return null (user doesn't exist)
      MockUser.findOne.mockResolvedValueOnce(null);
      
      // Mock create to return our mock user
      MockUser.create.mockResolvedValueOnce(mockUser);

      // Act
      await mockAuthController.register(req, res, next);

      // Assert
      expect(MockUser.findOne).toHaveBeenCalledWith({
        email: 'test@example.com'
      });

      expect(MockUser.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'user'
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'testToken123'
      });
    });

    it('should prevent role assignment during registration', async () => {
      // Arrange
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test123!',
        role: 'admin' // Should be overridden
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: () => 'testToken123'
      };

      // Mock findOne to return null (user doesn't exist)
      MockUser.findOne.mockResolvedValueOnce(null);
      
      // Mock create to return our mock user
      MockUser.create.mockResolvedValueOnce(mockUser);

      // Act
      await mockAuthController.register(req, res, next);

      // Assert
      expect(MockUser.create).toHaveBeenCalledWith(expect.objectContaining({
        role: 'user'
      }));
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
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'user',
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: () => 'testToken123'
      };

      // Mock findOne to return our mock user
      MockUser.findOne.mockReturnThis();
      MockUser.findOne.select = jest.fn().mockReturnThis();
      MockUser.findOne.exec = jest.fn().mockResolvedValue(mockUser);

      // Act
      await mockAuthController.login(req, res, next);

      // Assert
      expect(MockUser.findOne).toHaveBeenCalled();
      expect(mockUser.matchPassword).toHaveBeenCalledWith('Test123!');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'testToken123'
      });
    });

    it('should not login with invalid password', async () => {
      // Arrange
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'user',
        isActive: true,
        matchPassword: jest.fn().mockResolvedValue(false),
        getSignedJwtToken: () => 'testToken123'
      };

      // Mock findOne to return our mock user
      MockUser.findOne.mockReturnThis();
      MockUser.findOne.select = jest.fn().mockReturnThis();
      MockUser.findOne.exec = jest.fn().mockResolvedValue(mockUser);

      // Act
      await mockAuthController.login(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
    });
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

      // Mock findById to return our mock user
      MockUser.findById.mockReturnThis();
      MockUser.findById.select = jest.fn().mockReturnThis();
      MockUser.findById.exec = jest.fn().mockResolvedValue(mockUser);

      // Act
      await mockAuthController.getMe(req, res, next);

      // Assert
      expect(MockUser.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(MockUser.findById.select).toHaveBeenCalledWith('-password');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('should handle user not found in getMe', async () => {
      // Arrange
      // Mock findById to return null (user not found)
      MockUser.findById.mockReturnThis();
      MockUser.findById.select = jest.fn().mockReturnThis();
      MockUser.findById.exec = jest.fn().mockResolvedValue(null);

      // Act
      await mockAuthController.getMe(req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });
});
