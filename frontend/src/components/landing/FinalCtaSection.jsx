import { Link } from 'react-router-dom';

export default function FinalCtaSection() {
  return (
    <section className="relative py-24 lg:py-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_45%)]" />

      <div className="max-w-4xl mx-auto px-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 px-8 py-14 text-center shadow-[0_30px_80px_rgba(8,15,40,0.55)] backdrop-blur-lg">
          <h2 className="font-['Space_Grotesk'] text-4xl font-bold text-white md:text-5xl">
            Start Detecting Deepfakes Today.
          </h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Join thousands of security professionals securing the truth.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              to="/auth?mode=signup"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-8 py-4 font-bold text-white shadow-lg shadow-cyan-500/30 transition-all duration-300 hover:scale-105"
            >
              Create Account
            </Link>
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-8 py-4 font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
