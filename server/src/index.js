import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { helmetMiddleware, generalLimiter, paymentLimiter } from './middleware/security.js';
import { ensureDatabaseSeeded } from './services/seedService.js';
import checkinRoutes from './routes/checkinRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import iotRoutes from './routes/iotRoutes.js';
import conciergeRoutes from './routes/conciergeRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Trust Render / reverse-proxy headers (X-Forwarded-For, X-Forwarded-Proto)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

function normalizeOrigin(url = '') {
  return String(url).trim().replace(/\/+$/, '');
}

const defaultOrigins = [
  'https://nexstay-hotel-pvsw.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const envOrigins = String(process.env.FRONTEND_URL || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

function corsOriginValidator(origin, callback) {
  if (!origin) return callback(null, true);
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.has(normalized) || process.env.NODE_ENV !== 'production') {
    return callback(null, true);
  }
  const err = new Error(`CORS policy: Origin ${origin} is not permitted`);
  err.status = 403;
  return callback(err);
}

// Configure dynamic CORS with credentials support
app.use(
  cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Socket.io Real-time Setup (aligned with Express CORS)
export const io = new SocketIOServer(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.on('guest:request_cleaning', (data) => {
    const safeData = data && typeof data === 'object' ? data : {};
    const roomNo = typeof safeData.roomNumber === 'string' || typeof safeData.roomNumber === 'number'
      ? String(safeData.roomNumber).slice(0, 16)
      : '302';
    const priority = ['VIP', 'HIGH', 'NORMAL'].includes(safeData.priority) ? safeData.priority : 'HIGH';
    io.emit('reception:notification', {
      id: `NOTIF-${Date.now()}`,
      roomNumber: roomNo,
      type: 'CLEANING',
      message: `Phòng ${roomNo} vừa yêu cầu dọn phòng tức thì!`,
      timestamp: new Date().toISOString(),
      priority,
    });
  });
});

// Security Headers & Rate Limiting
app.use(helmetMiddleware);
app.use('/api', generalLimiter);

// API Routes
app.use('/api/checkin', checkinRoutes);
app.use('/api/payment', paymentLimiter, paymentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/chat', conciergeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/system', systemRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'NexStay Super VIP Smart Hotel OS',
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY'),
    features: ['CCCD_OCR', 'C06_POLICE_SYNC', 'VOICE_IOT_3D', 'AI_YIELD_PRICING', 'VIETQR_VNPAY', 'PDF_INVOICE', 'AI_CONCIERGE'],
    timestamp: new Date().toISOString(),
  });
});

// API 404 Fallback (JSON instead of HTML)
app.use('/api', (req, res) => {
  return res.status(404).json({ success: false, message: 'API endpoint not found.' });
});

// Global Error Handler (handles Multer upload & JSON/CORS errors cleanly)
app.use((err, req, res, _next) => {
  console.error('❌ Unhandled Server Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Uploaded image exceeds 10MB limit.' });
  }
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// Ensure default demo dataset exists on fresh boots, then start server
ensureDatabaseSeeded()
  .catch((err) => {
    console.error('⚠️ Startup DB seed check failed:', err.message);
  })
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`🚀 NexStay Super VIP Server active on port ${PORT}`);
    });
  });
