'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { Phone, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (phoneNumber.length < 10) {
      setError('Please enter a valid Nepalese phone number (10 digits)');
      return;
    }

    setLoading(true);
    try {
      await fetchApi('/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      });
      setStep('otp');
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

      // Redirect based on role
      switch (result.user.role) {
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
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
          <span className="font-heading font-extrabold text-lg text-[#0B3C5D]">ServeNep</span>
        </Link>
        <span className="text-xs text-slate-500 font-medium">Secure Login</span>
      </header>

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white p-8 rounded-3xl border border-slate-200/60 shadow-lg space-y-8">
            {/* Icon & Title */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-[#0B3C5D]/5 rounded-2xl flex items-center justify-center mx-auto">
                <ShieldCheck size={32} className="text-[#0B3C5D]" />
              </div>
              <h1 className="font-heading text-2xl font-black text-[#0B3C5D]">
                {step === 'phone' ? 'Welcome to ServeNep' : 'Enter Verification Code'}
              </h1>
              <p className="text-sm text-slate-500">
                {step === 'phone' 
                  ? 'Login with your phone number to book services or manage jobs.' 
                  : `A 6-digit code was sent to +977-${phoneNumber}`}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Phone Number Step */}
            {step === 'phone' && (
              <form onSubmit={handleRequestOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white focus-within:border-[#328CC1] transition-colors">
                    <span className="text-slate-400 font-bold text-sm">+977</span>
                    <Phone size={18} className="text-slate-400" />
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
                  <p className="text-xs text-slate-400">Enter your 10-digit Nepalese mobile number</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneNumber.length < 10}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            )}

            {/* OTP Step */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    6-Digit OTP Code
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white focus-within:border-[#328CC1] transition-colors">
                    <KeyRound size={18} className="text-slate-400" />
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
                  <p className="text-xs text-slate-400">Enter the 6-digit code sent via SMS</p>
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
                    onClick={() => { setStep('phone'); setOtpCode(''); setError(''); }}
                    className="text-xs text-[#328CC1] font-bold hover:underline"
                  >
                    ← Change phone number
                  </button>
                </div>
              </form>
            )}

            {/* Demo Info */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 space-y-2">
              <p className="font-bold">🔐 Demo Mode</p>
              <p>Use any phone number (10+ digits). Check server console for OTP code when running in development.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}