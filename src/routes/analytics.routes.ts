import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/links/{id}/analytics:
 *   get:
 *     tags: [Analytics]
 *     summary: Get detailed analytics for a link
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (default 30 days ago)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (default now)
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 linkId:
 *                   type: string
 *                 from:
 *                   type: string
 *                 to:
 *                   type: string
 *                 granularity:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/analytics', analyticsController.getLinkAnalytics);

/**
 * @openapi
 * /api/links/{id}/analytics/realtime:
 *   get:
 *     tags: [Analytics]
 *     summary: Get realtime clicks (last 60 minutes)
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Realtime click data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 linkId:
 *                   type: string
 *                 windowMinutes:
 *                   type: integer
 *                 clicks:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/analytics/realtime', analyticsController.getRealtimeAnalytics);

export default router;
