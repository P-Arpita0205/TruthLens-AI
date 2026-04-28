import { motion } from 'framer-motion';
import { riskCards } from './data';
import { fadeUp } from './motion';

export default function ProblemSection() {
  return (
    <section id="problem" className="relative py-24 lg:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.4),transparent_60%)]" />

      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          className="mx-auto mb-16 max-w-3xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
            Security Landscape
          </p>
          <h2 className="mt-4 font-['Space_Grotesk'] text-3xl font-bold text-white md:text-4xl">
            Why Deepfakes Are Dangerous
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Synthetic media is advancing rapidly, posing critical threats to individuals and organizations.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {riskCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.08, duration: 0.55 }}
              className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-white/15 hover:shadow-xl hover:shadow-cyan-500/10"
            >
              <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${card.accent} shadow-lg shadow-cyan-400/20 transition-all duration-300 group-hover:scale-105`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-['Space_Grotesk'] text-xl font-bold text-white">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
