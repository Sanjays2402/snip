import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createWebhookSchema } from '../utils/validators.js';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/webhooks:
 *   post:
 *     tags: [Webhooks]
 *     summary: Create a webhook
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, events]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/webhook
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [link.clicked, link.created, link.threshold_reached, link.expired]
 *                 minItems: 1
 *     responses:
 *       201:
 *         description: Webhook created
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', validate(createWebhookSchema), webhookController.createWebhook);

/**
 * @openapi
 * /api/webhooks:
 *   get:
 *     tags: [Webhooks]
 *     summary: List your webhooks
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of webhooks
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', webhookController.getWebhooks);

/**
 * @openapi
 * /api/webhooks/{id}:
 *   delete:
 *     tags: [Webhooks]
 *     summary: Delete a webhook
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
 *       204:
 *         description: Webhook deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', webhookController.deleteWebhook);

/**
 * @openapi
 * /api/webhooks/{id}/deliveries:
 *   get:
 *     tags: [Webhooks]
 *     summary: Get webhook delivery history
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
 *         description: List of deliveries
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id/deliveries', webhookController.getWebhookDeliveries);

export default router;
