import express from 'express';
import {
  getAllRooms,
  getHousekeepingQueue,
  updateRoomStatus,
  requestRoomCleaning,
  completeRoomCleaning,
} from '../controllers/roomController.js';

const router = express.Router();

router.get('/', getAllRooms);
router.get('/housekeeping/queue', getHousekeepingQueue);
router.patch('/:id/status', updateRoomStatus);
router.post('/:id/request-cleaning', requestRoomCleaning);
router.post('/:id/complete-cleaning', completeRoomCleaning);

export default router;
