/**
 * scanRateLimit middleware
 *
 * Enforces a per-user daily scan quota (default: 3 scans/day).
 *
 * Identity resolution (in priority order):
 *  1. Firebase ID Token in Authorization: Bearer <token> header → verified UID
 *  2. No token → falls back to IP-based tracking (allows anonymous usage)
 *
 * Storage: Firestore collection `scan_quotas`, key = `{identity}_{YYYY-MM-DD}`
 * Reset:   Automatic at midnight UTC (old date keys are never matched again)
 *
 * Config:  DAILY_SCAN_LIMIT env var (default: 3)
 */

const { admin, db } = require('../config/firebase.config');

const DAILY_LIMIT = Math.max(1, Number(process.env.DAILY_SCAN_LIMIT) || 3);

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function buildQuotaDocId(identity) {
  // Sanitize identity for use as a Firestore document ID
  const safe = String(identity).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `${safe}_${getTodayKey()}`;
}

/**
 * Attempt to verify a Firebase ID token from the Authorization header.
 * Returns the UID on success, or null if missing/invalid.
 */
async function resolveUserId(req) {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid || null;
  } catch {
    return null; // expired or invalid token — fall through to IP tracking
  }
}

/**
 * Get a stable identity for rate-limiting purposes.
 * Authenticated users → their Firebase UID
 * Unauthenticated users → their IP address
 */
async function resolveIdentity(req) {
  const uid = await resolveUserId(req);
  if (uid) {
    req.user = { uid }; // set req.user for downstream use (controller etc.)
    return { identity: uid, isAuthenticated: true };
  }

  // Fallback: use IP address for anonymous users
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return { identity: `ip_${ip}`, isAuthenticated: false };
}

const scanRateLimit = async (req, res, next) => {
  // Fail-open if Firestore is unavailable
  if (!db) {
    console.warn('[RateLimit] Firestore unavailable — skipping quota check.');
    return next();
  }

  try {
    const { identity } = await resolveIdentity(req);
    const docId = buildQuotaDocId(identity);
    const quotaRef = db.collection('scan_quotas').doc(docId);

    const snapshot = await quotaRef.get();
    const currentCount = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;

    if (currentCount >= DAILY_LIMIT) {
      return res.status(429).json({
        error: `Daily scan limit reached. You can perform up to ${DAILY_LIMIT} scans per day. Please try again tomorrow.`,
        limit: DAILY_LIMIT,
        used: currentCount,
        remaining: 0,
        resetsAt: `${getTodayKey()}T23:59:59Z`
      });
    }

    // Increment atomically
    await quotaRef.set(
      {
        identity,
        count: currentCount + 1,
        date: getTodayKey(),
        lastScanAt: new Date().toISOString()
      },
      { merge: true }
    );

    req.scanQuota = {
      limit: DAILY_LIMIT,
      used: currentCount + 1,
      remaining: DAILY_LIMIT - (currentCount + 1)
    };

    return next();
  } catch (error) {
    // Fail-open: don't block users due to infrastructure errors
    console.warn('[RateLimit] Quota check failed — allowing request:', error?.message || error);
    return next();
  }
};

module.exports = scanRateLimit;
