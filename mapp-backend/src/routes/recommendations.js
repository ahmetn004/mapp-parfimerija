const router = require('express').Router();
const optionalAuthenticate = require('../middleware/optionalAuthenticate');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.post('/', optionalAuthenticate, validate({ body: s.recommendations, query: s.empty, params: s.empty }), c('recommend'));
router.get('/history', authenticate, validate({ body: s.empty, query: s.empty, params: s.empty }), c('recommendationHistory'));

module.exports = router;
