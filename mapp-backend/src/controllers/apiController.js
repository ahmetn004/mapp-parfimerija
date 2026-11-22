const api = require('../services/api');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../middleware/asyncHandler');

module.exports = (action, options = {}) => asyncHandler(async (req, res) => {
  if (options.fileRequired && !req.file) throw new ApiError(400, 'Image file is required');
  const result = await api[action]({
    user: req.user,
    token: req.authToken,
    body: req.validated?.body || {},
    query: req.validated?.query || {},
    params: req.validated?.params || {},
    file: req.file,
    kind: options.kind,
    resource: options.resource,
  });
  res.status(options.status || 200).json({ success: true, data: result });
});
