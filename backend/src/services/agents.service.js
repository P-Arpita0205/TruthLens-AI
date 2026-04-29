const visionService = require('./vision.service');
const edgeService = require('./edge.service');

class AgentsService {
  getManipulationThreshold() {
    return 55;
  }

  clampScore(value) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return 0;
    return Math.max(0, Math.min(100, numericValue));
  }

  scoreFlags(flags = []) {
    const weightedPatterns = [
      { pattern: /synthetic|generated|ai-generated|ai generated/i, weight: 26 },
      { pattern: /diffusion|gan|rendered|computer-generated/i, weight: 30 },
      { pattern: /waxy|plastic|airbrushed|over-smoothed|overly smooth/i, weight: 18 },
      { pattern: /artifact|warped|distortion|geometry|mismatch/i, weight: 14 },
      { pattern: /reflection|shadow|lighting|depth of field|bokeh/i, weight: 12 },
      { pattern: /eye|teeth|hair|ear|hand|finger|jewelry|jawline/i, weight: 12 },
      { pattern: /repeated|duplicate|pattern|texture/i, weight: 14 },
      { pattern: /inconsistent|unnatural|implausible|uncanny/i, weight: 14 }
    ];

    let score = 0;
    for (const flag of flags) {
      const text = String(flag || '');
      for (const { pattern, weight } of weightedPatterns) {
        if (pattern.test(text)) {
          score += weight;
        }
      }
    }

    if (flags.length >= 3) {
      score += 10;
    } else if (flags.length === 2) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  uniqueFlags(flags = []) {
    return Array.from(
      new Set(
        (flags || [])
          .map((flag) => String(flag || '').trim())
          .filter(Boolean)
      )
    );
  }

  formatFlagList(flags = []) {
    return flags
      .map((flag) => String(flag || '').replace(/[.]+$/g, '').trim())
      .filter(Boolean)
      .join('; ');
  }

  simplifyFlag(flag = '') {
    const text = String(flag || '').trim();
    if (!text) return '';

    const framePrefixMatch = text.match(/^Frame\s+(\d+):\s*(.*)$/i);
    const frameLabel = framePrefixMatch ? `In frame ${framePrefixMatch[1]}, ` : '';
    const body = framePrefixMatch ? framePrefixMatch[2] : text;
    const normalized = body.toLowerCase();

    let simplified = body.replace(/[.]+$/g, '').trim();
    if (/fourier-domain analysis found periodic frequency spikes|grid-like artifacts|gan-generated media/.test(normalized)) {
      simplified = 'repeating visual patterns showed up that often appear in AI-generated media';
    } else if (/fourier-domain analysis found moderate periodic structure/.test(normalized)) {
      simplified = 'there were repeating patterns that are uncommon in normal camera footage';
    } else if (/frequency energy is distributed unusually|frequency energy distribution is unusual/.test(normalized)) {
      simplified = 'the texture of the image looked less natural than normal camera footage';
    } else if (/skin-tone pulse proxy remains unusually flat/.test(normalized)) {
      simplified = 'the face looked too flat and lifeless across frames';
    } else if (/skin-tone pulse proxy changes too abruptly/.test(normalized)) {
      simplified = 'the skin tone changed too sharply between frames';
    } else if (/lip-region motion does not track nearby audio energy consistently|lip-sync drift|lip movement does not match/.test(normalized)) {
      simplified = 'the lip movement did not match the audio consistently';
    } else if (/eye openness remains unusually fixed/.test(normalized)) {
      simplified = 'the eyes stayed too still across frames';
    } else if (/eye-region behavior changes erratically/.test(normalized)) {
      simplified = 'the eyes behaved unnaturally across frames';
    } else if (/mouth-region detail changes abruptly|lip or mouth movement changes too abruptly/.test(normalized)) {
      simplified = 'the mouth changed too abruptly between frames';
    } else if (/jaw shape or jaw position changes too abruptly/.test(normalized)) {
      simplified = 'the jaw changed too abruptly between frames';
    } else if (/jaw shape or jaw size looks unusual/.test(normalized)) {
      simplified = 'the jaw looked unusual in that frame';
    } else if (/lip or mouth movement looks unusual|lip or mouth shape/.test(normalized)) {
      simplified = 'the lips or mouth looked unusual in that frame';
    } else if (/eye movement or eye shape looks unusual|unusual eye behavior/.test(normalized)) {
      simplified = 'the eyes looked unusual in that frame';
    } else if (/boundary artifacts around the detected face|face-swap blending|boundary_seam/.test(normalized)) {
      simplified = 'the edges around the face looked blended or unnatural';
    } else if (/lighting mismatch between the face and the surrounding scene/.test(normalized)) {
      simplified = 'the face lighting did not match the rest of the scene';
    } else if (/face position or scale shifts too abruptly/.test(normalized)) {
      simplified = 'the face moved or changed size too abruptly';
    } else if (/synthetic generation patterns/.test(normalized)) {
      simplified = 'the frame showed signs that often appear in AI-generated media';
    } else if (/waxy|plastic|over-smoothed|overly smooth/.test(normalized)) {
      simplified = 'parts of the face looked too smooth or artificial';
    } else if (/warped|distortion|geometry inconsistenc/.test(normalized)) {
      simplified = 'some shapes looked warped or unnatural';
    }

    return `${frameLabel}${simplified}`.trim();
  }

  summarizeFlagsForHumans(flags = []) {
    const simplifiedFlags = this.uniqueFlags(
      (flags || [])
        .map((flag) => this.simplifyFlag(flag))
        .filter(Boolean)
    );

    return simplifiedFlags.slice(0, 3);
  }

  countHardSyntheticFlags(flags = []) {
    return (flags || []).filter((flag) =>
      /synthetic|generated|ai-generated|ai generated|diffusion|gan|face swap|faceswap|rendered|computer-generated/i.test(String(flag || ''))
    ).length;
  }

  collectEvidenceSignals(perceptionData = {}, temporalData = null) {
    const flags = perceptionData.flags || [];
    const flagScore = this.scoreFlags(flags);
    const aiGenerationScore = this.clampScore(perceptionData.aiGenerationScore ?? perceptionData.score);
    const perceptionScore = this.clampScore(perceptionData.score);
    const temporalScore = this.clampScore(temporalData?.temporal_score || 0);
    const localForensicsScore = this.clampScore(perceptionData.localForensicsScore || 0);
    const edgeCompressionScore = this.clampScore(perceptionData.edgeCompressionScore || 0);
    const edgeFaceScore = this.clampScore(perceptionData.edgeFaceScore || 0);
    const maxFrameRisk = this.clampScore((perceptionData.maxFrameRisk ?? temporalData?.max_frame_risk) || 0);
    const suspiciousFrameCount = Number((perceptionData.suspiciousFrameCount ?? temporalData?.suspicious_frame_count) || 0);
    const pronouncedFrameCount = Number((perceptionData.pronouncedFrameCount ?? temporalData?.pronounced_frame_count) || 0);
    const remoteFrameCount = Number(perceptionData.remoteFrameCount || 0);
    const localOnlyAnalysis = Boolean(perceptionData.localOnlyAnalysis || perceptionData.fallbackUsed);
    const isVideoAnalysis =
      temporalData !== null ||
      Object.prototype.hasOwnProperty.call(perceptionData || {}, 'suspiciousFrameCount') ||
      Object.prototype.hasOwnProperty.call(perceptionData || {}, 'maxFrameRisk') ||
      remoteFrameCount > 0;
    const hardSyntheticFlagCount = this.countHardSyntheticFlags(flags);
    const faceCount = Number(perceptionData.localMetrics?.face_count || 0);
    const multiFaceSoftCount = Number(perceptionData.localMetrics?.multi_face_soft_count || 0);
    const multiFaceMaxMouthAsymmetry = Number(perceptionData.localMetrics?.multi_face_max_mouth_asymmetry || 0);
    const multiFaceMaxBoundarySeam = Number(perceptionData.localMetrics?.multi_face_max_boundary_seam || 0);
    const faceVisibleFrameCount = Number(perceptionData.faceVisibleFrameCount || temporalData?.face_visible_frame_count || 0);
    const facialEvidenceFrameCount = Number(perceptionData.facialEvidenceFrameCount || temporalData?.facial_evidence_frame_count || 0);
    const strongFacialEvidenceFrameCount = Number(perceptionData.strongFacialEvidenceFrameCount || temporalData?.strong_facial_evidence_frame_count || 0);
    const jawAnomalyFrameCount = Number(perceptionData.jawAnomalyFrameCount || temporalData?.jaw_anomaly_frame_count || 0);
    const mouthAnomalyFrameCount = Number(perceptionData.mouthAnomalyFrameCount || temporalData?.mouth_anomaly_frame_count || 0);
    const eyeAnomalyFrameCount = Number(perceptionData.eyeAnomalyFrameCount || temporalData?.eye_anomaly_frame_count || 0);
    const jawMotionAnomalyCount = Number(perceptionData.jawMotionAnomalyCount || temporalData?.jaw_motion_anomaly_count || 0);
    const mouthMotionAnomalyCount = Number(perceptionData.mouthMotionAnomalyCount || temporalData?.mouth_motion_anomaly_count || 0);
    const eyeMotionAnomalyCount = Number(perceptionData.eyeMotionAnomalyCount || temporalData?.eye_motion_anomaly_count || 0);
    const lipSyncMismatchCount = Number(perceptionData.lipSyncMismatchCount || temporalData?.lip_sync_mismatch_count || 0);
    const facialEvidenceStrength = this.clampScore(perceptionData.facialEvidenceStrength || 0);

    const remoteEvidence = !localOnlyAnalysis && (
      (aiGenerationScore >= (isVideoAnalysis ? 62 : 68) && perceptionScore >= (isVideoAnalysis ? 52 : 58)) ||
      (hardSyntheticFlagCount >= 1 && (aiGenerationScore >= (isVideoAnalysis ? 58 : 62) || perceptionScore >= 60))
    );
    const portraitForensicsEvidence =
      faceCount >= 2 &&
      localForensicsScore >= 14 &&
      (
        multiFaceSoftCount >= 2 ||
        multiFaceMaxMouthAsymmetry >= 0.16 ||
        multiFaceMaxBoundarySeam >= 0.045
      );
    const flagEvidence =
      (hardSyntheticFlagCount >= 1 && flagScore >= 40) ||
      (portraitForensicsEvidence && flagScore >= 40 && flags.length >= 2);
    const facialVideoEvidence = isVideoAnalysis && (
      lipSyncMismatchCount >= 2 ||
      jawMotionAnomalyCount >= 3 ||
      mouthMotionAnomalyCount >= 3 ||
      eyeMotionAnomalyCount >= 3 ||
      strongFacialEvidenceFrameCount >= 2 ||
      facialEvidenceFrameCount >= 3 ||
      (jawAnomalyFrameCount >= 2 && mouthAnomalyFrameCount >= 1) ||
      (mouthAnomalyFrameCount >= 2 && eyeAnomalyFrameCount >= 1) ||
      (lipSyncMismatchCount >= 1 && facialEvidenceFrameCount >= 2)
    );
    const localEvidence = isVideoAnalysis
      ? (
          facialVideoEvidence &&
          (
            localForensicsScore >= 18 ||
            facialEvidenceStrength >= 38 ||
            maxFrameRisk >= 44 ||
            faceVisibleFrameCount >= 4
          )
        )
      : (
          localForensicsScore >= 24 ||
          portraitForensicsEvidence ||
          edgeCompressionScore >= 16 ||
          edgeFaceScore >= 10
        );
    const temporalEvidence = isVideoAnalysis
      ? (
          lipSyncMismatchCount >= 1 ||
          jawMotionAnomalyCount >= 2 ||
          mouthMotionAnomalyCount >= 2 ||
          eyeMotionAnomalyCount >= 2 ||
          temporalScore >= 18 ||
          pronouncedFrameCount >= 1
        )
      : (
          temporalScore >= 28 ||
          pronouncedFrameCount >= 2 ||
          (suspiciousFrameCount >= 3 && maxFrameRisk >= 55)
        );
    const repeatedFrameEvidence = isVideoAnalysis
      ? (
          facialEvidenceFrameCount >= 2 ||
          strongFacialEvidenceFrameCount >= 1 ||
          lipSyncMismatchCount >= 1 ||
          jawMotionAnomalyCount >= 2 ||
          mouthMotionAnomalyCount >= 2 ||
          eyeMotionAnomalyCount >= 2
        )
      : (
          pronouncedFrameCount >= 2 ||
          (suspiciousFrameCount >= 3 && (remoteFrameCount >= 2 || localOnlyAnalysis))
        );
    const exceptionallyStrong = isVideoAnalysis
      ? (
          (lipSyncMismatchCount >= 2) ||
          (strongFacialEvidenceFrameCount >= 2) ||
          (jawMotionAnomalyCount >= 3) ||
          (mouthMotionAnomalyCount >= 3) ||
          (facialEvidenceFrameCount >= 3 && facialEvidenceStrength >= 42)
        )
      : (
          (hardSyntheticFlagCount >= 2 && aiGenerationScore >= 72) ||
          (remoteEvidence && maxFrameRisk >= 70) ||
          (localOnlyAnalysis && pronouncedFrameCount >= 3 && maxFrameRisk >= 60) ||
          (temporalScore >= 36 && pronouncedFrameCount >= 2)
        );

    const corroboratingSignals = [
      remoteEvidence,
      flagEvidence,
      localEvidence,
      temporalEvidence,
      repeatedFrameEvidence
    ].filter(Boolean).length;

    return {
      flagScore,
      hardSyntheticFlagCount,
      remoteEvidence,
      flagEvidence,
      localEvidence,
      portraitForensicsEvidence,
      temporalEvidence,
      repeatedFrameEvidence,
      localOnlyAnalysis,
      exceptionallyStrong,
      corroboratingSignals,
      isVideoAnalysis,
      facialVideoEvidence,
      faceVisibleFrameCount,
      facialEvidenceFrameCount,
      strongFacialEvidenceFrameCount,
      jawAnomalyFrameCount,
      mouthAnomalyFrameCount,
      eyeAnomalyFrameCount,
      jawMotionAnomalyCount,
      mouthMotionAnomalyCount,
      eyeMotionAnomalyCount,
      lipSyncMismatchCount,
      facialEvidenceStrength
    };
  }

  calculateStrictRisk(perceptionData, temporalData = null) {
    const evidenceSignals = this.collectEvidenceSignals(perceptionData, temporalData);
    const isVideoAnalysis = Boolean(evidenceSignals.isVideoAnalysis);
    const flagScore = evidenceSignals.flagScore;
    const aiGenerationScore = this.clampScore(perceptionData.aiGenerationScore ?? perceptionData.score);
    const perceptionScore = this.clampScore(perceptionData.score);
    const temporalScore = this.clampScore(temporalData?.temporal_score || 0);
    const maxFrameRisk = this.clampScore((perceptionData.maxFrameRisk ?? temporalData?.max_frame_risk) || 0);
    const averageFrameRisk = this.clampScore(temporalData?.average_frame_risk || 0);
    const suspiciousFrameCount = Number((perceptionData.suspiciousFrameCount ?? temporalData?.suspicious_frame_count) || 0);
    const pronouncedFrameCount = Number((perceptionData.pronouncedFrameCount ?? temporalData?.pronounced_frame_count) || 0);
    const faceDetectedFrameCount = Number(perceptionData.faceDetectedFrameCount || 0);
    const moderateFaceFrameCount = Number(perceptionData.moderateFaceFrameCount || 0);
    const localOnlyAnalysis = Boolean(perceptionData.localOnlyAnalysis || perceptionData.fallbackUsed);
    const threshold = this.getManipulationThreshold();

    if (isVideoAnalysis) {
      const facialEvidenceStrength = this.clampScore(evidenceSignals.facialEvidenceStrength || 0);
      const jawMotionAnomalyCount = Number(evidenceSignals.jawMotionAnomalyCount || 0);
      const mouthMotionAnomalyCount = Number(evidenceSignals.mouthMotionAnomalyCount || 0);
      const eyeMotionAnomalyCount = Number(evidenceSignals.eyeMotionAnomalyCount || 0);
      const lipSyncMismatchCount = Number(evidenceSignals.lipSyncMismatchCount || 0);
      const jawAnomalyFrameCount = Number(evidenceSignals.jawAnomalyFrameCount || 0);
      const mouthAnomalyFrameCount = Number(evidenceSignals.mouthAnomalyFrameCount || 0);
      const eyeAnomalyFrameCount = Number(evidenceSignals.eyeAnomalyFrameCount || 0);
      const facialEvidenceFrameCount = Number(evidenceSignals.facialEvidenceFrameCount || 0);
      const strongFacialEvidenceFrameCount = Number(evidenceSignals.strongFacialEvidenceFrameCount || 0);

      let strictRisk =
        (perceptionScore * 0.32) +
        (aiGenerationScore * 0.10) +
        (temporalScore * 0.18) +
        (facialEvidenceStrength * 0.40);

      strictRisk += (jawMotionAnomalyCount * 4.5);
      strictRisk += (mouthMotionAnomalyCount * 4.5);
      strictRisk += (eyeMotionAnomalyCount * 3.5);
      strictRisk += (lipSyncMismatchCount * 8);
      strictRisk += (jawAnomalyFrameCount * 4);
      strictRisk += (mouthAnomalyFrameCount * 3.5);
      strictRisk += (eyeAnomalyFrameCount * 3);

      if (!evidenceSignals.facialVideoEvidence) {
        strictRisk = Math.min(strictRisk, 28);
      } else if (strongFacialEvidenceFrameCount >= 2 || lipSyncMismatchCount >= 2) {
        strictRisk = Math.max(strictRisk, threshold + 4);
      } else if (facialEvidenceFrameCount >= 3 && facialEvidenceStrength >= 38) {
        strictRisk = Math.max(strictRisk, threshold + 1);
      } else if (facialEvidenceFrameCount <= 2 && facialEvidenceStrength < 32) {
        strictRisk = Math.min(strictRisk, threshold - 2);
      }

      if (localOnlyAnalysis && !evidenceSignals.facialVideoEvidence) {
        strictRisk = Math.min(strictRisk, 28);
      }

      return this.clampScore(strictRisk);
    }

    let strictRisk = (perceptionScore * 0.5) + (aiGenerationScore * 0.25) + (flagScore * 0.15);
    if (temporalScore > 0) {
      strictRisk = isVideoAnalysis
        ? (strictRisk * 0.84) + (temporalScore * 0.16)
        : (strictRisk * 0.88) + (temporalScore * 0.12);
    }

    if (evidenceSignals.hardSyntheticFlagCount >= 2 && aiGenerationScore >= 72) {
      strictRisk = Math.max(strictRisk, threshold + 12);
    } else if (evidenceSignals.remoteEvidence && evidenceSignals.flagEvidence) {
      strictRisk = Math.max(strictRisk, threshold + 4);
    } else if (evidenceSignals.portraitForensicsEvidence && flagScore >= 40) {
      strictRisk = Math.max(strictRisk, threshold + 2);
    } else if (aiGenerationScore >= 72 && perceptionScore >= 60) {
      strictRisk = Math.max(strictRisk, threshold + 1);
    }

    if (pronouncedFrameCount >= 2 && maxFrameRisk >= 60) {
      strictRisk = Math.max(strictRisk, threshold + 3);
    } else if (suspiciousFrameCount >= 3 && maxFrameRisk >= 48) {
      strictRisk = Math.max(strictRisk, threshold - 2);
    } else if (suspiciousFrameCount >= 2 && evidenceSignals.localEvidence && maxFrameRisk >= 34) {
      strictRisk = Math.max(strictRisk, threshold - 4);
    } else if (maxFrameRisk >= 70) {
      strictRisk = Math.max(strictRisk, threshold - 1);
    }

    if (isVideoAnalysis && evidenceSignals.localEvidence && evidenceSignals.repeatedFrameEvidence && perceptionScore >= 42 && maxFrameRisk >= 38) {
      strictRisk = Math.max(strictRisk, threshold + 1);
    } else if (isVideoAnalysis && suspiciousFrameCount >= 3 && maxFrameRisk >= 34 && flagScore >= 55) {
      strictRisk = Math.max(strictRisk, threshold - 1);
    }

    if (localOnlyAnalysis) {
      if (pronouncedFrameCount >= 3 && maxFrameRisk >= 60) {
        strictRisk = Math.max(strictRisk, threshold + 3);
      } else if (pronouncedFrameCount >= 2 && temporalScore >= (isVideoAnalysis ? 18 : 28)) {
        strictRisk = Math.max(strictRisk, isVideoAnalysis ? threshold + 1 : threshold);
      } else if (moderateFaceFrameCount >= 3 && faceDetectedFrameCount >= 2 && averageFrameRisk >= 30) {
        strictRisk = Math.max(strictRisk, threshold - (isVideoAnalysis ? 1 : 4));
      } else if (suspiciousFrameCount >= 3 && faceDetectedFrameCount >= 2 && averageFrameRisk >= 28) {
        strictRisk = Math.max(strictRisk, threshold - (isVideoAnalysis ? 2 : 6));
      } else if (isVideoAnalysis && suspiciousFrameCount >= 3 && averageFrameRisk >= 30 && flagScore >= 55) {
        strictRisk = Math.max(strictRisk, threshold - 1);
      }
    }

    return this.clampScore(strictRisk);
  }

  verdictConfidenceBase(decisionScore, verdict) {
    const threshold = this.getManipulationThreshold();
    if (verdict === 'Authentic') {
      const distanceBelowThreshold = Math.max(0, threshold - decisionScore);
      return 52 + ((distanceBelowThreshold / threshold) * 47);
    }

    const distanceAboveThreshold = Math.max(0, decisionScore - threshold);
    return 52 + ((distanceAboveThreshold / (100 - threshold)) * 47);
  }

  /**
   * Perception Agent: Combines Edge inference and VLM visual data.
   */
  async perceptionAgent(buffer, mimeType) {
    const edgeCompression = edgeService.detectCompressionNoise(buffer, mimeType);
    const edgeFace = edgeService.detectFaceArtifacts(buffer, mimeType);
    
    // For video, this might be called on a single keyframe, or bypassed if video service handled frames.
    const vlmResult = await visionService.runVLMAnalysis(buffer, mimeType, {
      sourceType: 'image',
      includeLocalForensics: true
    });
    if (!vlmResult.analysis_ok) {
      const unavailableError = new Error('Vision model temporarily unavailable. Please retry the analysis.');
      unavailableError.code = 'VLM_UNAVAILABLE';
      unavailableError.status = 503;
      throw unavailableError;
    }

    const flags = [...(vlmResult.flags || []), ...(edgeCompression.flags || []), ...(edgeFace.flags || [])];
    const aiGenerationScore = this.clampScore(vlmResult.ai_generation_score ?? vlmResult.visual_score);
    const visualScore = this.clampScore(vlmResult.visual_score);
    const flagScore = this.scoreFlags(flags);

    const baseScore = this.clampScore(
      (visualScore * 0.43) +
      (aiGenerationScore * 0.32) +
      (flagScore * 0.13) +
      (this.clampScore(vlmResult.local_forensics_score) * 0.05) +
      (this.clampScore(edgeCompression.score) * 0.04) +
      (this.clampScore(edgeFace.score) * 0.03)
    );

    return {
      score: baseScore,
      aiGenerationScore,
      authenticityConfidence: this.clampScore(vlmResult.authenticity_confidence, 50),
      flagScore,
      summary: vlmResult.summary || '',
      flags: this.uniqueFlags(flags),
      fallbackUsed: Boolean(vlmResult.fallback_used),
      localForensicsUsed: Boolean(vlmResult.local_forensics_used),
      localForensicsScore: this.clampScore(vlmResult.local_forensics_score || 0),
      localMetrics: vlmResult.local_metrics || {},
      edgeCompressionScore: this.clampScore(edgeCompression.score),
      edgeFaceScore: this.clampScore(edgeFace.score),
      remoteFrameCount: vlmResult.fallback_used ? 0 : 1
    };
  }

  /**
   * Authenticity Agent: Takes all flags and base scores, cross-references with known deepfake patterns.
   */
  async authenticityAgent(perceptionData, temporalData = null) {
    const strictRisk = this.calculateStrictRisk(perceptionData, temporalData);
    const decisionScore = strictRisk;
    const threshold = this.getManipulationThreshold();
    const evidence = this.collectEvidenceSignals(perceptionData, temporalData);
    const hasEnoughEvidence = evidence.isVideoAnalysis
      ? (
          evidence.facialVideoEvidence &&
          (evidence.exceptionallyStrong || decisionScore >= threshold)
        )
      : (
          evidence.exceptionallyStrong ||
          (decisionScore >= threshold && evidence.corroboratingSignals >= 2)
        );
    const verdict = hasEnoughEvidence ? 'Manipulated' : 'Authentic';

    return {
      decision_score: decisionScore,
      verdict,
      evidence
    };
  }

  /**
   * Reasoning Agent: Generates human-readable explanation based on the findings.
   */
  async reasoningAgent(authenticityData, allFlags, perceptionData = {}, temporalData = null) {
    const groundedFlags = this.uniqueFlags(allFlags);
    const topFlags = this.summarizeFlagsForHumans(groundedFlags);
    const decisionScore = this.clampScore(authenticityData.decision_score);
    const displayScore = Math.round(decisionScore);
    const temporalScore = this.clampScore(temporalData?.temporal_score || 0);
    const flagText = this.formatFlagList(topFlags);
    const isVideoAnalysis = temporalData !== null;
    const facialEvidenceFrameCount = Number(perceptionData.facialEvidenceFrameCount || temporalData?.facial_evidence_frame_count || 0);
    const faceVisibleFrameCount = Number(perceptionData.faceVisibleFrameCount || temporalData?.face_visible_frame_count || 0);
    const lipSyncMismatchCount = Number(perceptionData.lipSyncMismatchCount || temporalData?.lip_sync_mismatch_count || 0);
    const jawMotionAnomalyCount = Number(perceptionData.jawMotionAnomalyCount || temporalData?.jaw_motion_anomaly_count || 0);
    const mouthMotionAnomalyCount = Number(perceptionData.mouthMotionAnomalyCount || temporalData?.mouth_motion_anomaly_count || 0);
    const eyeMotionAnomalyCount = Number(perceptionData.eyeMotionAnomalyCount || temporalData?.eye_motion_anomaly_count || 0);

    if (authenticityData.verdict === 'Manipulated') {
      const firstSentence = flagText
        ? `The media was marked as Manipulated because ${flagText}.`
        : perceptionData.summary
          ? `The media was marked as Manipulated because the visual review found several warning signs. ${perceptionData.summary}`
          : 'The media was marked as Manipulated because the analysis found enough warning signs to cross the risk threshold.';

      const secondSentence = isVideoAnalysis && faceVisibleFrameCount > 0
        ? `The video was checked across ${faceVisibleFrameCount} face-visible frames, and these facial issues repeated enough times to raise the manipulation risk to ${displayScore}/100.`
        : temporalScore >= 25
          ? `The problems also repeated across multiple frames, which raised the manipulation risk to ${displayScore}/100.`
          : `Taken together, these signs raised the manipulation risk to ${displayScore}/100.`;

      const thirdSentence = isVideoAnalysis && (
        lipSyncMismatchCount > 0 ||
        jawMotionAnomalyCount > 0 ||
        mouthMotionAnomalyCount > 0 ||
        eyeMotionAnomalyCount > 0 ||
        facialEvidenceFrameCount > 0
      )
        ? `The biggest triggers were lip-sync drift or unusual jaw, lip, or eye behavior across the sampled frames.`
        : '';

      return `${firstSentence} ${secondSentence} ${thirdSentence}`.trim();
    }

    const firstSentence = flagText
      ? `The media was marked as Authentic because the warning signs were weak or limited: ${flagText}.`
      : perceptionData.summary
        ? `The media was marked as Authentic because the visual analysis did not find strong signs of manipulation. ${perceptionData.summary}`
        : 'The media was marked as Authentic because the analysis did not find strong signs of manipulation.';

    const secondSentence = isVideoAnalysis && faceVisibleFrameCount > 0
      ? `The video was checked across ${faceVisibleFrameCount} face-visible frames, and it did not show strong lip-sync, jaw, lip, or eye anomalies, so the manipulation risk stayed at ${displayScore}/100.`
      : temporalScore >= 15
        ? `The sampled frames stayed mostly consistent over time, so the manipulation risk stayed below the decision threshold at ${displayScore}/100.`
        : `Overall, the manipulation risk stayed below the decision threshold at ${displayScore}/100.`;

    const thirdSentence = isVideoAnalysis && facialEvidenceFrameCount === 0
      ? 'The verdict was not based on one frame alone; it stayed authentic because the broader frame set remained stable.'
      : '';

    return `${firstSentence} ${secondSentence} ${thirdSentence}`.trim();
  }

  /**
   * Confidence Agent: Final mathematical aggregation for the UI.
   */
  confidenceAgent(authenticityData, perceptionData, temporalData = null) {
    const threshold = this.getManipulationThreshold();
    const decisionScore = this.clampScore(authenticityData?.decision_score);
    const verdict = authenticityData?.verdict === 'Manipulated' ? 'Manipulated' : 'Authentic';
    const perceptionScore = this.clampScore(perceptionData?.score);
    const aiGenerationScore = this.clampScore(perceptionData?.aiGenerationScore ?? perceptionData?.score);
    const temporalScore = this.clampScore(temporalData?.temporal_score || 0);
    const authenticityConfidence = this.clampScore(
      perceptionData?.authenticityConfidence,
      verdict === 'Authentic' ? 70 : 50
    );
    const verdictConfidence = this.verdictConfidenceBase(decisionScore, verdict);
    const localOnlyAnalysis = Boolean(perceptionData?.localOnlyAnalysis || perceptionData?.fallbackUsed);
    const faceDetectedFrameCount = Number(perceptionData?.faceDetectedFrameCount || 0);
    const isVideoAnalysis = temporalData !== null;
    const facialEvidenceFrameCount = Number(perceptionData?.facialEvidenceFrameCount || temporalData?.facial_evidence_frame_count || 0);
    const strongFacialEvidenceFrameCount = Number(perceptionData?.strongFacialEvidenceFrameCount || temporalData?.strong_facial_evidence_frame_count || 0);
    const lipSyncMismatchCount = Number(perceptionData?.lipSyncMismatchCount || temporalData?.lip_sync_mismatch_count || 0);
    const facialEvidenceStrength = this.clampScore(perceptionData?.facialEvidenceStrength || 0);

    let finalScore;
    if (isVideoAnalysis) {
      if (verdict === 'Authentic') {
        finalScore = (verdictConfidence * 0.58) + (authenticityConfidence * 0.27) + ((100 - temporalScore) * 0.15);

        if (facialEvidenceFrameCount === 0) {
          finalScore = Math.max(finalScore, 82);
        } else if (decisionScore >= threshold - 8) {
          finalScore = Math.min(finalScore, 66);
        }

        if (localOnlyAnalysis) {
          finalScore = Math.min(finalScore, faceDetectedFrameCount >= 2 ? 72 : 76);
        }
      } else {
        finalScore =
          (verdictConfidence * 0.45) +
          (facialEvidenceStrength * 0.30) +
          (temporalScore * 0.15) +
          (Math.max(perceptionScore, aiGenerationScore) * 0.10);

        if (lipSyncMismatchCount >= 1 || strongFacialEvidenceFrameCount >= 1) {
          finalScore = Math.max(finalScore, 78);
        } else {
          finalScore = Math.max(finalScore, 68);
        }
      }

      return parseFloat(this.clampScore(finalScore).toFixed(2));
    }

    if (verdict === 'Authentic') {
      const stabilityScore = 100 - temporalScore;
      finalScore = (verdictConfidence * 0.6) + (authenticityConfidence * 0.25) + (stabilityScore * 0.15);

      if (decisionScore <= 12 && authenticityConfidence >= 70 && temporalScore <= 10) {
        finalScore = Math.max(finalScore, 84);
      } else if (decisionScore <= 20 && authenticityConfidence >= 65) {
        finalScore = Math.max(finalScore, 76);
      }

      if (decisionScore >= threshold - 10) {
        finalScore = Math.min(finalScore, 68);
      }
      if (localOnlyAnalysis) {
        finalScore = Math.min(finalScore, faceDetectedFrameCount >= 2 ? 68 : 76);
      }
    } else {
      const suspiciousEvidence = Math.max(perceptionScore, aiGenerationScore);
      finalScore = (verdictConfidence * 0.65) + (suspiciousEvidence * 0.2) + (temporalScore * 0.15);

      if (decisionScore >= 70) {
        finalScore = Math.max(finalScore, 82);
      } else if (decisionScore >= 55) {
        finalScore = Math.max(finalScore, 72);
      } else {
        finalScore = Math.max(finalScore, 58);
      }
    }

    return parseFloat(this.clampScore(finalScore).toFixed(2));
  }
}

module.exports = new AgentsService();
