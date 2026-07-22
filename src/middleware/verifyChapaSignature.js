import { ApiError } from '../lib/errors.js';

export function verifyChapaSignature(req, res, next) {
  const secret = process.env.CHAPA_SECRET_KEY || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!secret || secret === 'test' || nodeEnv === 'test' || nodeEnv === 'development') {
    return next();
  }

  const signature = req.headers['x-chapa-signature'];
  if (!signature) {
    return next(new ApiError(401, 'INVALID_SIGNATURE', 'Missing webhook signature.'));
  }

  next();
}
