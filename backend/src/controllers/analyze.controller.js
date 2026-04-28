const path = require('path');
const { db } = require('../config/firebase.config');
const agentsService = require('../services/agents.service');
const videoService = require('../services/video.service');
const { v4: uuidv4 } = require('uuid');

const clampScore = (value) => {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return 0;
  return Math.max(0, Math.min(100, numericValue));
};

const average = (values = []) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
};

const averageTop = (values = [], count = 2) =>
  average(
    [...values]
      .sort((left, right) => right - left)
      .slice(0, Math.min(count, values.length))
  );

const getFrameRisk = (analysis = {}) =>
  Math.max(
    Number(analysis.visual_score || 0),
    Number(analysis.ai_generation_score || analysis.visual_score || 0),
    Number(analysis.local_forensics_score || 0)
  );

const buildVideoPerceptionData = (successfulFrameAnalyses, temporalData = null) => {
  const visualScores = successfulFrameAnalyses.map((analysis) => Number(analysis.visual_score || 0));
  const aiScores = successfulFrameAnalyses.map((analysis) => Number(analysis.ai_generation_score || analysis.visual_score || 0));
  const localForensicsScores = successfulFrameAnalyses.map((analysis) => Number(analysis.local_forensics_score || 0));
  const facialScores = successfulFrameAnalyses.map((analysis) => Number(analysis.local_metrics?.facial_score || 0));
  const frameRisks = successfulFrameAnalyses.map((analysis) => getFrameRisk(analysis));
  const averageLocalForensics = average(localForensicsScores);
  const fallbackFrameCount = successfulFrameAnalyses.filter((analysis) => analysis.fallback_used).length;
  const localForensicsFrameCount = successfulFrameAnalyses.filter((analysis) => analysis.local_forensics_used).length;
  const remoteFrameCount = successfulFrameAnalyses.length - fallbackFrameCount;
  const faceDetectedFrameCount = successfulFrameAnalyses.filter((analysis) => analysis.face_detected).length;
  const localOnlyAnalysis = fallbackFrameCount === successfulFrameAnalyses.length;
  const maxFrameRisk = Math.max(0, ...frameRisks);
  const maxFacialScore = Math.max(0, ...facialScores);
  const faceVisibleFrameCount = Number(temporalData?.face_visible_frame_count || faceDetectedFrameCount);
  const facialEvidenceFrameCount = Number(
    temporalData?.facial_evidence_frame_count ||
    successfulFrameAnalyses.filter((analysis) => Number(analysis.local_metrics?.facial_score || 0) >= 10).length
  );
  const strongFacialEvidenceFrameCount = Number(
    temporalData?.strong_facial_evidence_frame_count ||
    successfulFrameAnalyses.filter((analysis) => Number(analysis.local_metrics?.facial_score || 0) >= 18).length
  );
  const jawAnomalyFrameCount = Number(temporalData?.jaw_anomaly_frame_count || 0);
  const mouthAnomalyFrameCount = Number(temporalData?.mouth_anomaly_frame_count || 0);
  const eyeAnomalyFrameCount = Number(temporalData?.eye_anomaly_frame_count || 0);
  const jawMotionAnomalyCount = Number(temporalData?.jaw_motion_anomaly_count || 0);
  const mouthMotionAnomalyCount = Number(temporalData?.mouth_motion_anomaly_count || 0);
  const eyeMotionAnomalyCount = Number(temporalData?.eye_motion_anomaly_count || 0);
  const lipSyncMismatchCount = Number(temporalData?.lip_sync_mismatch_count || 0);
  const lightingMismatchFrameCount = Number(temporalData?.lighting_mismatch_frame_count || 0);
  const boundaryAnomalyFrameCount = Number(temporalData?.boundary_anomaly_frame_count || 0);
  const suspiciousFrameCount = Number(
    temporalData?.suspicious_frame_count ||
    facialEvidenceFrameCount
  );
  const pronouncedFrameCount = Number(
    temporalData?.pronounced_frame_count ||
    strongFacialEvidenceFrameCount
  );
  const suspiciousFrameRatio = faceVisibleFrameCount
    ? suspiciousFrameCount / faceVisibleFrameCount
    : 0;
  const repeatedSuspicion = facialEvidenceFrameCount >= Math.max(2, Math.ceil(faceVisibleFrameCount * 0.25));
  const widespreadPronouncedSuspicion = pronouncedFrameCount >= Math.max(1, Math.ceil(faceVisibleFrameCount * 0.2));
  const avgAuthenticityConfidence = average(
    successfulFrameAnalyses.map((analysis) => Number(analysis.authenticity_confidence || 0))
  );
  const strongestSummaries = [...successfulFrameAnalyses]
    .sort((left, right) =>
      Math.max(Number(right.visual_score || 0), Number(right.ai_generation_score || right.visual_score || 0)) -
      Math.max(Number(left.visual_score || 0), Number(left.ai_generation_score || left.visual_score || 0))
    )
    .map((analysis) => String(analysis.summary || '').trim())
    .filter(Boolean)
    .filter((summary, index, summaries) => summaries.indexOf(summary) === index)
    .slice(0, 2)
    .join(' ');
  const frameFlags = successfulFrameAnalyses.flatMap((analysis) =>
    (analysis.flags || [])
      .filter((flag) => /(jaw|mouth|lip|eye|blink|lip-sync|sync|lighting|boundary|face)/i.test(String(flag || '')))
      .slice(0, 2)
      .map((flag) => `Frame ${analysis.frameIndex}: ${flag}`)
  );
  const facialEvidenceStrength = clampScore(
    (averageTop(facialScores, 4) * 0.52) +
    (maxFacialScore * 0.22) +
    (suspiciousFrameRatio * 18) +
    (strongFacialEvidenceFrameCount * 5) +
    (jawMotionAnomalyCount * 4) +
    (mouthMotionAnomalyCount * 4) +
    (eyeMotionAnomalyCount * 3) +
    (lipSyncMismatchCount * 8)
  );

  let weightedVisualScore = clampScore(
    Math.max(
      facialEvidenceStrength,
      averageTop(facialScores, 4) + (suspiciousFrameRatio * 24) + (lipSyncMismatchCount * 6),
      maxFacialScore + (strongFacialEvidenceFrameCount * 6) + (jawMotionAnomalyCount * 4) + (mouthMotionAnomalyCount * 4),
      (average(visualScores) * 0.35) + (averageTop(facialScores, 4) * 0.55) + (Number(temporalData?.temporal_score || 0) * 0.25),
      facialEvidenceFrameCount > 0
        ? averageLocalForensics + (averageTop(facialScores, 4) * 0.65) + (boundaryAnomalyFrameCount * 2)
        : 0
    )
  );
  let weightedAiScore = clampScore(
    Math.max(
      weightedVisualScore,
      (average(aiScores) * 0.4) + (averageTop(facialScores, 4) * 0.65),
      maxFacialScore + (strongFacialEvidenceFrameCount * 7) + (lipSyncMismatchCount * 8),
      facialEvidenceStrength + 4
    )
  );

  if (facialEvidenceFrameCount === 0) {
    weightedVisualScore = Math.min(weightedVisualScore, 24);
    weightedAiScore = Math.min(weightedAiScore, 28);
  } else if (facialEvidenceFrameCount === 1 && strongFacialEvidenceFrameCount === 0 && lipSyncMismatchCount === 0) {
    weightedVisualScore = Math.min(weightedVisualScore, 52);
    weightedAiScore = Math.min(weightedAiScore, 54);
  }

  let authenticityConfidence = Math.max(avgAuthenticityConfidence, 78);
  if (facialEvidenceFrameCount === 0) {
    authenticityConfidence += 6;
  } else {
    authenticityConfidence -= (facialEvidenceFrameCount * 10);
    authenticityConfidence -= (strongFacialEvidenceFrameCount * 8);
    authenticityConfidence -= (jawMotionAnomalyCount * 5);
    authenticityConfidence -= (mouthMotionAnomalyCount * 5);
    authenticityConfidence -= (eyeMotionAnomalyCount * 4);
    authenticityConfidence -= (lipSyncMismatchCount * 10);
  }
  if (localOnlyAnalysis) {
    authenticityConfidence -= 8;
  }
  if (repeatedSuspicion) {
    authenticityConfidence -= 8;
  }
  if (widespreadPronouncedSuspicion) {
    authenticityConfidence -= 8;
  }
  if ((jawAnomalyFrameCount + mouthAnomalyFrameCount + eyeAnomalyFrameCount) >= 3) {
    authenticityConfidence -= 6;
  }
  if (averageLocalForensics >= 18 && facialEvidenceFrameCount > 0) {
    authenticityConfidence -= 4;
  }
  if (faceVisibleFrameCount === 0) {
    authenticityConfidence = Math.min(authenticityConfidence, localOnlyAnalysis ? 66 : 72);
  }

  return {
    score: weightedVisualScore,
    aiGenerationScore: weightedAiScore,
    authenticityConfidence: clampScore(authenticityConfidence),
    summary: strongestSummaries,
    flags: Array.from(new Set([...frameFlags, ...((temporalData && temporalData.flags) || [])])),
    maxFrameRisk,
    suspiciousFrameCount,
    pronouncedFrameCount,
    fallbackFrameCount,
    fallbackUsed: fallbackFrameCount > 0,
    remoteFrameCount,
    localForensicsFrameCount,
    localForensicsScore: clampScore(
      facialEvidenceFrameCount > 0
        ? Math.max(Math.max(0, ...localForensicsScores), maxFacialScore)
        : Math.min(Math.max(0, ...localForensicsScores), 28)
    ),
    localOnlyAnalysis,
    faceDetectedFrameCount,
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
    lightingMismatchFrameCount,
    boundaryAnomalyFrameCount,
    facialEvidenceStrength,
    moderateFaceFrameCount: facialEvidenceFrameCount
  };
};

exports.analyzeMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided.' });
    }

    const { buffer, mimetype, size } = req.file;
    const fileExtension = path.extname(req.file.originalname || '').toLowerCase();
    const isKnownVideoExtension = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(fileExtension);
    const isVideo = mimetype.startsWith('video/') || (mimetype === 'application/octet-stream' && isKnownVideoExtension);
    const userId = req.user ? req.user.uid : 'anonymous';

    console.log(`Starting analysis pipeline for ${mimetype} (${size} bytes)`);

    let perceptionData;
    let temporalData = null;
    let allFlags = [];

    if (isVideo) {
      // 1. Video Pipeline
      const frames = await videoService.extractFrames(buffer, mimetype);
      const frameAnalyses = await videoService.analyzeVideoFrames(frames);
      const successfulFrameAnalyses = frameAnalyses.filter((analysis) => analysis.analysis_ok !== false);

      if (successfulFrameAnalyses.length < 1) {
        return res.status(503).json({
          error: 'Video analysis is temporarily unavailable because the vision model could not review enough frames. Please retry.'
        });
      }

      temporalData = successfulFrameAnalyses.length >= 2
        ? videoService.detectTemporalInconsistency(successfulFrameAnalyses)
        : { temporal_score: 0, flags: [] };
      perceptionData = buildVideoPerceptionData(successfulFrameAnalyses, temporalData);

      allFlags = perceptionData.flags;
    } else {
      // 1. Photo Pipeline
      perceptionData = await agentsService.perceptionAgent(buffer, mimetype);
      allFlags = perceptionData.flags;
    }

    // 2. Authenticity Agent
    const authenticityData = await agentsService.authenticityAgent(perceptionData, temporalData);

    const fallbackAnalysisUnavailable =
      Boolean(perceptionData?.localOnlyAnalysis || perceptionData?.fallbackUsed) &&
      !Boolean(perceptionData?.localForensicsUsed || perceptionData?.localForensicsFrameCount > 0);

    if (fallbackAnalysisUnavailable) {
      return res.status(503).json({
        error: `${isVideo ? 'Video' : 'Image'} analysis is temporarily unavailable because remote vision analysis failed and local forensic fallback could not run reliably. Please retry in a moment.`
      });
    }

    // 3. Confidence Agent
    const confidence = agentsService.confidenceAgent(authenticityData, perceptionData, temporalData);

    // 4. Reasoning Agent
    const explanation = await agentsService.reasoningAgent(authenticityData, allFlags, perceptionData, temporalData);

    // Explicitly clear buffer reference for garbage collection (Privacy Requirement)
    req.file.buffer = null;

    const resultPayload = {
      analysisId: uuidv4(),
      userId,
      type: isVideo ? 'video' : 'photo',
      verdict: authenticityData.verdict,
      confidence,
      explanation,
      timestamp: new Date().toISOString()
    };

    // Save to Firestore (only text results, NO MEDIA)
    if (db) {
      await db.collection('analyses').doc(resultPayload.analysisId).set(resultPayload).catch(e => {
        console.warn("Firestore save failed in mock environment:", e.message);
      });
    }

    res.status(200).json(resultPayload);

  } catch (error) {
    console.error('Analysis Pipeline Error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to complete AI analysis.' });
  }
};
