import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './modules/health/routes.js';
import identityRoutes from './modules/identity/routes.js';
import restaurantRoutes from './modules/restaurant/routes.js';
import menuRoutes from './modules/menu/routes.js';
import orderRoutes from './modules/orders/routes.js';
import kotRoutes from './modules/kot/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import billingRoutes from './modules/billing/routes.js';
import customerRoutes from './modules/customers/routes.js';
import reportRoutes from './modules/reports/routes.js';
import auditRoutes from './modules/audit/routes.js';

export function createApp() {
  const app = express();

  // Disable strict routing so routes match both with and without trailing slashes (like Django APPEND_SLASH)
  app.set('strict routing', false);
  app.disable('x-powered-by');

  // CORS configuration supporting Web & Mobile clients and custom POS headers
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsAllowedOrigins.includes(origin) || env.nodeEnv !== 'production') {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'X-Idempotency-Key',
        'X-Correlation-ID',
        'X-Request-ID',
      ],
      exposedHeaders: ['X-Correlation-ID', 'X-Idempotent-Replay'],
    })
  );

  // Body parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Cross-cutting middlewares
  app.use(correlationIdMiddleware);
  app.use(idempotencyMiddleware);

  // Root, Health, Readiness & OpenAPI documentation routes
  app.use('/', healthRoutes);

  // API v1 Domain Routes
  app.use('/api/v1', identityRoutes);
  app.use('/api/v1', restaurantRoutes);
  app.use('/api/v1', menuRoutes);
  app.use('/api/v1', orderRoutes);
  app.use('/api/v1', kotRoutes);
  app.use('/api/v1', notificationRoutes);
  app.use('/api/v1', billingRoutes);
  app.use('/api/v1', customerRoutes);
  app.use('/api/v1', reportRoutes);
  app.use('/api/v1', auditRoutes);

  // 404 & Central Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
