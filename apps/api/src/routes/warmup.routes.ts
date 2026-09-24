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

const router = Router();

router.get('/config', getWarmupConfig);
router.post('/config', updateWarmupConfig);
router.get('/personas', getPersonas);
router.post('/fetch-models', fetchAiModels);
router.get('/logs', getWarmupLogs);
router.post('/trigger', triggerWarmupManual);
router.post('/welcome-device', welcomeDevice);

export default router;
