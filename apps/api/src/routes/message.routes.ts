import { Router } from 'express';
import * as messageController from '../controllers/message.controller';

const router = Router();

router.post('/send', messageController.sendMessage);

export default router;
