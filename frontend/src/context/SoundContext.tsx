'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { playClickSound } from '@/lib/sounds';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const STORAGE_KEY = 'sn_sound_muted';

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    setSoundEnabled(localStorage.getItem(STORAGE_KEY) !== '1');
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? '0' : '1');
      return next;
    });
  }, []);

  // Delegated listener: gives every button/link/checkbox/select in the app a
  // soft click sound without touching each component's onClick individually.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!soundEnabledRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const interactive = target.closest(
        'button, a, [role="button"], input[type="checkbox"], input[type="radio"], select',
      ) as HTMLButtonElement | null;
      if (!interactive) return;
      if (interactive.hasAttribute('data-no-sound') || interactive.disabled) return;
      playClickSound(true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound(): SoundContextType {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within a SoundProvider');
  return ctx;
}
