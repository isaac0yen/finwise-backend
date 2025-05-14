import express from 'express';
import { authenticate, authorizeAdmin } from '../middleware/authMiddleware';
import adminController from '../controllers/adminController';

const router = express.Router();

// Route to get all pending withdrawal requests
router.get('/withdrawals/pending', authenticate, authorizeAdmin, adminController.getPendingWithdrawals);

// Route to process a withdrawal request (approve/reject)
router.post('/withdrawals/:id/process', authenticate, authorizeAdmin, adminController.processWithdrawalRequest);

export default router;
