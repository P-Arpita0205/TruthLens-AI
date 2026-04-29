const express = require('express');
const router = express.Router();
const analyzeController = require('../controllers/analyze.controller');
const upload = require('../middlewares/upload.middleware');
const scanRateLimit = require('../middlewares/scanRateLimit.middleware');
const { admin, db } = require('../config/firebase.config');

const PER_TYPE_LIMIT = 999999;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/analyze/quota?type=video|photo
// Returns current scan usage without consuming a scan
router.get('/quota', async (req, res) => {
  const mediaType = req.query.type === 'video' ? 'video' : 'photo';

  try {
    // Resolve identity (same logic as middleware)
    let identity = null;
    const authHeader = req.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.slice(7).trim();
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        identity = decoded.uid;
      } catch { /* fall through to IP */ }
    }
    if (!identity) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress || 'unknown';
      identity = `ip_${ip}`;
    }

    const safe = String(identity).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
    const docId = `${safe}_${mediaType}_${getTodayKey()}`;

    let used = 0;
    if (db) {
      const snapshot = await db.collection('scan_quotas').doc(docId).get();
      if (snapshot.exists) used = Number(snapshot.data()?.count || 0);
    }

    return res.status(200).json({
      mediaType,
      limit: PER_TYPE_LIMIT,
      used,
      remaining: Math.max(0, PER_TYPE_LIMIT - used)
    });
  } catch (error) {
    // Fail gracefully — return full quota so UI doesn't block user
    return res.status(200).json({
      mediaType,
      limit: PER_TYPE_LIMIT,
      used: 0,
      remaining: PER_TYPE_LIMIT
    });
  }
});

// Order matters:
//  1. upload.single  — parse the multipart body into req.file (memory only)
//  2. scanRateLimit  — enforce 3 scans/user/day BEFORE any AI pipeline runs
//  3. analyzeMedia   — run the actual detection pipeline
router.post('/', upload.single('file'), scanRateLimit, analyzeController.analyzeMedia);

module.exports = router;
