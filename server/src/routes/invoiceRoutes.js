import express from 'express';
import { downloadInvoicePdf } from '../controllers/invoiceController.js';

const router = express.Router();

router.get('/:bookingId', downloadInvoicePdf);

export default router;
