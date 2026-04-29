import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, RefreshCw, User, Lock } from 'lucide-react';
import PasswordField from '../components/PasswordField';

const API_BASE_URL = 'http://localhost:5000/api/auth';
const getIsLoginMode = (searchParams) => searchParams.get('mode') !== 'signup';

const readApiResponse = async (response) => {
  const rawBody = await response.text();
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
};

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(() => getIsLoginMode(searchParams));
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const nextIsLogin = getIsLoginMode(searchParams);
    setIsLogin(nextIsLogin);
    setStep(1);
    setErrorMsg('');
    setTimer(60);
    resetOtp();
    setIsSubmitting(false);
  }, [searchParams]);

  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer((value) => value - 1), 1000);
    }

    return () => clearInterval(interval);
  }, [step, timer]);

  const resetOtp = () => setOtp(['', '', '', '', '', '']);

  const persistAuth = (data) => {
    localStorage.setItem('auth', 'true');
    if (data?.token) {
      localStorage.setItem('token', data.token);
    }
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  };

  const handleLogin = async () => {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        password
      })
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    persistAuth(data);
    setStep(3);
    setTimeout(() => navigate('/dashboard'), 1200);
  };

  const handleSignupSendOtp = async () => {
    const response = await fetch(`${API_BASE_URL}/send-email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        mode: 'signup'
      })
    });

    const data = await readApiResponse(response);
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send OTP');
    }

    setStep(2);
    setTimer(60);
    resetOtp();
  };

  const handleSendOTP = async (event) => {
    event.preventDefault();
    if (!email || !password) return;
    if (!isLogin && !name.trim()) return;

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (isLogin) {
        await handleLogin();
      } else {
        await handleSignupSendOtp();
      }
    } catch (error) {
      setErrorMsg(error.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: code,
          name: name.trim(),
          password,
          mode: 'signup'
        })
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      persistAuth(data);
      setStep(3);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (error) {
      setErrorMsg(error.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || isSubmitting) return;

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await handleSignupSendOtp();
    } catch (error) {
      setErrorMsg(error.message || 'Failed to resend OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAuthMode = () => {
    const nextIsLogin = !isLogin;
    setIsLogin(nextIsLogin);
    setSearchParams({ mode: nextIsLogin ? 'login' : 'signup' });
    setName('');
    setEmail('');
    setPassword('');
    setErrorMsg('');
    setTimer(60);
    resetOtp();
    setIsSubmitting(false);
  };

  const submitButtonLabel = isSubmitting
    ? (isLogin ? 'Signing In...' : 'Sending OTP...')
    : (isLogin ? 'Sign In' : 'Create Account');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0F172A] to-black flex items-center justify-center p-6 relative overflow-hidden font-sans">

      {/* Background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-blue-600/10 blur-[140px] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.07), transparent 65%)' }}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 z-10 p-10 transition-all duration-300 hover:shadow-cyan-500/10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-cyan-500/30"
          >
            <ShieldCheck className="w-7 h-7 text-white" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-1">
            {step === 3
              ? (isLogin ? 'Welcome Back' : 'Account Created')
              : (isLogin ? 'Sign In' : 'Create Account')}
          </h1>
          <p className="text-gray-400 text-sm">
            {step === 1
              ? 'Secure access to TruthLens AI'
              : step === 2
                ? 'Enter the code sent to your email'
                : 'Redirecting to your dashboard...'}
          </p>

          {errorMsg ? (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 py-2 px-4 rounded-lg inline-block"
            >
              {errorMsg}
            </motion.p>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Credentials form ── */}
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleSendOTP} className="space-y-4">
                <AnimatePresence>
                  {!isLogin ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative overflow-hidden"
                    >
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 font-medium outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                        required={!isLogin}
                        disabled={isSubmitting}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 font-medium outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <PasswordField
                  id="auth-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  leftIcon={Lock}
                  inputClassName="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 font-medium outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                  wrapperClassName=""
                />

                {/* Forgot password — login mode only */}
                {isLogin ? (
                  <div className="text-right -mt-1">
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-sm text-cyan-400 hover:text-cyan-300 hover:underline transition-colors duration-200"
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-[1px] active:scale-[0.98] shadow-lg shadow-cyan-500/25 mt-2"
                >
                  <span>{submitButtonLabel}</span>
                  {!isSubmitting ? <ArrowRight className="w-5 h-5" /> : null}
                </button>
              </form>

              <div className="mt-7 text-center text-sm text-gray-400">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={toggleAuthMode}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-colors duration-200"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </div>
            </motion.div>
          ) : null}

          {/* ── Step 2: OTP Verification ── */}
          {step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <div className="mb-7">
                <p className="text-sm text-gray-400 leading-relaxed">
                  We sent a 6-digit code to
                  <br />
                  <span className="text-white font-semibold mt-1 inline-block">{email.trim()}</span>
                </p>
              </div>

              <div className="flex justify-between mb-7 gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!/^[0-9]*$/.test(value)) return;

                      const nextOtp = [...otp];
                      nextOtp[index] = value;
                      setOtp(nextOtp);

                      if (value && index < 5) {
                        document.getElementById(`otp-${index + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Backspace' && !otp[index] && index > 0) {
                        document.getElementById(`otp-${index - 1}`)?.focus();
                      }
                    }}
                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold text-white outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={otp.join('').length < 6 || isSubmitting}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-500/25 mb-6"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Proceed'}
              </button>

              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <span className="text-gray-400">Didn't receive code?</span>
                {timer > 0 ? (
                  <span className="text-cyan-400 font-bold">00:{timer.toString().padStart(2, '0')}</span>
                ) : (
                  <button
                    onClick={handleResend}
                    className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors duration-200 font-bold"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Resend
                  </button>
                )}
              </div>
            </motion.div>
          ) : null}

          {/* ── Step 3: Success ── */}
          {step === 3 ? (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
                className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/20"
              >
                <ShieldCheck className="w-10 h-10 text-cyan-400" />
              </motion.div>

              {!isLogin ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-cyan-400 font-medium mb-4 text-sm text-center px-4 py-2 bg-cyan-500/10 border border-cyan-400/20 rounded-lg"
                >
                  Confirmation sent to {email.trim()}
                </motion.p>
              ) : null}

              <div className="flex items-center gap-2 text-gray-400 font-medium text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Redirecting to Dashboard...</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
