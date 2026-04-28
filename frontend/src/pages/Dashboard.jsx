import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle2, Percent, Sparkles, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import analysisService from '../services/analysisService';

const COLORS = ['#ef4444', '#22c55e'];
const tooltipContentStyle = {
  backgroundColor: 'rgba(2, 6, 23, 0.96)',
  borderColor: 'rgba(148, 163, 184, 0.18)',
  borderRadius: '16px',
  color: '#e2e8f0',
  boxShadow: '0 18px 60px rgba(2, 8, 23, 0.45)',
  backdropFilter: 'blur(20px)'
};

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    activityData: [],
    distributionData: [],
    confidenceData: [],
    stats: {
      totalAnalyses: '0',
      fakeDetected: '0%',
      authenticVerified: '0%',
      avgConfidence: '0%'
    }
  });

  useEffect(() => {
    setDashboardData(analysisService.getDashboardData());

    const unsubscribe = analysisService.subscribe((data) => {
      setDashboardData(data);
    });

    return unsubscribe;
  }, []);

  const stats = useMemo(() => ([
    {
      label: 'Total Analyses',
      value: dashboardData.stats.totalAnalyses,
      icon: Activity,
      tone: 'from-cyan-400/30 via-cyan-400/15 to-transparent',
      iconBg: 'from-cyan-400 to-blue-500'
    },
    {
      label: 'Fake Detected',
      value: dashboardData.stats.fakeDetected,
      icon: AlertTriangle,
      tone: 'from-rose-400/30 via-rose-400/15 to-transparent',
      iconBg: 'from-rose-400 to-red-500'
    },
    {
      label: 'Authentic Verified',
      value: dashboardData.stats.authenticVerified,
      icon: CheckCircle2,
      tone: 'from-emerald-400/30 via-emerald-400/15 to-transparent',
      iconBg: 'from-emerald-400 to-teal-500'
    },
    {
      label: 'Avg Confidence',
      value: dashboardData.stats.avgConfidence,
      icon: Percent,
      tone: 'from-violet-400/30 via-violet-400/15 to-transparent',
      iconBg: 'from-violet-400 to-fuchsia-500'
    }
  ]), [dashboardData.stats]);

  const authenticShare = dashboardData.distributionData.find((entry) => entry.name === 'Authentic/Real')?.value || 0;
  const fakeShare = dashboardData.distributionData.find((entry) => entry.name === 'Fake/Manipulated')?.value || 0;

  return (
    <div className="relative px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="dashboard-pill mb-4">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>Operational Intelligence</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              TruthLens{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                Command Center
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium text-slate-400">
              Monitor platform performance, detection ratios, and model confidence through a production-grade analytics surface.
            </p>
          </div>

          <div className="glass-card flex items-center gap-3 px-4 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 text-cyan-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Live Snapshot</p>
              <p className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-lg font-bold text-transparent">
                {dashboardData.stats.avgConfidence} avg confidence
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="glass-card glass-card-hover group relative overflow-hidden p-6"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stat.tone} opacity-60`} />
              <div className="relative flex items-start justify-between">
                <div className="space-y-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.iconBg} shadow-lg shadow-cyan-500/20`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                    <p className="mt-2 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                      {stat.value}
                    </p>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-[0.28em] text-slate-400">
                  Live
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="glass-card glass-card-hover p-6"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">Weekly Analysis Activity</h3>
                <p className="mt-2 text-sm text-slate-400">A view of authentic versus manipulated detections across recent usage.</p>
              </div>
              <div className="dashboard-pill">
                <span>7-day view</span>
              </div>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.activityData} barGap={10}>
                  <defs>
                    <linearGradient id="authenticBar" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="100%" stopColor="#0f766e" />
                    </linearGradient>
                    <linearGradient id="fakeBar" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="100%" stopColor="#be123c" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipContentStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
                  <Bar dataKey="real" name="Authentic" fill="url(#authenticBar)" radius={[10, 10, 0, 0]} barSize={24} />
                  <Bar dataKey="fake" name="Manipulated" fill="url(#fakeBar)" radius={[10, 10, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 }}
              className="glass-card glass-card-hover p-6"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">Detection Split</h3>
                  <p className="mt-2 text-sm text-slate-400">Overall proportion of authentic and manipulated media.</p>
                </div>
                <div className="dashboard-pill">
                  <span>All time</span>
                </div>
              </div>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="relative h-52 flex-1">
                  <div className="absolute inset-6 rounded-full bg-cyan-400/10 blur-3xl" />
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <radialGradient id="donutGlow" cx="50%" cy="50%" r="60%">
                          <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                        </radialGradient>
                      </defs>
                      <Pie
                        data={dashboardData.distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="rgba(15, 23, 42, 0.8)"
                        strokeWidth={4}
                      >
                        {dashboardData.distributionData.map((entry, index) => (
                          <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipContentStyle} />
                      <circle cx="50%" cy="50%" r="38" fill="url(#donutGlow)" />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs uppercase tracking-[0.26em] text-slate-500">Center</span>
                    <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-2xl font-bold text-transparent">
                      {authenticShare}% Real
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="glass-card rounded-2xl border-white/5 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-300">Authentic</span>
                      <span className="text-sm font-semibold text-emerald-300">{authenticShare}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${authenticShare}%` }} />
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl border-white/5 bg-white/[0.04] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-300">Manipulated</span>
                      <span className="text-sm font-semibold text-rose-300">{fakeShare}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500" style={{ width: `${fakeShare}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-card glass-card-hover p-6"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-white">Confidence Trend</h3>
                  <p className="mt-2 text-sm text-slate-400">Recent confidence scores returned by the analysis pipeline.</p>
                </div>
                <div className="dashboard-pill">
                  <span>Realtime</span>
                </div>
              </div>

              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.confidenceData}>
                    <defs>
                      <linearGradient id="confidenceStroke" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipContentStyle} cursor={{ stroke: 'rgba(34,211,238,0.25)' }} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="url(#confidenceStroke)"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#22d3ee', strokeWidth: 0 }}
                      className="drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
