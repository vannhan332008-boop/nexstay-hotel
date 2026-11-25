import prisma from '../lib/prisma.js';
import { io } from '../index.js';
import { parseVoiceIoTCommand } from '../services/ai.service.js';
import { getOrCreateGuestUser } from '../services/seedService.js';

const VALID_AMBIENT_COLORS = new Set(['CYAN', 'VIOLET', 'GOLD', 'WARM']);

function sanitizeSmartControls(state = {}) {
  const safe = {};
  if (typeof state.lights === 'boolean') {
    safe.lights = state.lights;
  }
  if (typeof state.ambientLighting === 'string' && VALID_AMBIENT_COLORS.has(state.ambientLighting)) {
    safe.ambientLighting = state.ambientLighting;
  }
  if (state.acTemp !== undefined) {
    const temp = Number(state.acTemp);
    safe.acTemp = Number.isFinite(temp) ? Math.min(30, Math.max(16, Math.round(temp))) : 21;
  }
  if (state.curtainsOpen !== undefined) {
    const open = Number(state.curtainsOpen);
    safe.curtainsOpen = Number.isFinite(open) ? Math.min(100, Math.max(0, Math.round(open))) : 50;
  }
  if (typeof state.doorLocked === 'boolean') {
    safe.doorLocked = state.doorLocked;
  }
  if (typeof state.scene === 'string' && state.scene.trim()) {
    safe.scene = state.scene.trim().slice(0, 40);
  }
  return safe;
}

/**
 * POST /api/iot/control
 * Updates a room's virtual smart IoT state, writes IoTLog, and emits Socket.io telemetry
 */
export async function updateIoTControl(req, res) {
  try {
    const { roomId, device, action, value, updates, source = 'UI' } = req.body || {};

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'roomId is required.' });
    }

    const validUpdates = sanitizeSmartControls(
      updates && typeof updates === 'object' && !Array.isArray(updates) ? updates : {}
    );

    const room = await prisma.room.findUnique({ where: { id: String(roomId) } });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    let currentState = {
      lights: false,
      ambientLighting: 'CYAN',
      acTemp: 21,
      curtainsOpen: 50,
      doorLocked: true,
      scene: 'STANDBY',
    };

    try {
      if (room.smartControls) {
        currentState = { ...currentState, ...sanitizeSmartControls(JSON.parse(room.smartControls)) };
      }
    } catch {
      // ignore malformed stored controls
    }

    const newState = sanitizeSmartControls({ ...currentState, ...validUpdates });

    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: { smartControls: JSON.stringify(newState) },
    });

    const logEntry = await prisma.ioTLog.create({
      data: {
        roomId,
        device: device || 'SYSTEM',
        action: action || 'UPDATE_STATE',
        value: value !== undefined ? String(value) : JSON.stringify(validUpdates),
        source,
      },
      include: { room: { select: { number: true, type: true } } },
    });

    if (io) {
      io.emit('iot:action', {
        id: logEntry.id,
        roomId,
        roomNumber: room.number,
        device: logEntry.device,
        action: logEntry.action,
        value: logEntry.value,
        source: logEntry.source,
        smartControls: newState,
        timestamp: logEntry.createdAt,
      });

      if (device === 'DOOR_LOCK' && validUpdates.doorLocked === false) {
        io.emit('reception:notification', {
          id: `IOT-DOOR-${Date.now()}`,
          roomNumber: room.number,
          type: 'IOT_SECURITY',
          message: `Phòng ${room.number} vừa mở khóa cửa qua Digital Biometric Key.`,
          timestamp: new Date().toISOString(),
          priority: 'NORMAL',
        });
      }
    }

    return res.status(200).json({
      success: true,
      smartControls: newState,
      log: logEntry,
      room: updatedRoom,
    });
  } catch (error) {
    console.error('❌ IoT Control Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/iot/voice
 * Voice-to-IoT Natural Language Engine (Vietnamese & English)
 */
export async function processVoiceIoT(req, res) {
  try {
    const { roomId, transcript } = req.body || {};
    if (!roomId || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({ success: false, message: 'roomId and transcript are required.' });
    }

    const room = await prisma.room.findUnique({
      where: { id: String(roomId) },
      include: { bookings: { take: 1, orderBy: { createdAt: 'desc' } } },
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    let currentState = { lights: false, ambientLighting: 'CYAN', acTemp: 21, curtainsOpen: 50, doorLocked: true };
    try {
      if (room.smartControls) currentState = { ...currentState, ...JSON.parse(room.smartControls) };
    } catch {
      // ignore malformed JSON
    }

    const parsed = await parseVoiceIoTCommand(transcript, currentState);
    const newState = sanitizeSmartControls({ ...currentState, ...(parsed.updates || {}) });

    await prisma.room.update({
      where: { id: roomId },
      data: { smartControls: JSON.stringify(newState) },
    });

    const logEntry = await prisma.ioTLog.create({
      data: {
        roomId,
        device: 'VOICE_AI',
        action: 'VOICE_COMMAND',
        value: `"${transcript}" ➜ ${JSON.stringify(parsed.updates || {})}`,
        source: 'VOICE_AI',
      },
      include: { room: { select: { number: true, type: true } } },
    });

    // If voice command also triggered a service request
    if (parsed.serviceRequest) {
      const fallbackUser = await getOrCreateGuestUser();
      const userId = room.bookings?.[0]?.userId || fallbackUser?.id;
      if (userId) {
        await prisma.serviceRequest.create({
          data: {
            userId,
            roomId,
            type: parsed.serviceRequest.type,
            description: parsed.serviceRequest.description,
            status: 'PENDING',
            priority: 'VIP',
          },
        });
      }

      if (io) {
        io.emit('reception:notification', {
          id: `VOICE-SVC-${Date.now()}`,
          roomNumber: room.number,
          type: parsed.serviceRequest.type,
          message: `🎙️ Voice AI Phòng ${room.number}: ${parsed.serviceRequest.description}`,
          timestamp: new Date().toISOString(),
          priority: 'VIP',
        });
      }
    }

    if (io) {
      io.emit('iot:action', {
        id: logEntry.id,
        roomId,
        roomNumber: room.number,
        device: 'VOICE_AI',
        action: 'VOICE_COMMAND',
        value: transcript,
        source: 'VOICE_AI',
        smartControls: newState,
        timestamp: logEntry.createdAt,
      });
    }

    return res.status(200).json({
      success: true,
      smartControls: newState,
      spokenReply: parsed.spokenReply,
      serviceRequest: parsed.serviceRequest,
      log: logEntry,
    });
  } catch (error) {
    console.error('❌ Voice IoT Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/iot/logs
 * Retrieve latest real-time IoT telemetry feed across the hotel
 */
export async function getIoTLogs(req, res) {
  try {
    const logs = await prisma.ioTLog.findMany({
      take: 25,
      orderBy: { createdAt: 'desc' },
      include: {
        room: { select: { number: true, type: true, floor: true } },
      },
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
