import crypto from 'node:crypto';

/**
 * Attaches X-Correlation-ID (or X-Request-ID) to req.correlationId and response headers.
 * Mirrors CorrelationIdMiddleware in Django apps/common/middleware.py.
 */
export function correlationIdMiddleware(req, res, next) {
  const incomingId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    crypto.randomUUID();

  req.correlationId = String(incomingId);
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
