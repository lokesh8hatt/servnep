'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { AuthGuard } from '@/context/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { User, CheckCircle, Navigation, Phone, MapPin, DollarSign, Star, RefreshCw, XCircle, LogOut, Clock } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { useToast } from '@/context/ToastContext';

// Only send a location update this often — watchPosition can fire far more
// frequently than that, and there's no need to hammer the API every time.
const LOCATION_SEND_INTERVAL_MS = 15000;

export default function TechnicianDashboard() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const lastSentAtRef = useRef(0);

  const loadData = async () => {
    try {
      const [profData, jobData] = await Promise.all([
        fetchApi('/users/profile'),
        fetchApi('/bookings'),
      ]);
      setProfile(profData);
      setJobs(jobData);
    } catch {
      showToast('Please log in to continue.', 'error');
      logout();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeJob = jobs.find((j) => j.status === 'ASSIGNED' || j.status === 'IN_PROGRESS');

  useEffect(() => {
    if (!activeJob || typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationError('');
        setSharingLocation(true);
        const now = Date.now();
        if (now - lastSentAtRef.current < LOCATION_SEND_INTERVAL_MS) return;
        lastSentAtRef.current = now;
        fetchApi('/users/me/location', {
          method: 'PATCH',
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {
          // Best-effort — a dropped location update isn't worth interrupting the technician.
        });
      },
      () => {
        setSharingLocation(false);
        setLocationError('Location sharing is off — enable it in your browser so the customer can track you.');
      },
      { enableHighAccuracy: true, maximumAge: 10000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setSharingLocation(false);
    };
  }, [activeJob?.id]);

  const STATUS_MESSAGES: Record<string, string> = {
    COMPLETED: 'Job marked as complete. Nice work!',
    IN_PROGRESS: 'Job started — customer has been notified.',
    CANCELLED: 'Job rejected.',
  };

  const handleUpdateStatus = async (bookingId: string, nextStatus: string) => {
    try {
      await fetchApi(`/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          imagesAfter: nextStatus === 'COMPLETED' ? ['https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&q=80&w=400'] : [],
        }),
      });
      showToast(STATUS_MESSAGES[nextStatus] || 'Job updated.', nextStatus === 'CANCELLED' ? 'info' : 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not update the job. Please try again.', 'error');
    }
  };

  const handleLogout = async () => {
    try { await fetchApi('/auth/logout', { method: 'POST' }); } catch {}
    logout();
  };

  const getEarningsSummary = () => {
    const completed = jobs.filter(j => j.status === 'COMPLETED');
    const total = completed.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const commission = Math.round(total * 0.20);
    const net = total - commission;
    return { total, commission, net, count: completed.length };
  };

  const earnings = getEarningsSummary();

  return (
    <AuthGuard requiredRole="TECHNICIAN">
      <div className="min-h-screen bg-sky-50 dark:bg-slate-950 flex flex-col font-sans">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-y-2 shadow-xs dark:shadow-none">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
            <span className="font-heading font-extrabold text-lg text-[#0B3C5D] dark:text-sky-300">ServeNep</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className="bg-emerald-500/15 text-emerald-600 px-2 sm:px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Pro Portal
            </span>
            <ThemeToggle />
            <SoundToggle />
            <button onClick={handleLogout} title="Logout" aria-label="Logout" className="p-1.5 sm:p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 hover:text-red-500 shrink-0">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          
          {/* Left Sidebar - Profile & Earnings */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-full mx-auto flex items-center justify-center shadow-lg">
                <span className="font-heading font-black text-2xl text-white">
                  {profile?.fullName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-slate-800 dark:text-slate-100 text-lg">{profile?.fullName || 'Loading...'}</h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2.5 py-0.5 rounded-full">
                  Service Professional
                </span>
              </div>
              <div className="flex gap-2 justify-center text-xs text-amber-500 font-bold">
                <Star size={16} fill="currentColor" className="text-amber-500" />
                <span>4.95 Rating ({earnings.count} Jobs)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-4">
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <DollarSign size={16} className="text-emerald-600" /> Earnings Overview
              </h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-sky-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Gross</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Rs.{earnings.total}</span>
                </div>
                <div className="p-3 bg-sky-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Fee</span>
                  <span className="text-sm font-extrabold text-red-500">Rs.{earnings.commission}</span>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block uppercase font-bold">Net Pay</span>
                  <span className="text-sm font-extrabold text-emerald-600">Rs.{earnings.net}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">Platform fee: 20% commission</p>
            </div>

            {activeJob && (
              <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                sharingLocation
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}>
                <MapPin size={14} className="shrink-0" />
                <span>
                  {sharingLocation
                    ? `Sharing your live location for job ${activeJob.bookingNumber}`
                    : locationError || 'Waiting for location permission…'}
                </span>
              </div>
            )}

            {/* Availability Toggle */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <Clock size={16} className="text-emerald-500" />
                <span>Available for Jobs</span>
              </div>
              <div className="w-10 h-6 bg-emerald-500 rounded-full p-0.5 cursor-pointer flex justify-end">
                <div className="w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm"></div>
              </div>
            </div>
          </div>

          {/* Right Content - Jobs */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] dark:text-sky-300">Your Assigned Jobs</h2>
              <button onClick={loadData} className="text-xs text-[#328CC1] font-bold flex items-center gap-1 hover:underline">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-slate-400 dark:text-slate-500">
                <Clock size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">No jobs dispatched yet</p>
                <p className="text-xs mt-2">Stay online to receive new job assignments</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-xs font-extrabold tracking-wider">{job.bookingNumber}</span>
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base mt-0.5">{job.itemName}</h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                        job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600'
                        : job.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600'
                        : job.status === 'ASSIGNED' ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {job.status === 'IN_PROGRESS' ? 'In Progress' : job.status}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 border-y py-3">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>Customer: <strong className="text-slate-800 dark:text-slate-100">{job.customerName}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>Contact: <a href={`tel:${job.customerPhone}`} className="text-secondary underline font-bold">{job.customerPhone}</a></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>Address: <strong className="text-slate-800 dark:text-slate-100">{job.addressText}</strong></span>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end text-xs font-bold pt-1">
                      {job.status === 'ASSIGNED' && (
                        <>
                          <button onClick={() => handleUpdateStatus(job.id, 'CANCELLED')} className="btn-outline border-red-200 hover:bg-red-50 dark:bg-red-500/10 text-red-600 py-2 flex items-center gap-1">
                            <XCircle size={12} /> Reject
                          </button>
                          <button onClick={() => handleUpdateStatus(job.id, 'IN_PROGRESS')} className="btn-secondary py-2 flex items-center gap-1">
                            <Navigation size={12} /> Start Job
                          </button>
                        </>
                      )}
                      {job.status === 'IN_PROGRESS' && (
                        <button onClick={() => handleUpdateStatus(job.id, 'COMPLETED')} className="btn-primary py-2 flex items-center gap-1">
                          <CheckCircle size={12} /> Mark Complete
                        </button>
                      )}
                      {job.status === 'COMPLETED' && (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 py-2">
                          <CheckCircle size={14} /> Job Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}