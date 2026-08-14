'use client';

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/context/SoundContext';

export function SoundToggle({ className = '' }: { className?: string }) {
  const { soundEnabled, toggleSound } = useSound();

  return (
    <button
      type="button"
      data-no-sound
      onClick={toggleSound}
      aria-label={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
      title={soundEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
      className={`p-1.5 sm:p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 ${className}`}
    >
      {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}
