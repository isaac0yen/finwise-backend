import { Router } from 'express';
import depositController from '../controllers/depositController';
import { authenticate } from '../middleware/middleware';

const router = Router();

router.post('/initialize', authenticate, depositController.initializeDeposit);
router.get('/verify/:reference', authenticate, depositController.verifyDeposit);

export default router;
