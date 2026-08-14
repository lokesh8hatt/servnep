'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { Phone, KeyRound, ArrowRight, ShieldCheck, User, Wrench, ShieldAlert, Mail, Lock } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { useToast } from '@/context/ToastContext';

const QUICK_LOGIN_ROLES = [
  { role: 'CUSTOMER', label: 'Continue as Customer', icon: User },
  { role: 'TECHNICIAN', label: 'Continue as Technician', icon: Wrench },
  { role: 'ADMIN', label: 'Continue as Admin', icon: ShieldAlert },
] as const;

type View = 'demo' | 'email-login' | 'register' | 'forgot' | 'reset' | 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [view, setView] = useState<View>('demo');
  const [loading, setLoading] = useState(false);
  const [quickLoadingRole, setQuickLoadingRole] = useState('');
  const [error, setError] = useState('');

  // Email + password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Forgot / reset password
  const [resetOtp, setResetOtp] = useState('');
  const [devResetOtp, setDevResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Phone OTP
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState('');

  const redirectForRole = (role: string) => {
    switch (role) {
      case 'CUSTOMER':
        router.push('/dashboard/customer');
        break;
      case 'TECHNICIAN':
        router.push('/dashboard/technician');
        break;
      case 'ADMIN':
      case 'DISPATCHER':
        router.push('/dashboard/admin');
        break;
      default:
        router.push('/');
    }
  };

  const handleSession = (result: any) => {
    login(
      {
        id: result.user.id,
        phone: result.user.phone,
        role: result.user.role,
        fullName: result.user.fullName,
      },
      result.accessToken,
      result.refreshToken,
    );
    showToast(`Welcome, ${result.user.fullName}!`, 'success');
    redirectForRole(result.user.role);
  };

  const handleQuickLogin = async (role: string) => {
    setError('');
    setQuickLoadingRole(role);
    try {
      const result = await fetchApi('/auth/dev-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      handleSession(result);
    } catch (err: any) {
      setError(err.message || 'Quick login failed. Please try again.');
    } finally {
      setQuickLoadingRole('');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      handleSession(result);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const result = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName }),
      });
      handleSession(result);
    } catch (err: any) {
      setError(err.message || 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await fetchApi('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (result.devOtp) {
        setDevResetOtp(result.devOtp);
        setResetOtp(result.devOtp);
      }
      showToast(result.message, 'info');
      setView('reset');
    } catch (err: any) {
      setError(err.message || 'Could not send the reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await fetchApi('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otpCode: resetOtp, newPassword }),
      });
      showToast('Password updated — you can log in now.', 'success');
      setPassword('');
      setView('email-login');
    } catch (err: any) {
      setError(err.message || 'Could not reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (phoneNumber.length < 10) {
      setError('Please enter a valid Nepalese phone number (10 digits)');
      return;
    }

    setLoading(true);
    try {
      const result = await fetchApi('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      });
      // devOtp is only ever present outside production (see AuthService.requestOtp) —
      // no real SMS gateway is wired up, so the login page shows it directly
      // instead of requiring access to the backend's terminal output.
      if (result.devOtp) {
        setDevOtp(result.devOtp);
        setOtpCode(result.devOtp);
      }
      setView('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      const result = await fetchApi('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, otpCode }),
      });
      handleSession(result);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goTo = (v: View) => {
    setError('');
    setView(v);
  };

  const TITLES: Record<View, string> = {
    demo: 'Welcome to ServeNep',
    'email-login': 'Login with Email',
    register: 'Create Your Account',
    forgot: 'Reset Your Password',
    reset: 'Enter Verification Code',
    phone: 'Login with Phone',
    otp: 'Enter Verification Code',
  };

  const SUBTITLES: Record<View, string> = {
    demo: 'Pick a role below to jump straight into the app — no signup needed.',
    'email-login': 'Login with your email and password.',
    register: 'Sign up with your email — no phone number needed.',
    forgot: "We'll email you a 6-digit verification code.",
    reset: `A 6-digit code was sent to ${email}`,
    phone: 'Login with your phone number to book services or manage jobs.',
    otp: `A 6-digit code was sent to +977-${phoneNumber}`,
  };

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
          <span className="font-heading font-extrabold text-lg text-[#0B3C5D] dark:text-sky-300">ServeNep</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-medium">Secure Login</span>
          <ThemeToggle />
          <SoundToggle />
        </div>
      </header>

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg space-y-8">
            {/* Icon & Title */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-[#0B3C5D]/5 rounded-2xl flex items-center justify-center mx-auto">
                <ShieldCheck size={32} className="text-[#0B3C5D] dark:text-sky-300" />
              </div>
              <h1 className="font-heading text-2xl font-black text-[#0B3C5D] dark:text-sky-300">{TITLES[view]}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{SUBTITLES[view]}</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Quick Demo Login */}
            {view === 'demo' && (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  {QUICK_LOGIN_ROLES.map(({ role, label, icon: Icon }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleQuickLogin(role)}
                      disabled={quickLoadingRole !== ''}
                      className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon size={16} />
                      <span>{quickLoadingRole === role ? 'Logging in...' : label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button type="button" onClick={() => goTo('email-login')} className="text-xs text-[#328CC1] font-bold hover:underline">
                    Login with email & password →
                  </button>
                  <button type="button" onClick={() => goTo('phone')} className="text-xs text-[#328CC1] font-bold hover:underline">
                    Or login with phone number →
                  </button>
                </div>
              </div>
            )}

            {/* Email + Password Login */}
            {view === 'email-login' && (
              <form onSubmit={handleEmailLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <Mail size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                    <button type="button" onClick={() => { setResetOtp(''); setDevResetOtp(''); goTo('forgot'); }} className="text-[11px] text-[#328CC1] font-bold hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <Lock size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Logging in...' : 'Log In'}
                  {!loading && <ArrowRight size={16} />}
                </button>

                <div className="flex flex-col items-center gap-2">
                  <button type="button" onClick={() => goTo('register')} className="text-xs text-[#328CC1] font-bold hover:underline">
                    Don't have an account? Sign up
                  </button>
                  <button type="button" onClick={() => goTo('demo')} className="text-xs text-slate-400 dark:text-slate-500 font-semibold hover:underline">
                    ← Back to quick login
                  </button>
                </div>
              </form>
            )}

            {/* Register */}
            {view === 'register' && (
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Full Name</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <User size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <Mail size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <Lock size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || password.length < 8 || !fullName}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating account...' : 'Sign Up'}
                  {!loading && <ArrowRight size={16} />}
                </button>

                <div className="text-center">
                  <button type="button" onClick={() => goTo('email-login')} className="text-xs text-[#328CC1] font-bold hover:underline">
                    ← Already have an account? Log in
                  </button>
                </div>
              </form>
            )}

            {/* Forgot Password */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <Mail size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending code...' : 'Send Verification Code'}
                  {!loading && <ArrowRight size={16} />}
                </button>

                <div className="text-center">
                  <button type="button" onClick={() => goTo('email-login')} className="text-xs text-[#328CC1] font-bold hover:underline">
                    ← Back to login
                  </button>
                </div>
              </form>
            )}

            {/* Reset Password */}
            {view === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                {devResetOtp && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Demo Mode — Your Code</p>
                    <p className="text-2xl font-black tracking-[0.3em] mt-1">{devResetOtp}</p>
                    <p className="text-[11px] mt-1">Gmail isn't configured on this deployment, so it's shown here instead.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">6-Digit Code</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <KeyRound size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      maxLength={6}
                      className="flex-1 bg-transparent text-sm font-medium tracking-widest text-center focus:outline-hidden"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">New Password</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <Lock size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || resetOtp.length !== 6 || newPassword.length < 8}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Reset Password'}
                  {!loading && <ArrowRight size={16} />}
                </button>

                <div className="text-center">
                  <button type="button" onClick={() => goTo('forgot')} className="text-xs text-[#328CC1] font-bold hover:underline">
                    ← Send a new code
                  </button>
                </div>
              </form>
            )}

            {/* Phone Number Step */}
            {view === 'phone' && (
              <form onSubmit={handleRequestOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">+977</span>
                    <Phone size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="9841234567"
                      maxLength={10}
                      className="flex-1 bg-transparent text-sm font-medium focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Enter your 10-digit Nepalese mobile number</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneNumber.length < 10}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                  {!loading && <ArrowRight size={16} />}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => goTo('demo')}
                    className="text-xs text-[#328CC1] font-bold hover:underline"
                  >
                    ← Back to quick login
                  </button>
                </div>
              </form>
            )}

            {/* OTP Step */}
            {view === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {devOtp && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wider">Demo Mode — Your Code</p>
                    <p className="text-2xl font-black tracking-[0.3em] mt-1">{devOtp}</p>
                    <p className="text-[11px] mt-1">Already filled in below — just click Verify.</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    6-Digit OTP Code
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-[#328CC1] transition-colors">
                    <KeyRound size={18} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      maxLength={6}
                      className="flex-1 bg-transparent text-sm font-medium tracking-widest text-center focus:outline-hidden"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Enter the 6-digit code sent via SMS</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                  {!loading && <ArrowRight size={16} />}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { goTo('phone'); setOtpCode(''); setDevOtp(''); }}
                    className="text-xs text-[#328CC1] font-bold hover:underline"
                  >
                    ← Change phone number
                  </button>
                </div>
              </form>
            )}

            {/* Demo Info */}
            {(view === 'phone' || view === 'forgot') && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <p className="font-bold">🔐 Demo Mode</p>
                <p>
                  {view === 'phone'
                    ? 'Use any phone number (10+ digits). Your verification code will be shown right on the next screen — no separate device or console access needed.'
                    : "If real email delivery isn't configured on this deployment, your verification code will be shown right on the next screen instead."}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
