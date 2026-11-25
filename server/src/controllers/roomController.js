import prisma from '../lib/prisma.js';
import { io } from '../index.js';
import { getOrCreateGuestUser } from '../services/seedService.js';

const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];

/**
 * Helper: Build prioritized housekeeping queue across all CLEANING rooms & open cleaning tickets
 */
export async function computeHousekeepingQueue() {
  const [rooms, serviceRequests] = await Promise.all([
    prisma.room.findMany({ orderBy: { number: 'asc' } }),
    prisma.serviceRequest.findMany({
      where: {
        status: { not: 'COMPLETED' },
        type: { in: ['CLEANING', 'TOWELS'] },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return rooms
    .filter((r) => r.status === 'CLEANING' || serviceRequests.some((sr) => sr.roomId === r.id))
    .map((r) => {
      const roomTickets = serviceRequests.filter((sr) => sr.roomId === r.id);
      const hasVip = roomTickets.some((t) => t.priority === 'VIP') || r.floor >= 3;
      const score = (r.status === 'CLEANING' ? 50 : 30) + (hasVip ? 35 : 10) + r.floor * 5;
      return {
        roomId: r.id,
        roomNumber: r.number,
        roomType: r.type,
        floor: r.floor,
        roomStatus: r.status,
        priorityScore: Math.min(99, score),
        tier: hasVip ? 'VIP URGENT' : 'HIGH',
        taskStatus: roomTickets[0]?.status || 'PENDING',
        reason:
          roomTickets[0]?.description ||
          (r.status === 'CLEANING' ? 'Dọn vệ sinh & khử khuẩn bàn giao phòng' : 'Chăm sóc buồng phòng theo yêu cầu'),
        estimatedMinutes: r.floor >= 3 ? 25 : 15,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * GET /api/rooms
 */
export async function getAllRooms(req, res) {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { number: 'asc' },
      include: {
        bookings: {
          where: {
            paymentStatus: { in: ['PENDING', 'COMPLETED'] },
          },
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    console.error('❌ Error fetching rooms:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve room matrix.', error: error.message });
  }
}

/**
 * GET /api/rooms/housekeeping/queue
 */
export async function getHousekeepingQueue(req, res) {
  try {
    const queue = await computeHousekeepingQueue();
    return res.status(200).json({ success: true, data: queue });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PATCH /api/rooms/:id/status
 * Automatically spawns prioritized Housekeeping task when dragged to CLEANING,
 * and marks cleaning tasks COMPLETED when moved to AVAILABLE.
 */
export async function updateRoomStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid room status. Allowed values: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const existingRoom = await prisma.room.findUnique({ where: { id } });
    if (!existingRoom) {
      return res.status(404).json({ success: false, message: `Room with ID ${id} not found.` });
    }

    const previousStatus = existingRoom.status;

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: { status },
      include: {
        bookings: {
          where: { paymentStatus: { in: ['PENDING', 'COMPLETED'] } },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Auto-create prioritized cleaning ticket when dragged to CLEANING
    if (status === 'CLEANING') {
      const openTicket = await prisma.serviceRequest.findFirst({
        where: { roomId: id, type: 'CLEANING', status: { not: 'COMPLETED' } },
      });
      if (!openTicket) {
        const guestUser = await getOrCreateGuestUser();
        if (guestUser) {
          await prisma.serviceRequest.create({
            data: {
              userId: guestUser.id,
              roomId: id,
              type: 'CLEANING',
              description: `Lễ tân điều phối dọn Phòng ${updatedRoom.number} (${updatedRoom.type})`,
              status: 'PENDING',
              priority: updatedRoom.floor >= 3 ? 'VIP' : 'HIGH',
            },
          });
        }
      }
    } else if (status === 'AVAILABLE') {
      // Complete open cleaning tasks when marked AVAILABLE
      await prisma.serviceRequest.updateMany({
        where: { roomId: id, type: { in: ['CLEANING', 'TOWELS'] }, status: { not: 'COMPLETED' } },
        data: { status: 'COMPLETED' },
      });
    }

    if (io) {
      io.emit('room:status_updated', {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        previousStatus,
        status: updatedRoom.status,
        updatedAt: updatedRoom.updatedAt,
        room: updatedRoom,
      });

      io.emit('housekeeping:updated', { roomId: updatedRoom.id, status: updatedRoom.status });

      if (status === 'CLEANING') {
        io.emit('reception:notification', {
          id: `NOTIF-CLEAN-${Date.now()}`,
          roomNumber: updatedRoom.number,
          type: 'CLEANING',
          message: `🧹 Phòng ${updatedRoom.number} đã vào hàng đợi Buồng phòng (Ưu tiên ${updatedRoom.floor >= 3 ? 'VIP' : 'HIGH'}).`,
          timestamp: new Date().toISOString(),
          priority: updatedRoom.floor >= 3 ? 'VIP' : 'HIGH',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Room ${updatedRoom.number} status updated to ${status}.`,
      data: updatedRoom,
    });
  } catch (error) {
    console.error('❌ Error updating room status:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/rooms/:id/request-cleaning
 * Guest taps "Yêu cầu dọn phòng" inside 3D Room Portal
 */
export async function requestRoomCleaning(req, res) {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const guestUser = await getOrCreateGuestUser();
    const updatedRoom = await prisma.room.update({
      where: { id },
      data: { status: 'CLEANING' },
    });

    if (guestUser) {
      await prisma.serviceRequest.create({
        data: {
          userId: guestUser.id,
          roomId: id,
          type: 'CLEANING',
          description: `Khách tại Phòng ${room.number} vừa bấm "Yêu cầu dọn phòng" từ Smart Room 3D.`,
          status: 'PENDING',
          priority: 'VIP',
        },
      });
    }

    if (io) {
      io.emit('room:status_updated', {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        status: 'CLEANING',
        room: updatedRoom,
      });
      io.emit('housekeeping:updated', { roomId: updatedRoom.id, status: 'CLEANING' });
      io.emit('reception:notification', {
        id: `GUEST-CLEAN-${Date.now()}`,
        roomNumber: room.number,
        type: 'CLEANING',
        message: `🧹 Khách Phòng ${room.number} yêu cầu dọn phòng ngay! (Đã xếp ưu tiên VIP)`,
        timestamp: new Date().toISOString(),
        priority: 'VIP',
      });
    }

    return res.status(200).json({ success: true, room: updatedRoom });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/rooms/:id/complete-cleaning
 * 1-click "Hoàn tất dọn phòng" transitioning room back to AVAILABLE
 */
export async function completeRoomCleaning(req, res) {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    await prisma.serviceRequest.updateMany({
      where: { roomId: id, type: { in: ['CLEANING', 'TOWELS'] }, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED' },
    });

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: { status: 'AVAILABLE' },
    });

    if (io) {
      io.emit('room:status_updated', {
        roomId: updatedRoom.id,
        roomNumber: updatedRoom.number,
        status: 'AVAILABLE',
        room: updatedRoom,
      });
      io.emit('housekeeping:updated', { roomId: updatedRoom.id, status: 'AVAILABLE' });
      io.emit('reception:notification', {
        id: `CLEAN-DONE-${Date.now()}`,
        roomNumber: room.number,
        type: 'CLEANING_DONE',
        message: `✨ Hoàn tất dọn Phòng ${room.number} — Đã sẵn sàng đón khách (AVAILABLE).`,
        timestamp: new Date().toISOString(),
        priority: 'NORMAL',
      });
    }

    return res.status(200).json({ success: true, room: updatedRoom });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
