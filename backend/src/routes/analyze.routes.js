const express = require('express');
const router = express.Router();
const analyzeController = require('../controllers/analyze.controller');
const upload = require('../middlewares/upload.middleware');

router.post('/', upload.single('file'), analyzeController.analyzeMedia);

module.exports = router;
