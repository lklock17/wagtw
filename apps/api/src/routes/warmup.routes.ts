import { Router } from 'express';
import {
  getWarmupConfig,
  updateWarmupConfig,
  fetchAiModels,
  getWarmupLogs,
  triggerWarmupManual,
  welcomeDevice,
  getPersonas
} from '../controllers/warmup.controller';
import { joinGroupBatch, getGroupTasksList } from '../controllers/agent.controller';

const router = Router();

router.get('/config', getWarmupConfig);
router.post('/config', updateWarmupConfig);
router.get('/personas', getPersonas);
router.post('/fetch-models', fetchAiModels);
router.get('/logs', getWarmupLogs);
router.post('/trigger', triggerWarmupManual);
router.post('/welcome-device', welcomeDevice);

// Group Warmup & Auto-Join routes
router.post('/groups/join', joinGroupBatch);
router.get('/groups/tasks', getGroupTasksList);

export default router;
