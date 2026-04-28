import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const clampConfidence = (value) => {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return 0;
  return Math.max(0, Math.min(100, numericValue));
};

const parseConfidence = (value) => {
  if (typeof value === 'number') {
    return clampConfidence(value);
  }

  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  return match ? clampConfidence(Number(match[0])) : 0;
};

const normalizeVerdict = (value) => {
  const verdict = String(value ?? '').trim();

  if (!verdict) return 'Unknown';
  if (/authentic|real/i.test(verdict)) return 'Authentic';
  if (/manipulated|fake|deepfake|synthetic|generated/i.test(verdict)) return 'Manipulated';
  if (/uncertain|unknown|inconclusive/i.test(verdict)) return 'Uncertain';

  return verdict;
};

const normalizeExplanation = (data = {}) => {
  const directExplanation =
    data.explanation ??
    data.Explanation ??
    data.reasoning ??
    data.summary;

  if (typeof directExplanation === 'string' && directExplanation.trim()) {
    return directExplanation.trim();
  }

  if (Array.isArray(data['Key Reasons'])) {
    const combinedReasons = data['Key Reasons']
      .map((reason) => String(reason || '').trim())
      .filter(Boolean)
      .join(' ');

    if (combinedReasons) {
      return combinedReasons;
    }
  }

  return '';
};

export const normalizeAnalysisResult = (data = {}, extraFields = {}) => ({
  ...data,
  ...extraFields,
  verdict: normalizeVerdict(data.verdict ?? data.Verdict ?? data.finalVerdict ?? data.result),
  confidence: parseConfidence(
    data.confidence ??
      data.Confidence ??
      data['Confidence Score'] ??
      data.confidenceScore
  ),
  explanation: normalizeExplanation(data)
});

class AnalysisService {
  constructor() {
    this.analyses = [];
    this.listeners = [];
    this.unsubscribeFirestore = null;
  }

  getCurrentUser() {
    try {
      const rawUser = localStorage.getItem('user');
      return rawUser ? JSON.parse(rawUser) : null;
    } catch {
      return null;
    }
  }

  getAnalysesCollection() {
    const user = this.getCurrentUser();
    if (!user?.uid) return null;
    return collection(db, 'users', user.uid, 'analyses');
  }

  startRealtimeSync() {
    if (this.unsubscribeFirestore) return;

    const analysesCollection = this.getAnalysesCollection();
    if (!analysesCollection) {
      this.analyses = [];
      this.notifyListeners();
      return;
    }

    const analysesQuery = query(analysesCollection, orderBy('timestamp', 'asc'));
    this.unsubscribeFirestore = onSnapshot(analysesQuery, (snapshot) => {
      this.analyses = snapshot.docs.map((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();

        return normalizeAnalysisResult(data, {
          id: doc.id,
          type: data.type || 'unknown',
          timestamp: timestamp.toISOString()
        });
      });

      this.notifyListeners();
    });
  }

  stopRealtimeSync() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
  }

  async addAnalysis(type, result) {
    const analysesCollection = this.getAnalysesCollection();
    if (!analysesCollection) {
      throw new Error('No authenticated user found');
    }

    const normalizedResult = normalizeAnalysisResult(result, { type });

    await addDoc(analysesCollection, {
      type: normalizedResult.type,
      verdict: normalizedResult.verdict,
      confidence: normalizedResult.confidence,
      explanation: normalizedResult.explanation,
      timestamp: serverTimestamp()
    });
  }

  getAnalyses() {
    return this.analyses;
  }

  getDashboardData() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const recentAnalyses = this.analyses.filter(a => 
      new Date(a.timestamp) >= weekAgo
    );

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activityData = weekDays.map((day, index) => {
      const dayAnalyses = recentAnalyses.filter(a => 
        new Date(a.timestamp).getDay() === index
      );
      
      const real = dayAnalyses.filter(a => a.verdict === 'Authentic').length;
      const fake = dayAnalyses.filter(a => a.verdict === 'Manipulated').length;
      
      return { name: day, real, fake };
    });

    const totalAnalyses = this.analyses.length;
    const authenticCount = this.analyses.filter(a => a.verdict === 'Authentic').length;
    const manipulatedCount = this.analyses.filter(a => a.verdict === 'Manipulated').length;
    
    const distributionData = [
      { name: 'Fake/Manipulated', value: totalAnalyses > 0 ? Math.round((manipulatedCount / totalAnalyses) * 100) : 0 },
      { name: 'Authentic/Real', value: totalAnalyses > 0 ? Math.round((authenticCount / totalAnalyses) * 100) : 0 }
    ];

    const confidenceData = this.analyses.slice(-6).map((analysis, index) => ({
      time: new Date(analysis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      score: analysis.confidence
    }));

    const stats = {
      totalAnalyses: totalAnalyses.toString(),
      fakeDetected: totalAnalyses > 0 ? `${Math.round((manipulatedCount / totalAnalyses) * 100)}%` : '0%',
      authenticVerified: totalAnalyses > 0 ? `${Math.round((authenticCount / totalAnalyses) * 100)}%` : '0%',
      avgConfidence: totalAnalyses > 0 
        ? `${(this.analyses.reduce((sum, a) => sum + a.confidence, 0) / totalAnalyses).toFixed(1)}%`
        : '0%'
    };

    return {
      activityData,
      distributionData,
      confidenceData,
      stats
    };
  }

  subscribe(callback) {
    this.startRealtimeSync();
    this.listeners.push(callback);
    callback(this.getDashboardData());

    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
      if (this.listeners.length === 0) {
        this.stopRealtimeSync();
      }
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.getDashboardData()));
  }
}

export default new AnalysisService();
