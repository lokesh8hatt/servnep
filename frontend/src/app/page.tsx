'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Droplet, Zap, Tv, Sparkles, PaintRoller, Shield, Clock, ShieldCheck,
  Star, Award, PhoneCall,
  Search, ArrowRight, UserCheck, LogIn
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchApi } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';

const CATEGORY_META: Record<string, { icon: React.ElementType; desc: string }> = {
  plumbing: { icon: Droplet, desc: 'Water tanks, pipes & toilets' },
  electrical: { icon: Zap, desc: 'Short circuit diagnosis & wiring' },
  'ac-appliance-repair': { icon: Tv, desc: 'AC, fridge, geysers & washing machines' },
  'cleaning-pest-control': { icon: Sparkles, desc: 'Sofa cleaning & full home scrubbing' },
  painting: { icon: PaintRoller, desc: 'Interior, exterior & waterproof wall painting' },
};

const CITIES = ['Kathmandu', 'Lalitpur', 'Bhaktapur'];

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
}

interface CatalogService {
  id: string;
  name: string;
  slug: string;
  categories: { id: string; items: CatalogItem[] }[];
}

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Kathmandu');
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const { user, isAuthenticated } = useAuth();
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchApi('/services').then(setCatalog).catch(() => {});
  }, []);

  // ServeNep only operates in the Kathmandu valley today, so "location"
  // here means the fixed city selector, not a full province/district tree.
  const categories = useMemo(() => catalog.map((s) => {
    const meta = CATEGORY_META[s.slug] || { icon: Sparkles, desc: '' };
    const itemCount = s.categories.reduce((acc, c) => acc + c.items.length, 0);
    return {
      name: s.name,
      icon: meta.icon,
      count: `${itemCount} Service${itemCount === 1 ? '' : 's'}`,
      slug: s.slug,
      desc: meta.desc,
    };
  }), [catalog]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: { itemId: string; itemName: string; serviceName: string; basePrice: number }[] = [];
    for (const service of catalog) {
      for (const cat of service.categories) {
        for (const item of cat.items) {
          const haystack = `${item.name} ${item.description} ${service.name}`.toLowerCase();
          if (haystack.includes(q)) {
            matches.push({ itemId: item.id, itemName: item.name, serviceName: service.name, basePrice: item.basePrice });
          }
        }
      }
    }
    return matches.slice(0, 6);
  }, [searchQuery, catalog]);

  const bookNowHref = searchResults.length > 0
    ? `/booking?item=${searchResults[0].itemId}&city=${selectedCity}`
    : `/booking?city=${selectedCity}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDashboardUrl = () => {
    if (!isAuthenticated || !user) return '/login';
    switch (user.role) {
      case 'CUSTOMER': return '/dashboard/customer';
      case 'TECHNICIAN': return '/dashboard/technician';
      case 'ADMIN':
      case 'DISPATCHER': return '/dashboard/admin';
      default: return '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Main Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-y-2 shadow-xs dark:shadow-none">
        <div className="flex items-center gap-2">
          <div className="bg-[#0B3C5D] text-white p-2 rounded-xl shrink-0">
            <span className="font-heading font-black text-xl tracking-wider">SN</span>
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-lg text-[#0B3C5D] dark:text-sky-300 tracking-tight">ServeNep</h1>
            <p className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold">Home Marketplace</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Link href="#services" className="hover:text-[#0B3C5D] dark:text-sky-300 transition-colors">Services</Link>
          <Link href="#how-it-works" className="hover:text-[#0B3C5D] dark:text-sky-300 transition-colors">How It Works</Link>
          <Link href="#reviews" className="hover:text-[#0B3C5D] dark:text-sky-300 transition-colors">Testimonials</Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 border px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-slate-700 dark:text-slate-200">
            <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              title="Select your city"
              aria-label="Select your city"
              className="bg-transparent font-semibold focus:outline-hidden cursor-pointer max-w-[6rem] sm:max-w-none"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <ThemeToggle />
          <SoundToggle />

          {isAuthenticated ? (
            <Link
              href={getDashboardUrl()}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <UserCheck size={16} />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative gradient-hero text-white py-14 sm:py-20 md:py-24 px-4 sm:px-6 md:px-12 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-primary to-transparent pointer-events-none"></div>

        <span className="bg-white/10 dark:bg-white/5 text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
          🇳🇵 Nepal's #1 On-Demand Home Services Platform
        </span>

        <h2 className="font-heading text-4xl md:text-6xl font-black max-w-4xl leading-tight mb-6">
          Your Home, Maintained by Verified Experts
        </h2>
        
        <p className="text-slate-300 text-lg md:text-xl max-w-2xl mb-12">
          From plumbing leaks to deep cleanings, book verified professionals in Kathmandu, Lalitpur, and Bhaktapur.
        </p>

        {/* Search / booking redirect box */}
        <div ref={searchBoxRef} className="relative w-full max-w-2xl mb-6 text-left">
          <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex-1 flex items-center gap-2 px-3 text-slate-500 dark:text-slate-400">
              <Search size={20} className="text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="What service do you need today? e.g., Tap leak, Deep cleaning"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                onFocus={() => setShowSearchResults(true)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); router.push(bookNowHref); } }}
                className="w-full py-3.5 bg-transparent text-slate-850 text-sm focus:outline-hidden font-medium"
              />
            </div>
            <Link href={bookNowHref} className="btn-secondary flex items-center justify-center gap-2 py-4">
              <span>Book Now</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {showSearchResults && searchQuery.trim() !== '' && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden z-10">
              {searchResults.length > 0 ? (
                searchResults.map((r) => (
                  <Link
                    key={r.itemId}
                    href={`/booking?item=${r.itemId}&city=${selectedCity}`}
                    onClick={() => setShowSearchResults(false)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.itemName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{r.serviceName}</p>
                    </div>
                    <span className="text-xs font-bold text-[#328CC1] shrink-0">Rs. {r.basePrice}</span>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  No matching services — try "Book Now" to browse the full catalog.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-sm text-center px-2">
          <span className="text-red-400 animate-pulse font-bold flex items-center gap-1">
            <PhoneCall size={14} /> Emergency booking needed?
          </span>
          <Link href={`/booking?emergency=true&city=${selectedCity}`} className="underline hover:text-red-300 font-semibold transition-colors">
            Dispatch Technician in 30 Mins (Emergency Surcharge Applies)
          </Link>
        </div>
      </section>

      {/* Trust Badging */}
      <section className="bg-white dark:bg-slate-900 border-y border-slate-100 dark:border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 text-[#0B3C5D] dark:text-sky-300 rounded-full flex items-center justify-center mb-3">
              <ShieldCheck size={24} />
            </div>
            <h4 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Verified Pros</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">100% background checked</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 text-[#0B3C5D] dark:text-sky-300 rounded-full flex items-center justify-center mb-3">
              <Award size={24} />
            </div>
            <h4 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Service Warranty</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">7-Day free callback warranty</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 text-[#0B3C5D] dark:text-sky-300 rounded-full flex items-center justify-center mb-3">
              <Clock size={24} />
            </div>
            <h4 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Quick Response</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">On-time technician arrival</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 text-[#0B3C5D] dark:text-sky-300 rounded-full flex items-center justify-center mb-3">
              <Shield size={24} />
            </div>
            <h4 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">Transparent Pricing</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Upfront estimates, no tricks</p>
          </div>
        </div>
      </section>

      {/* Service Categories Grid */}
      <section id="services" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-black text-[#0B3C5D] dark:text-sky-300 mb-4">
            Popular Service Offerings
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto text-sm">
            Choose from our range of verified home maintenance tasks. Select to launch booking workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, i) => (
            <Link
              key={i}
              href={`/booking?service=${cat.slug}&city=${selectedCity}`}
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs dark:shadow-none hover:shadow-md hover:border-sky-500/40 transition-all group flex flex-col"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-950 text-[#328CC1] group-hover:bg-[#328CC1] group-hover:text-white transition-all flex items-center justify-center mb-6">
                <cat.icon size={24} />
              </div>
              <h3 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-lg group-hover:text-primary transition-colors mb-1">{cat.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{cat.desc}</p>
              <div className="mt-auto flex items-center justify-between text-xs font-semibold text-[#328CC1] group-hover:underline">
                <span>{cat.count}</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-slate-900 text-white py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-black mb-4">
              Booking Made Simple
            </h2>
            <p className="text-slate-400 dark:text-slate-500 max-w-xl mx-auto text-sm">
              Ready to restore your peace of mind? Schedule in four steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Select Service', desc: 'Choose plumbing, electrical or cleaning task.' },
              { step: '02', title: 'Schedule Visit', desc: 'Pick your preferred date and convenient time slot.' },
              { step: '03', title: 'Get Assigned Pro', desc: 'Our dispatcher assigns the nearest background checked specialist.' },
              { step: '04', title: 'Seamless Payment', desc: 'Pay securely after completion using eSewa, Khalti, or Cash.' },
            ].map((s, idx) => (
              <div key={idx} className="flex flex-col relative">
                <span className="font-heading text-5xl font-black text-white/10 mb-4">{s.step}</span>
                <h3 className="font-heading font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-black text-[#0B3C5D] dark:text-sky-300 mb-4">
            Loved by Customers in Kathmandu Valley
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Sabin Shrestha', location: 'Lazimpat, Kathmandu', review: 'Excellent plumbing fix. Ramesh arrived within 20 minutes and solved our tap leak perfectly!', rating: 5 },
            { name: 'Anjana Thapa', location: 'Patan, Lalitpur', review: 'Booked home deep cleaning. A team of three arrived with full equipment. My kitchen looks brand new.', rating: 5 },
            { name: 'Prajwal Adhikari', location: 'Thimi, Bhaktapur', review: 'Highly professional AC servicing. Upfront pricing, clear communication, and very tidy work.', rating: 5 },
          ].map((t, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex gap-0.5 text-[#D9B310] mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-slate-655 text-sm leading-relaxed italic mb-6">"{t.review}"</p>
              </div>
              <div>
                <h4 className="font-heading font-bold text-slate-800 dark:text-slate-100 text-sm">{t.name}</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 border-t border-slate-800 text-slate-400 dark:text-slate-500 py-12 px-6 text-sm">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#0B3C5D] text-white p-1.5 rounded-lg text-xs font-black">SN</div>
              <span className="font-heading font-bold text-white text-lg">ServeNep</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Nepal's leading on-demand digital services marketplace. Registering skilled local professionals to make maintenance simple.
            </p>
          </div>
          <div>
            <h5 className="font-bold text-white mb-4">Our Services</h5>
            <ul className="space-y-2 text-xs">
              <li><Link href="/booking?service=plumbing" className="hover:underline">Plumbing Services</Link></li>
              <li><Link href="/booking?service=electrical" className="hover:underline">Electrical Services</Link></li>
              <li><Link href="/booking?service=ac-appliance-repair" className="hover:underline">AC & Appliance Repair</Link></li>
              <li><Link href="/booking?service=cleaning-pest-control" className="hover:underline">Deep Home Cleaning</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-white mb-4">Company</h5>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:underline">About Us</a></li>
              <li><a href="#" className="hover:underline">Contact Support</a></li>
              <li><a href="#" className="hover:underline">Become a Service Partner</a></li>
            </ul>
          </div>
          <div>
            <h5 className="font-bold text-white mb-4">Legal Policy</h5>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:underline">7-Day Warranty Policy</a></li>
              <li><a href="#" className="hover:underline">Refund Policy</a></li>
              <li><a href="#" className="hover:underline">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} ServeNep Technologies Pvt. Ltd. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="hover:underline cursor-pointer">Kathmandu</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer">Lalitpur</span>
            <span>•</span>
            <span className="hover:underline cursor-pointer">Bhaktapur</span>
          </div>
        </div>
      </footer>
    </div>
  );
}