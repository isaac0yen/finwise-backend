import express from 'express';
import tokenController from '../controllers/tokenController';
import { authenticate } from '../middleware/authMiddleware';
import { checkUserStatus } from '../middleware/checkuserStatus';

const router = express.Router();

// Public routes
router.get('/tokens', tokenController.getAllTokens);
router.get('/market/prices', tokenController.getMarketData);

// Authenticated routes
router.get('/portfolio', authenticate, checkUserStatus, tokenController.getUserPortfolio);
router.get('/transactions', authenticate, checkUserStatus, tokenController.getTransactionHistory);
router.post('/buy', authenticate, checkUserStatus, tokenController.buyTokens);
router.post('/sell', authenticate, checkUserStatus, tokenController.sellTokens);

// Admin route for initialization (should be protected in production)
router.post('/admin/initialize', tokenController.initializeTokens);

export default router;
