import { Router } from 'express';
import * as clientController from '../controllers/client.controller';

const router = Router();

router.get('/', clientController.getClients);
router.post('/', clientController.createClient);
router.delete('/:id', clientController.deleteClient);

export default router;
