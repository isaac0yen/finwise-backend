import express from 'express';
import verificationController from '../controllers/verificationController';

const router = express.Router();

// Public verification routes
router.get('/', verificationController.getVerificationPage);
router.get('/data', verificationController.getTransactionsData);

export default router;
