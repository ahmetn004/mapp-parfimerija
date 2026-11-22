const ApiError = require('../utils/ApiError');

module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    error = new ApiError(400, 'Image must be 5 MB or smaller');
  } else if (error.name === 'MulterError') {
    error = new ApiError(400, error.message);
  } else if (!(error instanceof ApiError)) {
    const duplicate = error.code === '23505';
    const invalidData = ['23502', '23503', '23514', '22P02'].includes(error.code);
    const missing = error.code === 'PGRST116';
    error = new ApiError(duplicate || error.code === '23503' ? 409 : invalidData ? 400 : missing ? 404 : 500,
      duplicate ? 'A record with these values already exists'
        : error.code === '23503' ? 'The operation conflicts with related records'
          : invalidData ? 'The submitted data is invalid' : missing ? 'Resource not found' : 'Internal server error');
    if (error.statusCode === 500) console.error('Request failed:', req.method, req.originalUrl, error);
  }

  const payload = { success: false, message: error.message };
  if (error.errors) payload.errors = error.errors;
  res.status(error.statusCode || 500).json(payload);
};
