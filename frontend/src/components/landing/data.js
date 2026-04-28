import {
  Shield,
  Eye,
  Lock,
  UserX,
  FileWarning,
  Search,
  UploadCloud,
  Activity,
  CheckCircle2
} from 'lucide-react';

export const pipelineItems = [
  { title: 'Zero-Storage Policy', desc: 'Media drops from memory immediately.' },
  { title: 'Temporal Analysis', desc: 'Cross-frame logic catches hidden flickering.' },
  { title: 'Generative AI Detection', desc: 'Identifies GAN and Diffusion artifacts.' }
];

export const riskCards = [
  {
    icon: FileWarning,
    title: 'Misinformation',
    desc: 'Weaponized false narratives affecting elections and markets.',
    accent: 'from-rose-400 to-red-500'
  },
  {
    icon: UserX,
    title: 'Identity Theft',
    desc: 'Cloning voices and faces for social engineering and fraud.',
    accent: 'from-amber-300 to-orange-500'
  },
  {
    icon: Shield,
    title: 'Security Risks',
    desc: 'Bypassing biometric authentication systems easily.',
    accent: 'from-sky-400 to-blue-500'
  },
  {
    icon: Search,
    title: 'Lack of Tools',
    desc: 'Traditional detection fails against modern diffusion models.',
    accent: 'from-fuchsia-400 to-purple-500'
  }
];

export const featureCards = [
  { title: 'Video Detection', desc: 'Extracts keyframes in-memory to detect temporal inconsistencies.' },
  { title: 'Image Verification', desc: 'Analyzes lighting, blending, and generative AI noise patterns.' },
  { title: 'Multi-Agent Reasoning', desc: '4 specialized LLM agents debate to reach the final verdict.' },
  { title: 'Confidence Scoring', desc: 'Mathematically aggregated percentage of media authenticity.' },
  { title: 'Real-Time Processing', desc: 'Highly optimized Gemini integrations for sub-second responses.' },
  { title: 'Zero-Storage Protocol', desc: 'Media never touches our disks. Complete privacy guaranteed.' }
];

export const workflowSteps = [
  { icon: UploadCloud, title: '1. Upload', desc: 'Select video or image via our secure dashboard.' },
  { icon: Activity, title: '2. Analyze', desc: 'Agents process media entirely in memory.' },
  { icon: Eye, title: '3. Result', desc: 'Receive confidence score and explainable logic.' }
];

export const heroTrustBadges = [
  { label: 'Authentic', tone: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  { label: 'Manipulated', tone: 'bg-rose-500/15 text-rose-300 border-rose-400/30' }
];

export const heroSignalBadges = [
  { icon: Lock, label: 'Zero Storage' },
  { icon: Shield, label: 'Explainable Verdicts' },
  { icon: CheckCircle2, label: 'Analyst Ready' }
];
