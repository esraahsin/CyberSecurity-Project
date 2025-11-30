/**
 * Middleware de validation des données
 * Utilise express-validator pour valider les entrées
 * @module middleware/validation
 */

const { body, param, query, validationResult } = require('express-validator');
const { 
  validatePassword, 
  validateEmail,
  validateUsername,
  validatePhone 
} = require('../utils/validators');
const { AppError } = require('./error.middleware');

/**
 * Middleware qui vérifie les résultats de validation
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * Validation pour l'inscription
 */
const validateRegister = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .custom((value) => {
      const result = validateEmail(value);
      if (!result.valid) {
        throw new Error(result.error);
      }
      return true;
    }),
  
  body('username')
    .trim()
    .custom((value) => {
      const result = validateUsername(value);
      if (!result.valid) {
        throw new Error(result.error);
      }
      return true;
    }),
  
  body('password')
    .custom((value) => {
      const result = validatePassword(value);
      if (!result.valid) {
        throw new Error(result.errors.join(', '));
      }
      return true;
    }),
  
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s-]+$/)
    .withMessage('First name can only contain letters, spaces and hyphens'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s-]+$/)
    .withMessage('Last name can only contain letters, spaces and hyphens'),
  
  body('phoneNumber')
    .optional()
    .custom((value) => {
      if (!value) return true;
      const result = validatePhone(value);
      if (!result.valid) {
        throw new Error(result.error);
      }
      return true;
    }),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 18) {
        throw new Error('You must be at least 18 years old');
      }
      if (age > 120) {
        throw new Error('Invalid date of birth');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation pour la connexion
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * Validation pour le changement de mot de passe
 */
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .custom((value) => {
      const result = validatePassword(value);
      if (!result.valid) {
        throw new Error(result.errors.join(', '));
      }
      return true;
    })
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  
  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation pour la création d'un transfert
 */
const validateTransfer = [
  body('fromAccountId')
    .notEmpty()
    .withMessage('Source account is required')
    .isInt()
    .withMessage('Invalid account ID'),
  
  body('toAccountNumber')
    .notEmpty()
    .withMessage('Destination account is required')
.matches(/^BNK[0-9]{12,16}$/)  // Accepte de 12 à 16 chiffres
    .withMessage('Invalid account number format'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0')
    .custom((value) => {
      if (value > 1000000) {
        throw new Error('Amount exceeds maximum limit (1,000,000)');
      }
      return true;
    }),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must not exceed 200 characters'),
  
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency'),
  
  handleValidationErrors
];

/**
 * Validation pour l'ajout d'un bénéficiaire
 */
const validateBeneficiary = [
  body('beneficiaryName')
    .trim()
    .notEmpty()
    .withMessage('Beneficiary name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),
  
  body('accountNumber')
    .notEmpty()
    .withMessage('Account number is required')
.matches(/^BNK[0-9]{12,16}$/)  // Accepte de 12 à 16 chiffres
    .withMessage('Invalid account number format'),
  
  body('bankName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Bank name must not exceed 100 characters'),
  
  body('nickname')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Nickname must not exceed 50 characters'),
  
  handleValidationErrors
];

/**
 * Validation pour les paramètres d'ID
 */
const validateIdParam = [
  param('id')
    .isInt()
    .withMessage('Invalid ID'),
  
  handleValidationErrors
];

/**
 * Validation pour les paramètres UUID
 */
const validateUUIDParam = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  handleValidationErrors
];

/**
 * Validation pour la pagination
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Invalid sort field'),
  
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  
  handleValidationErrors
];

/**
 * Validation pour la vérification MFA
 */
const validateMFACode = [
  body('code')
    .notEmpty()
    .withMessage('MFA code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('MFA code must be 6 digits')
    .isNumeric()
    .withMessage('MFA code must contain only numbers'),
  
  handleValidationErrors
];

/**
 * Validation pour la recherche
 */
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Search query contains invalid characters'),
  
  handleValidationErrors
];

/**
 * Validation pour les dates
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const start = new Date(req.query.startDate);
        const end = new Date(value);
        
        if (end < start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation pour la mise à jour du profil
 */
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s-]+$/)
    .withMessage('First name can only contain letters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s-]+$/)
    .withMessage('Last name can only contain letters'),
  
  body('phoneNumber')
    .optional()
    .custom((value) => {
      const result = validatePhone(value);
      if (!result.valid) {
        throw new Error(result.error);
      }
      return true;
    }),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  handleValidationErrors
];

/**
 * Validation pour le montant
 */
const validateAmount = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be positive')
    .toFloat(),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateTransfer,
  validateBeneficiary,
  validateIdParam,
  validateUUIDParam,
  validatePagination,
  validateMFACode,
  validateSearch,
  validateDateRange,
  validateProfileUpdate,
  validateAmount
};