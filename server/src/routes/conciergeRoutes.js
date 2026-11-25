import express from 'express';
import { handleConciergeChat, getConciergeHistory } from '../controllers/conciergeController.js';

const router = express.Router();

router.post('/concierge', handleConciergeChat);
router.get('/history', getConciergeHistory);

export default router;
