const Joi = require('joi');

// Common schemas
const idSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

// Document schema
exports.documentSchema = Joi.object({
  title: Joi.string().required().min(3).max(100).trim(),
  content: Joi.string().required(),
  tags: Joi.array().items(Joi.string().trim()),
  isPublic: Joi.boolean().default(false),
  projectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  folderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow(null).default(null)
});

// User schema
exports.userSchema = Joi.object({
  name: Joi.string().required().min(2).max(50).trim(),
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('user', 'admin').default('user')
});

// Login schema
exports.loginSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  password: Joi.string().required()
});

// Validation middleware
exports.validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true 
  });

  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Replace req.body with the validated and cleaned value
  req.body = value;
  next();
};

// Validate ObjectId
exports.validateId = (req, res, next) => {
  const { id } = req.params;
  const { error } = idSchema.validate(id);
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  next();
};
