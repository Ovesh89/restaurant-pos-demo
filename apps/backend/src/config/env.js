import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isTest = process.env.NODE_ENV === 'test';

const rawDbName = isTest
  ? (process.env.MONGODB_TEST_DATABASE || 'restaurant_pos_mern_test')
  : (process.env.MONGODB_DATABASE || 'restaurant_pos_mern_dev');

// Safety guardrail: Never allow connecting to legacy Django database by accident
if (rawDbName === 'restaurant_pos_dev' || rawDbName === 'restaurant_pos_test') {
  throw new Error(
    `[SAFETY VIOLATION] Refusing to use legacy database "${rawDbName}". Use "restaurant_pos_mern_dev" or "restaurant_pos_mern_test".`
  );
}

export function normalizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return rawUri;
  const match = rawUri.match(/^(mongodb(?:\+srv)?:\/\/)([^/]+)(.*)$/);
  if (!match) return rawUri;
  const [, protocol, authority, rest] = match;
  const atIndex = authority.lastIndexOf('@');
  if (atIndex === -1) return rawUri;
  const userInfo = authority.slice(0, atIndex);
  const host = authority.slice(atIndex + 1);
  const colonIndex = userInfo.indexOf(':');
  if (colonIndex === -1) return rawUri;
  const username = userInfo.slice(0, colonIndex);
  const rawPassword = userInfo.slice(colonIndex + 1);
  let decodedPassword = rawPassword;
  try {
    decodedPassword = decodeURIComponent(rawPassword);
  } catch {
    // ignore
  }
  const safePassword = encodeURIComponent(decodedPassword);
  let decodedUser = username;
  try {
    decodedUser = decodeURIComponent(username);
  } catch {
    // ignore
  }
  const safeUser = encodeURIComponent(decodedUser);
  return `${protocol}${safeUser}:${safePassword}@${host}${rest}`;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  port: Number(process.env.PORT) || 8001,
  secretKey:
    process.env.SECRET_KEY ||
    'django-insecure-pos-dev-secret-key-change-in-production',
  mongodbUri: normalizeMongoUri(process.env.MONGODB_URI) || 'mongodb://127.0.0.1:27017',
  mongodbDatabase: rawDbName,
  mongodbTestDatabase: process.env.MONGODB_TEST_DATABASE || 'restaurant_pos_mern_test',
  jwtAccessExpirationMinutes: Number(process.env.JWT_ACCESS_EXPIRATION_MINUTES) || 60,
  jwtRefreshExpirationDays: Number(process.env.JWT_REFRESH_EXPIRATION_DAYS) || 7,
  corsAllowedOrigins: (
    process.env.CORS_ALLOWED_ORIGINS ||
    'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL || 'info',
};
