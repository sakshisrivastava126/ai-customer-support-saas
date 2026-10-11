import { Router } from 'express';
import { isDbConnected } from '../config/db.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ status: 'ok', db: isDbConnected() ? 'up' : 'down' });
});

export default router;
