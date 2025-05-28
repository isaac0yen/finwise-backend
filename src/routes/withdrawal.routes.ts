import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator'; 
import withdrawalController from '../controllers/withdrawalController';
import { authenticate } from '../middleware/middleware'; 

const router = Router();

// Middleware to handle validation results
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ status: false, message: 'Validation error', errors: errors.array() });
  }
  return next();
};

// Route to get list of banks
router.get('/banks',
  authenticate,
  withdrawalController.getBanks
);

// Route to resolve bank account details
router.post('/resolve-account',
  authenticate,
  [
    body('account_number').notEmpty().withMessage('Account number is required').isString().isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits'),
    body('bank_code').notEmpty().withMessage('Bank code is required').isString()
  ],
  handleValidationErrors,
  withdrawalController.resolveAccount
);

// Route to request a withdrawal
router.post('/request', 
  authenticate, 
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Valid amount is required'),
    body('currency').optional().isString().isIn(['NGN', 'USD']).withMessage('Valid currency (NGN or USD) is required if provided'),
    body('bank_name').notEmpty().withMessage('Bank name is required').isString(),
    body('account_number').notEmpty().withMessage('Account number is required').isString().isLength({ min: 10, max: 10 }).withMessage('Account number must be 10 digits'), 
    body('account_name').notEmpty().withMessage('Account name is required').isString()
  ],
  handleValidationErrors, 
  withdrawalController.requestWithdrawal
);

export default router;
