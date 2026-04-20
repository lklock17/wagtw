import { Router } from 'express';
import * as deviceController from '../controllers/device.controller';

const router = Router();

router.get('/', deviceController.getDevices);
router.post('/', deviceController.createDevice);
router.post('/:id/connect', deviceController.connectDevice);
router.delete('/:id', deviceController.deleteDevice);
router.patch('/:id/webhook', deviceController.updateWebhook);
router.post('/test-webhook', deviceController.testWebhook);

export default router;
