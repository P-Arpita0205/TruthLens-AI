import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { fadeUp } from './motion';

export default function PrivacySection() {
  return (
    <section id="privacy" className="relative overflow-hidden py-28 lg:py-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_45%)]" />

      <div className="max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          className="rounded-[2rem] border border-white/10 bg-white/5 px-8 py-14 shadow-[0_30px_80px_rgba(8,15,40,0.55)] backdrop-blur-lg"
        >
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 shadow-lg shadow-cyan-500/20"
          >
            <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl" />
            <Lock className="relative h-9 w-9 text-cyan-300" />
          </motion.div>

          <h2 className="font-['Space_Grotesk'] text-4xl font-bold text-white md:text-5xl">
            We do NOT store user media.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-xl leading-9 text-slate-300">
            Privacy isn't an afterthought - it's the core architecture. All processing happens in ephemeral memory buffers that are instantly destroyed.
          </p>

          <div className="mt-10 inline-flex rounded-full border border-cyan-400/20 bg-slate-950/50 px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            HIPAA &amp; SOC2 Ready Architecture
          </div>
        </motion.div>
      </div>
    </section>
  );
}
