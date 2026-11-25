import { PrismaClient } from '@prisma/client';
import { io } from '../index.js';

const prisma = new PrismaClient();

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * GET /api/bookings
 * List all bookings with guest, room, itemized POS charges, and police declaration status
 */
export async function getAllBookings(req, res) {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        room: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        charges: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/bookings
 * Smart Reservation (Online) & Walk-in Booking using current AI Yield Rate
 */
export async function createSmartBooking(req, res) {
  try {
    const {
      roomId,
      roomNumber,
      checkIn,
      checkOut,
      guestName,
      guestPhone = '',
      guestIdNumber = '',
      guestNationality = 'Việt Nam',
      bookingSource = 'ONLINE',
      isVip = false,
      paymentMethod = 'VIETQR',
      autoSyncPolice = false,
    } = req.body;

    if (!guestName || (!roomId && !roomNumber)) {
      return res.status(400).json({ success: false, message: 'Guest name and room selection are required.' });
    }

    const room = roomId
      ? await prisma.room.findUnique({ where: { id: roomId } })
      : await prisma.room.findUnique({ where: { number: String(roomNumber) } });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Selected room not found.' });
    }

    const guestUser = await prisma.user.findFirst({ where: { role: 'GUEST' } });
    if (!guestUser) {
      return res.status(400).json({ success: false, message: 'No default guest user found.' });
    }

    const checkInDate = checkIn ? new Date(checkIn) : new Date();
    const checkOutDate = checkOut ? new Date(checkOut) : new Date(checkInDate.getTime() + 2 * 86400000);
    const diffMs = checkOutDate.getTime() - checkInDate.getTime();
    const nights = Math.max(1, Math.ceil(diffMs / 86400000));

    // Calculate total using current live AI Yield pricePerNight
    const totalAmount = Math.round(Number(room.pricePerNight || 0) * nights);
    const digitalKey = `NEX-KEY-${room.number}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const policeCode =
      autoSyncPolice && guestIdNumber
        ? `C06-VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
        : null;

    const booking = await prisma.booking.create({
      data: {
        userId: guestUser.id,
        roomId: room.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalAmount,
        paymentStatus: 'PENDING',
        paymentMethod,
        bookingSource,
        digitalKey,
        guestName: String(guestName).trim(),
        guestPhone: String(guestPhone || '').trim(),
        guestIdNumber: guestIdNumber ? String(guestIdNumber).trim() : null,
        guestNationality,
        policeSyncStatus: policeCode ? 'SYNCED' : 'PENDING',
        policeDeclarationId: policeCode,
        isVip: Boolean(isVip),
      },
      include: {
        room: true,
        user: true,
        charges: true,
      },
    });

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: { status: 'OCCUPIED' },
    });

    if (io) {
      io.emit('room:status_updated', {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        status: 'OCCUPIED',
        room: updatedRoom,
      });
      io.emit('booking:created', { booking });
      io.emit('reception:notification', {
        id: `BOOK-${Date.now()}`,
        roomNumber: room.number,
        type: 'NEW_BOOKING',
        message: `🛎️ ${bookingSource === 'WALK_IN' ? 'Walk-in Tại Quầy' : 'Đặt Phòng Online'}: ${guestName} ➜ P.${room.number} (${nights} đêm • $${totalAmount})`,
        timestamp: new Date().toISOString(),
        priority: isVip ? 'VIP' : 'HIGH',
      });
    }

    return res.status(201).json({
      success: true,
      booking,
      nights,
      digitalKey,
    });
  } catch (error) {
    console.error('❌ Create Smart Booking Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/bookings/:id/charges
 * Room Service & Mini-Bar POS order: creates FolioCharge, increments totalAmount, alerts Reception
 */
export async function addFolioCharge(req, res) {
  try {
    const { id } = req.params;
    const { itemName, category = 'MINIBAR', quantity = 1, unitPrice } = req.body;

    if (!itemName || !unitPrice) {
      return res.status(400).json({ success: false, message: 'itemName and unitPrice are required.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { room: true, user: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const qty = Math.max(1, Number(quantity) || 1);
    const price = Math.max(0, Number(unitPrice) || 0);
    const lineTotal = +(qty * price).toFixed(2);

    const charge = await prisma.folioCharge.create({
      data: {
        bookingId: booking.id,
        itemName: String(itemName),
        category: String(category),
        quantity: qty,
        unitPrice: price,
        totalPrice: lineTotal,
      },
    });

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        totalAmount: +(Number(booking.totalAmount || 0) + lineTotal).toFixed(2),
        paymentStatus: 'PENDING', // Re-open balance when new POS charges are added
      },
      include: {
        room: true,
        user: true,
        charges: { orderBy: { createdAt: 'desc' } },
      },
    });

    await prisma.serviceRequest.create({
      data: {
        userId: booking.userId,
        roomId: booking.roomId,
        type: 'ROOM_SERVICE',
        description: `POS Order: ${itemName} x${qty} ($${lineTotal})`,
        status: 'PENDING',
        priority: booking.isVip ? 'VIP' : 'HIGH',
      },
    });

    const roomNo = booking.room?.number || 'N/A';

    if (io) {
      io.emit('folio:updated', {
        bookingId: updatedBooking.id,
        roomNumber: roomNo,
        charge,
        totalAmount: updatedBooking.totalAmount,
      });
      io.emit('reception:notification', {
        id: `POS-${Date.now()}`,
        roomNumber: roomNo,
        type: 'ROOM_SERVICE',
        message: `🍾 POS Phòng ${roomNo}: Đặt ${itemName} x${qty} (+$${lineTotal}) • Tổng bill mới: $${updatedBooking.totalAmount}`,
        timestamp: new Date().toISOString(),
        priority: 'VIP',
      });
    }

    return res.status(201).json({
      success: true,
      charge,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('❌ Add Folio Charge Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/bookings/express-checkin
 * Persists OCR-scanned guest & CCCD/Passport info, creates Booking, marks Room OCCUPIED
 */
export async function createExpressCheckIn(req, res) {
  try {
    const {
      fullName,
      dob,
      idNumber,
      address,
      nationality = 'Việt Nam',
      roomNumber = '301',
      nights = 2,
      isVip = true,
      autoSyncPolice = true,
      paymentMethod = 'VIETQR',
    } = req.body;

    if (!fullName || !idNumber) {
      return res.status(400).json({ success: false, message: 'Full name and ID/CCCD number are required.' });
    }

    const safeNights = Math.max(1, Math.min(365, Number(nights) || 1));

    const room = await prisma.room.findUnique({ where: { number: String(roomNumber) } });
    if (!room) {
      return res.status(404).json({ success: false, message: `Room ${roomNumber} not found.` });
    }

    const guestUser = await prisma.user.findFirst({ where: { role: 'GUEST' } });
    if (!guestUser) {
      return res.status(400).json({ success: false, message: 'No guest profile available.' });
    }

    const checkIn = new Date();
    const checkOut = new Date(checkIn.getTime() + safeNights * 86400000);
    const totalAmount = Math.round(Number(room.pricePerNight || 0) * safeNights);
    const digitalKey = `NEX-KEY-${room.number}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const policeCode = autoSyncPolice
      ? `C06-VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
      : null;

    const booking = await prisma.booking.create({
      data: {
        userId: guestUser.id,
        roomId: room.id,
        checkIn,
        checkOut,
        totalAmount,
        paymentStatus: 'PENDING',
        paymentMethod,
        bookingSource: 'OCR_EXPRESS',
        digitalKey,
        guestName: String(fullName).trim(),
        guestIdNumber: String(idNumber).trim(),
        guestDob: dob ? String(dob) : '',
        guestAddress: address ? String(address) : '',
        guestNationality: nationality || 'Việt Nam',
        policeSyncStatus: autoSyncPolice ? 'SYNCED' : 'PENDING',
        policeDeclarationId: policeCode,
        isVip: Boolean(isVip),
      },
      include: { room: true, user: true, charges: true },
    });

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: { status: 'OCCUPIED' },
    });

    if (io) {
      io.emit('room:status_updated', {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        status: 'OCCUPIED',
        room: updatedRoom,
      });
      io.emit('booking:created', { booking });
      io.emit('reception:notification', {
        id: `CHECKIN-${Date.now()}`,
        roomNumber: room.number,
        type: 'EXPRESS_CHECKIN',
        message: `✨ Check-in AI hoàn tất: ${fullName} ➜ Phòng ${room.number}${autoSyncPolice ? ' (Đã đồng bộ Khai báo lưu trú C06)' : ''}`,
        timestamp: new Date().toISOString(),
        priority: isVip ? 'VIP' : 'NORMAL',
      });
    }

    return res.status(201).json({
      success: true,
      booking,
      digitalKey,
      policeDeclarationId: policeCode,
    });
  } catch (error) {
    console.error('❌ Express Check-In Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/bookings/:id/sync-police
 */
export async function syncPoliceDeclaration(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { room: true, user: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const declarationCode = `C06-VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        policeSyncStatus: 'SYNCED',
        policeDeclarationId: declarationCode,
      },
      include: { room: true, user: true, charges: true },
    });

    if (io) {
      io.emit('reception:notification', {
        id: `C06-${Date.now()}`,
        roomNumber: existing.room?.number || 'N/A',
        type: 'COMPLIANCE',
        message: `🛡️ Đã đồng bộ Khai báo lưu trú C06 cho Phòng ${existing.room?.number || 'N/A'} (Mã: ${declarationCode})`,
        timestamp: new Date().toISOString(),
        priority: 'NORMAL',
      });
    }

    return res.status(200).json({
      success: true,
      declarationCode,
      booking: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/bookings/:id/police-xml
 */
export async function exportPoliceXml(req, res) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { room: true, user: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const name = escapeXml(booking.guestName || booking.user?.name || 'Guest');
    const idNo = escapeXml(booking.guestIdNumber || '079095001234');
    const roomNo = escapeXml(booking.room?.number || '000');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<KHAI_BAO_LUU_TRU>
  <CO_SO_LUU_TRU>
    <TEN_CO_SO>NEXSTAY LUXURY SMART HOTEL</TEN_CO_SO>
    <MA_CO_SO>HCM-Q1-NEXSTAY-2026</MA_CO_SO>
    <MA_HO_SO>${escapeXml(booking.policeDeclarationId || 'PENDING')}</MA_HO_SO>
  </CO_SO_LUU_TRU>
  <KHACH_LUU_TRU>
    <HO_TEN>${name}</HO_TEN>
    <SO_CCCD_HO_CHIEU>${idNo}</SO_CCCD_HO_CHIEU>
    <NGAY_SINH>${escapeXml(booking.guestDob || '1994-01-01')}</NGAY_SINH>
    <QUOC_TICH>${escapeXml(booking.guestNationality || 'Việt Nam')}</QUOC_TICH>
    <DIA_CHI_THUONG_TRU>${escapeXml(booking.guestAddress || 'TP. Hồ Chí Minh, Việt Nam')}</DIA_CHI_THUONG_TRU>
    <SO_PHONG>${roomNo}</SO_PHONG>
    <NGAY_DEN>${booking.checkIn.toISOString()}</NGAY_DEN>
    <NGAY_DI_DU_KIEN>${booking.checkOut.toISOString()}</NGAY_DI_DU_KIEN>
  </KHACH_LUU_TRU>
</KHAI_BAO_LUU_TRU>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="KhaiBaoLuuTru_${roomNo}_${idNo}.xml"`);
    return res.send(xml);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/bookings/:id/simulate-vietqr
 */
export async function simulateVietQRSuccess(req, res) {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { room: true, user: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: 'COMPLETED',
        paymentMethod: 'VIETQR',
      },
      include: { room: true, user: true, charges: true },
    });

    const totalAmt = Number(updated.totalAmount || 0);
    const roomNo = updated.room?.number || 'N/A';

    if (io) {
      io.emit('payment:confirmed', {
        bookingId: updated.id,
        roomNumber: roomNo,
        amount: totalAmt,
        method: 'VIETQR',
      });
      io.emit('reception:notification', {
        id: `VIETQR-${Date.now()}`,
        roomNumber: roomNo,
        type: 'PAYMENT',
        message: `💸 VietQR Napas 24/7: Nhận thanh toán $${totalAmt} (${Math.round(totalAmt * 25400).toLocaleString('vi-VN')}₫) cho Phòng ${roomNo}!`,
        timestamp: new Date().toISOString(),
        priority: 'VIP',
      });
    }

    return res.status(200).json({ success: true, booking: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
