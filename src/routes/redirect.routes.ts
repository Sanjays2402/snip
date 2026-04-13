import { Router } from 'express';
import * as redirectController from '../controllers/redirect.controller.js';
import { validate } from '../middleware/validate.js';
import { verifyPasswordSchema } from '../utils/validators.js';

const router = Router();

/**
 * @openapi
 * /{shortCode}:
 *   get:
 *     tags: [Redirect]
 *     summary: Redirect to original URL
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The short code
 *     responses:
 *       302:
 *         description: Redirect to original URL
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       410:
 *         description: Link expired or inactive
 *       423:
 *         description: Password required
 */
router.get('/:shortCode', redirectController.redirect);

/**
 * @openapi
 * /{shortCode}/verify:
 *   post:
 *     tags: [Redirect]
 *     summary: Verify password for a protected link
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       302:
 *         description: Redirect to original URL
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Incorrect password
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:shortCode/verify', validate(verifyPasswordSchema), redirectController.verifyPassword);

export default router;
