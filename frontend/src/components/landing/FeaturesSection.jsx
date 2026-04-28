import { motion } from 'framer-motion';
import { featureCards } from './data';
import { fadeUp } from './motion';

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 lg:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.08),transparent_55%)]" />

      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          className="mx-auto mb-16 max-w-3xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
            Product Surface
          </p>
          <h2 className="mt-4 font-['Space_Grotesk'] text-3xl font-bold text-white md:text-4xl">
            A Comprehensive Arsenal
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            Everything you need to combat synthetic media in one powerful API.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: index * 0.08, duration: 0.55 }}
              className="group rounded-[1.75rem] border border-white/10 bg-white/5 p-8 backdrop-blur-lg transition-all duration-300 hover:scale-[1.03] hover:border-cyan-400/20 hover:shadow-xl hover:shadow-cyan-500/10"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="relative h-3 w-3 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-lg shadow-cyan-400/20">
                  <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-cyan-400/40 to-transparent" />
              </div>
              <h3 className="font-['Space_Grotesk'] text-xl font-bold text-white">{feature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
