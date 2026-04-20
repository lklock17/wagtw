import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as mediaController from '../controllers/media.controller';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.get('/', mediaController.getMedia);
router.post('/upload', upload.single('file'), mediaController.uploadMedia);
router.delete('/:id', mediaController.deleteMedia);

export default router;
