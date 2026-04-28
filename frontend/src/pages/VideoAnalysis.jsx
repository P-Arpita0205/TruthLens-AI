import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileVideo,
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Activity,
  FileText,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import analysisService, { normalizeAnalysisResult } from '../services/analysisService';

export default function VideoAnalysis() {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const readApiResponse = async (response) => {
    const rawBody = await response.text();
    if (!rawBody) return {};

    try {
      return JSON.parse(rawBody);
    } catch {
      return {
        error: response.ok ? '' : `Analysis failed with status ${response.status}.`
      };
    }
  };

  const startAnalysis = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        body: formData
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze video');
      }

      const normalizedResult = normalizeAnalysisResult(data);
      setResult(normalizedResult);

      try {
        await analysisService.addAnalysis('video', normalizedResult);
      } catch (syncError) {
        console.error('Failed to sync analysis to Firestore:', syncError);
      }
    } catch (analysisError) {
      setError(analysisError.message || 'Failed to analyze video');
      setResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setFile(null);
    setResult(null);
    setAnalyzing(false);
    setError('');
    setIsDragActive(false);
  };

  const verdictAppearance = result?.verdict === 'Authentic'
    ? {
        Icon: ShieldCheck,
        tone: 'text-emerald-300',
        badge: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
        bar: 'from-emerald-400 to-cyan-400'
      }
    : result?.verdict === 'Manipulated'
      ? {
          Icon: AlertOctagon,
          tone: 'text-rose-300',
          badge: 'border-rose-400/20 bg-rose-500/10 text-rose-300',
          bar: 'from-rose-400 to-red-500'
        }
      : {
          Icon: AlertTriangle,
          tone: 'text-amber-300',
          badge: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
          bar: 'from-amber-300 to-orange-400'
        };

  const VerdictIcon = verdictAppearance.Icon;

  return (
    <div className="relative px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="dashboard-pill mb-4">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>Motion Analysis</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Video{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                Deepfake Analyzer
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium text-slate-400">
              Upload a video to review authenticity, confidence, and plain-language AI reasoning in a darker premium workflow.
            </p>
            {error ? (
              <p className="mt-4 inline-flex rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <motion.div
              layout
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`glass-card glass-card-hover relative overflow-hidden border p-8 text-center ${
                file
                  ? 'border-cyan-400/30 bg-cyan-500/5'
                  : isDragActive
                    ? 'border-cyan-400 bg-cyan-500/10 shadow-cyan-500/20'
                    : 'border-white/10'
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10" />
              <input
                type="file"
                accept="video/*"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={handleFileChange}
              />

              {file ? (
                <motion.div initial={{ scale: 0.96, opacity: 0.8 }} animate={{ scale: 1, opacity: 1 }} className="relative z-0 flex flex-col items-center">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 shadow-lg shadow-cyan-500/20 ring-1 ring-white/10">
                    <FileVideo className="h-9 w-9 text-cyan-300" />
                  </div>
                  <p className="max-w-sm truncate text-2xl font-bold tracking-tight text-white">{file.name}</p>
                  <p className="mt-2 text-sm font-medium text-cyan-200">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for frame-by-frame analysis
                  </p>
                </motion.div>
              ) : (
                <div className="relative z-0 flex flex-col items-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
                    transition={{ repeat: Infinity, duration: 2.2 }}
                    className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 shadow-lg shadow-cyan-500/20"
                  >
                    <UploadCloud className="h-9 w-9 text-cyan-300" />
                  </motion.div>
                  <p className="text-2xl font-bold tracking-tight text-white">Drop your video here</p>
                  <p className="mt-3 text-sm font-medium text-slate-400">MP4, MOV, AVI up to 50MB</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.28em] text-slate-500">Drag, drop, or click to browse</p>
                </div>
              )}
            </motion.div>

            <button
              onClick={startAnalysis}
              disabled={!file || analyzing}
              className={`dashboard-button-primary w-full gap-2 py-4 text-base ${!file || analyzing ? 'opacity-50 cursor-not-allowed hover:scale-100 hover:translate-y-0' : ''}`}
            >
              {analyzing ? (
                <>
                  <Activity className="h-5 w-5 animate-pulse" />
                  <span>Running frame pipeline...</span>
                </>
              ) : (
                <span>Start Analysis</span>
              )}
            </button>
          </div>

          <div className="relative min-h-[28rem]">
            <AnimatePresence mode="wait">
              {analyzing ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card absolute inset-0 flex flex-col justify-center p-8"
                >
                  <div className="mb-8 flex items-center gap-4">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10">
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-300/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      <Activity className="h-6 w-6 text-cyan-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Analyzing Motion Signals</h3>
                      <p className="mt-2 text-sm text-slate-400">Extracting frames, checking consistency, and preparing the final verdict.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="shimmer-line h-3 w-1/3" />
                    <div className="shimmer-line h-3 w-full" />
                    <div className="shimmer-line h-3 w-5/6" />
                    <div className="shimmer-line h-3 w-4/6" />
                  </div>
                </motion.div>
              ) : null}

              {result && !analyzing ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="glass-card h-full p-8"
                >
                  <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Final Verdict</p>
                      <div className="mt-4 flex items-center gap-3">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${verdictAppearance.badge}`}>
                          <VerdictIcon className={`h-7 w-7 ${verdictAppearance.tone}`} />
                        </div>
                        <div>
                          <p className={`text-3xl font-bold tracking-tight ${verdictAppearance.tone}`}>{result.verdict}</p>
                          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${verdictAppearance.badge}`}>
                            Classified
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[13rem]">
                      <div className="flex items-end justify-between">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Confidence</p>
                        <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-4xl font-bold text-transparent">
                          {result.confidence}%
                        </span>
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${result.confidence}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          className={`h-full rounded-full bg-gradient-to-r ${verdictAppearance.bar}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                    <div className="mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-300" />
                      <h4 className="font-bold text-white">AI Explanation</h4>
                    </div>
                    <p className="text-sm font-medium leading-7 text-slate-300">
                      {result.explanation || 'The analysis service did not return a written explanation for this result.'}
                    </p>
                  </div>

                  <button
                    onClick={resetAnalysis}
                    className="dashboard-button-secondary mt-6 w-full gap-2 py-3.5"
                  >
                    <RefreshCw className="h-5 w-5" />
                    <span>New Analysis</span>
                  </button>
                </motion.div>
              ) : null}

              {!analyzing && !result ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  className="glass-card flex h-full min-h-[28rem] items-center justify-center p-8 text-center"
                >
                  <div>
                    <p className="text-lg font-semibold text-white">Results will appear here</p>
                    <p className="mt-3 text-sm font-medium text-slate-400">
                      Start a video analysis to see the verdict, confidence score, and plain-language explanation.
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
