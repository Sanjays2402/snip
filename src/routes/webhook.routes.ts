import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createWebhookSchema } from '../utils/validators.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createWebhookSchema), webhookController.createWebhook);
router.get('/', webhookController.getWebhooks);
router.delete('/:id', webhookController.deleteWebhook);
router.get('/:id/deliveries', webhookController.getWebhookDeliveries);

export default router;
