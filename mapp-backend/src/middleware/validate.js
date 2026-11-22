const ApiError = require('../utils/ApiError');

module.exports = (schemas = {}) => (req, res, next) => {
  try {
    req.validated = {};
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) req.validated[key] = schemas[key].parse(req[key] || {});
    }
    next();
  } catch (error) {
    if (error.name === 'ZodError') {
      return next(new ApiError(400, 'Validation failed', error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))));
    }
    next(error);
  }
};
