const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/profile', require('./profile'));
router.use('/addresses', require('./addresses'));
router.use('/', require('./catalog'));
router.use('/admin', require('./adminCatalog'));
router.use('/', require('./commerce'));
router.use('/admin', require('./adminCommerce'));
router.use('/orders', require('./orders'));
router.use('/admin', require('./adminOrders'));
router.use('/', require('./reviews'));
router.use('/recommendations', require('./recommendations'));

module.exports = router;
