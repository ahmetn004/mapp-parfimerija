const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const uploadImage = require('../middleware/uploadImage');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

const admin = [authenticate, requireAdmin];

function crud(path, table, schema, patchSchema) {
  router.get(path, ...admin, validate({ body: s.empty, query: s.empty, params: s.empty }), c('adminList', { resource: { table } }));
  router.post(path, ...admin, validate({ body: schema, query: s.empty, params: s.empty }), c('adminCreate', { resource: { table }, status: 201 }));
  router.get(`${path}/:id`, ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminGet', { resource: { table } }));
  router.put(`${path}/:id`, ...admin, validate({ body: schema, query: s.empty, params: s.uuidParams }), c('adminUpdate', { resource: { table } }));
  router.patch(`${path}/:id`, ...admin, validate({ body: patchSchema, query: s.empty, params: s.uuidParams }), c('adminUpdate', { resource: { table } }));
  router.delete(`${path}/:id`, ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminDelete', { resource: { table } }));
}

crud('/brands', 'brands', s.brand, s.brandPatch);
crud('/categories', 'categories', s.category, s.categoryPatch);

router.get('/products', ...admin, validate({ body: s.empty, query: s.empty, params: s.empty }), c('adminProducts'));
router.post('/products', ...admin, validate({ body: s.productCreate, query: s.empty, params: s.empty }), c('createProduct', { status: 201 }));
router.put('/products/:id', ...admin, validate({ body: s.productPatch, query: s.empty, params: s.uuidParams }), c('updateProduct'));
router.patch('/products/:id/status', ...admin, validate({ body: s.status, query: s.empty, params: s.uuidParams }), c('productStatus'));
router.delete('/products/:id', ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('deleteProduct'));
router.post('/products/:id/variants', ...admin, validate({ body: s.variant, query: s.empty, params: s.uuidParams }), c('createVariant', { status: 201 }));
router.put('/variants/:id', ...admin, validate({ body: s.variantPatch, query: s.empty, params: s.uuidParams }), c('updateVariant'));
router.delete('/variants/:id', ...admin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('deleteVariant'));
router.patch('/variants/:id/stock', ...admin, validate({ body: s.stock, query: s.empty, params: s.uuidParams }), c('stockVariant'));
router.post('/products/:id/image', ...admin, uploadImage, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('uploadProductImage', { kind: 'main', fileRequired: true }));
router.post('/products/:id/gallery', ...admin, uploadImage, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('uploadProductImage', { kind: 'gallery', fileRequired: true, status: 201 }));
router.delete('/products/:id/gallery/:imageId', ...admin, validate({
  body: s.empty, query: s.empty, params: s.uuidParams.extend({ imageId: s.uuidParams.shape.id }),
}), c('deleteGalleryImage'));

module.exports = router;
