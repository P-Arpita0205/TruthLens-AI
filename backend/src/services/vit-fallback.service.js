const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

class VitFallbackService {
  constructor() {
    this.pythonCommand = process.env.PYTHON_BIN || 'python';
    this.serverScriptPath = path.join(__dirname, 'vit_server.py');
    this.port = process.env.VIT_PORT || 5001;
    this.serverProcess = null;
    this.isStarting = false;
  }

  async ensureServerRunning() {
    if (this.isStarting) {
      // Wait for existing start attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return new Promise((resolve) => {
      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/analyze',
        method: 'POST',
        timeout: 1000
      };

      const req = http.request(options, (res) => {
        resolve(true);
        res.resume();
      });

      req.on('error', () => {
        // Server not running, start it
        this.startServer().then(() => resolve(true)).catch(() => resolve(false));
      });

      req.end(JSON.stringify({ check: true }));
    });
  }

  async startServer() {
    if (this.serverProcess) return;
    this.isStarting = true;
    console.info(`[VitFallback] Starting persistent ViT server on port ${this.port}...`);

    this.serverProcess = spawn(this.pythonCommand, [this.serverScriptPath], {
      env: { ...process.env, VIT_PORT: this.port },
      detached: false,
      windowsHide: true
    });

    this.serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('Running on')) {
        console.info('[VitFallback] ViT server is ready.');
        this.isStarting = false;
      }
    });

    this.serverProcess.on('error', (err) => {
      console.error('[VitFallback] Failed to start ViT server:', err);
      this.isStarting = false;
    });

    // Wait for server to boot (usually 5-10 seconds for model load)
    await new Promise(resolve => setTimeout(resolve, 8000));
    this.isStarting = false;
  }

  getFileExtension(mimeType = 'image/jpeg') {
    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };
    return extensionMap[mimeType] || '.jpg';
  }

  async analyzeMedia(buffer, mimeType = 'image/jpeg') {
    if (!buffer?.length) {
      return { available: false, status: 'empty_buffer' };
    }

    await this.ensureServerRunning();

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'truthlens-vit-'));
    const inputPath = path.join(tempDir, `input${this.getFileExtension(mimeType)}`);

    try {
      await fs.writeFile(inputPath, buffer);

      const result = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({ path: inputPath });
        const options = {
          hostname: '127.0.0.1',
          port: this.port,
          path: '/analyze',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 45000
        };

        const req = http.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Invalid response from ViT server'));
            }
          });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('ViT server request timed out'));
        });
        req.write(postData);
        req.end();
      });

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
      console.warn('[VitFallback] Analysis failed:', error?.message || error);
      return {
        available: false,
        status: 'failed',
        error_message: error?.message || 'Local ViT analysis failed.'
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}

module.exports = new VitFallbackService();
