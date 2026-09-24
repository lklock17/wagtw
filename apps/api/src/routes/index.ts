import { Router } from 'express';
import deviceRoutes from './device.routes';
import messageRoutes from './message.routes';
import inboxRoutes from './inbox.routes';
import templateRoutes from './template.routes';
import clientRoutes from './client.routes';
import autoReplyRoutes from './autoreply.routes';
import authRoutes from './auth.routes';
import bulkRoutes from './bulk.routes';
import mediaRoutes from './media.routes';
import scheduleRoutes from './schedule.routes';
import statsRoutes from './stats.routes';
import warmupRoutes from './warmup.routes';
import telegramRoutes from './telegram.routes';
import contactRoutes from './contact.routes';
import agentRoutes from './agent.routes';
import { authMiddleware } from '../middlewares/auth.middleware';

import { welcomeDevice } from '../controllers/warmup.controller';

const router = Router();

router.use('/auth', authRoutes);
router.use('/agent', agentRoutes);
router.post('/warmup/welcome-device', welcomeDevice);

// Protected Routes
router.use('/stats', authMiddleware, statsRoutes);
router.use('/devices', authMiddleware, deviceRoutes);
router.use('/contacts', authMiddleware, contactRoutes);
router.use('/messages', authMiddleware, messageRoutes);
router.use('/inbox', authMiddleware, inboxRoutes);
router.use('/templates', authMiddleware, templateRoutes);
router.use('/clients', authMiddleware, clientRoutes);
router.use('/autoreply', authMiddleware, autoReplyRoutes);
router.use('/bulk', authMiddleware, bulkRoutes);
router.use('/media', authMiddleware, mediaRoutes);
router.use('/schedules', authMiddleware, scheduleRoutes);
router.use('/warmup', authMiddleware, warmupRoutes);
router.use('/telegram', authMiddleware, telegramRoutes);

export default router;
