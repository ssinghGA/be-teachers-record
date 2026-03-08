const express = require('express');
const { createReport, getAllReports, getReportById } = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.post('/', createReport);
router.get('/', getAllReports);
router.get('/:id', getReportById);

module.exports = router;
