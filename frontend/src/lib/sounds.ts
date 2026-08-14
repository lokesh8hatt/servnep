// Tiny synthesized UI sound engine — no audio files to fetch or bundle.
// Tones are generated on the fly with the Web Audio API.

export type SoundName = 'click' | 'toggle' | 'success' | 'error' | 'notify';

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  // Browsers start contexts suspended until a user gesture — every call here
  // originates from a click/keypress, so resuming is always safe.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function tone(ctx: AudioContext, freq: number, startOffset: number, duration: number, type: OscillatorType, peakGain: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + startOffset;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  switch (name) {
    case 'click':
      tone(ctx, 1050, 0, 0.055, 'sine', 0.05);
      break;
    case 'toggle':
      tone(ctx, 700, 0, 0.05, 'sine', 0.05);
      tone(ctx, 1000, 0.05, 0.07, 'sine', 0.05);
      break;
    case 'success':
      tone(ctx, 660, 0, 0.09, 'sine', 0.06);
      tone(ctx, 880, 0.09, 0.09, 'sine', 0.06);
      tone(ctx, 1175, 0.18, 0.16, 'sine', 0.06);
      break;
    case 'error':
      tone(ctx, 330, 0, 0.12, 'sawtooth', 0.045);
      tone(ctx, 220, 0.1, 0.18, 'sawtooth', 0.045);
      break;
    case 'notify':
      tone(ctx, 900, 0, 0.07, 'triangle', 0.05);
      tone(ctx, 1300, 0.08, 0.1, 'triangle', 0.05);
      break;
  }
}
