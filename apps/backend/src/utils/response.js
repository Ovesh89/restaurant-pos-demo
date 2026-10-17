/**
 * Canonical API Response Helpers
 * Matches Django apps/common/responses.py 1:1.
 */

export function successResponse(res, data = null, message = '', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message: message || '',
  });
}

export function createdResponse(res, data = null, message = '') {
  return successResponse(res, data, message, 201);
}

export function errorResponse(
  res,
  {
    code = 'ERROR',
    message = 'An error occurred.',
    details = {},
    statusCode = 400,
  } = {}
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: details || {},
    },
  });
}
