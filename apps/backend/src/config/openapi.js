/**
 * OpenAPI 3.0 Specification for Restaurant POS & KOT Management System (MERN)
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Restaurant POS & KOT Management API',
    version: '1.0.0',
    description:
      'Production-grade Node.js + Express + MongoDB REST API compatible with Restaurant POS Web and React Native Captain/Kitchen Mobile clients.',
  },
  servers: [
    {
      url: 'http://127.0.0.1:8001',
      description: 'Local Development Server (MERN)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness & MongoDB health check',
        security: [],
        responses: {
          200: { description: 'Service is healthy' },
          503: { description: 'Database unavailable' },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe',
        security: [],
        responses: {
          200: { description: 'Service is ready' },
          503: { description: 'Service is not ready' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user and issue access & refresh JWTs',
        security: [],
        responses: { 200: { description: 'Login successful' } },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token using refresh token',
        security: [],
        responses: { 200: { description: 'Token refreshed' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current session',
        responses: { 200: { description: 'Logged out' } },
      },
    },
    '/api/v1/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user profile, roles, and permissions',
        responses: { 200: { description: 'Current user profile' } },
      },
    },
  },
};
