const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class OpenCvForensicsService {
  constructor() {
    this.pythonCommand = process.env.PYTHON_BIN || 'python';
    this.scriptPath = path.join(__dirname, 'opencv_frame_forensics.py');
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

  normalizeResult(raw = {}) {
    const score = Number(raw?.score || 0);
    const safeScore = Number.isNaN(score) ? 0 : Math.max(0, Math.min(100, score));

    return {
      available: raw?.available !== false,
      score: safeScore,
      flags: Array.isArray(raw?.flags)
        ? raw.flags.map((flag) => String(flag || '').trim()).filter(Boolean)
        : [],
      summary: String(raw?.summary || '').trim(),
      metrics: raw?.metrics && typeof raw.metrics === 'object' ? raw.metrics : {},
      face_detected: Boolean(raw?.face_detected)
    };
  }

  async analyzeImageBuffer(buffer, mimeType = 'image/jpeg') {
    if (!buffer?.length) {
      return this.normalizeResult({ available: false });
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthlens-opencv-'));
    const inputPath = path.join(tempDir, `frame${this.getFileExtension(mimeType)}`);

    try {
      await fs.writeFile(inputPath, buffer);

      const { stdout = '' } = await execFileAsync(
        this.pythonCommand,
        [this.scriptPath, inputPath],
        {
          timeout: 20000,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );

      return this.normalizeResult(JSON.parse(String(stdout || '{}').trim() || '{}'));
    } catch (error) {
      console.warn('OpenCV forensic fallback unavailable:', error?.message || error);
      return this.normalizeResult({
        available: false,
        score: 0,
        flags: [],
        summary: '',
        metrics: {},
        face_detected: false
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}

module.exports = new OpenCvForensicsService();
