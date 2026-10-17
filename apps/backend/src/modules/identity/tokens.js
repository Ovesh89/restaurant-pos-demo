import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AuthenticationAppError } from '../../middleware/errorHandler.js';

const JWT_ALGORITHM = 'HS256';

/**
 * Generate HS256 access token matching Django apps/identity/tokens.py.
 */
export function generateAccessToken(userId, username) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + env.jwtAccessExpirationMinutes * 60;
  const payload = {
    sub: String(userId),
    username: String(username),
    type: 'access',
    iat: nowSec,
    exp: expSec,
  };
  return jwt.sign(payload, env.secretKey, { algorithm: JWT_ALGORITHM });
}

/**
 * Generate HS256 refresh token matching Django apps/identity/tokens.py.
 */
export function generateRefreshToken(userId) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + env.jwtRefreshExpirationDays * 86400;
  const payload = {
    sub: String(userId),
    type: 'refresh',
    iat: nowSec,
    exp: expSec,
  };
  return jwt.sign(payload, env.secretKey, { algorithm: JWT_ALGORITHM });
}

/**
 * Decode and verify HS256 JWT token, validating token type ('access' | 'refresh').
 */
export function decodeToken(token, expectedType = 'access') {
  if (!token || typeof token !== 'string') {
    throw new AuthenticationAppError('Invalid authentication token.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.secretKey, { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      throw new AuthenticationAppError('Token has expired.');
    }
    throw new AuthenticationAppError('Invalid authentication token.');
  }

  if (!payload || payload.type !== expectedType) {
    throw new AuthenticationAppError(`Invalid token type. Expected ${expectedType} token.`);
  }

  return payload;
}
