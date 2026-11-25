import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import qs from 'qs';
import { sortObject } from './src/services/payment.service.js';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Testing VNPay Payment Flow ---');

  // 1. Fetch or create a test booking
  let booking = await prisma.booking.findFirst({
    where: { paymentStatus: 'PENDING' },
    include: { room: true },
  });

  if (!booking) {
    const user = await prisma.user.findFirst();
    const room = await prisma.room.findFirst({ where: { status: 'AVAILABLE' } });
    booking = await prisma.booking.create({
      data: {
        userId: user.id,
        roomId: room.id,
        checkIn: new Date(),
        checkOut: new Date(Date.now() + 86400000 * 2),
        totalAmount: 390.0,
        paymentStatus: 'PENDING',
        digitalKey: `NX-TEST-${Date.now()}`,
      },
      include: { room: true },
    });
    console.log(`Created new PENDING test booking: ${booking.id} ($${booking.totalAmount})`);
  } else {
    console.log(`Found existing PENDING booking: ${booking.id} ($${booking.totalAmount})`);
  }

  // 2. Test create_url endpoint
  const res = await fetch('http://localhost:5000/api/payment/create_url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId: booking.id,
      amount: booking.totalAmount,
      bankCode: 'NCB',
    }),
  });

  const data = await res.json();
  console.log('Payment URL Response:', data);

  if (!data.paymentUrl) {
    throw new Error('Failed to generate paymentUrl');
  }

  const url = new URL(data.paymentUrl);
  console.log('Generated Host:', url.host);
  console.log('vnp_TxnRef:', url.searchParams.get('vnp_TxnRef'));
  console.log('vnp_Amount:', url.searchParams.get('vnp_Amount'));
  console.log('vnp_SecureHash exists:', !!url.searchParams.get('vnp_SecureHash'));

  // 3. Test verification / webhook simulation
  const secretKey = 'RAOANNFADDQXRIWAAXGQUXSXFCUQNODZ';
  const returnParams = {
    vnp_Amount: url.searchParams.get('vnp_Amount'),
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP14298192',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: url.searchParams.get('vnp_OrderInfo'),
    vnp_PayDate: '20261117223000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: '2QXUI4J4',
    vnp_TransactionNo: '14298192',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: booking.id,
  };

  const sortedReturn = sortObject(returnParams);
  const signData = qs.stringify(sortedReturn, { encode: false });
  const hmac = crypto.createHmac('sha512', secretKey);
  const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  sortedReturn.vnp_SecureHash = secureHash;

  const returnUrl = `http://localhost:5000/api/payment/vnpay_return?${qs.stringify(sortedReturn, { encode: false })}`;
  console.log('\n--- Simulating VNPay Return Webhook ---');
  
  // Call webhook (do not follow redirects so we can inspect status 302)
  const webhookRes = await fetch(returnUrl, { redirect: 'manual' });
  console.log('Webhook Response Status:', webhookRes.status);
  console.log('Redirect Location:', webhookRes.headers.get('location'));

  // 4. Verify Database update
  const updatedBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
  });
  console.log('Updated Booking Payment Status in DB:', updatedBooking.paymentStatus);

  await prisma.$disconnect();
}

run().catch(console.error);
