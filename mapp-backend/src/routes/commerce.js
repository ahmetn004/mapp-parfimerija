const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.get('/shipping-methods', validate({ body: s.empty, query: s.empty, params: s.empty }), c('shippingMethods'));

router.get('/wishlist', authenticate, validate({ body: s.empty, query: s.empty, params: s.empty }), c('wishlist'));
router.post('/wishlist/:productId', authenticate, validate({ body: s.empty, query: s.empty, params: s.uuidParams.extend({ productId: s.uuidParams.shape.id }) }), c('addWishlist'));
router.delete('/wishlist/:productId', authenticate, validate({ body: s.empty, query: s.empty, params: s.uuidParams.extend({ productId: s.uuidParams.shape.id }) }), c('deleteWishlist'));

router.get('/cart', authenticate, validate({ body: s.empty, query: s.empty, params: s.empty }), c('getCart'));
router.post('/cart/items', authenticate, validate({ body: s.cartItem, query: s.empty, params: s.empty }), c('addCartItem', { status: 201 }));
router.patch('/cart/items/:itemId', authenticate, validate({ body: s.quantity, query: s.empty, params: s.idParams.extend({ itemId: s.uuidParams.shape.id }) }), c('updateCartItem'));
router.delete('/cart/items/:itemId', authenticate, validate({ body: s.empty, query: s.empty, params: s.idParams.extend({ itemId: s.uuidParams.shape.id }) }), c('deleteCartItem'));
router.delete('/cart', authenticate, validate({ body: s.empty, query: s.empty, params: s.empty }), c('clearCart'));
router.post('/coupons/validate', authenticate, validate({ body: s.couponValidation, query: s.empty, params: s.empty }), c('validateCoupon'));

module.exports = router;
