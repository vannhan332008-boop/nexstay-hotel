import prisma from '../lib/prisma.js';
import { io } from '../index.js';
import { chatWithConcierge } from '../services/ai.service.js';
import { getOrCreateGuestUser } from '../services/seedService.js';

/**
 * POST /api/chat/concierge
 * Bilingual AI Concierge "Nex" with Autonomous Service Dispatching
 */
export async function handleConciergeChat(req, res) {
  try {
    const { message, roomNumber = '302', language = 'vi', guestName = 'Quý khách' } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }

    const trimmedMsg = message.trim();
    const aiResult = await chatWithConcierge({ message: trimmedMsg, roomNumber, language, guestName });
    const safeReply =
      aiResult?.reply ||
      (language === 'vi'
        ? 'Dạ em đã ghi nhận yêu cầu của quý khách ạ.'
        : 'Your request has been logged.');

    let createdTicket = null;
    if (aiResult?.action && aiResult.action.type === 'SERVICE_REQUEST') {
      const room =
        (await prisma.room.findUnique({ where: { number: String(roomNumber) } })) ||
        (await prisma.room.findFirst({ orderBy: { number: 'asc' } }));
      const guestUser = await getOrCreateGuestUser();

      if (room && guestUser) {
        createdTicket = await prisma.serviceRequest.create({
          data: {
            userId: guestUser.id,
            roomId: room.id,
            type: aiResult.action.serviceType || 'ROOM_SERVICE',
            description: aiResult.action.description || trimmedMsg,
            status: 'PENDING',
            priority: 'VIP',
          },
        });

        if (io) {
          io.emit('reception:notification', {
            id: `AI-CONCIERGE-${Date.now()}`,
            roomNumber: room.number,
            type: createdTicket.type,
            message: `🤖 Nex AI vừa tiếp nhận từ Phòng ${room.number}: ${createdTicket.description}`,
            timestamp: new Date().toISOString(),
            priority: 'VIP',
          });
        }
      }
    }

    await prisma.conciergeLog.create({
      data: {
        roomNumber: String(roomNumber),
        query: trimmedMsg,
        reply: safeReply,
        actionTriggered: createdTicket ? `SERVICE_REQUEST:${createdTicket.type}` : 'CHAT_INFO',
        language: String(language || 'vi'),
      },
    });

    return res.status(200).json({
      success: true,
      reply: safeReply,
      action: aiResult?.action || { type: 'NONE' },
      ticket: createdTicket,
    });
  } catch (error) {
    console.error('❌ Concierge Chat Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/chat/history
 */
export async function getConciergeHistory(req, res) {
  try {
    const logs = await prisma.conciergeLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
