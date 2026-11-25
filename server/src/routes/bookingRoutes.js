import express from 'express';
import {
  getAllBookings,
  createSmartBooking,
  addFolioCharge,
  createExpressCheckIn,
  syncPoliceDeclaration,
  exportPoliceXml,
  simulateVietQRSuccess,
} from '../controllers/bookingController.js';

const router = express.Router();

router.get('/', getAllBookings);
router.post('/', createSmartBooking);
router.post('/:id/charges', addFolioCharge);
router.post('/express-checkin', createExpressCheckIn);
router.post('/:id/sync-police', syncPoliceDeclaration);
router.get('/:id/police-xml', exportPoliceXml);
router.post('/:id/simulate-vietqr', simulateVietQRSuccess);

export default router;
