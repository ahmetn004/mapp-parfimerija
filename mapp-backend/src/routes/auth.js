const router = require('express').Router();
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');
const empty = s.empty;

router.post('/register', validate({ body: s.register }), c('register', { status: 201 }));
router.post('/login', validate({ body: s.login }), c('login'));
router.post('/logout', authenticate, validate({ body: empty, query: empty, params: empty }), c('logout'));
router.post('/refresh', validate({ body: s.refresh }), c('refresh'));
router.post('/forgot-password', validate({ body: s.forgot }), c('forgotPassword'));
router.get('/me', authenticate, validate({ body: empty, query: empty, params: empty }), c('me'));

module.exports = router;
