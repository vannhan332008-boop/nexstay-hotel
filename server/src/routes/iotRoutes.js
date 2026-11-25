import express from 'express';
import { updateIoTControl, processVoiceIoT, getIoTLogs } from '../controllers/iotController.js';

const router = express.Router();

router.post('/control', updateIoTControl);
router.post('/voice', processVoiceIoT);
router.get('/logs', getIoTLogs);

export default router;
