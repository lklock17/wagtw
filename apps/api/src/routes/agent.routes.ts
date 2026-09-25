import { Router } from 'express';
import * as agentController from '../controllers/agent.controller';

const router = Router();

router.post('/register', agentController.registerAgent);
router.post('/incoming', agentController.receiveIncomingMessage);
router.get('/pending-messages/:deviceId', agentController.getPendingMessages);
router.post('/message-status', agentController.updateMessageStatus);
router.post('/disconnect', agentController.disconnectAgent);

export default router;
