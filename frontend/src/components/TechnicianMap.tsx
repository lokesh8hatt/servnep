'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchApi } from '@/lib/api';

// Leaflet's default marker icon paths resolve relative to the page URL and
// break under Next.js/webpack bundling unless pointed at absolute URLs.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

interface TechnicianLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

export default function TechnicianMap({ bookingId }: { bookingId: string }) {
  const [position, setPosition] = useState<TechnicianLocation | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const loc = await fetchApi(`/bookings/${bookingId}/technician-location`);
        if (!cancelled) setPosition(loc);
      } catch {
        // Keep showing the last known position rather than erroring the card.
      } finally {
        if (!cancelled) setChecked(true);
      }
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookingId]);

  if (!checked) return null;

  if (!position) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-sky-50 dark:bg-slate-950 p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
        Waiting for the technician to share their location…
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-48 relative z-0">
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[position.lat, position.lng]} />
        <Recenter lat={position.lat} lng={position.lng} />
      </MapContainer>
    </div>
  );
}
