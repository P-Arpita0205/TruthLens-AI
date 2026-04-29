const { vlmModel } = require('../config/gemini.config');
const edgeService = require('./edge.service');
const opencvForensicsService = require('./opencv-forensics.service');
const backupSignalsService = require('./backup-signals.service');
const sightengineService = require('./sightengine.service');

class VisionService {
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  clampScore(value, fallback = 50) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return fallback;
    return Math.max(0, Math.min(100, numericValue));
  }

  normalizeFlags(flags) {
    if (!Array.isArray(flags)) return [];

    return flags
      .map((flag) => String(flag || '').trim())
      .filter(Boolean);
  }

  uniqueFlags(flags) {
    return Array.from(new Set(this.normalizeFlags(flags)));
  }

  parseStructuredResponse(responseText) {
    const cleanJson = String(responseText || '')
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return {
      visual_score: this.clampScore(parsed.visual_score, 50),
      ai_generation_score: this.clampScore(parsed.ai_generation_score, parsed.visual_score ?? 50),
      authenticity_confidence: this.clampScore(parsed.authenticity_confidence, 50),
      flags: this.normalizeFlags(parsed.flags),
      summary: String(parsed.summary || '').trim()
    };
  }

  isTransientModelError(error) {
    const status = Number(error?.status || 0);
    return status === 429 || status === 500 || status === 503 || status === 504;
  }

  getAttemptLimit(options = {}) {
    const configuredLimit = Number(options.maxAttempts);
    if (!Number.isNaN(configuredLimit) && configuredLimit > 0) {
      return Math.max(1, Math.min(5, configuredLimit));
    }

    return options.sourceType === 'video-frame' ? 2 : 3;
  }

  getRetryDelayMs(attempt, options = {}) {
    const baseDelay = options.sourceType === 'video-frame' ? 300 : 800;
    return baseDelay * (attempt + 1);
  }

  shouldAttachLocalForensics(options = {}) {
    return options.sourceType === 'video-frame' || Boolean(options.includeLocalForensics);
  }

  async attachLocalForensics(result, imageBuffer, mimeType = 'image/jpeg', options = {}) {
    if (!this.shouldAttachLocalForensics(options)) {
      return {
        ...result,
        local_forensics_used: false,
        local_forensics_score: 0,
        local_metrics: {},
        face_detected: false
      };
    }

    if (options.sourceType === 'video-frame') {
      const backupSignal = await backupSignalsService.analyzeImageBuffer(imageBuffer, mimeType, options);
      const backupVisualScore = this.clampScore(backupSignal.visual_score, 0);
      const backupAiScore = this.clampScore(backupSignal.ai_generation_score, backupVisualScore);
      const backupLocalScore = this.clampScore(backupSignal.local_forensics_score, 0);
      const backupFrequencyScore = this.clampScore(backupSignal.signal_breakdown?.frequency, 0);
      const backupBiologicalScore = this.clampScore(backupSignal.signal_breakdown?.biological, 0);
      const mergedFlags = [...(result.flags || [])];

      if (backupVisualScore >= 34 || backupLocalScore >= 16) {
        mergedFlags.push(...(backupSignal.flags || []).slice(0, 4));
      } else if (backupVisualScore >= 24) {
        mergedFlags.push(...(backupSignal.flags || []).slice(0, 2));
      }

      const mergedVisualScore = this.clampScore(
        Math.max(
          result.visual_score || 0,
          backupVisualScore,
          backupLocalScore * 1.05,
          backupFrequencyScore + (backupBiologicalScore * 0.5)
        ),
        0
      );
      const mergedAiScore = this.clampScore(
        Math.max(
          result.ai_generation_score || result.visual_score || 0,
          backupAiScore,
          mergedVisualScore - 2
        ),
        mergedVisualScore
      );
      const mergedAuthenticityConfidence = this.clampScore(
        Math.min(
          Number(result.authenticity_confidence ?? 100),
          Number(backupSignal.authenticity_confidence ?? 100)
        ),
        0
      );

      return {
        ...result,
        visual_score: mergedVisualScore,
        ai_generation_score: mergedAiScore,
        authenticity_confidence: mergedAuthenticityConfidence,
        flags: this.uniqueFlags(mergedFlags),
        local_forensics_used: Boolean(backupSignal.local_forensics_used),
        local_forensics_score: backupLocalScore,
        local_metrics: backupSignal.local_metrics || {},
        face_detected: Boolean(backupSignal.face_detected),
        signal_breakdown: backupSignal.signal_breakdown,
        cnn_signal: backupSignal.cnn_signal
      };
    }

    const opencvSignal = await opencvForensicsService.analyzeImageBuffer(imageBuffer, mimeType);
    const localScore = this.clampScore(opencvSignal.score, 0);
    const mergedFlags = [...(result.flags || [])];

    if (localScore >= 18) {
      mergedFlags.push(...(opencvSignal.flags || []).slice(0, 3));
    } else if (localScore >= 12) {
      mergedFlags.push(...(opencvSignal.flags || []).slice(0, 2));
    }

    const photoBlend = options.sourceType !== 'video-frame';
    const mergedVisualScore = photoBlend
      ? this.clampScore(Math.max(result.visual_score || 0, localScore * 0.78))
      : this.clampScore(Math.max(result.visual_score || 0, localScore));
    const mergedAiScore = photoBlend
      ? this.clampScore(Math.max(result.ai_generation_score || result.visual_score || 0, localScore * 0.84))
      : this.clampScore(Math.max(result.ai_generation_score || result.visual_score || 0, localScore * 0.95));

    return {
      ...result,
      visual_score: mergedVisualScore,
      ai_generation_score: mergedAiScore,
      flags: this.uniqueFlags(mergedFlags),
      local_forensics_used: opencvSignal.available,
      local_forensics_score: localScore,
      local_metrics: opencvSignal.metrics || {},
      face_detected: opencvSignal.face_detected
    };
  }

  async buildFallbackAnalysis(imageBuffer, mimeType = 'image/jpeg', error = null, options = {}) {
    // ── Tier 2: Sightengine Specialized Deepfake API ──────────────────────────
    // Only activates when Gemini fails, is rate-limited, or is inconclusive.
    // Achieves ~90%+ accuracy on facial manipulation via DFDC-trained models.
    // Requires SIGHTENGINE_API_USER + SIGHTENGINE_API_SECRET in .env
    if (sightengineService.isConfigured()) {
      const sightResult = await sightengineService.analyzeBuffer(imageBuffer, mimeType);

      if (sightResult.available && sightResult.status === 'ok') {
        console.info('[VisionService] Tier 2 fallback: Sightengine deepfake API succeeded.');

        // Map Sightengine result to the shape expected by the agent pipeline
        const sightengineBase = {
          visual_score: sightResult.visual_score,
          ai_generation_score: sightResult.ai_generation_score,
          authenticity_confidence: sightResult.authenticity_confidence,
          flags: sightResult.flags || [],
          summary: sightResult.summary || '',
          analysis_ok: true,
          fallback_used: true,
          fallback_source: 'sightengine'
        };

        // Enrich with local forensic signals (edge, metadata, OpenCV)
        return await this.attachLocalForensics(sightengineBase, imageBuffer, mimeType, options);
      }

      console.warn('[VisionService] Sightengine unavailable, falling to Tier 3 local signals.');
    }

    // ── Tier 3: Local Backup Signals (CNN + OpenCV + Edge heuristics) ─────────
    const backupResult = await backupSignalsService.analyzeImageBuffer(imageBuffer, mimeType, options);

    return {
      ...backupResult,
      error_code: Number(error?.status || 0),
      error_message: error?.message || 'Vision model analysis failed.'
    };
  }

  /**
   * Send an image buffer to Gemini VLM for deepfake analysis.
   * @param {Buffer} imageBuffer - The extracted frame or photo buffer
   * @param {string} mimeType - e.g., 'image/jpeg'
   */
  async runVLMAnalysis(imageBuffer, mimeType = 'image/jpeg', options = {}) {
    if (options.skipRemote) {
      return await this.buildFallbackAnalysis(
        imageBuffer,
        mimeType,
        options.fallbackError || {
          status: 503,
          message: 'Remote vision analysis was skipped after an earlier service limitation.'
        },
        options
      );
    }

    try {
      const videoFramePrompt = options.sourceType === 'video-frame'
        ? `
        This image is a sampled frame from a video.
        Look for concrete deepfake evidence such as:
        1. Face-swap blending around the jawline, cheeks, temples, beard, or hairline
        2. Over-smoothed skin or facial detail that does not match the rest of the frame
        3. Lip, teeth, eye, or eyelash rendering that looks too clean, warped, or synthetic
        4. Identity inconsistency cues such as unusual symmetry, uncanny facial proportions, or face/background mismatch
        5. Lighting and texture on the face that look flatter or more artificial than surrounding objects
        Do not treat ordinary compression, motion blur, camera softness, beauty filters, or low-light noise alone as evidence of manipulation.
        `
        : '';

      const photoPrompt = options.sourceType === 'video-frame'
        ? ''
        : `
        For photorealistic portrait or selfie-style images, inspect carefully for:
        1. Subtle AI portrait cues such as uniformly polished skin, overly tidy hair masses, and faces that look a little too clean overall
        2. Finger, hand, wristwatch, jewelry, or arm-over-shoulder anatomy that looks slightly malformed or fused
        3. Background people or repeated small human figures that look inconsistent, smeared, or generically rendered
        4. Semi-transparent AI watermark or generation mark in image corners, especially the bottom-right corner
        5. Multi-person images where one face looks slightly detached, overly refined, or inconsistent with the rest of the scene
        `;

      const prompt = `
        You are an expert digital forensics analyst performing a precision-focused review.
        Analyze this image for signs of AI generation, diffusion artifacts, face swaps, or other manipulation.
        Look especially for:
        1. Over-smoothed or waxy skin
        2. Unnatural eyes, teeth, hair strands, ears, fingers, or jewelry
        3. Lighting mismatches, inconsistent reflections, or impossible shadows
        4. Repeated background patterns, warped edges, or geometry inconsistencies
        5. Overly perfect symmetry, synthetic bokeh, or plastic-looking textures
        6. Any signs that the image may be Gemini-, diffusion-, or GAN-generated
        ${videoFramePrompt}
        ${photoPrompt}

        Only assign high manipulation scores when there are clear, concrete forensic cues.
        Do not infer manipulation from style alone. Studio lighting, retouching, screenshots, exports, compression, or missing metadata are not enough by themselves.
        If the evidence is weak, ambiguous, or could be explained by normal capture/compression, keep the suspicious scores low and say so.
        Flags should mention only grounded visual anomalies, not vague suspicion.
        
        Return ONLY a JSON response in the following format:
        {
          "visual_score": <number 0-100 where 100 means highly manipulated>,
          "ai_generation_score": <number 0-100 where 100 means highly likely AI-generated>,
          "authenticity_confidence": <number 0-100 where 100 means highly confident the image is real>,
          "flags": ["specific anomalies or synthetic-image concerns"],
          "summary": "short forensic summary"
        }
      `;

      const imageParts = [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType
          }
        }
      ];

      let lastError = null;
      const attemptLimit = this.getAttemptLimit(options);
      for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
        try {
          const result = await vlmModel.generateContent([prompt, ...imageParts]);
          const responseText = result.response.text();

          const parsed = this.parseStructuredResponse(responseText);
          if (parsed.ai_generation_score >= 55 && parsed.flags.length === 0) {
            parsed.flags.push('High probability of synthetic generation patterns despite subtle visible defects.');
          }

          const parsedResult = {
            ...parsed,
            analysis_ok: true
          };
          return await this.attachLocalForensics(parsedResult, imageBuffer, mimeType, options);
        } catch (error) {
          lastError = error;
          if (!this.isTransientModelError(error) || attempt === attemptLimit - 1) {
            throw error;
          }
          await this.sleep(this.getRetryDelayMs(attempt, options));
        }
      }

      throw lastError || new Error('Vision model analysis failed.');
    } catch (error) {
      console.warn('VLM Analysis Error, using local forensic fallback:', error?.message || error);
      return await this.buildFallbackAnalysis(imageBuffer, mimeType, error, options);
    }
  }
}

module.exports = new VisionService();
