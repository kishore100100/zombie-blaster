// All sound is synthesized with WebAudio - no audio files.
let ctx = null, master = null, noiseBuf = null, volume = 0.5;

/** Master volume, 0..1. */
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function tone(freq, dur, { type = 'sine', vol = 0.2, to = null, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.2, freq = 1200, to = null, q = 1, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = 'bandpass'; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t); s.stop(t + dur + 0.02);
}

export const sfx = {
  shoot() { noise(0.09, { vol: 0.16, freq: 2600, to: 700, q: 2 }); tone(720 + Math.random() * 120, 0.08, { vol: 0.07, to: 300 }); },
  hit() { tone(420 + Math.random() * 160, 0.07, { type: 'triangle', vol: 0.13, to: 180 }); noise(0.06, { vol: 0.08, freq: 900 }); },
  pop() { tone(240, 0.16, { vol: 0.22, to: 980 }); noise(0.12, { vol: 0.1, freq: 1800, to: 500, delay: 0.05 }); },
  hurt() { tone(170, 0.22, { type: 'sawtooth', vol: 0.18, to: 60 }); },
  jump() { tone(300, 0.14, { vol: 0.08, to: 620 }); },
  dodge() { noise(0.18, { vol: 0.1, freq: 500, to: 2200 }); },
  empty() { tone(140, 0.05, { type: 'square', vol: 0.06 }); },
  reload() { noise(0.35, { vol: 0.09, freq: 400, to: 2400, q: 3 }); tone(520, 0.08, { vol: 0.08, delay: 0.35 }); },
  combo(n) { tone(440 * Math.pow(1.06, Math.min(n, 16)), 0.1, { type: 'triangle', vol: 0.1 }); },
  power() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.07, delay: i * 0.07 })); },
  splash() { noise(0.6, { vol: 0.3, freq: 300, to: 2400, q: 0.7 }); tone(90, 0.5, { vol: 0.25, to: 40 }); },
  wave() { [392, 523].forEach((f, i) => tone(f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.14 })); },
  victory() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.13, delay: i * 0.13 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.13, delay: i * 0.2 })); },
  coin() { tone(988, 0.06, { type: 'square', vol: 0.05 }); tone(1319, 0.12, { type: 'square', vol: 0.05, delay: 0.06 }); },
};
