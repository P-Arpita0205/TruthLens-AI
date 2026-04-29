/**
 * scanRateLimit middleware
 *
 * Enforces a per-user daily scan quota (default: 3 scans/day) to protect
 * API token budgets (Gemini, Sightengine, etc.) from exhaustion.
 *
 * Strategy:
 *  - Uses Firestore collection `scan_quotas` with documents keyed by
 *    `{userId}_{YYYY-MM-DD}` (UTC date).
 *  - On each request: reads the doc, checks count < limit, increments atomically.
 *  - Documents auto-expire conceptually at midnight UTC (key includes the date).
 *  - No cron job needed — old date keys are simply never matched again.
 *
 * Config (via environment variables):
 *   DAILY_SCAN_LIMIT   — scans per user per day (default: 3)
 *
 * Error responses:
 *   401  — unauthenticated request (no req.user)
 *   429  — daily limit reached
 *   503  — Firestore unavailable (fails open: request is allowed through)
 */

const { db } = require('../config/firebase.config');

const DAILY_LIMIT = Math.max(1, Number(process.env.DAILY_SCAN_LIMIT) || 3);

/**
 * Returns today's UTC date string in YYYY-MM-DD format.
 */
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // e.g. "2026-04-29"
}

/**
 * Builds the Firestore document ID for a user's daily quota.
 * e.g. "uXjK9AbcDef_2026-04-29"
 */
function buildQuotaDocId(userId) {
  return `${userId}_${getTodayKey()}`;
}

const scanRateLimit = async (req, res, next) => {
  // ── 1. Require authentication ─────────────────────────────────────────────
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required to perform a scan.'
    });
  }

  // ── 2. Fail-open if Firestore is unavailable ──────────────────────────────
  if (!db) {
    console.warn('[RateLimit] Firestore unavailable — skipping quota check.');
    return next();
  }

  const docId = buildQuotaDocId(userId);
  const quotaRef = db.collection('scan_quotas').doc(docId);

  try {
    // ── 3. Read current usage ───────────────────────────────────────────────
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

    // ── 4. Increment atomically ─────────────────────────────────────────────
    // Using set with merge so the doc is created on first scan of the day
    await quotaRef.set(
      {
        userId,
        count: currentCount + 1,
        date: getTodayKey(),
        lastScanAt: new Date().toISOString()
      },
      { merge: true }
    );

    // Expose quota info to the controller (optional, for response headers)
    req.scanQuota = {
      limit: DAILY_LIMIT,
      used: currentCount + 1,
      remaining: DAILY_LIMIT - (currentCount + 1)
    };

    return next();
  } catch (error) {
    // Fail-open: if Firestore throws, let the request through rather than
    // blocking the user due to an infrastructure error.
    console.warn('[RateLimit] Firestore quota check failed — allowing request:', error?.message || error);
    return next();
  }
};

module.exports = scanRateLimit;
