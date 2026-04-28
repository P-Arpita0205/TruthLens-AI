import { motion } from 'framer-motion';
import { workflowSteps } from './data';
import { fadeUp } from './motion';

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,rgba(34,211,238,0.09),transparent_50%)]" />

      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          className="mx-auto mb-16 max-w-3xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
            Workflow
          </p>
          <h2 className="mt-4 font-['Space_Grotesk'] text-3xl font-bold text-white md:text-4xl">
            How It Works
          </h2>
        </motion.div>

        <div className="relative grid gap-8 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[18%] right-[18%] top-10 hidden h-px overflow-hidden md:block">
            <div className="h-full w-full bg-gradient-to-r from-cyan-400/0 via-cyan-400/50 to-purple-500/0" />
            <motion.div
              initial={{ x: '-35%' }}
              whileInView={{ x: '135%' }}
              viewport={{ once: true }}
              transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
              className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/60 to-transparent blur-sm"
            />
          </div>

          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.1, duration: 0.55 }}
              className="group relative rounded-[1.75rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-lg transition-all duration-300 hover:-translate-y-1.5 hover:border-cyan-400/20 hover:bg-white/10"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 }}
                className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/20 bg-slate-950/40 shadow-lg shadow-cyan-500/10"
              >
                <div className="absolute inset-2 rounded-full bg-cyan-400/10 blur-md" />
                <step.icon className="relative h-8 w-8 text-cyan-300" />
              </motion.div>
              <h3 className="mt-6 font-['Space_Grotesk'] text-xl font-bold text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
