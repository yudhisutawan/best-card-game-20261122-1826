// Tiny WebAudio synth for Ember Pact: every sound is an oscillator, no files.
let audioCtx = null;

export function ensureAudio() {
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    } catch {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, dur, type = 'sine', gain = 0.12, when = 0) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  play() { tone(520, 0.12, 'triangle', 0.1); tone(780, 0.1, 'triangle', 0.07, 0.05); },
  hit() { tone(160, 0.18, 'sawtooth', 0.14); tone(90, 0.22, 'square', 0.08, 0.02); },
  block() { tone(300, 0.1, 'square', 0.06); },
  draw() { tone(880, 0.07, 'sine', 0.06); },
  heal() { tone(660, 0.14, 'sine', 0.08); tone(990, 0.16, 'sine', 0.06, 0.08); },
  edge() { tone(1040, 0.1, 'triangle', 0.09); tone(1318, 0.14, 'triangle', 0.08, 0.07); },
  turn() { tone(440, 0.09, 'triangle', 0.07); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.11, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, i * 0.14)); },
  click() { tone(700, 0.05, 'square', 0.05); },
};
