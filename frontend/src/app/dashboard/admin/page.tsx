'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { AuthGuard } from '@/context/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp, Users, ShoppingBag, CheckCircle, Clock, Send, RefreshCw, LogOut, Shield } from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('ALL');

  const loadData = async () => {
    try {
      const data = await fetchApi('/bookings');
      setBookings(data);
    } catch {
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

  const handleManualDispatch = async (bookingId: string) => {
    await fetchApi(`/bookings/${bookingId}/assign`, {
      method: 'POST',
      body: JSON.stringify({
        technicianId: 'tech-uuid-1',
        technicianName: 'Ramesh Mali (Plumber)',
      }),
    });
    loadData();
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
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-xs">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
            <span className="font-heading font-extrabold text-lg text-[#0B3C5D]">ServeNep</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="bg-purple-500/15 text-purple-600 px-3.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
              <Shield size={12} />
              Admin Control
            </span>
            <button onClick={handleLogout} title="Logout" aria-label="Logout" className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-red-500">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-12 space-y-8">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-bold">Total Bookings</span>
                <h3 className="font-heading font-black text-xl text-slate-800">{stats.totalBookings}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-bold">Completed</span>
                <h3 className="font-heading font-black text-xl text-slate-800">{stats.completed}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-bold">Revenue</span>
                <h3 className="font-heading font-black text-xl text-slate-800">Rs. {stats.revenue}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-bold">Active Pros</span>
                <h3 className="font-heading font-black text-xl text-slate-800">{stats.activeTechs}</h3>
              </div>
            </div>
          </div>

          {/* Dispatch Engine */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
              <h2 className="font-heading text-lg font-extrabold text-[#0B3C5D]">Booking Dispatch Engine</h2>
              
              <div className="flex gap-2 flex-wrap">
                {['ALL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                <button onClick={loadData} className="p-2 bg-slate-50 border rounded-lg text-slate-500 hover:bg-slate-100" title="Refresh" aria-label="Refresh">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600">
                <thead>
                  <tr className="border-b text-slate-400 uppercase text-xs tracking-wider">
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
                      <td colSpan={7} className="py-12 text-center text-slate-400">No bookings found for this filter</td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.id} className="border-b hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pr-4 font-bold text-slate-800">{b.bookingNumber}</td>
                        <td className="py-4 pr-4">
                          <p className="font-bold text-slate-800">{b.customerName}</p>
                          <p className="text-[10px] text-slate-500">{b.customerPhone}</p>
                        </td>
                        <td className="py-4 pr-4 font-bold text-primary">{b.itemName}</td>
                        <td className="py-4 pr-4">{b.city}</td>
                        <td className="py-4 pr-4">
                          {b.technicianName ? (
                            <span className="font-bold text-slate-800">{b.technicianName}</span>
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
                          <span className="text-slate-400"> ({b.paymentMethod})</span>
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