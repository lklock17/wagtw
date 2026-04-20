import { Router } from 'express';
import * as deviceController from '../controllers/device.controller';

const router = Router();

router.get('/', deviceController.getDevices);
router.post('/', deviceController.createDevice);
router.post('/:id/connect', deviceController.connectDevice);
router.delete('/:id', deviceController.deleteDevice);

export default router;
