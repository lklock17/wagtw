import { Router } from 'express';
import deviceRoutes from './device.routes';
import messageRoutes from './message.routes';
import inboxRoutes from './inbox.routes';
import templateRoutes from './template.routes';
import clientRoutes from './client.routes';
import autoReplyRoutes from './autoreply.routes';
import authRoutes from './auth.routes';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use('/auth', authRoutes);

// Protected Routes
router.use('/devices', authMiddleware, deviceRoutes);
router.use('/messages', authMiddleware, messageRoutes);
router.use('/inbox', authMiddleware, inboxRoutes);
router.use('/templates', authMiddleware, templateRoutes);
router.use('/clients', authMiddleware, clientRoutes);
router.use('/autoreply', authMiddleware, autoReplyRoutes);

export default router;
