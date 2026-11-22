const ApiError = require('../utils/ApiError');

module.exports.requireAdmin = (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.role !== 'admin') return next(new ApiError(403, 'Administrator access required'));
  next();
};
