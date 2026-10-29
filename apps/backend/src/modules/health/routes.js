import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { checkMongoConnection } from '../../config/database.js';
import { openApiSpec } from '../../config/openapi.js';

const router = Router();

async function buildHealthPayload(readyMode = false) {
  const dbStatus = await checkMongoConnection();
  const isHealthy = Boolean(dbStatus.connected);
  const statusCode = isHealthy ? 200 : 503;

  const payload = {
    status: isHealthy ? (readyMode ? 'ready' : 'ok') : (readyMode ? 'not_ready' : 'degraded'),
    service: 'restaurant-pos-backend',
    database: isHealthy ? 'connected' : 'disconnected',
    mongodb: {
      status: isHealthy ? 'connected' : 'disconnected',
      database: dbStatus.database,
      version: dbStatus.version,
      ...(dbStatus.error ? { error: dbStatus.error } : {}),
    },
  };

  return { statusCode, payload };
}

// Root health info
router.get('/', async (_req, res) => {
  const { statusCode, payload } = await buildHealthPayload(false);
  return res.status(statusCode).json({
    ...payload,
    version: '1.0.0',
    docs: '/api/docs/',
    schema: '/api/schema/',
  });
});

// Liveness & Health endpoints (with and without /api prefix)
router.get(['/health', '/api/health'], async (_req, res) => {
  const { statusCode, payload } = await buildHealthPayload(false);
  return res.status(statusCode).json(payload);
});

// Readiness endpoints (with and without /api prefix)
router.get(['/ready', '/api/ready'], async (_req, res) => {
  const { statusCode, payload } = await buildHealthPayload(true);
  return res.status(statusCode).json(payload);
});

// OpenAPI 3.0 JSON Schema
router.get(['/api/schema', '/api/schema/'], (_req, res) => {
  return res.status(200).json(openApiSpec);
});

// Swagger UI configuration options
const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'Restaurant POS & KOT Management API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
    tryItOutEnabled: true,
  },
};

// Swagger UI Interactive Docs
router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));

// Convenient Swagger documentation redirects
router.get(['/docs', '/docs/', '/swagger', '/swagger/', '/api/swagger'], (_req, res) => {
  return res.redirect('/api/docs/');
});

// ReDoc HTML page
router.get('/api/redoc', (_req, res) => {
  return res
    .status(200)
    .type('text/html')
    .send(`<!DOCTYPE html>
<html>
  <head>
    <title>Restaurant POS & KOT Management API — ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <redoc spec-url='/api/schema'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`);
});

export default router;
