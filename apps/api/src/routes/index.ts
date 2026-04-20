import { Router } from 'express';
import deviceRoutes from './device.routes';
import messageRoutes from './message.routes';

const router = Router();

router.use('/devices', deviceRoutes);
router.use('/messages', messageRoutes);

export default router;
