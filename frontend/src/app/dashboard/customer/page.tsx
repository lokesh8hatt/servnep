'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi, fetchApiBlob } from '@/lib/api';
import { AuthGuard } from '@/context/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { User, MapPin, Download, Award, RefreshCw, Star, LogOut, ShoppingBag } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { useSound } from '@/context/SoundContext';
import { useToast } from '@/context/ToastContext';

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const { play } = useSound();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const loadData = async () => {
    try {
      const [profData, bookData] = await Promise.all([
        fetchApi('/users/profile'),
        fetchApi('/bookings'),
      ]);
      setProfile(profData);
      setBookings(bookData);
    } catch {
      // If API fails (e.g. token expired), logout
      showToast('Please log in to continue.', 'error');
      logout();
    }
  };

  const handleViewInvoice = async (bookingId: string) => {
    // Open the tab synchronously so the browser still counts it as a direct
    // response to the click — opening it after the await below gets blocked
    // as a popup in most browsers.
    const invoiceWindow = window.open('', '_blank');
    try {
      const blob = await fetchApiBlob(`/bookings/${bookingId}/invoice`);
      const url = URL.createObjectURL(blob);
      if (invoiceWindow) {
        invoiceWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err: any) {
      invoiceWindow?.close();
      play('error');
      showToast(err.message || 'Could not load the invoice. Please try again.', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReviewSubmit = async () => {
    try {
      await fetchApi('/reviews', {
        method: 'POST',
        body: JSON.stringify({ bookingId: selectedBookingId, rating, comment }),
      });
      play('success');
      showToast('Thanks! Your review has been submitted.', 'success');
      setShowReviewModal(false);
      setComment('');
      loadData();
    } catch (err: any) {
      play('error');
      showToast(err.message || 'Could not submit your review. Please try again.', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // Logout locally even if API fails
    }
    logout();
  };

  return (
    <AuthGuard requiredRole="CUSTOMER">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shadow-xs dark:shadow-none">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
            <span className="font-heading font-extrabold text-lg text-[#0B3C5D] dark:text-sky-300">ServeNep</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="bg-[#328CC1]/15 text-[#328CC1] px-3.5 py-1 rounded-full text-xs font-bold">
              Customer Portal
            </span>
            <ThemeToggle />
            <SoundToggle />
            <button onClick={handleLogout} title="Logout" aria-label="Logout" className="p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 hover:text-red-500">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Sidebar - Profile */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-[#328CC1] to-[#0B3C5D] rounded-full mx-auto flex items-center justify-center shadow-lg">
                <span className="font-heading font-black text-2xl text-white">
                  {profile?.fullName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-slate-800 dark:text-slate-100 text-lg">{profile?.fullName || 'Loading...'}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{profile?.phone}</p>
                <span className="inline-block mt-2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {user?.role}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                  <Award size={14} className="text-amber-500" /> Referral:
                </span>
                <span className="font-heading font-black text-primary">{profile?.referralCode || 'NEP-XXXX'}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-4">
              <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                <MapPin size={16} className="text-[#328CC1]" /> Saved Addresses
              </h4>
              {profile?.addresses?.length > 0 ? profile.addresses.map((addr: any) => (
                <div key={addr.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex items-start gap-2.5">
                  <MapPin size={16} className="text-[#328CC1] mt-0.5 shrink-0" />
                  <div>
                    <h5 className="font-bold text-slate-800 dark:text-slate-100">{addr.label}</h5>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">{addr.street}, {addr.city}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No saved addresses yet</p>
              )}
            </div>

            <Link href="/booking" className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
              <ShoppingBag size={16} /> Book a New Service
            </Link>
          </div>

          {/* Right Content - Bookings */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] dark:text-sky-300">Your Booking Orders</h2>
              <button onClick={loadData} className="text-xs text-[#328CC1] font-bold flex items-center gap-1 hover:underline">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 text-center text-slate-400 dark:text-slate-500">
                <ShoppingBag size={40} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">No orders booked yet</p>
                <Link href="/booking" className="text-[#328CC1] font-bold text-sm hover:underline mt-2 inline-block">
                  Book your first service →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-slate-400 dark:text-slate-500 text-xs font-extrabold tracking-wider">{booking.bookingNumber}</span>
                        <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-base mt-0.5">{booking.itemName}</h4>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase ${
                        booking.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600'
                        : booking.status === 'ASSIGNED' || booking.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {booking.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 border-y py-3">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Pro Assigned</p>
                        <p className="text-slate-800 dark:text-slate-100 font-bold mt-0.5">{booking.technicianName || 'Searching...'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Scheduled</p>
                        <p className="text-slate-800 dark:text-slate-100 mt-0.5">{booking.scheduledDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Payment</p>
                        <p className="text-slate-800 dark:text-slate-100 font-bold mt-0.5">{booking.paymentStatus}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Amount</p>
                        <p className="text-slate-800 dark:text-slate-100 font-bold mt-0.5">Rs. {booking.totalAmount}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end text-xs font-bold pt-1">
                      {booking.status === 'COMPLETED' && (
                        <button onClick={() => { setSelectedBookingId(booking.id); setShowReviewModal(true); }} className="btn-outline py-2 flex items-center gap-1">
                          <Star size={12} /> Leave a Review
                        </button>
                      )}
                      <button onClick={() => handleViewInvoice(booking.id)} className="btn-primary py-2 flex items-center gap-1">
                        <Download size={12} /> Invoice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-xl">
              <h3 className="font-heading font-extrabold text-slate-800 dark:text-slate-100 text-lg">Leave a Review</h3>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRating(star)} className="text-amber-500 hover:scale-110 transition-transform" title={`${star} star`} aria-label={`${star} star`}>
                      <Star size={28} fill={star <= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Comment</label>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your technician? Upfront? Professional?" className="w-full p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#328CC1]"></textarea>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowReviewModal(false)} className="btn-outline flex-1">Cancel</button>
                <button onClick={handleReviewSubmit} className="btn-secondary flex-1">Submit Review</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}