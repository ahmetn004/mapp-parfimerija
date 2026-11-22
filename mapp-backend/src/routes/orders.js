const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.use(authenticate);
router.post('/', validate({ body: s.orderCreate, query: s.empty, params: s.empty }), c('createOrder', { status: 201 }));
router.get('/', validate({ body: s.empty, query: s.orderList, params: s.empty }), c('listOrders'));
router.get('/:id', validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('orderById'));
router.patch('/:id/cancel', validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('cancelOrder'));

module.exports = router;
