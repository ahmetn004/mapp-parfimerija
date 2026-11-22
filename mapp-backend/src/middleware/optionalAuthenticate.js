const api = require('../services/api');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('./asyncHandler');

module.exports = asyncHandler(async (req, res, next) => {
  const authorization = req.get('authorization');
  if (!authorization) return next();
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Invalid authorization header');
  req.user = await api.authenticatedUser(token);
  next();
});
