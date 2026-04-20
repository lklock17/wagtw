import { Router } from 'express';
import * as bulkController from '../controllers/bulk.controller';

const router = Router();

router.post('/', bulkController.createBulkJob);
router.get('/', bulkController.getBulkJobs);
router.get('/:id', bulkController.getBulkJobStatus);

export default router;
