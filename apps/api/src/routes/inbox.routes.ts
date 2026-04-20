import { Router } from 'express';
import * as inboxController from '../controllers/inbox.controller';

const router = Router();

router.get('/threads', inboxController.getThreads);
router.get('/threads/:threadId/messages', inboxController.getMessages);
router.post('/threads/:threadId/read', inboxController.markAsRead);

export default router;
