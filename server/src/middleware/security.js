import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * Helmet HTTP security headers configured for modern hybrid REST & WebSocket APIs
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Disabled for flexible integration with external CDNs and WebSocket endpoints
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Rate Limiter for Authentication endpoints (e.g., /api/auth/login, /api/auth/register)
 * Protects against credential-stuffing and brute-force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Limit each IP to 10 requests per window
  standardHeaders: true, // Return standard `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Rate Limiter for Payment endpoints (e.g., /api/payment/create_url)
 * Prevents transaction flood and automated spam sessions
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 25, // Limit each IP to 25 payment checkout sessions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Payment checkout rate limit reached. Please wait before creating new payment orders.',
  },
});

/**
 * General API Rate Limiter
 * Guards against general denial of service and aggressive scraping
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 300, // Limit each IP to 300 requests per window
  skip: (req) => req.path === '/health',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests dispatched to NexStay API. Please throttle your client.',
  },
});

export default {
  helmetMiddleware,
  authLimiter,
  paymentLimiter,
  generalLimiter,
};
