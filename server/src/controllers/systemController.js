import { resetDemoDatabase } from '../services/seedService.js';
import { io } from '../index.js';

/**
 * POST /api/system/reset-demo
 * One-Click Demo Data Reset for clean live presentations
 */
export async function handleResetDemoData(req, res) {
  try {
    const result = await resetDemoDatabase();

    if (io) {
      io.emit('system:demo_reset', result);
      io.emit('reception:notification', {
        id: `RESET-${Date.now()}`,
        roomNumber: 'SYSTEM',
        type: 'SYSTEM_RESET',
        message: '🔄 Hệ thống đã khôi phục dữ liệu thuyết trình mặc định (8 phòng, 3 booking VIP & hồ sơ C06).',
        timestamp: new Date().toISOString(),
        priority: 'HIGH',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Demo data restored to pristine default state.',
      ...result,
    });
  } catch (error) {
    console.error('❌ Demo Reset Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
