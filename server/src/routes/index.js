import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import documentsRoutes from './documents.routes.js';
import chatRoutes from './chat.routes.js';
import publicRoutes from './public.routes.js';
import conversationsRoutes from './conversations.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/documents', documentsRoutes);
router.use('/public', publicRoutes);
router.use('/chat', chatRoutes);
router.use('/conversations', conversationsRoutes);

export default router;
