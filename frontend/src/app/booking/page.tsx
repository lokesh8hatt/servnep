'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { MapPin, Calendar, Clock, CreditCard, ChevronRight, ShoppingBag, Send, Smartphone } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SoundToggle } from '@/components/SoundToggle';
import { useToast } from '@/context/ToastContext';

// Real money, no merchant API — customers send eSewa/Khalti transfers here
// directly, then claim the payment; an admin confirms it against the actual
// wallet before it's marked paid. See PaymentsService.claimManualPayment.
const MANUAL_PAYMENT_NUMBER = '9868918609';

export default function BookingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [useSandboxDemo, setUseSandboxDemo] = useState(false);
  const [manualPaymentBooking, setManualPaymentBooking] = useState<{ id: string; amount: number } | null>(null);
  const [claimingPayment, setClaimingPayment] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [addressLabel, setAddressLabel] = useState('Home');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('Kathmandu');
  const [scheduledDate, setScheduledDate] = useState('2026-06-23');
  const [scheduledSlot, setScheduledSlot] = useState('11:00 AM - 01:00 PM');
  const [isEmergency, setIsEmergency] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'ESEWA' | 'KHALTI' | 'CASH'>('CASH');

  useEffect(() => {
    fetchApi('/services').then(data => {
      setServices(data);
      if (data.length === 0) return;

      // Deep-link support: the homepage's search box, category cards, and
      // emergency link all navigate here with query params — previously
      // ignored entirely, so every link landed on the same default item.
      const params = new URLSearchParams(window.location.search);
      const itemParam = params.get('item');
      const serviceParam = params.get('service');
      const cityParam = params.get('city');
      const emergencyParam = params.get('emergency');

      let matchedService: any = null;
      let matchedItem: any = null;

      if (itemParam) {
        outer: for (const s of data) {
          for (const cat of s.categories) {
            const found = cat.items.find((it: any) => it.id === itemParam);
            if (found) {
              matchedService = s;
              matchedItem = found;
              break outer;
            }
          }
        }
      }

      if (!matchedService && serviceParam) {
        matchedService = data.find((s: any) => s.slug === serviceParam) || null;
        if (matchedService?.categories.length > 0 && matchedService.categories[0].items.length > 0) {
          matchedItem = matchedService.categories[0].items[0];
        }
      }

      if (!matchedService) {
        matchedService = data[0];
        if (data[0].categories.length > 0 && data[0].categories[0].items.length > 0) {
          matchedItem = data[0].categories[0].items[0];
        }
      }

      setSelectedService(matchedService);
      setSelectedItem(matchedItem);

      if (cityParam && ['Kathmandu', 'Lalitpur', 'Bhaktapur'].includes(cityParam)) {
        setCity(cityParam);
      }
      if (emergencyParam === 'true') {
        setIsEmergency(true);
      }
    });
  }, []);

  const handleServiceChange = (serviceId: string) => {
    const s = services.find(x => x.id === serviceId);
    setSelectedService(s);
    if (s.categories.length > 0 && s.categories[0].items.length > 0) {
      setSelectedItem(s.categories[0].items[0]);
    }
  };

  const handleBookingSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const addressResult = await fetchApi('/users/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: addressLabel,
          street: streetAddress || 'Lazimpat Rd, Ward 2',
          city: city,
          lat: 27.7196,
          lng: 85.3240,
        }),
      });

      const bookingResult = await fetchApi('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          itemId: selectedItem.id,
          addressId: addressResult.id || 'addr-1',
          scheduledDate: scheduledDate,
          scheduledTimeSlot: scheduledSlot,
          isEmergency: isEmergency,
          paymentMethod: paymentMethod,
        }),
      });

      if (paymentMethod === 'CASH') {
        showToast('Booking confirmed! We\'ll assign a technician shortly.', 'success');
        router.push(`/dashboard/customer?status=success&bookingId=${bookingResult.id}&msg=cash_confirmed`);
        return;
      }

      if (!useSandboxDemo) {
        // Default, real path: no merchant API — customer sends the transfer
        // manually and claims it; admin confirms against the actual wallet.
        setManualPaymentBooking({ id: bookingResult.id, amount: bookingResult.totalAmount });
        setSubmitting(false);
        return;
      }

      if (paymentMethod === 'ESEWA') {
        const esewaForm = await fetchApi('/payments/esewa/initiate', {
          method: 'POST',
          body: JSON.stringify({ bookingId: bookingResult.id }),
        });

        const form = document.createElement('form');
        form.setAttribute('method', 'POST');
        form.setAttribute('action', esewaForm.url);

        Object.entries(esewaForm.fields).forEach(([key, val]: any) => {
          const input = document.createElement('input');
          input.setAttribute('type', 'hidden');
          input.setAttribute('name', key);
          input.setAttribute('value', val);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      } else {
        const khaltiResponse = await fetchApi('/payments/khalti/initiate', {
          method: 'POST',
          body: JSON.stringify({ bookingId: bookingResult.id }),
        });
        window.location.href = khaltiResponse.payment_url;
      }
    } catch (err: any) {
      showToast(err.message || 'Could not complete your booking. Please try again.', 'error');
      setSubmitting(false);
    }
  };

  const handleClaimPayment = async () => {
    if (!manualPaymentBooking) return;
    setClaimingPayment(true);
    try {
      await fetchApi('/payments/manual/claim', {
        method: 'POST',
        body: JSON.stringify({ bookingId: manualPaymentBooking.id }),
      });
      showToast('Thanks! We\'ll confirm your payment shortly.', 'success');
      router.push(`/dashboard/customer?status=success&bookingId=${manualPaymentBooking.id}`);
    } catch (err: any) {
      showToast(err.message || 'Could not submit your payment claim. Please try again.', 'error');
      setClaimingPayment(false);
    }
  };

  const getEstimatedCost = () => {
    if (!selectedItem) return 0;
    const base = selectedItem.basePrice;
    const serviceFee = 50;
    const surcharge = isEmergency ? 300 : 0;
    return base + serviceFee + surcharge;
  };

  if (!selectedService || !selectedItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-semibold">
        Loading services catalog...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-950 flex flex-col font-sans">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black shrink-0">SN</div>
          <span className="font-heading font-extrabold text-lg text-[#0B3C5D] dark:text-sky-300 truncate">ServeNep Booking</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">
            Step {step}/3
          </div>
          <ThemeToggle />
          <SoundToggle />
        </div>
      </header>

      <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
        <div className={`h-full bg-[#328CC1] transition-all duration-300 ${
          step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'
        }`}></div>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        
        <div className="md:col-span-2 space-y-6">
          
          {step === 1 && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-6">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] dark:text-sky-300 flex items-center gap-2">
                <ShoppingBag size={20} className="text-[#328CC1]" />
                <span>Select Service Item</span>
              </h2>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Service Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleServiceChange(s.id)}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        selectedService.id === s.id
                          ? 'border-[#328CC1] bg-[#328CC1]/5 text-[#328CC1]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:bg-slate-950'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Select Category</label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {selectedService.categories.map((cat: any) => (
                    <div
                      key={cat.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-sky-50 dark:bg-slate-950"
                    >
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{cat.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cat.description}</p>
                    </div>
                  ))}
                </div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Available Tasks</label>
                <div className="space-y-3">
                  {selectedService.categories.flatMap((cat: any) => cat.items).map((it: any) => (
                    <div
                      key={it.id}
                      onClick={() => setSelectedItem(it)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${
                        selectedItem.id === it.id
                          ? 'border-[#328CC1] bg-[#328CC1]/5 shadow-xs dark:shadow-none'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:bg-slate-950'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{it.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{it.description}</p>
                      </div>
                      <span className="font-heading font-black text-sm text-[#0B3C5D] dark:text-sky-300">Rs. {it.basePrice}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setStep(2)} className="btn-secondary w-full flex items-center justify-center gap-1.5 mt-8">
                <span>Continue</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-6">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] dark:text-sky-300 flex items-center gap-2">
                <MapPin size={20} className="text-[#328CC1]" />
                <span>Service Address & Schedule</span>
              </h2>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Service City</label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  {['Kathmandu', 'Lalitpur', 'Bhaktapur'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCity(c)}
                      className={`py-2 px-1.5 sm:px-3 rounded-lg border text-[11px] sm:text-xs font-bold transition-all ${
                        city === c
                          ? 'border-[#328CC1] bg-[#328CC1]/5 text-[#328CC1]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:bg-slate-950'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. Lazimpat Rd, Ward 2, near Standard Chartered Bank"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-[#328CC1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                    <Calendar size={14} /> Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-[#328CC1] [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                    <Clock size={14} /> Time Slot
                  </label>
                  <select
                    value={scheduledSlot}
                    onChange={(e) => setScheduledSlot(e.target.value)}
                    title="Time Slot"
                    aria-label="Time Slot"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-[#328CC1]"
                  >
                    <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                    <option value="01:00 PM - 03:00 PM">01:00 PM - 03:00 PM</option>
                    <option value="03:00 PM - 05:00 PM">03:00 PM - 05:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 flex items-center justify-between pt-4">
                <div>
                  <h4 className="text-sm font-bold text-red-950 dark:text-red-300">Need urgent dispatch?</h4>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">Technician arrives within 30 minutes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                  title="Emergency dispatch"
                  className="w-4 h-4 text-red-650 border-gray-300 rounded-sm"
                />
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => setStep(1)} className="btn-outline w-1/3">Back</button>
                <button onClick={() => setStep(3)} className="btn-secondary flex-1">Next Step</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-6">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] dark:text-sky-300 flex items-center gap-2">
                <CreditCard size={20} className="text-[#328CC1]" />
                <span>Confirm & Pay</span>
              </h2>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Payment Method</label>
                <div className="space-y-3">
                  {[
                    { key: 'CASH', name: 'Cash on Service Completion', desc: 'Pay directly to technician' },
                    { key: 'ESEWA', name: 'eSewa', desc: `Send payment to ${MANUAL_PAYMENT_NUMBER} via the eSewa app` },
                    { key: 'KHALTI', name: 'Khalti', desc: `Send payment to ${MANUAL_PAYMENT_NUMBER} via the Khalti app` },
                  ].map((p) => (
                    <div
                      key={p.key}
                      onClick={() => setPaymentMethod(p.key as any)}
                      className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === p.key
                          ? 'border-[#328CC1] bg-[#328CC1]/5'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-sky-50 dark:bg-slate-950'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === p.key ? 'border-[#328CC1] bg-[#328CC1]' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {paymentMethod === p.key && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900"></span>}
                      </div>
                    </div>
                  ))}
                </div>

                {(paymentMethod === 'ESEWA' || paymentMethod === 'KHALTI') && (
                  <label className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
                    <input
                      type="checkbox"
                      checked={useSandboxDemo}
                      onChange={(e) => setUseSandboxDemo(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5"
                    />
                    <span>
                      Use the sandbox payment gateway integration instead (technical demo — test money only, no real payment reaches {MANUAL_PAYMENT_NUMBER})
                    </span>
                  </label>
                )}
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => setStep(2)} disabled={submitting} className="btn-outline w-1/3 disabled:opacity-50 disabled:cursor-not-allowed">Back</button>
                <button onClick={handleBookingSubmit} disabled={submitting} className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Confirming…' : 'Book & Confirm'}
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-xs dark:shadow-none space-y-6">
            <h3 className="font-heading font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Booking Invoice
            </h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-4">
              <div className="flex justify-between">
                <span>Task:</span>
                <span className="text-slate-900 dark:text-white font-bold">{selectedItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span>City Location:</span>
                <span className="text-slate-900 dark:text-white">{city}</span>
              </div>
              <div className="flex justify-between">
                <span>Base Cost:</span>
                <span className="text-slate-900 dark:text-white font-bold">Rs. {selectedItem.basePrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee:</span>
                <span className="text-slate-900 dark:text-white">Rs. 50</span>
              </div>
              {isEmergency && (
                <div className="flex justify-between text-red-650">
                  <span>Emergency Surcharge:</span>
                  <span>Rs. 300</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-heading font-black text-lg text-primary pt-2">
              <span>Total:</span>
              <span>Rs. {getEstimatedCost()}</span>
            </div>
          </div>
        </div>

      </main>

      {manualPaymentBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full space-y-5 shadow-xl text-center">
            <div className="w-14 h-14 bg-[#328CC1]/10 rounded-2xl flex items-center justify-center mx-auto">
              <Smartphone size={28} className="text-[#328CC1]" />
            </div>
            <div>
              <h3 className="font-heading font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                Pay via {paymentMethod === 'KHALTI' ? 'Khalti' : 'eSewa'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Open your {paymentMethod === 'KHALTI' ? 'Khalti' : 'eSewa'} app and send the amount below, then confirm here.
              </p>
            </div>

            <div className="bg-sky-50 dark:bg-slate-950 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Send to</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{MANUAL_PAYMENT_NUMBER}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Amount</span>
                <span className="font-heading font-black text-base text-[#0B3C5D] dark:text-sky-300">Rs. {manualPaymentBooking.amount}</span>
              </div>
            </div>

            <button
              onClick={handleClaimPayment}
              disabled={claimingPayment}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              <span>{claimingPayment ? 'Submitting…' : "I've Sent the Payment"}</span>
            </button>
            <button
              onClick={() => router.push(`/dashboard/customer?status=success&bookingId=${manualPaymentBooking.id}`)}
              disabled={claimingPayment}
              className="text-xs text-slate-500 dark:text-slate-400 font-semibold hover:underline disabled:opacity-50"
            >
              I'll pay later from my dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
