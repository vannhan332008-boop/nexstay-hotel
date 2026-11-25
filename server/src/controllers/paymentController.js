import { PrismaClient } from '@prisma/client';
import { createVNPayPaymentUrl, verifyVNPayReturn } from '../services/payment.service.js';
import { io } from '../index.js';

const prisma = new PrismaClient();

/**
 * Controller: Generate VNPay payment checkout URL
 * Route: POST /api/payment/create_url
 */
export async function createPaymentUrl(req, res) {
  try {
    const { bookingId, amount, bankCode, orderInfo, locale } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId is required.',
      });
    }

    let payableAmount = Number(amount || 0);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true, user: true },
    });

    if (booking) {
      if (!payableAmount || payableAmount <= 0) {
        payableAmount = Number(booking.totalAmount || 0);
      }
    } else if (!payableAmount || payableAmount <= 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found and no valid payment amount was specified.',
      });
    }

    if (payableAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than zero.',
      });
    }

    const rawIp =
      req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const ipAddr = String(rawIp).split(',')[0].trim();

    const paymentUrl = createVNPayPaymentUrl({
      bookingId,
      amount: payableAmount,
      bankCode: bankCode || '',
      orderInfo: orderInfo || `NexStay Booking #${booking?.room?.number ? `Room ${booking.room.number}` : bookingId.slice(0, 8)}`,
      ipAddr,
      locale: locale || 'vn',
    });

    return res.status(200).json({
      success: true,
      message: 'VNPay payment redirect URL generated successfully.',
      paymentUrl,
      bookingId,
      amount: payableAmount,
    });
  } catch (error) {
    console.error('❌ Error creating VNPay payment URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate VNPay checkout session.',
      error: error.message,
    });
  }
}

/**
 * Controller: Handle VNPay return callback webhook
 * Route: GET /api/payment/vnpay_return
 */
export async function vnpayReturn(req, res) {
  try {
    const verification = verifyVNPayReturn(req.query);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (verification.isSuccess) {
      const existingBooking = await prisma.booking.findUnique({
        where: { id: verification.bookingId },
        include: { room: true },
      });

      if (existingBooking) {
        await prisma.booking.update({
          where: { id: verification.bookingId },
          data: {
            paymentStatus: 'COMPLETED',
            paymentMethod: 'VNPAY',
          },
        });

        await prisma.room.update({
          where: { id: existingBooking.roomId },
          data: { status: 'OCCUPIED' },
        });

        if (io) {
          io.emit('payment:confirmed', {
            bookingId: existingBooking.id,
            roomNumber: existingBooking.room?.number,
            amount: existingBooking.totalAmount,
            method: 'VNPAY',
          });
          io.emit('room:status_updated', {
            roomId: existingBooking.roomId,
            roomNumber: existingBooking.room?.number,
            status: 'OCCUPIED',
          });
        }
      }

      const redirectUrl = new URL(`${frontendUrl}/payment/success`);
      redirectUrl.searchParams.set('bookingId', verification.bookingId || '');
      redirectUrl.searchParams.set('transactionNo', verification.transactionNo || '');
      redirectUrl.searchParams.set('bankCode', verification.bankCode || '');
      redirectUrl.searchParams.set('amount', verification.amount.toString());

      return res.redirect(redirectUrl.toString());
    } else {
      if (verification.bookingId) {
        await prisma.booking.update({
          where: { id: verification.bookingId },
          data: { paymentStatus: 'FAILED' },
        }).catch(() => {});
      }

      const redirectUrl = new URL(`${frontendUrl}/payment/failed`);
      redirectUrl.searchParams.set('bookingId', verification.bookingId || '');
      redirectUrl.searchParams.set('code', verification.responseCode || '99');
      redirectUrl.searchParams.set(
        'reason',
        verification.isValid ? 'Transaction canceled or declined by user/bank' : 'Data signature mismatch'
      );

      return res.redirect(redirectUrl.toString());
    }
  } catch (error) {
    console.error('❌ VNPay Return Webhook Error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/payment/failed?error=${encodeURIComponent(error.message)}`);
  }
}

export default {
  createPaymentUrl,
  vnpayReturn,
};
