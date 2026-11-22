const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const validate = require('../middleware/validate');
const c = require('../controllers/apiController');
const s = require('../validators/schemas');

router.post('/products/:id/reviews', authenticate, validate({ body: s.reviewCreate, query: s.empty, params: s.uuidParams }), c('createReview', { status: 201 }));
router.put('/:id', authenticate, validate({ body: s.reviewPatch, query: s.empty, params: s.uuidParams }), c('updateReview'));
router.delete('/:id', authenticate, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('deleteReview'));

router.get('/admin/reviews', authenticate, requireAdmin, validate({ body: s.empty, query: s.approvedQuery, params: s.empty }), c('adminReviews'));
router.patch('/admin/reviews/:id/approve', authenticate, requireAdmin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('approveReview'));
router.delete('/admin/reviews/:id', authenticate, requireAdmin, validate({ body: s.empty, query: s.empty, params: s.uuidParams }), c('adminDeleteReview'));

module.exports = router;
