import { Router } from 'express';
import * as deviceController from '../controllers/device.controller';

const router = Router();

router.get('/', deviceController.getDevices);
router.post('/', deviceController.createDevice);
router.post('/:id/connect', deviceController.connectDevice);
router.post('/:id/check-number', deviceController.checkNumber);
router.post('/:id/pairing-code', deviceController.getPairingCode);
router.delete('/:id', deviceController.deleteDevice);
router.patch('/:id/webhook', deviceController.updateWebhook);
router.patch('/:id/toggle-pause', deviceController.togglePauseDevice);
router.post('/test-webhook', deviceController.testWebhook);

export default router;
