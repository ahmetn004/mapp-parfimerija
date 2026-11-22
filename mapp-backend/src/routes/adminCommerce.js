const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

const admin = [authenticate, requireAdmin];

function crud(path, table, schema, patchSchema) {
  const resource = { table };
  router.get(path, ...admin, validate({ body: s.empty, query: s.empty, params: s.empty }), c('adminList', { resource }));
  router.post(path, ...admin, validate({ body: schema, query: s.empty, params: s.empty }), c('adminCreate', { resource, status: 201 }));
  router.get(`${path}/:id`, ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminGet', { resource }));
  router.put(`${path}/:id`, ...admin, validate({ body: schema, query: s.empty, params: s.uuidParams }), c('adminUpdate', { resource }));
  router.patch(`${path}/:id`, ...admin, validate({ body: patchSchema, query: s.empty, params: s.uuidParams }), c('adminUpdate', { resource }));
  router.delete(`${path}/:id`, ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminDelete', { resource }));
}

crud('/coupons', 'coupons', s.coupon, s.couponPatch);
crud('/shipping-methods', 'shipping_methods', s.shippingMethod, s.shippingPatch);

module.exports = router;
