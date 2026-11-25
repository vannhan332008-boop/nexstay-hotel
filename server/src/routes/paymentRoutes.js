import express from 'express';
import { createPaymentUrl, vnpayReturn } from '../controllers/paymentController.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Route: POST /api/payment/create_url
router.post('/create_url', createPaymentUrl);

// Route: GET /api/payment/vnpay_return
router.get('/vnpay_return', vnpayReturn);

// Route: GET /api/payment/status/:bookingId (Helper to inspect status)
router.get('/status/:bookingId', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: { room: true, user: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    return res.status(200).json({
      success: true,
      booking: {
        id: booking.id,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        totalAmount: booking.totalAmount,
        roomNumber: booking.room?.number || 'N/A',
        roomType: booking.room?.type || 'Smart Suite',
        guestName: booking.guestName || booking.user?.name || 'Guest',
        digitalKey: booking.digitalKey,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
