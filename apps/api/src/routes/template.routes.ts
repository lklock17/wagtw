import { Router } from 'express';
import * as templateController from '../controllers/template.controller';

const router = Router();

router.get('/', templateController.getTemplates);
router.post('/', templateController.createTemplate);
router.delete('/:id', templateController.deleteTemplate);

export default router;
