import { Router } from 'express';
import * as apiKeyController from '../controllers/apikey.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createApiKeySchema } from '../utils/validators.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createApiKeySchema), apiKeyController.createKey);
router.get('/', apiKeyController.listKeys);
router.delete('/:id', apiKeyController.deleteKey);

export default router;
