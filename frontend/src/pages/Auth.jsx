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
    : (isLogin ? 'Login' : 'Create Account');

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-2xl p-10 rounded-[2rem] border border-white shadow-2xl shadow-slate-200 z-10"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
            {step === 3 ? (isLogin ? 'Welcome Back' : 'Account Created') : (isLogin ? 'Sign In' : 'Create Account')}
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            {step === 1
              ? 'Secure access to TruthLens AI'
              : step === 2
                ? 'Security verification required'
                : 'Redirecting securely to your dashboard...'}
          </p>
          {errorMsg ? (
            <p className="text-red-500 text-sm mt-2 font-semibold bg-red-50 py-1 px-3 rounded inline-block">
              {errorMsg}
            </p>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
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
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
                        required={!isLogin}
                        disabled={isSubmitting}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
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
                  inputClassName="w-full py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-slate-900 placeholder-slate-400 font-medium shadow-sm"
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-4 rounded-xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/30 mt-2"
                >
                  <span>{submitButtonLabel}</span>
                  {!isSubmitting ? <ArrowRight className="w-5 h-5" /> : null}
                </button>
              </form>

              <div className="mt-8 text-center text-sm font-medium text-slate-500">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button onClick={toggleAuthMode} className="text-emerald-600 hover:text-emerald-700 font-bold underline underline-offset-4">
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </div>
            </motion.div>
          ) : null}

          {step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-center"
            >
              <div className="mb-8">
                <p className="text-sm text-slate-500">
                  We sent a 6-digit code to <br />
                  <span className="text-slate-900 font-bold mt-1 inline-block">{email.trim()}</span>
                </p>
              </div>

              <div className="flex justify-between mb-8 gap-2">
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
                    className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={otp.join('').length < 6 || isSubmitting}
                className="w-full bg-emerald-600 disabled:bg-emerald-300 disabled:shadow-none disabled:cursor-not-allowed hover:bg-emerald-700 text-white py-4 rounded-xl font-bold transition-all mb-6 shadow-lg shadow-emerald-500/30"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & Proceed'}
              </button>

              <div className="flex items-center justify-center space-x-2 text-sm font-medium">
                <span className="text-slate-500">Didn't receive code?</span>
                {timer > 0 ? (
                  <span className="text-emerald-600 font-bold">00:{timer.toString().padStart(2, '0')}</span>
                ) : (
                  <button onClick={handleResend} className="flex items-center text-emerald-600 hover:text-emerald-700 transition-colors font-bold">
                    <RefreshCw className="w-4 h-4 mr-1" /> Resend
                  </button>
                )}
              </div>
            </motion.div>
          ) : null}

          {step === 3 ? (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
                className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
              >
                <ShieldCheck className="w-10 h-10 text-emerald-600" />
              </motion.div>

              {!isLogin ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-emerald-600 font-medium mb-4 text-sm text-center px-4 py-2 bg-emerald-50 rounded-lg"
                >
                  Confirmation sent to {email.trim()}
                </motion.p>
              ) : null}

              <div className="flex items-center space-x-2 text-slate-500 font-medium text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                <span>Redirecting to Dashboard...</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
