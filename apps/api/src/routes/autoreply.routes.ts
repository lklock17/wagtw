import { Router } from 'express';
import * as autoReplyController from '../controllers/autoreply.controller';

const router = Router();

router.get('/', autoReplyController.getRules);
router.post('/', autoReplyController.createRule);
router.delete('/:id', autoReplyController.deleteRule);

export default router;
