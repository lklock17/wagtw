import { Router } from 'express';
import * as scheduleController from '../controllers/schedule.controller';

const router = Router();

router.get('/', scheduleController.getSchedules);
router.post('/', scheduleController.createSchedule);
router.delete('/:id', scheduleController.deleteSchedule);

export default router;
