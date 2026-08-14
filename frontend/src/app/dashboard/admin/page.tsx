'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { AuthGuard } from '@/context/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp, Users, ShoppingBag, CheckCircle, Clock, Send, RefreshCw, LogOut, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { useSound } from '@/context/SoundContext';
import { useToast } from '@/context/ToastContext';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { play } = useSound();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('ALL');

  const loadData = async () => {
    try {
      const data = await fetchApi('/bookings');
      setBookings(data);
    } catch {
      showToast('Please log in to continue.', 'error');
      logout();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    try { await fetchApi('/auth/logout', { method: 'POST' }); } catch {}
    logout();
  };

  // Demo-only: dispatches the single seeded demo technician (see backend/src/database/seed.ts).
  // A real technician picker is out of scope for this pass.
  const DEMO_TECHNICIAN_ID = '00000000-0000-4000-8000-000000000002';

  const handleManualDispatch = async (bookingId: string) => {
    try {
      await fetchApi(`/bookings/${bookingId}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          technicianId: DEMO_TECHNICIAN_ID,
        }),
      });
      play('success');
      showToast('Technician dispatched.', 'success');
      loadData();
    } catch (err: any) {
      play('error');
      showToast(err.message || 'Could not dispatch a technician. Please try again.', 'error');
    }
  };

  const getStats = () => {
    const totalBookings = bookings.length;
    const completed = bookings.filter(b => b.status === 'COMPLETED').length;
    const revenue = bookings
      .filter(b => b.status === 'COMPLETED' || b.paymentStatus === 'PAID')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
    const activeTechs = 14;
    return { totalBookings, completed, revenue, activeTechs };
  };

  const stats = getStats();
  const filteredBookings = activeTab === 'ALL' 
    ? bookings 
    : bookings.filter(b => b.status === activeTab);

  return (
    <AuthGuard requiredRole="ADMIN">
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-y-2 shadow-xs dark:shadow-none">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
            <span className="font-heading font-extrabold text-lg text-[#0B3C5D] dark:text-sky-300">ServeNep</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className="bg-purple-500/15 text-purple-600 px-2 sm:px-3.5 py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
              <Shield size={12} />
              Admin Control
            </span>
            <ThemeToggle />
            <SoundToggle />
            <button onClick={handleLogout} title="Logout" aria-label="Logout" className="p-1.5 sm:p-2 hover:bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors text-slate-400 dark:text-slate-500 hover:text-red-500 shrink-0">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-12 space-y-6 md:space-y-8">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <ShoppingBag size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase font-bold">Total Bookings</span>
                <h3 className="font-heading font-black text-xl text-slate-800 dark:text-slate-100">{stats.totalBookings}</h3>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase font-bold">Completed</span>
                <h3 className="font-heading font-black text-xl text-slate-800 dark:text-slate-100">{stats.completed}</h3>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase font-bold">Revenue</span>
                <h3 className="font-heading font-black text-xl text-slate-800 dark:text-slate-100">Rs. {stats.revenue}</h3>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block uppercase font-bold">Active Pros</span>
                <h3 className="font-heading font-black text-xl text-slate-800 dark:text-slate-100">{stats.activeTechs}</h3>
              </div>
            </div>
          </div>

          {/* Dispatch Engine */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
              <h2 className="font-heading text-lg font-extrabold text-[#0B3C5D] dark:text-sky-300">Booking Dispatch Engine</h2>
              
              <div className="flex gap-2 flex-wrap">
                {['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                <button onClick={loadData} className="p-2 bg-slate-50 dark:bg-slate-950 border rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800" title="Refresh" aria-label="Refresh">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600 dark:text-slate-300">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 uppercase text-xs tracking-wider">
                    <th className="py-3 pr-4">Booking</th>
                    <th className="py-3 pr-4">Customer</th>
                    <th className="py-3 pr-4">Service</th>
                    <th className="py-3 pr-4">City</th>
                    <th className="py-3 pr-4">Pro</th>
                    <th className="py-3 pr-4">Payment</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">No bookings found for this filter</td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-950/50 transition-colors">
                        <td className="py-4 pr-4 font-bold text-slate-800 dark:text-slate-100">{b.bookingNumber}</td>
                        <td className="py-4 pr-4">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{b.customerName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{b.customerPhone}</p>
                        </td>
                        <td className="py-4 pr-4 font-bold text-primary">{b.itemName}</td>
                        <td className="py-4 pr-4">{b.city}</td>
                        <td className="py-4 pr-4">
                          {b.technicianName ? (
                            <span className="font-bold text-slate-800 dark:text-slate-100">{b.technicianName}</span>
                          ) : (
                            <span className="text-amber-500 font-bold flex items-center gap-1">
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`font-bold text-xs ${
                            b.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {b.paymentStatus}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500"> ({b.paymentMethod})</span>
                        </td>
                        <td className="py-4 text-right">
                          {!b.technicianId && (
                            <button 
                              onClick={() => handleManualDispatch(b.id)}
                              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1 inline-flex"
                            >
                              <Send size={10} /> Dispatch
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}