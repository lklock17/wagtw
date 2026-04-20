import { Router } from 'express';
import deviceRoutes from './device.routes';
import messageRoutes from './message.routes';
import inboxRoutes from './inbox.routes';
import templateRoutes from './template.routes';
import clientRoutes from './client.routes';
import autoReplyRoutes from './autoreply.routes';

const router = Router();

router.use('/devices', deviceRoutes);
router.use('/messages', messageRoutes);
router.use('/inbox', inboxRoutes);
router.use('/templates', templateRoutes);
router.use('/clients', clientRoutes);
router.use('/autoreply', autoReplyRoutes);

export default router;
