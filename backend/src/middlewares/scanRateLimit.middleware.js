/**
 * scanRateLimit middleware
 *
 * Enforces SEPARATE per-user daily scan quotas by media type:
 *   - Video: 3 scans/day
 *   - Photo: 3 scans/day
 *   - Total: 6 scans/day (3 video + 3 photo)
 *
 * Identity resolution (in priority order):
 *  1. Firebase ID Token in Authorization: Bearer <token> header → verified UID
 *  2. No token → falls back to IP-based tracking (allows anonymous usage)
 *
 * Storage: Firestore collection `scan_quotas`
 *   Doc key: `{identity}_{mediaType}_{YYYY-MM-DD}`
 *
 * Config:  DAILY_SCAN_LIMIT env var sets the per-type limit (default: 3)
 */

const { admin, db } = require('../config/firebase.config');

const PER_TYPE_LIMIT = Math.max(1, Number(process.env.DAILY_SCAN_LIMIT) || 3);

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Detect media type from the uploaded file MIME type.
 * Returns 'video' or 'photo'.
 */
function detectMediaType(req) {
  const mime = req.file?.mimetype || '';
  if (mime.startsWith('video/')) return 'video';
  return 'photo';
}

function buildQuotaDocId(identity, mediaType) {
  const safe = String(identity).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `${safe}_${mediaType}_${getTodayKey()}`;
}

async function resolveUserId(req) {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

async function resolveIdentity(req) {
  const uid = await resolveUserId(req);
  if (uid) {
    req.user = { uid };
    return uid;
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `ip_${ip}`;
}

const scanRateLimit = async (req, res, next) => {
  if (!db) {
    console.warn('[RateLimit] Firestore unavailable — skipping quota check.');
    return next();
  }

  try {
    const identity = await resolveIdentity(req);
    const mediaType = detectMediaType(req);
    const docId = buildQuotaDocId(identity, mediaType);
    const quotaRef = db.collection('scan_quotas').doc(docId);

    const snapshot = await quotaRef.get();
    const currentCount = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;

    if (currentCount >= PER_TYPE_LIMIT) {
      return res.status(429).json({
        error: `Daily ${mediaType} scan limit reached. You can perform up to ${PER_TYPE_LIMIT} ${mediaType} scans per day. Please try again tomorrow.`,
        mediaType,
        limit: PER_TYPE_LIMIT,
        used: currentCount,
        remaining: 0,
        resetsAt: `${getTodayKey()}T23:59:59Z`
      });
    }

    // Increment atomically
    await quotaRef.set(
      {
        identity,
        mediaType,
        count: currentCount + 1,
        date: getTodayKey(),
        lastScanAt: new Date().toISOString()
      },
      { merge: true }
    );

    req.scanQuota = {
      mediaType,
      limit: PER_TYPE_LIMIT,
      used: currentCount + 1,
      remaining: PER_TYPE_LIMIT - (currentCount + 1)
    };

    return next();
  } catch (error) {
    console.warn('[RateLimit] Quota check failed — allowing request:', error?.message || error);
    return next();
  }
};

module.exports = scanRateLimit;
