const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const ffmpegPath = require('ffmpeg-static');
const visionService = require('./vision.service');

const execFileAsync = promisify(execFile);

class VideoService {
  getAnalysisConcurrency() {
    const configured = Number(process.env.VIDEO_ANALYSIS_CONCURRENCY || 2);
    if (Number.isNaN(configured)) return 2;
    return Math.max(1, Math.min(4, configured));
  }

  getTargetFrameCount(durationSeconds) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 12;
    if (durationSeconds <= 1.2) return 5;
    if (durationSeconds <= 3) return 8;
    if (durationSeconds <= 8) return 12;
    if (durationSeconds <= 18) return 18;
    return 24;
  }

  getMinimumFrameCount(durationSeconds) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0.8) return 3;
    if (durationSeconds <= 2) return 4;
    if (durationSeconds <= 6) return 6;
    return 8;
  }

  getFileExtension(mimeType = 'video/mp4') {
    const extensionMap = {
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'video/x-matroska': '.mkv',
      'video/webm': '.webm'
    };

    return extensionMap[mimeType] || '.mp4';
  }

  formatTimestamp(seconds) {
    const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
    return safeSeconds.toFixed(2);
  }

  parseDurationSeconds(ffmpegOutput = '') {
    const match = String(ffmpegOutput || '').match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
    if (!match) {
      return 0;
    }

    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    const seconds = Number(match[3] || 0);
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  async getVideoDuration(inputPath) {
    try {
      const { stdout = '', stderr = '' } = await execFileAsync(
        ffmpegPath,
        ['-hide_banner', '-i', inputPath, '-f', 'null', '-'],
        {
          timeout: 60000,
          windowsHide: true
        }
      );

      return this.parseDurationSeconds(`${stdout}\n${stderr}`);
    } catch (error) {
      return this.parseDurationSeconds(`${error?.stdout || ''}\n${error?.stderr || ''}`);
    }
  }

  buildSampleTimestamps(durationSeconds, targetFrameCount = this.getTargetFrameCount(durationSeconds)) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0.35) {
      return [0];
    }

    const maxTimestamp = Math.max(durationSeconds - 0.08, 0);
    const safeFrameCount = Math.max(3, Math.min(24, Math.round(targetFrameCount)));
    const ratios = Array.from({ length: safeFrameCount }, (_, index) => {
      if (safeFrameCount === 1) {
        return 0;
      }

      const padding = safeFrameCount <= 5 ? 0.02 : 0.03;
      return padding + (((1 - (padding * 2)) * index) / (safeFrameCount - 1));
    });

    return Array.from(
      new Set(
        ratios.map((ratio) => this.formatTimestamp(Math.min(maxTimestamp, durationSeconds * ratio)))
      )
    )
      .map(Number)
      .sort((left, right) => left - right);
  }

  async extractFrameAtTimestamp(inputPath, outputPath, seconds) {
    await execFileAsync(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-ss',
        this.formatTimestamp(seconds),
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outputPath
      ],
      {
        timeout: 60000,
        windowsHide: true
      }
    );
  }

  computePcmRms(buffer) {
    if (!buffer?.length || buffer.length < 2) {
      return null;
    }

    const sampleCount = Math.floor(buffer.length / 2);
    if (!sampleCount) return null;

    let sumSquares = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = buffer.readInt16LE(index * 2) / 32768;
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }

  async extractAudioRmsAtTimestamp(inputPath, seconds) {
    const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds) - 0.08) : 0;

    try {
      const { stdout } = await execFileAsync(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-ss',
          this.formatTimestamp(safeSeconds),
          '-t',
          '0.18',
          '-i',
          inputPath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-f',
          's16le',
          'pipe:1'
        ],
        {
          timeout: 60000,
          windowsHide: true,
          encoding: 'buffer',
          maxBuffer: 1024 * 1024
        }
      );

      return this.computePcmRms(stdout);
    } catch {
      return null;
    }
  }

  async extractFramesByTimeline(inputPath, tempDir, timestamps) {
    const frameEntries = [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const outputPath = path.join(tempDir, `frame-${String(index + 1).padStart(3, '0')}.jpg`);

      try {
        await this.extractFrameAtTimestamp(inputPath, outputPath, timestamps[index]);
        await fs.access(outputPath);
        frameEntries.push({
          path: outputPath,
          timestampSec: Number(timestamps[index])
        });
      } catch (error) {
        console.warn(`Frame extraction failed at ${this.formatTimestamp(timestamps[index])}s:`, error?.message || error);
      }
    }

    return frameEntries;
  }

  async extractFramesByFpsFallback(inputPath, tempDir, maxFrames, durationSeconds = 0) {
    const pattern = path.join(tempDir, 'fps-frame-%03d.jpg');
    const fallbackFps = Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.min(6, Math.max(1, maxFrames / durationSeconds))
      : 2;
    try {
      await execFileAsync(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          inputPath,
          '-vf',
          `fps=${fallbackFps.toFixed(3)}`,
          '-frames:v',
          String(maxFrames),
          '-q:v',
          '2',
          pattern
        ],
        {
          timeout: 60000,
          windowsHide: true
        }
      );
    } catch (error) {
      console.warn('Fallback FPS frame extraction failed:', error?.message || error);
    }

    const candidates = await fs.readdir(tempDir).catch(() => []);
    return candidates
      .filter((fileName) => /^fps-frame-\d+\.jpg$/i.test(fileName))
      .sort((left, right) => left.localeCompare(right))
      .map((fileName) => ({
        path: path.join(tempDir, fileName),
        timestampSec: null
      }));
  }

  getFrameRisk(analysis = {}) {
    return Math.max(
      Number(analysis.visual_score || 0),
      Number(analysis.ai_generation_score || analysis.visual_score || 0)
    );
  }

  getEffectiveFrameRisk(analysis = {}) {
    return Math.max(
      this.getFrameRisk(analysis),
      Number(analysis.local_forensics_score || 0)
    );
  }

  getLocalMetric(analysis = {}, metricName, fallback = 0) {
    const rawValue = analysis?.local_metrics?.[metricName];
    const numericValue = Number(rawValue);
    return Number.isNaN(numericValue) ? fallback : numericValue;
  }

  isJawAnomaly(analysis = {}) {
    const jawAsymmetry = this.getLocalMetric(analysis, 'jaw_asymmetry');
    const jawWidthRatio = this.getLocalMetric(analysis, 'jaw_width_ratio');
    const jawCenterOffset = this.getLocalMetric(analysis, 'jaw_center_offset');

    return (
      jawAsymmetry >= 0.15 ||
      jawCenterOffset >= 0.14 ||
      jawWidthRatio >= 0.86 ||
      (jawWidthRatio > 0 && jawWidthRatio <= 0.34)
    );
  }

  isMouthAnomaly(analysis = {}) {
    const mouthAsymmetry = this.getLocalMetric(analysis, 'mouth_asymmetry');
    const mouthOpenRatio = this.getLocalMetric(analysis, 'mouth_open_ratio');
    const mouthEdgeDensity = this.getLocalMetric(analysis, 'mouth_edge_density');

    return (
      mouthAsymmetry >= 0.14 ||
      mouthOpenRatio >= 0.42 ||
      (mouthAsymmetry >= 0.11 && mouthEdgeDensity >= 0.16)
    );
  }

  isEyeAnomaly(analysis = {}) {
    const eyeAsymmetry = this.getLocalMetric(analysis, 'eye_highlight_asymmetry');
    const eyeOpenness = this.getLocalMetric(analysis, 'eye_openness_ratio');

    return eyeAsymmetry >= 0.018 || eyeOpenness >= 0.50;
  }

  getFacialSignalScore(analysis = {}) {
    return this.getLocalMetric(analysis, 'facial_score');
  }

  getFrameFacialFlags(analysis = {}) {
    const directFlags = (analysis.flags || [])
      .filter((flag) => /(jaw|mouth|lip|eye|blink|lip-sync|sync)/i.test(String(flag || '')));
    const generatedFlags = [];

    if (this.isJawAnomaly(analysis)) {
      generatedFlags.push('Jaw shape or jaw size looks unusual in this frame.');
    }
    if (this.isMouthAnomaly(analysis)) {
      generatedFlags.push('Lip or mouth movement looks unusual in this frame.');
    }
    if (this.isEyeAnomaly(analysis)) {
      generatedFlags.push('Eye movement or eye shape looks unusual in this frame.');
    }

    return Array.from(new Set([...directFlags, ...generatedFlags])).slice(0, 2);
  }

  async mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        if (currentIndex >= items.length) {
          return;
        }

        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    };

    const workerCount = Math.min(Math.max(1, concurrency), Math.max(items.length, 1));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  async analyzeSingleFrame(frameInput, frameIndex, options = {}) {
    const frameBuffer = frameInput?.buffer || frameInput;
    const timestampSec = Number.isFinite(Number(frameInput?.timestampSec)) ? Number(frameInput.timestampSec) : null;
    const audioRms = Number.isFinite(Number(frameInput?.audioRms)) ? Number(frameInput.audioRms) : null;

    try {
      const result = await visionService.runVLMAnalysis(frameBuffer, 'image/jpeg', {
        sourceType: 'video-frame',
        ...options
      });

      return {
        ...result,
        frameIndex,
        timestampSec,
        audioRms,
        vlm_failed: result.analysis_ok === false
      };
    } catch (error) {
      console.error(`Complete analysis failed for frame ${frameIndex}:`, error);

      return {
        visual_score: 0,
        ai_generation_score: 0,
        authenticity_confidence: 0,
        flags: [],
        summary: 'Analysis service unavailable for this frame.',
        analysis_ok: false,
        fallback_used: true,
        frameIndex,
        timestampSec,
        audioRms,
        vlm_failed: true,
        error_code: error?.status || 500,
        error_message: error?.message || 'Unknown analysis error'
      };
    }
  }

  /**
   * Extract representative frames across the full video timeline.
   * Frames are written to a temporary directory and deleted immediately after extraction.
   */
  async extractFrames(videoBuffer, mimeType = 'video/mp4') {
    console.log('Extracting frames from video buffer...');

    if (!ffmpegPath) {
      throw new Error('FFmpeg binary is unavailable for video analysis.');
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthlens-video-'));
    const inputPath = path.join(tempDir, `input${this.getFileExtension(mimeType)}`);
    try {
      await fs.writeFile(inputPath, videoBuffer);

      const durationSeconds = await this.getVideoDuration(inputPath);
      const targetFrameCount = this.getTargetFrameCount(durationSeconds);
      const timestamps = this.buildSampleTimestamps(durationSeconds, targetFrameCount);
      const minimumFrameCount = this.getMinimumFrameCount(durationSeconds);
      let frameEntries = await this.extractFramesByTimeline(inputPath, tempDir, timestamps);

      if (frameEntries.length < minimumFrameCount || (frameEntries.length === 1 && targetFrameCount > 1)) {
        const fpsFallbackEntries = await this.extractFramesByFpsFallback(inputPath, tempDir, targetFrameCount, durationSeconds);
        if (fpsFallbackEntries.length > frameEntries.length) {
          frameEntries = fpsFallbackEntries;
        }
      }

      if (frameEntries.length === 0) {
        const fallbackFrame = path.join(tempDir, 'frame-fallback-001.jpg');
        await execFileAsync(
          ffmpegPath,
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            inputPath,
            '-frames:v',
            '1',
            fallbackFrame
          ],
          {
            timeout: 60000,
            windowsHide: true
          }
        );

        frameEntries = [{ path: fallbackFrame, timestampSec: 0 }];
      }

      const frames = await Promise.all(
        frameEntries.map(async (entry) => ({
          buffer: await fs.readFile(entry.path),
          timestampSec: Number.isFinite(Number(entry.timestampSec)) ? Number(entry.timestampSec) : null,
          audioRms: Number.isFinite(Number(entry.timestampSec))
            ? await this.extractAudioRmsAtTimestamp(inputPath, entry.timestampSec)
            : null
        }))
      );
      if (!frames.length) {
        throw new Error('No frames could be extracted from the uploaded video.');
      }

      console.log(`Extracted ${frames.length} frame(s) for video analysis.`);

      return frames;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  /**
   * Send each extracted frame to the VLM with a video-aware fallback path.
   */
  async analyzeVideoFrames(frames) {
    console.log(`Analyzing ${frames.length} frames with VLM...`);

    if (!frames?.length) {
      return [];
    }

    const firstResult = await this.analyzeSingleFrame(frames[0], 1);
    const results = [firstResult];

    if (frames.length === 1) {
      return results;
    }

    const remainingFrames = frames.slice(1);
    const concurrency = this.getAnalysisConcurrency();
    const remoteUnavailable = Boolean(
      firstResult?.fallback_used &&
      Number(firstResult?.error_code || 0) >= 400
    );

    const remainingResults = remoteUnavailable
      ? await this.mapWithConcurrency(
          remainingFrames,
          concurrency,
          (frameBuffer, index) =>
            this.analyzeSingleFrame(frameBuffer, index + 2, {
              skipRemote: true,
              fallbackError: {
                status: Number(firstResult?.error_code || 429),
                message: 'Remote vision analysis was skipped after an earlier service limitation for this video.'
              }
            })
        )
      : await this.mapWithConcurrency(
          remainingFrames,
          concurrency,
          (frameBuffer, index) => this.analyzeSingleFrame(frameBuffer, index + 2)
        );

    return results.concat(remainingResults);
  }

  /**
   * Compare frame results across time to find temporal inconsistencies.
   */
  detectTemporalInconsistency(frameAnalyses) {
    let temporalScore = 0;
    const temporalFlags = [];

    if (!frameAnalyses?.length) {
      return {
        temporal_score: 0,
        flags: []
      };
    }

    const successfulAnalyses = frameAnalyses.filter((analysis) => analysis.analysis_ok !== false);
    const failedAnalyses = frameAnalyses.filter((analysis) => analysis.analysis_ok === false);

    if (failedAnalyses.length > 0 && failedAnalyses.length >= successfulAnalyses.length) {
      temporalFlags.push(`VLM analysis failed for ${failedAnalyses.length}/${frameAnalyses.length} frames - reduced temporal confidence due to service limitations.`);
    }

    let suspiciousFrames = [];
    let pronouncedFrames = [];
    let maxFrameRisk = 0;
    let averageFrameRisk = 0;
    let faceVisibleFrameCount = 0;
    let facialEvidenceFrameCount = 0;
    let strongFacialEvidenceFrameCount = 0;
    let jawAnomalyFrameCount = 0;
    let mouthAnomalyFrameCount = 0;
    let eyeAnomalyFrameCount = 0;
    let jawMotionAnomalyCount = 0;
    let mouthMotionAnomalyCount = 0;
    let eyeMotionAnomalyCount = 0;
    let lipSyncMismatchCount = 0;
    let lightingMismatchFrameCount = 0;
    let boundaryAnomalyFrameCount = 0;

    if (successfulAnalyses.length > 0) {
      const frameRisks = successfulAnalyses.map((analysis) => this.getEffectiveFrameRisk(analysis));
      maxFrameRisk = Math.max(...frameRisks);
      averageFrameRisk = frameRisks.reduce((sum, score) => sum + score, 0) / frameRisks.length;

      const faceMetricFrames = successfulAnalyses.filter((analysis) =>
        analysis.face_detected && analysis.local_metrics && Object.keys(analysis.local_metrics).length > 0
      );
      faceVisibleFrameCount = faceMetricFrames.length;

      if (faceMetricFrames.length >= 1) {
        let abruptFaceShiftCount = 0;
        eyeMotionAnomalyCount = 0;
        mouthMotionAnomalyCount = 0;
        jawMotionAnomalyCount = 0;
        lightingMismatchFrameCount = 0;
        boundaryAnomalyFrameCount = 0;
        lipSyncMismatchCount = 0;
        jawAnomalyFrameCount = 0;
        mouthAnomalyFrameCount = 0;
        eyeAnomalyFrameCount = 0;
        facialEvidenceFrameCount = 0;
        strongFacialEvidenceFrameCount = 0;
        const groundedFlags = [];

        const eyeOpennessValues = [];
        const skinPulseValues = [];

        faceMetricFrames.forEach((analysis) => {
          if (this.getLocalMetric(analysis, 'face_background_luma_delta') >= 0.18) {
            lightingMismatchFrameCount += 1;
          }
          if (this.getLocalMetric(analysis, 'boundary_seam_score') >= 0.08) {
            boundaryAnomalyFrameCount += 1;
          }

          const jawAnomaly = this.isJawAnomaly(analysis);
          const mouthAnomaly = this.isMouthAnomaly(analysis);
          const eyeAnomaly = this.isEyeAnomaly(analysis);
          const facialSignalScore = this.getFacialSignalScore(analysis);
          const anomalyCount = [jawAnomaly, mouthAnomaly, eyeAnomaly].filter(Boolean).length;

          if (jawAnomaly) jawAnomalyFrameCount += 1;
          if (mouthAnomaly) mouthAnomalyFrameCount += 1;
          if (eyeAnomaly) eyeAnomalyFrameCount += 1;

          if (anomalyCount >= 1 || facialSignalScore >= 10) {
            facialEvidenceFrameCount += 1;
            this.getFrameFacialFlags(analysis).forEach((flag) => {
              groundedFlags.push(`Frame ${analysis.frameIndex}: ${flag}`);
            });
          }

          if (anomalyCount >= 2 || facialSignalScore >= 18) {
            strongFacialEvidenceFrameCount += 1;
          }

          const eyeOpenness = this.getLocalMetric(analysis, 'eye_openness_ratio');
          if (eyeOpenness > 0) {
            eyeOpennessValues.push(eyeOpenness);
          }

          const skinPulseProxy = this.getLocalMetric(analysis, 'skin_green_red_ratio');
          if (skinPulseProxy > 0) {
            skinPulseValues.push(skinPulseProxy);
          }
        });

        for (let index = 1; index < faceMetricFrames.length; index += 1) {
          const previous = faceMetricFrames[index - 1];
          const current = faceMetricFrames[index];

          const centerShift = Math.hypot(
            this.getLocalMetric(current, 'face_center_x') - this.getLocalMetric(previous, 'face_center_x'),
            this.getLocalMetric(current, 'face_center_y') - this.getLocalMetric(previous, 'face_center_y')
          );
          const areaShift = Math.abs(
            this.getLocalMetric(current, 'face_area_ratio') - this.getLocalMetric(previous, 'face_area_ratio')
          );
          if (centerShift >= 0.11 || areaShift >= 0.06) {
            abruptFaceShiftCount += 1;
          }

          const eyeOpennessShift = Math.abs(
            this.getLocalMetric(current, 'eye_openness_ratio') - this.getLocalMetric(previous, 'eye_openness_ratio')
          );
          const eyeReflectionShift = Math.abs(
            this.getLocalMetric(current, 'eye_highlight_asymmetry') - this.getLocalMetric(previous, 'eye_highlight_asymmetry')
          );
          if (eyeOpennessShift >= 0.08 || eyeReflectionShift >= 0.018) {
            eyeMotionAnomalyCount += 1;
          }

          const mouthEdgeShift = Math.abs(
            this.getLocalMetric(current, 'mouth_edge_density') - this.getLocalMetric(previous, 'mouth_edge_density')
          );
          const mouthAsymmetryShift = Math.abs(
            this.getLocalMetric(current, 'mouth_asymmetry') - this.getLocalMetric(previous, 'mouth_asymmetry')
          );
          const mouthOpenShift = Math.abs(
            this.getLocalMetric(current, 'mouth_open_ratio') - this.getLocalMetric(previous, 'mouth_open_ratio')
          );
          if (mouthEdgeShift >= 0.06 || mouthAsymmetryShift >= 0.05 || mouthOpenShift >= 0.07) {
            mouthMotionAnomalyCount += 1;
          }

          const jawAsymmetryShift = Math.abs(
            this.getLocalMetric(current, 'jaw_asymmetry') - this.getLocalMetric(previous, 'jaw_asymmetry')
          );
          const jawWidthShift = Math.abs(
            this.getLocalMetric(current, 'jaw_width_ratio') - this.getLocalMetric(previous, 'jaw_width_ratio')
          );
          const jawCenterShift = Math.abs(
            this.getLocalMetric(current, 'jaw_center_offset') - this.getLocalMetric(previous, 'jaw_center_offset')
          );
          if (jawAsymmetryShift >= 0.05 || jawWidthShift >= 0.10 || jawCenterShift >= 0.06) {
            jawMotionAnomalyCount += 1;
          }

          if (Number.isFinite(current.audioRms) && Number.isFinite(previous.audioRms)) {
            const audioDelta = Math.abs(current.audioRms - previous.audioRms);
            const averageAudio = (current.audioRms + previous.audioRms) / 2;
            const mouthMotion = mouthEdgeShift + mouthAsymmetryShift + (mouthOpenShift * 0.65);

            if ((audioDelta >= 0.025 && mouthMotion <= 0.025) || (mouthMotion >= 0.11 && averageAudio <= 0.01)) {
              lipSyncMismatchCount += 1;
            }
          }
        }

        if (abruptFaceShiftCount >= 2) {
          temporalScore += 6;
          temporalFlags.push('The face moves or changes size too abruptly across the video.');
        }

        if (eyeMotionAnomalyCount >= 2) {
          temporalScore += 12;
          temporalFlags.push('Eye-region behavior changes erratically across the video.');
        }

        if (mouthMotionAnomalyCount >= 2) {
          temporalScore += 14;
          temporalFlags.push('Lip or mouth movement changes too abruptly across the video.');
        }

        if (jawMotionAnomalyCount >= 2) {
          temporalScore += 16;
          temporalFlags.push('Jaw shape or jaw position changes too abruptly across the video.');
        }

        if (lightingMismatchFrameCount >= 2) {
          temporalScore += 4;
          temporalFlags.push('Multiple sampled frames show a recurring lighting mismatch between the face and the surrounding scene.');
        }

        if (boundaryAnomalyFrameCount >= 2) {
          temporalScore += 5;
          temporalFlags.push('Multiple sampled frames show recurring boundary artifacts around the detected face.');
        }

        if (eyeOpennessValues.length >= 4) {
          const eyeOpennessRange = Math.max(...eyeOpennessValues) - Math.min(...eyeOpennessValues);
          if (eyeOpennessRange < 0.025 && (strongFacialEvidenceFrameCount >= 1 || eyeAnomalyFrameCount >= 2)) {
            temporalScore += 6;
            temporalFlags.push('Eye openness stays unusually fixed across the video.');
          }
        }

        if (skinPulseValues.length >= 4) {
          const skinPulseRange = Math.max(...skinPulseValues) - Math.min(...skinPulseValues);
          let skinPulseJitter = 0;
          for (let index = 1; index < skinPulseValues.length; index += 1) {
            skinPulseJitter += Math.abs(skinPulseValues[index] - skinPulseValues[index - 1]);
          }
          skinPulseJitter /= Math.max(skinPulseValues.length - 1, 1);

          if (skinPulseRange < 0.018 && averageFrameRisk >= 28) {
            temporalScore += 5;
            temporalFlags.push('Skin-tone pulse proxy remains unusually flat across sampled frames.');
          } else if (skinPulseJitter > 0.05 && skinPulseRange > 0.10) {
            temporalScore += 5;
            temporalFlags.push('Skin-tone pulse proxy changes too abruptly across sampled frames to look natural.');
          }
        }

        if (lipSyncMismatchCount >= 2) {
          temporalScore += 18;
          temporalFlags.push('Lip movement does not match the nearby audio consistently.');
        } else if (lipSyncMismatchCount === 1) {
          temporalScore += 8;
          temporalFlags.push('One part of the video shows lip movement that does not match the nearby audio well.');
        }

        if (jawAnomalyFrameCount >= 1) {
          temporalScore += jawAnomalyFrameCount >= 2 ? 12 : 7;
          temporalFlags.push('At least one sampled frame shows unusual jaw shape or jaw size.');
        }

        if (mouthAnomalyFrameCount >= 1) {
          temporalScore += mouthAnomalyFrameCount >= 2 ? 10 : 6;
          temporalFlags.push('At least one sampled frame shows unusual lip or mouth shape.');
        }

        if (eyeAnomalyFrameCount >= 1) {
          temporalScore += eyeAnomalyFrameCount >= 2 ? 8 : 5;
          temporalFlags.push('At least one sampled frame shows unusual eye behavior.');
        }

        if (facialEvidenceFrameCount >= 2) {
          temporalScore += 10;
          temporalFlags.push(`Facial anomalies repeat across ${facialEvidenceFrameCount}/${faceMetricFrames.length} face-visible frames.`);
        }

        if (strongFacialEvidenceFrameCount >= 1) {
          temporalScore += strongFacialEvidenceFrameCount >= 2 ? 10 : 6;
        }

        suspiciousFrames = faceMetricFrames.filter((analysis) => {
          const anomalyCount = [
            this.isJawAnomaly(analysis),
            this.isMouthAnomaly(analysis),
            this.isEyeAnomaly(analysis)
          ].filter(Boolean).length;
          return anomalyCount >= 1 || this.getFacialSignalScore(analysis) >= 10;
        });

        pronouncedFrames = faceMetricFrames.filter((analysis) => {
          const anomalyCount = [
            this.isJawAnomaly(analysis),
            this.isMouthAnomaly(analysis),
            this.isEyeAnomaly(analysis)
          ].filter(Boolean).length;
          return anomalyCount >= 2 || this.getFacialSignalScore(analysis) >= 18;
        });

        temporalFlags.push(...groundedFlags);
      }
    }

    const uniqueFlags = Array.from(new Set(temporalFlags));

    return {
      temporal_score: Math.min(temporalScore, 100),
      flags: uniqueFlags,
      vlm_success_rate: (successfulAnalyses.length / frameAnalyses.length) * 100,
      suspicious_frame_count: suspiciousFrames.length,
      pronounced_frame_count: pronouncedFrames.length,
      max_frame_risk: maxFrameRisk,
      average_frame_risk: averageFrameRisk,
      sampled_frame_count: frameAnalyses.length,
      face_visible_frame_count: faceVisibleFrameCount,
      facial_evidence_frame_count: facialEvidenceFrameCount,
      strong_facial_evidence_frame_count: strongFacialEvidenceFrameCount,
      jaw_anomaly_frame_count: jawAnomalyFrameCount,
      mouth_anomaly_frame_count: mouthAnomalyFrameCount,
      eye_anomaly_frame_count: eyeAnomalyFrameCount,
      jaw_motion_anomaly_count: jawMotionAnomalyCount,
      mouth_motion_anomaly_count: mouthMotionAnomalyCount,
      eye_motion_anomaly_count: eyeMotionAnomalyCount,
      lip_sync_mismatch_count: lipSyncMismatchCount,
      lighting_mismatch_frame_count: lightingMismatchFrameCount,
      boundary_anomaly_frame_count: boundaryAnomalyFrameCount
    };
  }
}

module.exports = new VideoService();
