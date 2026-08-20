'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { AuthGuard } from '@/context/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { User, CheckCircle, Navigation, Phone, MapPin, DollarSign, Star, RefreshCw, XCircle, LogOut, Clock, Edit3, Send, Zap, Settings, Check } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { useToast } from '@/context/ToastContext';

// Only send a location update this often — watchPosition can fire far more
// frequently than that, and there's no need to hammer the API every time.
const LOCATION_SEND_INTERVAL_MS = 15000;

// Mirrors the real service catalog names on the backend — a technician's
// specialties gate which job broadcasts ever reach them at all.
const SERVICE_NAMES = ['Plumbing', 'Electrical', 'AC & Appliances', 'Cleaning & Pest Control', 'Painting'];

export default function TechnicianDashboard() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const lastSentAtRef = useRef(0);
  const [earnings, setEarnings] = useState<{ pendingBalance: number; pendingBookingCount: number; paidTotal: number } | null>(null);
  const [pendingRevisions, setPendingRevisions] = useState<Record<string, any>>({});
  const [revisingJobId, setRevisingJobId] = useState<string | null>(null);
  const [revisionAmount, setRevisionAmount] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [commissionRefs, setCommissionRefs] = useState<Record<string, string>>({});
  const [submittingCommission, setSubmittingCommission] = useState<string | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [techProfile, setTechProfile] = useState<{ isAvailable: boolean; specialties: string[]; serviceRadiusKm: number } | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSpecialties, setSettingsSpecialties] = useState<string[]>([]);
  const [settingsRadius, setSettingsRadius] = useState('10');
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = async () => {
    try {
      const [profData, jobData, earningsData, offersData, techProfileData] = await Promise.all([
        fetchApi('/users/profile'),
        fetchApi('/bookings'),
        fetchApi('/payments/technician/earnings').catch(() => null),
        fetchApi('/bookings/offers').catch(() => []),
        fetchApi('/users/me/technician-profile').catch(() => null),
      ]);
      setProfile(profData);
      setJobs(jobData);
      setEarnings(earningsData);
      setOffers(offersData);
      if (techProfileData) {
        setTechProfile(techProfileData);
        setSettingsSpecialties(techProfileData.specialties);
        setSettingsRadius(String(techProfileData.serviceRadiusKm));
      }

      // Only ASSIGNED/IN_PROGRESS jobs can have a live price revision — no
      // point checking the rest on every refresh.
      const activeJobs = jobData.filter((j: any) => j.status === 'ASSIGNED' || j.status === 'IN_PROGRESS');
      const revisionEntries = await Promise.all(
        activeJobs.map(async (j: any) => {
          try {
            const history = await fetchApi(`/bookings/${j.id}/price-revision`);
            const latest = history[0];
            return [j.id, latest?.status === 'PENDING' ? latest : null] as const;
          } catch {
            return [j.id, null] as const;
          }
        }),
      );
      setPendingRevisions(Object.fromEntries(revisionEntries.filter(([, v]) => v)));
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

  const handleSubmitRevision = async (jobId: string) => {
    const amount = parseFloat(revisionAmount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid revised amount.', 'error');
      return;
    }
    if (revisionReason.trim().length < 4) {
      showToast('Explain why the price is changing — the customer sees this before approving.', 'error');
      return;
    }
    setSubmittingRevision(true);
    try {
      await fetchApi(`/bookings/${jobId}/price-revision`, {
        method: 'POST',
        body: JSON.stringify({ requestedAmount: amount, reason: revisionReason.trim() }),
      });
      showToast('Price change sent to the customer for approval.', 'success');
      setRevisingJobId(null);
      setRevisionAmount('');
      setRevisionReason('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not submit the price change.', 'error');
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleRemitCommission = async (jobId: string) => {
    const reference = (commissionRefs[jobId] || '').trim();
    if (reference.length < 4) {
      showToast('Enter the transaction ID from your commission payment (at least 4 characters).', 'error');
      return;
    }
    setSubmittingCommission(jobId);
    try {
      await fetchApi('/payments/commission/claim', {
        method: 'POST',
        body: JSON.stringify({ bookingId: jobId, reference }),
      });
      showToast('Commission remittance submitted — awaiting admin verification.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not submit the remittance.', 'error');
    } finally {
      setSubmittingCommission(null);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    setRespondingOfferId(offerId);
    try {
      await fetchApi(`/bookings/offers/${offerId}/accept`, { method: 'POST' });
      showToast('Job accepted! Head to your assigned jobs.', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not accept this job — it may have just been taken by another technician.', 'error');
      loadData();
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleDeclineOffer = async (offerId: string) => {
    setRespondingOfferId(offerId);
    try {
      await fetchApi(`/bookings/offers/${offerId}/decline`, { method: 'POST' });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not decline this job.', 'error');
    } finally {
      setRespondingOfferId(null);
    }
  };

  const handleToggleAvailability = async () => {
    if (!techProfile) return;
    const next = !techProfile.isAvailable;
    setTogglingAvailability(true);
    setTechProfile({ ...techProfile, isAvailable: next }); // optimistic
    try {
      await fetchApi('/users/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: next }),
      });
      showToast(next ? "You're online — new jobs will be sent to you." : "You're offline — no new jobs will be sent.", 'success');
    } catch (err: any) {
      setTechProfile({ ...techProfile, isAvailable: !next }); // revert
      showToast(err.message || 'Could not update your availability.', 'error');
    } finally {
      setTogglingAvailability(false);
    }
  };

  const toggleSpecialty = (name: string) => {
    setSettingsSpecialties((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const handleSaveSettings = async () => {
    const radius = parseFloat(settingsRadius);
    if (!radius || radius <= 0 || radius > 100) {
      showToast('Enter a service radius between 1 and 100 km.', 'error');
      return;
    }
    setSavingSettings(true);
    try {
      await fetchApi('/users/me/technician-settings', {
        method: 'PATCH',
        body: JSON.stringify({ specialties: settingsSpecialties, serviceRadiusKm: radius }),
      });
      showToast('Settings saved.', 'success');
      setShowSettings(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Could not save your settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length;

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
                <span>4.95 Rating ({completedCount} Jobs)</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-4">
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <DollarSign size={16} className="text-emerald-600" /> Earnings Overview
              </h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block uppercase font-bold">Owed to You</span>
                  <span className="text-sm font-extrabold text-emerald-600">Rs.{earnings?.pendingBalance ?? 0}</span>
                </div>
                <div className="p-3 bg-sky-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block uppercase font-bold">Paid to Date</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Rs.{earnings?.paidTotal ?? 0}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                Platform commission: 15% per job · {earnings?.pendingBookingCount ?? 0} job{earnings?.pendingBookingCount === 1 ? '' : 's'} awaiting payout
              </p>
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
                <Clock size={16} className={techProfile?.isAvailable ? 'text-emerald-500' : 'text-slate-400'} />
                <span>{techProfile?.isAvailable ? 'Available for Jobs' : 'Offline'}</span>
              </div>
              <button
                onClick={handleToggleAvailability}
                disabled={togglingAvailability || !techProfile}
                title="Toggle availability"
                aria-label="Toggle availability"
                className={`w-10 h-6 rounded-full p-0.5 cursor-pointer flex transition-all disabled:opacity-50 ${
                  techProfile?.isAvailable ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <div className="w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm"></div>
              </button>
            </div>

            {/* Specialties / Service Radius */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-3">
              <button onClick={() => setShowSettings((v) => !v)} className="w-full flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-2"><Settings size={16} className="text-[#328CC1]" /> Job Preferences</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{showSettings ? 'Hide' : 'Edit'}</span>
              </button>
              {!showSettings && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {techProfile?.specialties?.length ? techProfile.specialties.join(', ') : 'No specialties set — you will not receive any job offers'} · {techProfile?.serviceRadiusKm ?? 10} km radius
                </p>
              )}
              {showSettings && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICE_NAMES.map((name) => (
                      <button
                        key={name}
                        onClick={() => toggleSpecialty(name)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          settingsSpecialties.includes(name)
                            ? 'border-[#328CC1] bg-[#328CC1]/10 text-[#328CC1]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {settingsSpecialties.includes(name) && <Check size={10} className="inline mr-1" />}
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">Radius (km)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settingsRadius}
                      onChange={(e) => setSettingsRadius(e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                    />
                  </div>
                  <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-secondary w-full text-xs py-1.5 disabled:opacity-50">
                    {savingSettings ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Content - Jobs */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] dark:text-sky-300">
                {offers.length > 0 ? `Incoming Requests (${offers.length})` : 'Your Assigned Jobs'}
              </h2>
              <button onClick={loadData} className="text-xs text-[#328CC1] font-bold flex items-center gap-1 hover:underline">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {offers.length > 0 && (
              <div className="space-y-3">
                {offers.map((offer) => (
                  <div key={offer.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-[#328CC1]/40 shadow-md space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-xs font-extrabold tracking-wider">{offer.bookingNumber}</span>
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base mt-0.5 flex items-center gap-1.5">
                          {offer.itemName}
                          {offer.isEmergency && <Zap size={14} className="text-red-500" />}
                        </h4>
                      </div>
                      <span className="font-heading font-black text-lg text-[#0B3C5D] dark:text-sky-300">Rs. {offer.totalAmount}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {offer.city} · {offer.distanceKm} km away</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {offer.scheduledDate}, {offer.scheduledTimeSlot}</span>
                    </div>
                    <div className="flex gap-3 justify-end pt-1">
                      <button
                        onClick={() => handleDeclineOffer(offer.id)}
                        disabled={respondingOfferId === offer.id}
                        className="btn-outline border-red-200 hover:bg-red-50 dark:bg-red-500/10 text-red-600 py-2 px-4 text-xs disabled:opacity-50"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAcceptOffer(offer.id)}
                        disabled={respondingOfferId === offer.id}
                        className="btn-primary py-2 px-4 text-xs disabled:opacity-50"
                      >
                        {respondingOfferId === offer.id ? 'Accepting…' : 'Accept Job'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {jobs.length === 0 && offers.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-slate-400 dark:text-slate-500">
                <Clock size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">No jobs yet</p>
                <p className="text-xs mt-2">
                  {techProfile?.isAvailable ? 'Stay online — new nearby job requests will show up here' : 'Go online in Job Preferences to start receiving requests'}
                </p>
              </div>
            ) : jobs.length === 0 ? null : (
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

                    {(job.status === 'ASSIGNED' || job.status === 'IN_PROGRESS') && (
                      <div className="space-y-2">
                        {pendingRevisions[job.id] ? (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-xs">
                            <p className="font-bold text-amber-800 dark:text-amber-300">
                              Waiting for customer approval: Rs. {pendingRevisions[job.id].requestedAmount} (was Rs. {pendingRevisions[job.id].previousAmount})
                            </p>
                            <p className="text-amber-700 dark:text-amber-400 mt-0.5">{pendingRevisions[job.id].reason}</p>
                          </div>
                        ) : revisingJobId === job.id ? (
                          <div className="p-3 rounded-xl bg-sky-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 space-y-2">
                            <input
                              type="number"
                              min="1"
                              placeholder="Revised amount (Rs.)"
                              value={revisionAmount}
                              onChange={(e) => setRevisionAmount(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                            />
                            <textarea
                              placeholder="Why is the price changing? The customer sees this."
                              value={revisionReason}
                              onChange={(e) => setRevisionReason(e.target.value)}
                              rows={2}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setRevisingJobId(null)} className="text-xs font-bold text-slate-500 dark:text-slate-400 px-3 py-1.5">
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSubmitRevision(job.id)}
                                disabled={submittingRevision}
                                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                              >
                                {submittingRevision ? 'Sending…' : 'Send to Customer'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRevisingJobId(job.id); setRevisionAmount(String(job.baseAmount)); setRevisionReason(''); }}
                            className="text-xs font-bold text-[#328CC1] flex items-center gap-1 hover:underline"
                          >
                            <Edit3 size={12} /> Actual price different? Request a change
                          </button>
                        )}
                      </div>
                    )}

                    {job.status === 'COMPLETED' && job.paymentMethod === 'CASH' && !job.commissionSettled && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 space-y-2">
                        {job.commissionReference ? (
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                            Commission of Rs. {job.commissionAmount} submitted (ref: {job.commissionReference}) — awaiting admin verification.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              You owe the company Rs. {job.commissionAmount} commission on this cash job (Rs. {job.technicianPayoutAmount} is yours).
                            </p>
                            <input
                              type="text"
                              placeholder="Transaction ID from your commission payment"
                              value={commissionRefs[job.id] || ''}
                              onChange={(e) => setCommissionRefs((prev) => ({ ...prev, [job.id]: e.target.value }))}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
                            />
                            <button
                              onClick={() => handleRemitCommission(job.id)}
                              disabled={submittingCommission === job.id}
                              className="btn-secondary text-xs py-1.5 px-3 w-full flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Send size={12} /> {submittingCommission === job.id ? 'Submitting…' : "I've Sent the Commission"}
                            </button>
                          </>
                        )}
                      </div>
                    )}

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
                        <button
                          onClick={() => handleUpdateStatus(job.id, 'COMPLETED')}
                          disabled={!!pendingRevisions[job.id]}
                          title={pendingRevisions[job.id] ? 'Resolve the pending price change first' : undefined}
                          className="btn-primary py-2 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
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