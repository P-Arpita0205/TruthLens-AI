/**
 * SightengineService — Tier 2 Deepfake Detection Fallback
 *
 * Activated when Gemini VLM fails, is rate-limited, triggers a safety filter,
 * or returns an inconclusive/uncertain response.
 *
 * Sightengine's deepfake model is trained on the DFDC dataset and consistently
 * achieves ~90%+ accuracy on facial manipulation detection.
 *
 * Required environment variables:
 *   SIGHTENGINE_API_USER   — your Sightengine API user ID
 *   SIGHTENGINE_API_SECRET — your Sightengine API secret
 *
 * Get free API keys at: https://sightengine.com/
 * Deepfake model docs:  https://sightengine.com/docs/deepfake-detection
 */

const SIGHTENGINE_ENDPOINT = 'https://api.sightengine.com/1.0/check.json';
const REQUEST_TIMEOUT_MS = 15_000;

class SightengineService {
  /**
   * Returns true if the required env vars are present.
   * Used as a guard before making any API calls.
   */
  isConfigured() {
    return (
      Boolean(String(process.env.SIGHTENGINE_API_USER || '').trim()) &&
      Boolean(String(process.env.SIGHTENGINE_API_SECRET || '').trim())
    );
  }

  /**
   * Converts Sightengine's 0–1 deepfake probability to TruthLens' 0–100 scale.
   * Sightengine: 0 = authentic, 1 = deepfake
   * TruthLens:   0 = authentic, 100 = manipulated
   */
  toManipulationScore(deepfakeScore) {
    const clamped = Math.max(0, Math.min(1, Number(deepfakeScore) || 0));
    return Math.round(clamped * 100);
  }

  getMimeExtension(mimeType = 'image/jpeg') {
    const map = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/bmp': 'bmp'
    };
    return map[mimeType] || 'jpg';
  }

  /**
   * Build a normalized result object compatible with VisionService's
   * expected shape (visual_score, ai_generation_score, flags, summary).
   */
  buildResult(deepfakeScore) {
    const manipulationScore = this.toManipulationScore(deepfakeScore);
    const authenticityConfidence = 100 - manipulationScore;
    const flags = [];

    if (deepfakeScore >= 0.90) {
      flags.push(`Sightengine deepfake model flagged this media with very high confidence (${(deepfakeScore * 100).toFixed(1)}% deepfake probability).`);
    } else if (deepfakeScore >= 0.70) {
      flags.push(`Sightengine deepfake model flagged elevated manipulation probability (${(deepfakeScore * 100).toFixed(1)}%).`);
    } else if (deepfakeScore >= 0.50) {
      flags.push(`Sightengine deepfake model detected moderate manipulation signals (${(deepfakeScore * 100).toFixed(1)}% probability).`);
    }

    const summary = deepfakeScore >= 0.50
      ? `Sightengine's specialized deepfake model (trained on DFDC) detected a ${(deepfakeScore * 100).toFixed(1)}% probability of facial manipulation.`
      : `Sightengine's deepfake model found no strong manipulation signals (${(deepfakeScore * 100).toFixed(1)}% deepfake probability).`;

    return {
      available: true,
      status: 'ok',
      visual_score: manipulationScore,
      ai_generation_score: manipulationScore,
      authenticity_confidence: authenticityConfidence,
      flags,
      summary,
      raw_deepfake_score: deepfakeScore
    };
  }

  /**
   * Sends an image buffer to the Sightengine deepfake detection API.
   *
   * @param {Buffer} imageBuffer — raw image bytes
   * @param {string} mimeType    — e.g. 'image/jpeg'
   * @returns {Promise<object>}  — normalized result or { available: false }
   */
  async analyzeBuffer(imageBuffer, mimeType = 'image/jpeg') {
    if (!imageBuffer?.length) {
      return { available: false, status: 'empty_buffer' };
    }

    if (!this.isConfigured()) {
      return { available: false, status: 'not_configured' };
    }

    try {
      // Use native Node 18+ FormData + Blob — no extra packages required
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: mimeType });

      formData.append('media', blob, `frame.${this.getMimeExtension(mimeType)}`);
      formData.append('models', 'deepfake');
      formData.append('api_user', process.env.SIGHTENGINE_API_USER);
      formData.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

      const response = await fetch(SIGHTENGINE_ENDPOINT, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        throw new Error(`Sightengine HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        const apiMessage = data.error?.message || data.error || 'Unknown API error';
        throw new Error(`Sightengine API error: ${apiMessage}`);
      }

      const deepfakeScore = Number(data.deepfake?.score ?? 0);
      return this.buildResult(deepfakeScore);
    } catch (error) {
      const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      console.warn(
        `[Sightengine] ${isTimeout ? 'Request timed out' : 'API call failed'}:`,
        error?.message || error
      );
      return {
        available: false,
        status: isTimeout ? 'timeout' : 'api_error',
        error_message: error?.message || 'Sightengine API call failed.'
      };
    }
  }
}

module.exports = new SightengineService();
