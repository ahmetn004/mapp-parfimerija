const api = require('../services/api');
const asyncHandler = require('./asyncHandler');
const ApiError = require('../utils/ApiError');

module.exports = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required');
  req.user = await api.authenticatedUser(token);
  req.authToken = token;
  next();
});
