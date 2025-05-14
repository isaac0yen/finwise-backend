import { Router } from 'express';
import transactionController from '../controllers/transactionController';
import { authenticate } from '../middleware/middleware';

const router = Router();

// GET /api/transactions - get all wallet transactions for the logged-in user
router.get('/', authenticate, transactionController.getWalletTransactions);

export default router;
