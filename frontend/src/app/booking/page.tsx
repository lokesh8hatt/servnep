'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import { MapPin, Calendar, Clock, CreditCard, ChevronRight, ShoppingBag } from 'lucide-react';

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
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
      if (data.length > 0) {
        setSelectedService(data[0]);
        if (data[0].categories.length > 0 && data[0].categories[0].items.length > 0) {
          setSelectedItem(data[0].categories[0].items[0]);
        }
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

    if (paymentMethod === 'ESEWA') {
      try {
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
      } catch (err) {
        console.error('eSewa error: ', err);
        router.push(`/dashboard/customer?status=success&bookingId=${bookingResult.id}`);
      }
    } else if (paymentMethod === 'KHALTI') {
      const khaltiResponse = await fetchApi('/payments/khalti/initiate', {
        method: 'POST',
        body: JSON.stringify({ bookingId: bookingResult.id }),
      });
      window.location.href = khaltiResponse.payment_url;
    } else {
      router.push(`/dashboard/customer?status=success&bookingId=${bookingResult.id}&msg=cash_confirmed`);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-semibold">
        Loading services catalog...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-[#0B3C5D] text-white p-2 rounded-lg text-xs font-black">SN</div>
          <span className="font-heading font-extrabold text-lg text-[#0B3C5D]">ServeNep Booking</span>
        </Link>
        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
          Step {step} of 3
        </div>
      </header>

      <div className="h-1 bg-slate-100 w-full">
        <div className={`h-full bg-[#328CC1] transition-all duration-300 ${
          step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'
        }`}></div>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="md:col-span-2 space-y-6">
          
          {step === 1 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs space-y-6">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] flex items-center gap-2">
                <ShoppingBag size={20} className="text-[#328CC1]" />
                <span>Select Service Item</span>
              </h2>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Service Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleServiceChange(s.id)}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                        selectedService.id === s.id
                          ? 'border-[#328CC1] bg-[#328CC1]/5 text-[#328CC1]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Select Category</label>
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {selectedService.categories.map((cat: any) => (
                    <div
                      key={cat.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50"
                    >
                      <h4 className="font-bold text-sm text-slate-800">{cat.name}</h4>
                      <p className="text-xs text-slate-500">{cat.description}</p>
                    </div>
                  ))}
                </div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Available Tasks</label>
                <div className="space-y-3">
                  {selectedService.categories.flatMap((cat: any) => cat.items).map((it: any) => (
                    <div
                      key={it.id}
                      onClick={() => setSelectedItem(it)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${
                        selectedItem.id === it.id
                          ? 'border-[#328CC1] bg-[#328CC1]/5 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{it.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{it.description}</p>
                      </div>
                      <span className="font-heading font-black text-sm text-[#0B3C5D]">Rs. {it.basePrice}</span>
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
            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs space-y-6">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] flex items-center gap-2">
                <MapPin size={20} className="text-[#328CC1]" />
                <span>Service Address & Schedule</span>
              </h2>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Service City</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Kathmandu', 'Lalitpur', 'Bhaktapur'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCity(c)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                        city === c
                          ? 'border-[#328CC1] bg-[#328CC1]/5 text-[#328CC1]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. Lazimpat Rd, Ward 2, near Standard Chartered Bank"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-[#328CC1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar size={14} /> Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-[#328CC1]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Clock size={14} /> Time Slot
                  </label>
                  <select
                    value={scheduledSlot}
                    onChange={(e) => setScheduledSlot(e.target.value)}
                    title="Time Slot"
                    aria-label="Time Slot"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-[#328CC1]"
                  >
                    <option value="09:00 AM - 11:00 AM">09:00 AM - 11:00 AM</option>
                    <option value="11:00 AM - 01:00 PM">11:00 AM - 01:00 PM</option>
                    <option value="01:00 PM - 03:00 PM">01:00 PM - 03:00 PM</option>
                    <option value="03:00 PM - 05:00 PM">03:00 PM - 05:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between pt-4">
                <div>
                  <h4 className="text-sm font-bold text-red-950">Need urgent dispatch?</h4>
                  <p className="text-xs text-red-700 mt-0.5">Technician arrives within 30 minutes.</p>
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
            <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs space-y-6">
              <h2 className="font-heading text-xl font-extrabold text-[#0B3C5D] flex items-center gap-2">
                <CreditCard size={20} className="text-[#328CC1]" />
                <span>Confirm & Pay</span>
              </h2>

              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                <div className="space-y-3">
                  {[
                    { key: 'CASH', name: 'Cash on Service Completion', desc: 'Pay directly to technician' },
                    { key: 'ESEWA', name: 'eSewa Digital Wallet', desc: 'Pay instantly via eSewa secure login' },
                    { key: 'KHALTI', name: 'Khalti Mobile SDK', desc: 'Pay instantly via Khalti secure gateway' },
                  ].map((p) => (
                    <div
                      key={p.key}
                      onClick={() => setPaymentMethod(p.key as any)}
                      className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        paymentMethod === p.key
                          ? 'border-[#328CC1] bg-[#328CC1]/5'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        paymentMethod === p.key ? 'border-[#328CC1] bg-[#328CC1]' : 'border-slate-300'
                      }`}>
                        {paymentMethod === p.key && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => setStep(2)} className="btn-outline w-1/3">Back</button>
                <button onClick={handleBookingSubmit} className="btn-primary flex-1">Book & Confirm</button>
              </div>
            </div>
          )}

        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-xs space-y-6">
            <h3 className="font-heading font-extrabold text-sm text-slate-800 uppercase tracking-wider">
              Booking Invoice
            </h3>
            
            <div className="space-y-4 text-xs font-semibold text-slate-600 border-b pb-4">
              <div className="flex justify-between">
                <span>Task:</span>
                <span className="text-slate-900 font-bold">{selectedItem.name}</span>
              </div>
              <div className="flex justify-between">
                <span>City Location:</span>
                <span className="text-slate-900">{city}</span>
              </div>
              <div className="flex justify-between">
                <span>Base Cost:</span>
                <span className="text-slate-900 font-bold">Rs. {selectedItem.basePrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee:</span>
                <span className="text-slate-900">Rs. 50</span>
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
    </div>
  );
}
