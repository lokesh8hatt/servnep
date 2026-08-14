'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { playSound, SoundName } from '@/lib/sounds';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  play: (name: SoundName) => void;
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
      // Play on the transition to "on" so the toggle itself gives feedback.
      if (next) playSound('toggle', true);
      return next;
    });
  }, []);

  const play = useCallback((name: SoundName) => {
    playSound(name, soundEnabledRef.current);
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
      playSound('click', true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, play }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound(): SoundContextType {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within a SoundProvider');
  return ctx;
}
