// Security middleware: helmet, CORS, request ID.

// Import crypto for request ID generation.
import crypto from 'node:crypto';

// Add a unique request ID to every request.
export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = id;
  res.set('X-Request-Id', id);
  next();
}

// Basic security headers (lightweight alternative to helmet for zero dependencies).
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing.
  res.set('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking.
  res.set('X-Frame-Options', 'DENY');
  // Enable XSS filter.
  res.set('X-XSS-Protection', '1; mode=block');
  // Referrer policy.
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy.
  res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'");
  // HSTS (only meaningful over HTTPS).
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

// CORS middleware for Mini App and Admin PWA.
export function cors(req, res, next) {
  const allowedOrigins = [
    process.env.MINI_APP_BASE_URL,
    process.env.ADMIN_PWA_BASE_URL,
    'https://web.telegram.org',
    'http://localhost:5173',
    'http://localhost:3001'
  ].filter(Boolean);

  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Request-Id');
    res.set('Access-Control-Max-Age', '86400');
  }

  // Handle preflight.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}
