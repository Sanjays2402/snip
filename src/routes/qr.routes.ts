import { Router } from 'express';
import * as qrController from '../controllers/qr.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/links/{id}/qr:
 *   get:
 *     tags: [QR Codes]
 *     summary: Generate QR code for a short link
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
 *         description: Link ID
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 300
 *           minimum: 100
 *           maximum: 2000
 *         description: QR code size in pixels
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [png, svg]
 *           default: png
 *         description: Output format
 *       - in: query
 *         name: fg_color
 *         schema:
 *           type: string
 *           default: "#000000"
 *         description: Foreground color (hex)
 *       - in: query
 *         name: bg_color
 *         schema:
 *           type: string
 *           default: "#ffffff"
 *         description: Background color (hex)
 *       - in: query
 *         name: logo_url
 *         schema:
 *           type: string
 *         description: URL of logo to overlay at center
 *     responses:
 *       200:
 *         description: QR code image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/svg+xml:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.get('/:id/qr', qrController.generateQRCode);

export default router;
