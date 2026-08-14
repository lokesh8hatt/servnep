// Tiny synthesized click sound — no audio file to fetch or bundle.

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  // Browsers start contexts suspended until a user gesture — every call here
  // originates from a click, so resuming is always safe.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playClickSound(enabled: boolean) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1050, start);

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.05, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.075);
}
