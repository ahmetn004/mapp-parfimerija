const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.use(authenticate);
router.get('/', validate({ body: s.empty, query: s.empty, params: s.empty }), c('getProfile'));
router.patch('/', validate({ body: s.profilePatch, query: s.empty, params: s.empty }), c('updateProfile'));

module.exports = router;
