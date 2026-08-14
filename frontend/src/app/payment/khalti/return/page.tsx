'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function KhaltiReturnPage() {
  const router = useRouter();
  const [state, setState] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying your Khalti payment…');
  const [bookingId, setBookingId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pidx = params.get('pidx');
    const bid = params.get('bookingId') || '';
    setBookingId(bid);

    if (!pidx) {
      setState('failed');
      setMessage('The Khalti payment was cancelled or did not complete.');
      return;
    }

    fetchApi('/payments/khalti/verify', {
      method: 'POST',
      body: JSON.stringify({ pidx }),
    })
      .then(() => {
        setState('success');
        setMessage('Payment confirmed! Redirecting to your dashboard…');
        setTimeout(() => router.push(`/dashboard/customer?status=success&bookingId=${bid}`), 1500);
      })
      .catch((err: any) => {
        setState('failed');
        setMessage(err.message || 'Could not verify the Khalti payment.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-sky-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg max-w-sm w-full text-center space-y-4">
        {state === 'verifying' && <Loader2 size={40} className="mx-auto text-[#328CC1] animate-spin" />}
        {state === 'success' && <CheckCircle2 size={40} className="mx-auto text-emerald-500" />}
        {state === 'failed' && <XCircle size={40} className="mx-auto text-red-500" />}

        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</p>

        {state === 'failed' && (
          <button
            onClick={() => router.push(`/dashboard/customer${bookingId ? `?bookingId=${bookingId}` : ''}`)}
            className="btn-primary w-full"
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
