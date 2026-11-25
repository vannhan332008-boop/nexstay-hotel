import prisma from '../lib/prisma.js';
import { createVNPayPaymentUrl, verifyVNPayReturn } from '../services/payment.service.js';
import { io } from '../index.js';

const isProductionEnv = () =>
  process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

function getFrontendBaseUrl() {
  const prod = isProductionEnv();
  const raw = String(process.env.FRONTEND_URL || '')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
  if (raw && !(prod && raw.includes('localhost'))) {
    return raw;
  }
  return prod
    ? 'https://nexstay-hotel-pvsw.vercel.app'
    : 'http://localhost:5173';
}

function getDynamicReturnUrl(req) {
  const prod = isProductionEnv();
  const envReturn = String(process.env.VNP_RETURN_URL || '').trim();
  if (envReturn && !(prod && envReturn.includes('localhost'))) {
    return envReturn;
  }
  const host = req.get('host');
  if (host) {
    return `${req.protocol}://${host}/api/payment/vnpay_return`;
  }
  return prod
    ? 'https://nexstay-hotel-nuxh.onrender.com/api/payment/vnpay_return'
    : 'http://localhost:5000/api/payment/vnpay_return';
}

/**
 * Controller: Generate VNPay payment checkout URL
 * Route: POST /api/payment/create_url
 */
export async function createPaymentUrl(req, res) {
  try {
    const { bookingId, amount, bankCode, orderInfo, locale } = req.body || {};

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId is required.',
      });
    }

    let payableAmount = Number(amount || 0);
    const booking = await prisma.booking.findUnique({
      where: { id: String(bookingId) },
      include: { room: true, user: true },
    });

    if (booking) {
      // Authoritatively use persisted booking folio amount rather than trusting client-supplied amount
      payableAmount = Number(booking.totalAmount || 0);
    } else if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found and no valid payment amount was specified.',
      });
    }

    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
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
      bookingId: String(bookingId),
      amount: payableAmount,
      currency: booking ? 'USD' : undefined,
      bankCode: bankCode || '',
      orderInfo: orderInfo || `NexStay Booking #${booking?.room?.number ? `Room ${booking.room.number}` : String(bookingId).slice(0, 8)}`,
      ipAddr,
      locale: locale || 'vn',
      returnUrl: getDynamicReturnUrl(req),
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
  const frontendUrl = getFrontendBaseUrl();
  try {
    const verification = verifyVNPayReturn(req.query);

    if (verification.isSuccess) {
      const existingBooking = verification.bookingId
        ? await prisma.booking.findUnique({
            where: { id: verification.bookingId },
            include: { room: true },
          })
        : null;

      if (existingBooking && existingBooking.paymentStatus !== 'COMPLETED') {
        await prisma.$transaction([
          prisma.booking.update({
            where: { id: existingBooking.id },
            data: {
              paymentStatus: 'COMPLETED',
              paymentMethod: 'VNPAY',
            },
          }),
          prisma.room.update({
            where: { id: existingBooking.roomId },
            data: { status: 'OCCUPIED' },
          }),
        ]);

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
      redirectUrl.searchParams.set('amount', String(verification.amount || 0));

      return res.redirect(redirectUrl.toString());
    }

    // Only transition booking to FAILED if the cryptographic signature is valid and it wasn't already COMPLETED
    if (verification.isValid && verification.bookingId) {
      const existing = await prisma.booking.findUnique({
        where: { id: verification.bookingId },
        select: { id: true, paymentStatus: true },
      });
      if (existing && existing.paymentStatus !== 'COMPLETED') {
        await prisma.booking.update({
          where: { id: existing.id },
          data: { paymentStatus: 'FAILED' },
        }).catch(() => {});
      }
    }

    const redirectUrl = new URL(`${frontendUrl}/payment/failed`);
    redirectUrl.searchParams.set('bookingId', verification.bookingId || '');
    redirectUrl.searchParams.set('code', verification.responseCode || '99');
    redirectUrl.searchParams.set(
      'reason',
      verification.isValid ? 'Transaction canceled or declined by user/bank' : 'Data signature mismatch'
    );

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('❌ VNPay Return Webhook Error:', error);
    return res.redirect(`${frontendUrl}/payment/failed?reason=${encodeURIComponent(error.message || 'Payment verification error')}`);
  }
}

export default {
  createPaymentUrl,
  vnpayReturn,
};
