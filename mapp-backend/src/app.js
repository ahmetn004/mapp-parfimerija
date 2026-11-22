const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const validate = require('./middleware/validate');
const asyncHandler = require('./middleware/asyncHandler');
const api = require('./services/api');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const { empty } = require('./validators/schemas');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/api/health', validate({ body: empty, query: empty, params: empty }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await api.health() });
}));
app.use('/api', routes);
app.use((req, res, next) => {
  const ApiError = require('./utils/ApiError');
  next(new ApiError(404, 'Route not found'));
});
app.use(errorHandler);

module.exports = app;
