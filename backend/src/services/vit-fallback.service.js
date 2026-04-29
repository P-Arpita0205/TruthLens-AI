const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

class VitFallbackService {
  constructor() {
    this.pythonCommand = process.env.PYTHON_BIN || 'python';
    this.scriptPath = path.join(__dirname, 'vit_deepfake_detector.py');
  }

  getFileExtension(mimeType = 'image/jpeg') {
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'video/webm': '.webm'
    };
    return extensionMap[mimeType] || '.jpg';
  }

  async analyzeMedia(buffer, mimeType = 'image/jpeg') {
    if (!buffer?.length) {
      return { available: false, status: 'empty_buffer' };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthlens-vit-'));
    const inputPath = path.join(tempDir, `input${this.getFileExtension(mimeType)}`);

    try {
      await fs.writeFile(inputPath, buffer);

      // Increase timeout because ViT on CPU can be slow, especially for videos
      const timeout = mimeType.startsWith('video/') ? 60000 : 20000;

      const { stdout = '' } = await execFileAsync(
        this.pythonCommand,
        [this.scriptPath, inputPath],
        {
          timeout,
          windowsHide: true,
          maxBuffer: 1024 * 1024
        }
      );

      const result = JSON.parse(String(stdout || '{}').trim() || '{}');
      
      if (result.error) {
        throw new Error(result.error);
      }

      return {
        available: true,
        status: 'ok',
        visual_score: result.visual_score,
        ai_generation_score: result.ai_generation_score,
        authenticity_confidence: result.authenticity_confidence,
        summary: `Tier 3 Local Fallback (SigLIP ViT) analyzed the media and detected a ${result.visual_score}% manipulation probability.`,
        flags: result.visual_score >= 50 ? [`Local SigLIP model flagged this as ${result.label.toLowerCase()} (${result.visual_score}%).`] : [],
        source: 'local-vit'
      };
    } catch (error) {
      console.warn('[VitFallback] Execution failed:', error?.message || error);
      return {
        available: false,
        status: 'execution_failed',
        error_message: error?.message || 'Local ViT execution failed.'
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}

module.exports = new VitFallbackService();
