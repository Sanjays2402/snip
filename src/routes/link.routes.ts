import { Router } from 'express';
import * as linkController from '../controllers/link.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createLinkSchema, updateLinkSchema, bulkCreateLinksSchema } from '../utils/validators.js';

const router = Router();

router.use(authenticate);

router.post('/', validate(createLinkSchema), linkController.createLink);
router.post('/bulk', validate(bulkCreateLinksSchema), linkController.bulkCreateLinks);
router.get('/', linkController.getLinks);
router.get('/:id', linkController.getLinkById);
router.patch('/:id', validate(updateLinkSchema), linkController.updateLink);
router.delete('/:id', linkController.deleteLink);

export default router;
