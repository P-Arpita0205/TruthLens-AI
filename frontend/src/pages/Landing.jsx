import LandingNavbar from '../components/landing/LandingNavbar';
import HeroSection from '../components/landing/HeroSection';
import ProblemSection from '../components/landing/ProblemSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import PrivacySection from '../components/landing/PrivacySection';
import FinalCtaSection from '../components/landing/FinalCtaSection';
import LandingFooter from '../components/landing/LandingFooter';

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-[#0F172A] via-[#020617] to-black font-['Plus_Jakarta_Sans'] text-slate-100 selection:bg-cyan-400/30 selection:text-white">
      <div className="relative isolate">
        <LandingNavbar />
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PrivacySection />
        <FinalCtaSection />
        <LandingFooter />
      </div>
    </div>
  );
}
