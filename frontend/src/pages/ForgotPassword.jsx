import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, RefreshCw, Lock, Eye, EyeOff } from 'lucide-react';
import PasswordField from '../components/PasswordField';

const API_BASE_URL = 'http://localhost:5000/api/auth';

const readApiResponse = async (response) => {
  const rawBody = await response.text();
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
};


export default function ForgotPassword() {
  const navigate = useNavigate();

  // step 1 = enter email, step 2 = enter OTP, step 3 = enter new password, step 4 = success
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState('');
  const [emailNotFound, setEmailNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── OTP timer ──────────────────────────────────────────────
  const startTimer = () => {
    setTimer(60);
    const interval = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  // ── Step 1: Send OTP ────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setEmailNotFound(false);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), mode: 'reset' })
      });

      const data = await readApiResponse(response);

      if (response.status === 404) {
        setEmailNotFound(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setStep(2);
      startTimer();
    } catch (error) {
      setErrorMsg(error.message || 'Failed to send OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) return;

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code, mode: 'reset' })
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      setStep(3);
    } catch (error) {
      setErrorMsg(error.message || 'Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────
  const handleResend = async () => {
    if (timer > 0 || isSubmitting) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), mode: 'reset' })
      });

      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Failed to resend OTP');

      setOtp(['', '', '', '', '', '']);
      startTimer();
    } catch (error) {
      setErrorMsg(error.message || 'Failed to resend OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 3: Reset Password ──────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          newPassword,
          confirmPassword
        })
      });

      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Password reset failed');

      setStep(4);
      setTimeout(() => navigate('/auth?mode=login'), 2000);
    } catch (error) {
      setErrorMsg(error.message || 'Password reset failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step labels ─────────────────────────────────────────────
  const titles = {
    1: 'Forgot Password',
    2: 'Check Your Email',
    3: 'Set New Password',
    4: 'Password Reset!'
  };
  const subtitles = {
    1: 'Enter your registered email to receive a reset code',
    2: 'Enter the 6-digit code we sent to your email',
    3: 'Choose a strong new password',
    4: 'Redirecting you to sign in...'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0F172A] to-black flex items-center justify-center p-6 relative overflow-hidden font-sans">

      {/* Background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-blue-600/10 blur-[140px] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.07), transparent 65%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 z-10 p-10"
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

          <h1 className="text-2xl font-bold text-white mb-1">{titles[step]}</h1>
          <p className="text-gray-400 text-sm">{subtitles[step]}</p>

          {errorMsg && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/20 py-2 px-4 rounded-lg inline-block"
            >
              {errorMsg}
            </motion.p>
          )}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Email input ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Registered Email Address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailNotFound(false);
                      setErrorMsg('');
                    }}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 font-medium outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                  />
                </div>

                {/* Email not found message */}
                {emailNotFound && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
                  >
                    <p className="text-amber-400 text-sm font-medium">
                      This email is not registered.{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/auth?mode=signup')}
                        className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline transition-colors duration-200"
                      >
                        Sign up
                      </button>
                    </p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-[1px] active:scale-[0.98] shadow-lg shadow-cyan-500/25"
                >
                  <span>{isSubmitting ? 'Sending...' : 'Send Reset Code'}</span>
                  {!isSubmitting && <ArrowRight className="w-5 h-5" />}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-400">
                Remembered your password?{' '}
                <button
                  onClick={() => navigate('/auth?mode=login')}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline transition-colors duration-200"
                >
                  Sign in
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: OTP verification ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <p className="text-sm text-gray-400 mb-7 leading-relaxed">
                Code sent to{' '}
                <span className="text-white font-semibold">{email.trim()}</span>
              </p>

              <div className="flex justify-between mb-7 gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`fp-otp-${index}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!/^[0-9]*$/.test(val)) return;
                      const next = [...otp];
                      next[index] = val;
                      setOtp(next);
                      if (val && index < 5) document.getElementById(`fp-otp-${index + 1}`)?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !otp[index] && index > 0) {
                        document.getElementById(`fp-otp-${index - 1}`)?.focus();
                      }
                    }}
                    className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold text-white outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={otp.join('').length < 6 || isSubmitting}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-500/25 mb-6"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code'}
              </button>

              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-gray-400">Didn't receive it?</span>
                {timer > 0 ? (
                  <span className="text-cyan-400 font-bold">00:{timer.toString().padStart(2, '0')}</span>
                ) : (
                  <button
                    onClick={handleResend}
                    className="flex items-center text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" /> Resend
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step 3: New password ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <form onSubmit={handleResetPassword} className="space-y-4">
                <PasswordField
                  id="new-password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  required
                  leftIcon={Lock}
                  inputClassName="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 font-medium outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                />

                <PasswordField
                  id="confirm-password"
                  placeholder="Retype New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  required
                  leftIcon={Lock}
                  inputClassName="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 font-medium outline-none transition-all duration-300 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08)] disabled:opacity-50"
                />

                {/* Live match indicator */}
                {confirmPassword.length > 0 && (
                  <p className={`text-xs font-medium ${newPassword === confirmPassword ? 'text-emerald-400' : 'text-red-400'}`}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || newPassword !== confirmPassword || newPassword.length < 6}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] hover:-translate-y-[1px] active:scale-[0.98] shadow-lg shadow-cyan-500/25 mt-2"
                >
                  <span>{isSubmitting ? 'Resetting...' : 'Reset Password'}</span>
                  {!isSubmitting && <ArrowRight className="w-5 h-5" />}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 4 && (
            <motion.div
              key="step4"
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

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-white font-semibold text-center mb-2"
              >
                Password reset successfully!
              </motion.p>

              <div className="flex items-center gap-2 text-gray-400 text-sm mt-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Redirecting to Sign In...</span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
