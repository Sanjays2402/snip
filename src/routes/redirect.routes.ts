import { Router } from 'express';
import * as redirectController from '../controllers/redirect.controller.js';
import { validate } from '../middleware/validate.js';
import { verifyPasswordSchema } from '../utils/validators.js';

const router = Router();

router.get('/:shortCode', redirectController.redirect);
router.post('/:shortCode/verify', validate(verifyPasswordSchema), redirectController.verifyPassword);

export default router;
