import { Router } from 'express';
import transferController from '../controllers/transferController';
import { authenticate } from '../middleware/middleware';

const router = Router();

// Route to create a wallet-to-wallet transfer
router.post('/', authenticate, transferController.createTransfer);

export default router;
