import { Router } from 'express';
import dashboardController from '../controllers/dashboardController';
import { authenticate } from '../middleware/middleware';

const router = Router();

// GET /dashboard
router.get('/', authenticate, dashboardController.getDashboard);

export default router;
