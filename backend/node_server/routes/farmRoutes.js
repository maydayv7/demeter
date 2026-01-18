const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController');

// Define Routes
router.post('/memory', farmController.addMemory);
router.get('/dashboard', farmController.getDashboard);
router.get('/crop/:cropId', farmController.getCropHistory);

module.exports = router;