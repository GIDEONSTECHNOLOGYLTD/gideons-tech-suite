const { body, query, param } = require('express-validator');

const validActions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'AUTHORIZATION', 'ACCESS', 'REGISTER'];
const validEntities = ['USER', 'DOCUMENT', 'PROJECT', 'AUTH', 'SYSTEM'];
const validStatuses = ['SUCCESS', 'FAILURE'];

const getAuditLogsValidation = [
  query('action')
    .optional()
    .isIn(validActions)
    .withMessage(`Action must be one of: ${validActions.join(', ')}`),
    
  query('entity')
    .optional()
    .isIn(validEntities)
    .withMessage(`Entity must be one of: ${validEntities.join(', ')}`),
    
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('User ID must be a valid MongoDB ID'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
];

const getAuditLogByIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid audit log ID')
];

const getMyAuditLogsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt()
];

module.exports = {
  getAuditLogsValidation,
  getAuditLogByIdValidation,
  getMyAuditLogsValidation
};
