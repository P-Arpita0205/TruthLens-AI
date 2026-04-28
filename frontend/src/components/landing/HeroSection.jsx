import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, CheckCircle2 } from 'lucide-react';
import { heroSignalBadges, heroTrustBadges, pipelineItems } from './data';
import { fadeUp, stagger } from './motion';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-24 pb-24 lg:pt-32 lg:pb-28">
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute left-[-10%] bottom-0 h-96 w-96 rounded-full bg-blue-500/12 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 flex flex-col gap-16 lg:flex-row lg:items-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative lg:w-1/2 text-left"
        >
          <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.15),transparent_60%)] blur-2xl" />

          <motion.div
            variants={fadeUp}
            className="inline-flex items-center space-x-2 rounded-full border border-cyan-400/20 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-950/30 backdrop-blur-lg"
          >
            <Shield className="h-4 w-4 text-cyan-300" />
            <span>Enterprise-Grade Security</span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-7 font-['Space_Grotesk'] text-5xl font-bold leading-[1.02] tracking-tight text-white md:text-6xl xl:text-7xl"
          >
            Detect Deepfakes in Real-Time with{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Explainable AI.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-7 max-w-xl text-lg leading-8 text-slate-300"
          >
            Privacy-first, no media stored. TruthLens uses a multi-agent AI pipeline to verify the authenticity of video and images instantly.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col gap-4 sm:flex-row">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-cyan-400/25 blur-xl" />
              <Link
                to="/auth?mode=signup"
                className="relative inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-7 py-4 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all duration-300 hover:scale-105"
              >
                Get Started
              </Link>
            </div>
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-7 py-4 text-sm font-semibold text-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Login
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-3">
            {heroSignalBadges.map((badge) => (
              <div
                key={badge.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 backdrop-blur-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/30"
              >
                <badge.icon className="h-4 w-4 text-cyan-300" />
                <span>{badge.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 56 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full lg:w-1/2"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(8,15,40,0.55)] backdrop-blur-lg">
            <div className="absolute -left-12 top-12 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-purple-500/12 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/70">
                  Pipeline Execution
                </p>
                <h3 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold text-white">
                  Multi-Signal Verdicting
                </h3>
              </div>
              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Live
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {pipelineItems.map((item) => (
                <div
                  key={item.title}
                  className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-white/10"
                >
                  <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-lg shadow-cyan-400/10">
                    <div className="absolute inset-0 rounded-2xl bg-cyan-400/10 blur-md" />
                    <CheckCircle2 className="relative h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{item.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_45%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Explainable confidence</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Layered model evidence, temporal cues, and forensic signals.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  96%
                </div>
              </div>

              <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '96%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500"
                />
              </div>

              <div className="relative mt-5 flex flex-wrap gap-3">
                {heroTrustBadges.map((badge) => (
                  <div
                    key={badge.label}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5 ${badge.tone}`}
                  >
                    {badge.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
