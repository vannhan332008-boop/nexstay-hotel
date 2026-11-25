import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { helmetMiddleware, generalLimiter, paymentLimiter } from './middleware/security.js';
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

const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Configure dynamic CORS with credentials support
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by origin'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io Real-time Setup
export const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`⚡ Client connected via Socket.io: ${socket.id}`);

  socket.on('guest:request_cleaning', (data) => {
    io.emit('reception:notification', {
      id: `NOTIF-${Date.now()}`,
      roomNumber: data.roomNumber || '302',
      type: 'CLEANING',
      message: `Phòng ${data.roomNumber || '302'} vừa yêu cầu dọn phòng tức thì!`,
      timestamp: new Date().toISOString(),
      priority: data.priority || 'HIGH',
    });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
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

// Global Error Handler (handles Multer upload & JSON/CORS errors cleanly)
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Server Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Uploaded image exceeds 10MB limit.' });
  }
  return res.status(err.status || 400).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 NexStay Super VIP Server active on http://localhost:${PORT}`);
});
