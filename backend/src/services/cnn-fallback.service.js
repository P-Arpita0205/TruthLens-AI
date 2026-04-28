const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class CnnFallbackService {
  constructor() {
    this.pythonCommand = process.env.PYTHON_BIN || 'python';
    this.scriptPath = path.join(__dirname, 'cnn_deepfake_inference.py');
  }

  getFileExtension(mimeType = 'image/jpeg') {
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/bmp': '.bmp'
    };

    return extensionMap[mimeType] || '.jpg';
  }

  isConfigured() {
    return Boolean(
      String(process.env.TRUTHLENS_EFFICIENTNET_MODEL || '').trim() ||
      String(process.env.TRUTHLENS_XCEPTION_MODEL || '').trim()
    );
  }

  shouldRun(options = {}) {
    if (!this.isConfigured()) return false;
    if (options.sourceType === 'video-frame') {
      return String(process.env.CNN_ENABLE_VIDEO_FRAMES || '').toLowerCase() === 'true';
    }

    return true;
  }

  normalizeResult(raw = {}) {
    const numericScore = Number(raw?.score || 0);

    return {
      available: raw?.available === true,
      status: String(raw?.status || (raw?.available ? 'ok' : 'unavailable')),
      score: Number.isNaN(numericScore) ? 0 : Math.max(0, Math.min(100, numericScore)),
      flags: Array.isArray(raw?.flags)
        ? raw.flags.map((flag) => String(flag || '').trim()).filter(Boolean)
        : [],
      summary: String(raw?.summary || '').trim(),
      models_run: Array.isArray(raw?.models_run)
        ? raw.models_run.map((modelName) => String(modelName || '').trim()).filter(Boolean)
        : [],
      model_scores: raw?.model_scores && typeof raw.model_scores === 'object'
        ? raw.model_scores
        : {}
    };
  }

  async analyzeImageBuffer(buffer, mimeType = 'image/jpeg', options = {}) {
    if (!buffer?.length || !this.shouldRun(options)) {
      return this.normalizeResult({ available: false, status: 'skipped' });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthlens-cnn-'));
    const inputPath = path.join(tempDir, `frame${this.getFileExtension(mimeType)}`);

    try {
      await fs.writeFile(inputPath, buffer);

      const { stdout = '' } = await execFileAsync(
        this.pythonCommand,
        [this.scriptPath, inputPath],
        {
          timeout: Number(process.env.CNN_FALLBACK_TIMEOUT_MS || 45000),
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );

      return this.normalizeResult(JSON.parse(String(stdout || '{}').trim() || '{}'));
    } catch (error) {
      console.warn('CNN fallback unavailable:', error?.message || error);
      return this.normalizeResult({
        available: false,
        status: 'execution_failed',
        summary: error?.message || 'CNN fallback execution failed.'
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}

module.exports = new CnnFallbackService();
