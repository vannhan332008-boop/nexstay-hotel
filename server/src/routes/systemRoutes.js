import express from 'express';
import { handleResetDemoData } from '../controllers/systemController.js';

const router = express.Router();

router.post('/reset-demo', handleResetDemoData);

export default router;
