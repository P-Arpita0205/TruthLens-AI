import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';

const navLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#problem', label: 'Security' },
  { href: '#privacy', label: 'Privacy' }
];

export default function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-white/10 backdrop-blur-md transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-950/80 shadow-[0_18px_60px_rgba(2,6,23,0.55)]'
          : 'bg-white/5 shadow-[0_8px_30px_rgba(2,6,23,0.22)]'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20 transition-all duration-300">
            <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-lg" />
            <Eye className="relative h-5 w-5 text-white" />
          </div>
          <div>
            <span className="block font-['Space_Grotesk'] text-lg font-bold tracking-tight text-white">
              TruthLens AI
            </span>
            <span className="block text-xs font-medium uppercase tracking-[0.32em] text-cyan-200/70">
              Trust Layer
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative transition-all duration-300 hover:text-white"
            >
              {link.label}
              <span className="absolute -bottom-2 left-0 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-cyan-400 to-purple-500 transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/auth?mode=login"
            className="rounded-full border border-white/0 px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-300 hover:border-white/10 hover:bg-white/5 hover:text-white hover:-translate-y-0.5"
          >
            Login
          </Link>
          <Link
            to="/auth?mode=signup"
            className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/40"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
