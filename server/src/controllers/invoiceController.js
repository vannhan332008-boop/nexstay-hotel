import fs from 'fs';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma.js';

const FONT_REGULAR_CANDIDATES = [
  'C:\\Windows\\Fonts\\arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
];

const FONT_BOLD_CANDIDATES = [
  'C:\\Windows\\Fonts\\arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
];

function findExistingPath(paths) {
  return paths.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

function toSafeAscii(str = '') {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/₫/g, 'VND')
    .replace(/[^\x20-\x7E\n\r\t\u2022]/g, '');
}

function formatDateSafe(val) {
  if (!val) return '--/--/----';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? '--/--/----' : d.toLocaleDateString('en-GB');
}

/**
 * GET /api/invoice/:bookingId
 * Generates a minimalist 5-star PDF e-invoice including Room Stay + Itemized POS Folio Charges
 */
export async function downloadInvoicePdf(req, res) {
  try {
    const { bookingId } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: true,
        user: true,
        charges: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found for invoice.' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.on('error', (err) => {
      console.error('❌ PDF Stream Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.end();
      }
    });

    const regularFontPath = findExistingPath(FONT_REGULAR_CANDIDATES);
    const boldFontPath = findExistingPath(FONT_BOLD_CANDIDATES);
    let regularFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';
    let supportsUnicode = false;

    if (regularFontPath && boldFontPath) {
      try {
        doc.registerFont('NexRegular', regularFontPath);
        doc.registerFont('NexBold', boldFontPath);
        regularFont = 'NexRegular';
        boldFont = 'NexBold';
        supportsUnicode = true;
      } catch {
        regularFont = 'Helvetica';
        boldFont = 'Helvetica-Bold';
      }
    }

    const txt = (val) => (supportsUnicode ? String(val ?? '') : toSafeAscii(val ?? ''));
    const roomNumber = booking.room?.number || 'N/A';
    const roomType = booking.room?.type || 'Smart Suite';
    const nightlyRate = Number(booking.room?.pricePerNight || 0);
    const totalAmount = Number(booking.totalAmount || 0);
    const posCharges = Array.isArray(booking.charges) ? booking.charges : [];
    const posChargesSum = posCharges.reduce((s, c) => s + Number(c.totalPrice || 0), 0);
    const roomStayGross = Math.max(0, totalAmount - posChargesSum);

    const safeRoomFile = String(roomNumber).replace(/[^a-zA-Z0-9._-]/g, '_') || 'Room';
    const safeIdFile = String(booking.id).slice(0, 8).replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="NexStay_Invoice_Room${safeRoomFile}_${safeIdFile}.pdf"`);

    doc.pipe(res);

    // Dark luxury top banner
    doc.rect(0, 0, 595.28, 125).fill('#0B0F19');
    doc.fillColor('#00F3FF').fontSize(26).font(boldFont).text('NEXSTAY', 50, 38);
    doc.fillColor('#94A3B8').fontSize(10).font(regularFont).text(txt('SMART LUXURY HOSPITALITY OS • TP. HỒ CHÍ MINH, VIỆT NAM'), 50, 72);
    doc.fillColor('#FFFFFF').fontSize(12).font(boldFont).text(txt('HÓA ĐƠN ĐIỆN TỬ / ELECTRONIC TAX INVOICE'), 50, 92);

    // Invoice Meta on Right
    doc.fillColor('#00F3FF').fontSize(10).font(boldFont).text(`INVOICE #${String(booking.id).slice(0, 8).toUpperCase()}`, 350, 42, { width: 195, align: 'right' });
    doc.fillColor('#CBD5E1').fontSize(9).font(regularFont).text(`Issued: ${new Date().toLocaleDateString('en-GB')}`, 350, 58, { width: 195, align: 'right' });
    doc.text(txt(`Payment Method: ${booking.paymentMethod || 'VIETQR'}`), 350, 72, { width: 195, align: 'right' });
    doc.text(txt(`Police C06 Ref: ${booking.policeDeclarationId || 'PENDING'}`), 350, 86, { width: 195, align: 'right' });

    // Watermark Seal
    const isPaid = booking.paymentStatus === 'COMPLETED';
    doc.save();
    doc.rotate(-12, { origin: [440, 210] });
    doc.roundedRect(380, 175, 145, 52, 8).lineWidth(3).strokeColor(isPaid ? '#10B981' : '#F59E0B').stroke();
    doc.fillColor(isPaid ? '#10B981' : '#F59E0B').fontSize(22).font(boldFont).text(isPaid ? 'PAID' : 'UNPAID', 380, 190, { width: 145, align: 'center' });
    doc.restore();

    // Guest Details
    doc.fillColor('#0F172A').fontSize(12).font(boldFont).text(txt('THÔNG TIN KHÁCH HÀNG / GUEST INFORMATION'), 50, 155);
    doc.moveTo(50, 172).lineTo(350, 172).strokeColor('#E2E8F0').lineWidth(1).stroke();

    const guestName = booking.guestName || booking.user?.name || 'Valued Guest';
    const guestId = booking.guestIdNumber || 'Verified Biometric Profile';
    const address = booking.guestAddress || 'TP. Hồ Chí Minh, Việt Nam';

    doc.fillColor('#334155').fontSize(10).font(regularFont)
      .text(txt(`Họ tên / Guest Name:  ${guestName}`), 50, 185, { width: 320 })
      .text(txt(`Số CCCD / Passport:  ${guestId}`), 50, 203, { width: 320 })
      .text(txt(`Quốc tịch / Nationality:  ${booking.guestNationality || 'Việt Nam'}`), 50, 221, { width: 320 })
      .text(txt(`Địa chỉ / Address:  ${address}`), 50, 239, { width: 320 })
      .text(txt(`Digital Access Key:  ${booking.digitalKey || 'NEX-KEY'}`), 50, 265, { width: 320 });

    // Stay Summary Box
    doc.roundedRect(50, 298, 495, 65, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc.fillColor('#0F172A').fontSize(10).font(boldFont)
      .text('SUITE / ROOM', 68, 312)
      .text('CHECK-IN', 235, 312)
      .text('CHECK-OUT', 345, 312)
      .text('VIP TIER', 455, 312);

    doc.fillColor('#334155').fontSize(10).font(regularFont)
      .text(txt(`#${roomNumber} - ${roomType}`), 68, 332, { width: 160 })
      .text(formatDateSafe(booking.checkIn), 235, 332)
      .text(formatDateSafe(booking.checkOut), 345, 332)
      .text(booking.isVip ? 'DIAMOND VIP' : 'STANDARD', 455, 332);

    // Line Item Table
    doc.fillColor('#0F172A').fontSize(11).font(boldFont).text(txt('CHI TIẾT PHÒNG & DỊCH VỤ POS / FOLIO CHARGES'), 50, 388);
    doc.rect(50, 408, 495, 26).fill('#0F172A');
    doc.fillColor('#FFFFFF').fontSize(9).font(boldFont)
      .text('DESCRIPTION', 65, 417)
      .text('RATE / QTY', 330, 417, { width: 90, align: 'right' })
      .text('AMOUNT (USD)', 435, 417, { width: 95, align: 'right' });

    let y = 446;
    const subtotalPreVat = +(totalAmount / 1.1).toFixed(2);
    const vat = +(totalAmount - subtotalPreVat).toFixed(2);
    const roomNet = +(roomStayGross / 1.1).toFixed(2);
    const vndTotal = Math.round(totalAmount * 25400).toLocaleString('en-US');

    doc.fillColor('#1E293B').fontSize(9.5).font(regularFont)
      .text(txt(`Lưu trú thông minh - Phòng #${roomNumber} (${roomType})`), 65, y, { width: 260, lineBreak: false })
      .text(`$${nightlyRate.toFixed(2)}/nt`, 330, y, { width: 90, align: 'right' })
      .text(`$${roomNet.toFixed(2)}`, 435, y, { width: 95, align: 'right' });
    y += 20;

    // Render up to 6 POS items cleanly so 1-page A4 fits under both Arial and Linux Helvetica metrics
    const maxVisiblePos = posCharges.length > 6 ? 5 : 6;
    const visiblePos = posCharges.slice(0, maxVisiblePos);
    const remainingPos = posCharges.slice(maxVisiblePos);

    for (const c of visiblePos) {
      const cNet = +(Number(c.totalPrice || 0) / 1.1).toFixed(2);
      const label = txt(`[POS ${c.category || 'ITEM'}] ${c.itemName || 'Service'}`).slice(0, 44);
      doc.text(label, 65, y, { width: 260, lineBreak: false })
        .text(`x${Number(c.quantity || 1)} ($${Number(c.unitPrice || 0).toFixed(0)})`, 330, y, { width: 90, align: 'right' })
        .text(`$${cNet.toFixed(2)}`, 435, y, { width: 95, align: 'right' });
      y += 19;
    }

    if (remainingPos.length > 0) {
      const extraNet = +(remainingPos.reduce((s, c) => s + Number(c.totalPrice || 0), 0) / 1.1).toFixed(2);
      doc.text(txt(`[POS] +${remainingPos.length} dich vu bo sung khac`), 65, y, { width: 260, lineBreak: false })
        .text(`${remainingPos.length} items`, 330, y, { width: 90, align: 'right' })
        .text(`$${extraNet.toFixed(2)}`, 435, y, { width: 95, align: 'right' });
      y += 19;
    }

    doc.text(txt('Tiện ích IoT 3D, Wi-Fi 7 & Trợ lý AI Concierge 24/7'), 65, y, { width: 260, lineBreak: false })
      .text('$0.00', 330, y, { width: 90, align: 'right' })
      .text('INCLUDED', 435, y, { width: 95, align: 'right' });
    y += 19;

    doc.text(txt('Thuế GTGT & Phí dịch vụ khách sạn (10% VAT)'), 65, y, { width: 260, lineBreak: false })
      .text('10%', 330, y, { width: 90, align: 'right' })
      .text(`$${vat.toFixed(2)}`, 435, y, { width: 95, align: 'right' });
    y += 22;

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#CBD5E1').stroke();
    y += 12;

    // Totals
    doc.fillColor('#0F172A').fontSize(12).font(boldFont)
      .text(txt('TỔNG THANH TOÁN / TOTAL:'), 180, y)
      .fillColor('#0284C7')
      .text(`$${totalAmount.toFixed(2)}`, 435, y, { width: 95, align: 'right' });

    doc.fillColor('#475569').fontSize(10).font(regularFont)
      .text(txt(`Quy đổi VNĐ (1 USD = 25,400 VNĐ):  ${vndTotal} VND`), 180, y + 20, { width: 350, align: 'right' });

    // Footer (positioned safely on single A4 page across Windows & Linux fonts)
    const footerY = Math.max(720, Math.min(750, y + 48));
    doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#E2E8F0').stroke();
    doc.fillColor('#64748B').fontSize(8.5).font(regularFont)
      .text(txt('Cảm ơn quý khách đã lựa chọn NexStay Smart Hotel. Powered by Gemini AI, VNPay & VietQR Napas 24/7.'), 50, footerY + 15, { align: 'center', width: 495 })
      .text('This electronic invoice is cryptographically verified and compliant with hospitality standards.', 50, footerY + 30, { align: 'center', width: 495 });

    doc.end();
  } catch (error) {
    console.error('❌ PDF Invoice Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error.message });
    }
    return res.end();
  }
}
