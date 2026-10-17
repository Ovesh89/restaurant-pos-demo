import { errorResponse } from '../utils/response.js';

/**
 * Domain & Application Error Hierarchy
 * Mirrors apps/common/exceptions.py in Django backend 1:1.
 */
export class AppError extends Error {
  constructor(
    message = 'An unexpected error occurred.',
    { code = 'APP_ERROR', statusCode = 400, details = {} } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details || {};
  }
}

export class ValidationAppError extends AppError {
  constructor(message = 'Invalid input data.', details = {}) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, details });
  }
}

export class AuthenticationAppError extends AppError {
  constructor(message = 'Authentication credentials were not provided or are invalid.', details = {}) {
    super(message, { code: 'UNAUTHORIZED', statusCode: 401, details });
  }
}

export class PermissionDeniedAppError extends AppError {
  constructor(message = 'You do not have permission to perform this action.', details = {}) {
    super(message, { code: 'PERMISSION_DENIED', statusCode: 403, details });
  }
}

export class NotFoundAppError extends AppError {
  constructor(message = 'Requested resource was not found.', details = {}) {
    super(message, { code: 'NOT_FOUND', statusCode: 404, details });
  }
}

export class ConflictAppError extends AppError {
  constructor(message = 'Resource conflict or invalid state transition.', details = {}, code = 'CONFLICT') {
    super(message, { code, statusCode: 409, details });
  }
}

export class StateConflictError extends ConflictAppError {
  constructor(message = 'Invalid state transition.', details = {}) {
    super(message, details, 'INVALID_STATE');
  }
}

/**
 * Async route wrapper to forward rejected promises to Express errorHandler.
 */
export function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found Handler for unmatched routes
 */
export function notFoundHandler(req, res) {
  return errorResponse(res, {
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found.`,
    details: {},
    statusCode: 404,
  });
}

/**
 * Central Express Error Handling Middleware
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return errorResponse(res, {
      code: err.code,
      message: err.message,
      details: err.details,
      statusCode: err.statusCode,
    });
  }

  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errorResponse(res, {
      code: 'VALIDATION_ERROR',
      message: 'Malformed JSON request body.',
      details: {},
      statusCode: 400,
    });
  }

  // Handle MongoDB duplicate key errors (E11000)
  if (err?.code === 11000) {
    return errorResponse(res, {
      code: 'CONFLICT',
      message: 'Duplicate record violates uniqueness constraint.',
      details: err.keyValue || {},
      statusCode: 409,
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[UnhandledServerError]', err);
  }

  return errorResponse(res, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred.',
    details: {},
    statusCode: 500,
  });
}
