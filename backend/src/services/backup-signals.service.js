const edgeService = require('./edge.service');
const opencvForensicsService = require('./opencv-forensics.service');
const cnnFallbackService = require('./cnn-fallback.service');

class BackupSignalsService {
  clampScore(value, fallback = 0) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return fallback;
    return Math.max(0, Math.min(100, numericValue));
  }

  normalizeFlags(flags = []) {
    if (!Array.isArray(flags)) return [];

    return flags
      .map((flag) => String(flag || '').trim())
      .filter(Boolean);
  }

  uniqueFlags(flags = []) {
    return Array.from(new Set(this.normalizeFlags(flags)));
  }

  getMetric(metrics = {}, key, fallback = 0) {
    const numericValue = Number(metrics?.[key]);
    return Number.isNaN(numericValue) ? fallback : numericValue;
  }

  computeFrequencySignal(metrics = {}) {
    const highFrequencyRatio = this.getMetric(metrics, 'fft_high_frequency_ratio');
    const periodicSpikeScore = this.getMetric(metrics, 'fft_periodic_spike_score');
    const gridArtifactScore = this.getMetric(metrics, 'fft_grid_artifact_score');
    const flags = [];
    let score = 0;

    if (periodicSpikeScore >= 0.26 || gridArtifactScore >= 0.18) {
      score += 16;
      flags.push('Fourier-domain analysis found periodic energy spikes or grid-like artifacts that can appear in GAN-generated media.');
    } else if (periodicSpikeScore >= 0.18 || gridArtifactScore >= 0.12) {
      score += 9;
      flags.push('Fourier-domain analysis found moderate periodic structure that is uncommon in natural captures.');
    }

    if (highFrequencyRatio >= 0.82 || highFrequencyRatio <= 0.34) {
      score += 5;
      flags.push('Frequency energy is distributed unusually compared with most natural camera imagery.');
    }

    return {
      score: this.clampScore(score, 0),
      flags,
      metrics: {
        fft_high_frequency_ratio: highFrequencyRatio,
        fft_periodic_spike_score: periodicSpikeScore,
        fft_grid_artifact_score: gridArtifactScore
      }
    };
  }

  computeBiologicalSignal(metrics = {}, options = {}) {
    const skinPixelRatio = this.getMetric(metrics, 'skin_pixel_ratio');
    const skinChromaStd = this.getMetric(metrics, 'skin_chroma_std');
    const skinToneFlatness = this.getMetric(metrics, 'skin_tone_flatness');
    const skinGreenRedRatio = this.getMetric(metrics, 'skin_green_red_ratio');
    const faceDetected = this.getMetric(metrics, 'face_count') > 0 || Boolean(metrics?.face_detected);
    const flags = [];
    let score = 0;

    if (!faceDetected || skinPixelRatio < 0.06) {
      return {
        score: 0,
        flags: [],
        metrics: {
          skin_pixel_ratio: skinPixelRatio,
          skin_chroma_std: skinChromaStd,
          skin_tone_flatness: skinToneFlatness,
          skin_green_red_ratio: skinGreenRedRatio
        }
      };
    }

    if (skinToneFlatness >= 0.80 && skinChromaStd <= 8.5) {
      score += 12;
      flags.push('Detected facial skin-tone variation looks unusually flat, which weakens natural biological texture cues.');
    } else if (skinToneFlatness >= 0.72 && skinChromaStd <= 11.0) {
      score += 7;
      flags.push('Detected facial skin-tone variation is flatter than most natural face footage.');
    }

    if (skinGreenRedRatio <= 0.74 || skinGreenRedRatio >= 1.18) {
      score += 4;
    }

    if (options.sourceType === 'video-frame' && skinToneFlatness >= 0.82) {
      score += 3;
    }

    return {
      score: this.clampScore(score, 0),
      flags,
      metrics: {
        skin_pixel_ratio: skinPixelRatio,
        skin_chroma_std: skinChromaStd,
        skin_tone_flatness: skinToneFlatness,
        skin_green_red_ratio: skinGreenRedRatio
      }
    };
  }

  computeVideoFaceSignal(metrics = {}) {
    const faceDetected = Number(metrics?.face_count || 0) > 0 || Boolean(metrics?.face_detected);
    if (!faceDetected) {
      return {
        score: 0,
        flags: [],
        metrics: {
          jaw_asymmetry: this.getMetric(metrics, 'jaw_asymmetry'),
          jaw_width_ratio: this.getMetric(metrics, 'jaw_width_ratio'),
          jaw_center_offset: this.getMetric(metrics, 'jaw_center_offset'),
          mouth_asymmetry: this.getMetric(metrics, 'mouth_asymmetry'),
          eye_highlight_asymmetry: this.getMetric(metrics, 'eye_highlight_asymmetry')
        }
      };
    }

    const jawAsymmetry = this.getMetric(metrics, 'jaw_asymmetry');
    const jawWidthRatio = this.getMetric(metrics, 'jaw_width_ratio');
    const jawCenterOffset = this.getMetric(metrics, 'jaw_center_offset');
    const mouthAsymmetry = this.getMetric(metrics, 'mouth_asymmetry');
    const mouthOpenRatio = this.getMetric(metrics, 'mouth_open_ratio');
    const eyeAsymmetry = this.getMetric(metrics, 'eye_highlight_asymmetry');
    const eyeOpenness = this.getMetric(metrics, 'eye_openness_ratio');
    const flags = [];
    let score = 0;

    if (jawAsymmetry >= 0.15 || jawCenterOffset >= 0.14) {
      score += 12;
      flags.push('Jaw shape or position looks unusual in this frame.');
    } else if (jawAsymmetry >= 0.11 || jawCenterOffset >= 0.1) {
      score += 6;
      flags.push('Jaw shape looks slightly uneven in this frame.');
    }

    if (jawWidthRatio > 0.86 || (jawWidthRatio > 0 && jawWidthRatio < 0.34)) {
      score += 8;
      flags.push('Jaw size looks unusual compared with the rest of the face.');
    }

    if (mouthAsymmetry >= 0.14 || mouthOpenRatio >= 0.42) {
      score += 8;
      flags.push('Lip or mouth shape looks unusual in this frame.');
    } else if (mouthAsymmetry >= 0.1) {
      score += 4;
    }

    if (eyeAsymmetry >= 0.018 || eyeOpenness >= 0.5) {
      score += 6;
      flags.push('Eye shape or eye behavior looks unusual in this frame.');
    }

    return {
      score: this.clampScore(score, 0),
      flags,
      metrics: {
        jaw_asymmetry: jawAsymmetry,
        jaw_width_ratio: jawWidthRatio,
        jaw_center_offset: jawCenterOffset,
        mouth_asymmetry: mouthAsymmetry,
        mouth_open_ratio: mouthOpenRatio,
        eye_highlight_asymmetry: eyeAsymmetry,
        eye_openness_ratio: eyeOpenness
      }
    };
  }

  buildSummary(options = {}, visualScore, aiGenerationScore, signalBreakdown = {}) {
    const sourceLabel = options.sourceType === 'video-frame'
      ? 'video-frame backup'
      : 'deterministic backup';

    const labelMap = {
      compression: 'compression',
      metadata: 'metadata',
      structure: 'structure',
      local_forensics: 'local forensics',
      facial: 'face-geometry',
      frequency: 'frequency-domain',
      biological: 'biological',
      cnn: 'CNN'
    };

    const activeSignals = Object.entries(signalBreakdown)
      .filter(([, value]) => Number(value) > 0)
      .map(([name]) => labelMap[name] || name);

    const signalLabel = activeSignals.length
      ? activeSignals.join(', ')
      : 'basic local forensic signals';

    if (visualScore >= 60 || aiGenerationScore >= 66) {
      return `Remote vision analysis was unavailable, so the ${sourceLabel} fused ${signalLabel} and found multiple suspicious signals.`;
    }

    if (visualScore >= 38 || aiGenerationScore >= 44) {
      return `Remote vision analysis was unavailable, so the ${sourceLabel} fused ${signalLabel} and found moderate anomalies that should be treated cautiously.`;
    }

    return `Remote vision analysis was unavailable, so the ${sourceLabel} fused ${signalLabel} and did not find strong manipulation cues.`;
  }

  async analyzeImageBuffer(buffer, mimeType = 'image/jpeg', options = {}) {
    const sourceType = options.sourceType || 'image';
    const isVideoFrame = sourceType === 'video-frame';
    const compressionSignal = edgeService.detectCompressionNoise(buffer, mimeType, {
      ignoreMetadata: isVideoFrame
    });
    const metadataSignal = isVideoFrame
      ? {
          score: 0,
          flags: [],
          metrics: {
            has_embedded_metadata: true,
            marker_count: 0,
            chunk_count: 0,
            skipped_for_video_frame: true
          }
        }
      : edgeService.extractMetadataSignals(buffer, mimeType);
    const faceSignal = edgeService.detectFaceArtifacts(buffer, mimeType);
    const opencvSignal = await opencvForensicsService.analyzeImageBuffer(buffer, mimeType);
    const cnnSignal = await cnnFallbackService.analyzeImageBuffer(buffer, mimeType, options);
    const frequencySignal = this.computeFrequencySignal(opencvSignal.metrics || {});
    const biologicalSignal = this.computeBiologicalSignal(
      { ...(opencvSignal.metrics || {}), face_detected: opencvSignal.face_detected },
      options
    );
    const facialSignal = isVideoFrame
      ? this.computeVideoFaceSignal({ ...(opencvSignal.metrics || {}), face_detected: opencvSignal.face_detected })
      : { score: 0, flags: [], metrics: {} };

    const signalBreakdown = {
      compression: this.clampScore(compressionSignal.score, 0),
      metadata: this.clampScore(metadataSignal.score, 0),
      structure: this.clampScore(faceSignal.score, 0),
      local_forensics: this.clampScore(opencvSignal.score, 0),
      facial: this.clampScore(facialSignal.score, 0),
      frequency: this.clampScore(frequencySignal.score, 0),
      biological: this.clampScore(biologicalSignal.score, 0),
      cnn: this.clampScore(cnnSignal.score, 0)
    };

    let suspiciousScore =
      (signalBreakdown.compression * 0.55) +
      (signalBreakdown.metadata * 0.45) +
      (signalBreakdown.structure * 0.55) +
      (signalBreakdown.local_forensics * (isVideoFrame ? 0.72 : 0.82)) +
      (signalBreakdown.facial * (isVideoFrame ? 1.28 : 0)) +
      (signalBreakdown.frequency * (isVideoFrame ? 0.32 : 0.90)) +
      (signalBreakdown.biological * (isVideoFrame ? 0.42 : 0.78)) +
      (signalBreakdown.cnn * 1.05);

    const corroboratingSignals = Object.values(signalBreakdown).filter((value) => Number(value) >= 10).length;
    if (corroboratingSignals >= 3) {
      suspiciousScore += isVideoFrame ? 7 : 9;
    } else if (corroboratingSignals >= 2) {
      suspiciousScore += 4;
    }

    if (cnnSignal.available && signalBreakdown.cnn >= 72) {
      suspiciousScore += 6;
    }

    if (isVideoFrame && signalBreakdown.facial === 0 && !opencvSignal.face_detected) {
      suspiciousScore = Math.min(suspiciousScore, 18);
    } else if (isVideoFrame && signalBreakdown.facial < 8 && signalBreakdown.local_forensics < 16) {
      suspiciousScore = Math.min(suspiciousScore, 28);
    }

    const visualScore = this.clampScore(
      isVideoFrame
        ? Math.max(
            suspiciousScore,
            signalBreakdown.facial + (signalBreakdown.local_forensics * 0.48),
            signalBreakdown.local_forensics,
            signalBreakdown.frequency + (signalBreakdown.facial * 0.4) + (signalBreakdown.biological * 0.2)
          )
        : Math.max(
            suspiciousScore,
            signalBreakdown.local_forensics,
            signalBreakdown.frequency + (signalBreakdown.cnn * 0.30)
          ),
      isVideoFrame ? 12 : 16
    );

    const aiGenerationScore = this.clampScore(
      Math.max(
        visualScore +
          (signalBreakdown.frequency >= 12 ? (isVideoFrame ? 2 : 5) : 0) +
          (signalBreakdown.facial >= 12 ? 6 : 0) +
          (signalBreakdown.cnn >= 58 ? 6 : 0),
        signalBreakdown.local_forensics * (isVideoFrame ? 0.92 : 0.88),
        signalBreakdown.cnn
      ),
      visualScore
    );

    const normalizedVisualScore = isVideoFrame && signalBreakdown.facial === 0
      ? this.clampScore(Math.min(visualScore, 28), 0)
      : visualScore;
    const normalizedAiGenerationScore = isVideoFrame && signalBreakdown.facial === 0
      ? this.clampScore(Math.min(aiGenerationScore, 32), normalizedVisualScore)
      : aiGenerationScore;

    let authenticityConfidence = isVideoFrame ? 82 : 66;
    if (metadataSignal.metrics?.has_embedded_metadata) authenticityConfidence += isVideoFrame ? 0 : 6;
    if (!opencvSignal.flags?.length && signalBreakdown.frequency < 8 && signalBreakdown.biological < 8) {
      authenticityConfidence += isVideoFrame ? 4 : 8;
    }
    authenticityConfidence -= signalBreakdown.compression * 0.60;
    authenticityConfidence -= signalBreakdown.metadata * 0.45;
    authenticityConfidence -= signalBreakdown.structure * 0.35;
    authenticityConfidence -= signalBreakdown.local_forensics * (isVideoFrame ? 0.26 : 0.42);
    authenticityConfidence -= signalBreakdown.facial * (isVideoFrame ? 0.75 : 0);
    authenticityConfidence -= signalBreakdown.frequency * (isVideoFrame ? 0.18 : 0.55);
    authenticityConfidence -= signalBreakdown.biological * (isVideoFrame ? 0.25 : 0.50);
    authenticityConfidence -= signalBreakdown.cnn * 0.52;
    authenticityConfidence = this.clampScore(authenticityConfidence, isVideoFrame ? 76 : 55);

    const flags = this.uniqueFlags([
      ...(compressionSignal.flags || []),
      ...(metadataSignal.flags || []),
      ...(faceSignal.flags || []),
      ...(opencvSignal.flags || []),
      ...(facialSignal.flags || []),
      ...(frequencySignal.flags || []),
      ...(biologicalSignal.flags || []),
      ...(cnnSignal.flags || [])
    ]);

    const localMetrics = {
      ...(opencvSignal.metrics || {}),
      compression_score: signalBreakdown.compression,
      metadata_score: signalBreakdown.metadata,
      structure_score: signalBreakdown.structure,
      local_forensics_score: signalBreakdown.local_forensics,
      facial_score: signalBreakdown.facial,
      frequency_score: signalBreakdown.frequency,
      biological_score: signalBreakdown.biological,
      cnn_score: signalBreakdown.cnn,
      cnn_available: cnnSignal.available,
      cnn_models_run: cnnSignal.models_run,
      metadata_has_embedded: Boolean(metadataSignal.metrics?.has_embedded_metadata),
      metadata_marker_count: Number(metadataSignal.metrics?.marker_count || 0),
      metadata_chunk_count: Number(metadataSignal.metrics?.chunk_count || 0)
    };

    return {
      visual_score: normalizedVisualScore,
      ai_generation_score: normalizedAiGenerationScore,
      authenticity_confidence: authenticityConfidence,
      flags,
      summary: this.buildSummary(options, visualScore, aiGenerationScore, signalBreakdown),
      analysis_ok: true,
      fallback_used: true,
      local_forensics_used: Boolean(opencvSignal.available || metadataSignal.score || compressionSignal.score || frequencySignal.score || biologicalSignal.score || cnnSignal.available),
      local_forensics_score: this.clampScore(
        Math.max(
          signalBreakdown.local_forensics,
          signalBreakdown.frequency,
          signalBreakdown.biological,
          signalBreakdown.cnn,
          signalBreakdown.metadata,
          signalBreakdown.compression
        ),
        0
      ),
      local_metrics: localMetrics,
      face_detected: Boolean(opencvSignal.face_detected),
      cnn_signal: cnnSignal,
      signal_breakdown: signalBreakdown
    };
  }
}

module.exports = new BackupSignalsService();
