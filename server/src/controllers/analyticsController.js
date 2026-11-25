import { PrismaClient } from '@prisma/client';
import { io } from '../index.js';
import { computeHousekeepingQueue } from './roomController.js';

const prisma = new PrismaClient();

/**
 * GET /api/analytics/summary
 * Computes live financial KPIs, Occupancy, AI Yield Pricing recommendations,
 * AI Housekeeping priority queue, and Recharts datasets.
 */
export async function getAnalyticsSummary(req, res) {
  try {
    const [rooms, bookings, serviceRequests, conciergeLogs, iotLogs] = await Promise.all([
      prisma.room.findMany({ orderBy: { number: 'asc' } }),
      prisma.booking.findMany({ include: { room: true, user: true }, orderBy: { createdAt: 'desc' } }),
      prisma.serviceRequest.findMany({ include: { room: true, user: true }, orderBy: { createdAt: 'desc' } }),
      prisma.conciergeLog.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.ioTLog.findMany({ take: 15, orderBy: { createdAt: 'desc' }, include: { room: { select: { number: true } } } }),
    ]);

    const totalRooms = rooms.length;
    const statusCounts = {
      AVAILABLE: rooms.filter((r) => r.status === 'AVAILABLE').length,
      OCCUPIED: rooms.filter((r) => r.status === 'OCCUPIED').length,
      CLEANING: rooms.filter((r) => r.status === 'CLEANING').length,
      MAINTENANCE: rooms.filter((r) => r.status === 'MAINTENANCE').length,
    };

    const occupancyRate = totalRooms ? Math.round((statusCounts.OCCUPIED / totalRooms) * 100) : 0;
    const totalRevenueUSD = bookings.reduce((sum, b) => sum + (b.paymentStatus === 'COMPLETED' ? Number(b.totalAmount || 0) : 0), 0);
    const pendingRevenueUSD = bookings.reduce((sum, b) => sum + (b.paymentStatus === 'PENDING' ? Number(b.totalAmount || 0) : 0), 0);

    const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED');
    const adr = occupiedRooms.length
      ? Math.round(occupiedRooms.reduce((sum, r) => sum + Number(r.pricePerNight || 0), 0) / occupiedRooms.length)
      : totalRooms
      ? Math.round(rooms.reduce((sum, r) => sum + Number(r.pricePerNight || 0), 0) / totalRooms)
      : 0;

    const revPAR = Math.round((adr * occupancyRate) / 100);

    // AI Dynamic Yield Pricing Calculation
    // Surge rules based on live occupancy pressure + weekend/event demand simulation
    let recommendedMultiplier = 1.05;
    let yieldReasonVi = 'Nhu cầu ổn định — AI đề xuất tăng nhẹ +5% cho các hạng phòng view sông.';
    let yieldReasonEn = 'Steady demand — AI recommends +5% yield uplift on panoramic suites.';

    if (occupancyRate >= 70) {
      recommendedMultiplier = 1.28;
      yieldReasonVi = `Cảnh báo cháy phòng (${occupancyRate}% lấp đầy) — AI đề xuất bật Surge +28% tối đa hóa RevPAR.`;
      yieldReasonEn = `High Compression (${occupancyRate}% occupancy) — AI recommends +28% Yield Surge.`;
    } else if (occupancyRate >= 35) {
      recommendedMultiplier = 1.15;
      yieldReasonVi = `Nhu cầu VIP tăng cao cuối tuần (${occupancyRate}% lấp đầy) — AI đề xuất tăng giá động +15%.`;
      yieldReasonEn = `Elevated VIP weekend demand (${occupancyRate}% occupancy) — AI recommends +15% dynamic pricing.`;
    }

    const yieldRecommendations = rooms.map((r) => {
      const current = Number(r.pricePerNight || 0);
      const base = Number(r.basePricePerNight || current || 100);
      const suggested = Math.round(base * recommendedMultiplier);
      return {
        roomId: r.id,
        number: r.number,
        type: r.type,
        status: r.status,
        basePrice: base,
        currentPrice: current,
        suggestedPrice: suggested,
        deltaPercent: current > 0 ? Math.round(((suggested - current) / current) * 100) : 0,
      };
    });

    // AI Housekeeping Priority Queue (shared helper)
    const housekeepingQueue = await computeHousekeepingQueue();

    // 7-day Revenue Timeline + AI Forecast (anchored to live DB revenue)
    const baseDaily = Math.max(1200, Math.round(totalRevenueUSD / 3));
    const revenueTimeline = [
      { day: 'T2 / Mon', actual: Math.round(baseDaily * 0.78), forecast: Math.round(baseDaily * 0.8) },
      { day: 'T3 / Tue', actual: Math.round(baseDaily * 0.85), forecast: Math.round(baseDaily * 0.82) },
      { day: 'T4 / Wed', actual: Math.round(baseDaily * 0.92), forecast: Math.round(baseDaily * 0.9) },
      { day: 'T5 / Thu', actual: Math.round(baseDaily * 1.05), forecast: Math.round(baseDaily * 1.02) },
      { day: 'T6 / Fri', actual: Math.round(baseDaily * 1.25), forecast: Math.round(baseDaily * 1.2) },
      { day: 'T7 / Sat', actual: Math.round(baseDaily * 1.48), forecast: Math.round(baseDaily * 1.45) },
      { day: 'CN / Sun', actual: totalRevenueUSD || Math.round(baseDaily * 1.35), forecast: Math.round((totalRevenueUSD || baseDaily * 1.35) * recommendedMultiplier) },
    ];

    const occupancyPie = [
      { name: 'Occupied (Đang ở)', value: statusCounts.OCCUPIED, color: '#00F3FF' },
      { name: 'Available (Sẵn sàng)', value: statusCounts.AVAILABLE, color: '#10B981' },
      { name: 'Cleaning (Đang dọn)', value: statusCounts.CLEANING, color: '#F59E0B' },
      { name: 'Maintenance (Bảo trì)', value: statusCounts.MAINTENANCE, color: '#F43F5E' },
    ];

    const aiUsageChart = [
      { metric: 'T2', queries: 18 + conciergeLogs.length, voice: 9 },
      { metric: 'T3', queries: 24 + conciergeLogs.length, voice: 14 },
      { metric: 'T4', queries: 31, voice: 19 },
      { metric: 'T5', queries: 42, voice: 28 },
      { metric: 'T6', queries: 56, voice: 39 },
      { metric: 'T7', queries: 68, voice: 47 },
      { metric: 'Hôm nay', queries: 45 + conciergeLogs.length * 4, voice: 32 + iotLogs.filter((l) => l.source === 'VOICE_AI').length * 3 },
    ];

    return res.status(200).json({
      success: true,
      kpis: {
        totalRevenueUSD,
        totalRevenueVND: Math.round(totalRevenueUSD * 25400),
        pendingRevenueUSD,
        occupancyRate,
        adr,
        revPAR,
        totalRooms,
        statusCounts,
        policeSyncedCount: bookings.filter((b) => b.policeSyncStatus === 'SYNCED').length,
        totalBookings: bookings.length,
        aiInteractionsCount: conciergeLogs.length + iotLogs.length,
      },
      yieldEngine: {
        recommendedMultiplier,
        surgePercent: Math.round((recommendedMultiplier - 1) * 100),
        reasonVi: yieldReasonVi,
        reasonEn: yieldReasonEn,
        recommendations: yieldRecommendations,
      },
      housekeepingQueue,
      charts: {
        revenueTimeline,
        occupancyPie,
        aiUsageChart,
      },
      recentTelemetry: iotLogs,
    });
  } catch (error) {
    console.error('❌ Analytics Summary Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/analytics/apply-yield
 * Applies AI Dynamic Yield Pricing across rooms or resets to base prices
 */
export async function applyDynamicYield(req, res) {
  try {
    const { multiplier = 1.15, reset = false } = req.body;
    const rooms = await prisma.room.findMany();

    const effectiveMultiplier = reset ? 1.0 : Number(multiplier);

    await Promise.all(
      rooms.map((room) => {
        const base = room.basePricePerNight || room.pricePerNight;
        const newPrice = Math.round(base * effectiveMultiplier);
        return prisma.room.update({
          where: { id: room.id },
          data: {
            basePricePerNight: base,
            yieldMultiplier: effectiveMultiplier,
            pricePerNight: newPrice,
          },
        });
      })
    );

    const updatedRooms = await prisma.room.findMany({ orderBy: { number: 'asc' } });

    if (io) {
      io.emit('rooms:yield_updated', {
        multiplier: effectiveMultiplier,
        reset,
        rooms: updatedRooms,
      });

      io.emit('reception:notification', {
        id: `YIELD-${Date.now()}`,
        roomNumber: 'ALL',
        type: 'AI_YIELD',
        message: reset
          ? '💰 AI Yield Engine: Đã khôi phục bảng giá gốc toàn hệ thống.'
          : `🚀 AI Yield Autopilot: Đã cập nhật giá động x${effectiveMultiplier.toFixed(2)} theo nhu cầu thực tế!`,
        timestamp: new Date().toISOString(),
        priority: 'HIGH',
      });
    }

    return res.status(200).json({
      success: true,
      multiplier: effectiveMultiplier,
      rooms: updatedRooms,
    });
  } catch (error) {
    console.error('❌ Apply Yield Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
