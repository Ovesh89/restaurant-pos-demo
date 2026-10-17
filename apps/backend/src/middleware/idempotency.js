import { getCollection } from '../config/database.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Idempotency-Key Middleware
 * Mirrors IdempotencyMiddleware in Django apps/common/middleware.py 1:1.
 *
 * - Checks 'Idempotency-Key' or 'X-Idempotency-Key' header on POST/PUT/PATCH/DELETE.
 * - If key is already 'PROCESSING', returns 409 CONCURRENT_REQUEST.
 * - If key is 'COMPLETED', replays stored status & body with 'X-Idempotent-Replay: true'.
 * - If response status is < 500, marks key 'COMPLETED'; if >= 500, deletes lock so client can retry.
 */
export async function idempotencyMiddleware(req, res, next) {
  if (!MUTATION_METHODS.has(req.method)) {
    return next();
  }

  const rawKey =
    req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  const idempotencyKey = typeof rawKey === 'string' ? rawKey.trim() : '';

  if (!idempotencyKey) {
    return next();
  }

  req.idempotencyKey = idempotencyKey;
  const requestPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;

  let collection;
  try {
    collection = await getCollection('idempotency_keys');
    const existing = await collection.findOne({
      key: idempotencyKey,
      path: requestPath,
      method: req.method,
    });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        res.setHeader('X-Idempotent-Replay', 'true');
        res.status(existing.statusCode || 200);
        res.type(existing.contentType || 'application/json');
        return res.send(existing.content);
      }

      return res.status(409).json({
        success: false,
        error: {
          code: 'CONCURRENT_REQUEST',
          message: 'A request with this Idempotency-Key is currently being processed.',
          details: {},
        },
      });
    }

    try {
      await collection.insertOne({
        key: idempotencyKey,
        path: requestPath,
        method: req.method,
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
      });
    } catch (insertErr) {
      if (insertErr?.code === 11000) {
        const raceDoc = await collection.findOne({
          key: idempotencyKey,
          path: requestPath,
          method: req.method,
        });
        if (raceDoc && raceDoc.status === 'COMPLETED') {
          res.setHeader('X-Idempotent-Replay', 'true');
          res.status(raceDoc.statusCode || 200);
          res.type(raceDoc.contentType || 'application/json');
          return res.send(raceDoc.content);
        }
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONCURRENT_REQUEST',
            message: 'Duplicate concurrent request with the same Idempotency-Key.',
            details: {},
          },
        });
      }
    }
  } catch {
    // If idempotency storage fails unexpectedly, proceed rather than blocking POS operations
    return next();
  }

  // Intercept res.json / res.send to persist completed response
  const originalSend = res.send.bind(res);
  let captured = false;

  res.send = function interceptSend(body) {
    if (!captured && collection) {
      captured = true;
      const statusCode = res.statusCode || 200;
      const contentType = res.getHeader('content-type') || 'application/json';
      const contentStr =
        typeof body === 'string'
          ? body
          : Buffer.isBuffer(body)
          ? body.toString('utf8')
          : JSON.stringify(body);

      if (statusCode < 500) {
        collection
          .updateOne(
            { key: idempotencyKey, path: requestPath, method: req.method },
            {
              $set: {
                status: 'COMPLETED',
                statusCode,
                contentType: String(contentType),
                content: contentStr,
                completedAt: new Date().toISOString(),
              },
            }
          )
          .catch(() => undefined);
      } else {
        collection
          .deleteOne({ key: idempotencyKey, path: requestPath, method: req.method })
          .catch(() => undefined);
      }
    }
    return originalSend(body);
  };

  return next();
}
