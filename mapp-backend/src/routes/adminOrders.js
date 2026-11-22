const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

const admin = [authenticate, requireAdmin];
router.get('/stats', ...admin, validate({ body: s.empty, query: s.empty, params: s.empty }), c('adminStats'));
router.get('/orders', ...admin, validate({ body: s.empty, query: s.adminOrderQuery, params: s.empty }), c('adminOrders'));
router.get('/orders/:id', ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminOrder'));
router.patch('/orders/:id/status', ...admin, validate({ body: s.orderStatus, query: s.empty, params: s.uuidParams }), c('adminOrderStatus'));
router.patch('/orders/:id/payment-status', ...admin, validate({ body: s.paymentStatus, query: s.empty, params: s.uuidParams }), c('adminPaymentStatus'));
router.put('/orders/:id', ...admin, validate({ body: s.orderPatch, query: s.empty, params: s.uuidParams }), c('adminUpdateOrder'));
router.delete('/orders/:id', ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminDeleteOrder'));

module.exports = router;
