const router = require('express').Router();
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.get('/brands', validate({ body: s.empty, query: s.empty, params: s.empty }), c('listBrands'));
router.get('/brands/:slug', validate({ body: s.empty, query: s.empty, params: s.slugParams }), c('brandBySlug'));
router.get('/categories', validate({ body: s.empty, query: s.empty, params: s.empty }), c('listCategories'));
router.get('/products', validate({ body: s.empty, query: s.productListQuery, params: s.empty }), c('listProducts'));
router.get('/products/:idOrSlug/reviews', validate({ body: s.empty, query: s.reviewListQuery, params: s.productParams }), c('productReviews'));
router.get('/products/:idOrSlug', validate({ body: s.empty, query: s.empty, params: s.productParams }), c('productByIdOrSlug'));

module.exports = router;
