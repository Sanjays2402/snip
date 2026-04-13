import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/links/:id/analytics — detailed analytics
router.get('/:id/analytics', analyticsController.getLinkAnalytics);

// GET /api/links/:id/analytics/realtime — last 60 min
router.get('/:id/analytics/realtime', analyticsController.getRealtimeAnalytics);

export default router;
