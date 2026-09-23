import { Router } from 'express';
import * as telegramController from '../controllers/telegram.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.get('/config', authMiddleware, telegramController.getTelegramConfig);
router.post('/config', authMiddleware, telegramController.updateTelegramConfig);
router.post('/test', authMiddleware, telegramController.testTelegram);

export default router;
