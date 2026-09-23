import { Router } from 'express';
import {
  getWarmupConfig,
  updateWarmupConfig,
  fetchAiModels,
  getWarmupLogs,
  triggerWarmupManual
} from '../controllers/warmup.controller';

const router = Router();

router.get('/config', getWarmupConfig);
router.post('/config', updateWarmupConfig);
router.post('/fetch-models', fetchAiModels);
router.get('/logs', getWarmupLogs);
router.post('/trigger', triggerWarmupManual);

export default router;
