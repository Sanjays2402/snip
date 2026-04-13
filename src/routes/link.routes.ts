import { Router } from 'express';
import * as linkController from '../controllers/link.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createLinkSchema, updateLinkSchema, bulkCreateLinksSchema } from '../utils/validators.js';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/links:
 *   post:
 *     tags: [Links]
 *     summary: Create a short link
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/very-long-url
 *               customSlug:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: my-link
 *               title:
 *                 type: string
 *                 maxLength: 500
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *               password:
 *                 type: string
 *                 minLength: 4
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               maxClicks:
 *                 type: integer
 *                 minimum: 1
 *               isPermanent:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Link created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Link'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Slug already taken
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.post('/', validate(createLinkSchema), linkController.createLink);

/**
 * @openapi
 * /api/links/bulk:
 *   post:
 *     tags: [Links]
 *     summary: Bulk create short links
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [links]
 *             properties:
 *               links:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required: [url]
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     customSlug:
 *                       type: string
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       201:
 *         description: Links created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 links:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Link'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/bulk', validate(bulkCreateLinksSchema), linkController.bulkCreateLinks);

/**
 * @openapi
 * /api/links/import:
 *   post:
 *     tags: [Bulk Operations]
 *     summary: Import links from CSV file
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "CSV with columns: original_url, custom_slug, tags, expires_at"
 *     responses:
 *       201:
 *         description: Links imported
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: integer
 *                       error:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/import', linkController.importLinks);

/**
 * @openapi
 * /api/links/export:
 *   get:
 *     tags: [Bulk Operations]
 *     summary: Export links as CSV
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/export', linkController.exportLinks);

/**
 * @openapi
 * /api/links:
 *   get:
 *     tags: [Links]
 *     summary: List your links
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of links
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 links:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Link'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', linkController.getLinks);

/**
 * @openapi
 * /api/links/{id}:
 *   get:
 *     tags: [Links]
 *     summary: Get a link by ID
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
 *         description: Link details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Link'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', linkController.getLinkById);

/**
 * @openapi
 * /api/links/{id}:
 *   patch:
 *     tags: [Links]
 *     summary: Update a link
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               title:
 *                 type: string
 *                 nullable: true
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               password:
 *                 type: string
 *                 nullable: true
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               maxClicks:
 *                 type: integer
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *               isPermanent:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Link updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Link'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id', validate(updateLinkSchema), linkController.updateLink);

/**
 * @openapi
 * /api/links/{id}:
 *   delete:
 *     tags: [Links]
 *     summary: Delete a link
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
 *         description: Link deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', linkController.deleteLink);

export default router;
