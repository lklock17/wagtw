import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes (Requires Login)
router.get('/me', authMiddleware, authController.getProfile);
router.post('/change-password', authMiddleware, authController.changePassword);
router.get('/users', authMiddleware, authController.listUsers);
router.post('/users', authMiddleware, authController.createUser);
router.delete('/users/:id', authMiddleware, authController.deleteUser);
router.patch('/users/:id/password', authMiddleware, authController.resetUserPassword);

export default router;
