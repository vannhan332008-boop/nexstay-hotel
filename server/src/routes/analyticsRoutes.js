import express from 'express';
import { getAnalyticsSummary, applyDynamicYield } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/summary', getAnalyticsSummary);
router.post('/apply-yield', applyDynamicYield);

export default router;
