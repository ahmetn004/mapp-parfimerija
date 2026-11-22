const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.use(authenticate);
router.get('/', validate({ body: s.empty, query: s.empty, params: s.empty }), c('listAddresses'));
router.post('/', validate({ body: s.address, query: s.empty, params: s.empty }), c('createAddress', { status: 201 }));
router.put('/:id', validate({ body: s.address, query: s.empty, params: s.uuidParams }), c('updateAddress'));
router.patch('/:id/default', validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('defaultAddress'));
router.delete('/:id', validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('deleteAddress'));

module.exports = router;
