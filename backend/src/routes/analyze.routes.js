const express = require('express');
const router = express.Router();
const analyzeController = require('../controllers/analyze.controller');
const upload = require('../middlewares/upload.middleware');
const scanRateLimit = require('../middlewares/scanRateLimit.middleware');

// Order matters:
//  1. upload.single  — parse the multipart body into req.file (memory only)
//  2. scanRateLimit  — enforce 3 scans/user/day BEFORE any AI pipeline runs
//  3. analyzeMedia   — run the actual detection pipeline
router.post('/', upload.single('file'), scanRateLimit, analyzeController.analyzeMedia);

module.exports = router;
