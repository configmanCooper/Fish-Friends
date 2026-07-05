// audio.js — tiny WebAudio synth SFX (no asset files). Unlocked on first gesture.
let ctx = null;
let enabled = true;
let musicGain = null;
let musicOn = true;
let musicNodes = [];

export function setEnabled(v) { enabled = v; }
export function setMusicEnabled(v) {
  musicOn = v;
  if (!v) stopMusic();
}

export function unlock() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
  if (!ctx || !enabled) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(now); osc.stop(now + dur + 0.02);
}

function noise(dur, vol = 0.2) {
  if (!ctx || !enabled) return;
  const now = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g); g.connect(ctx.destination);
  src.start(now);
}

export const sfx = {
  draw: () => tone(300, 0.06, 'triangle', 0.08),
  launch: () => tone(420, 0.12, 'triangle', 0.12, 620),
  pop: () => { tone(660, 0.12, 'sine', 0.18, 990); },
  weave: () => tone(240, 0.1, 'sine', 0.06, 180),
  leak: () => { noise(0.2, 0.18); tone(160, 0.2, 'sawtooth', 0.1, 90); },
  transform: () => tone(520, 0.18, 'square', 0.1, 880),
  star: () => tone(880, 0.2, 'sine', 0.16, 1320),
  buy: () => tone(600, 0.1, 'triangle', 0.12, 800),
  shark: () => { noise(0.4, 0.22); tone(120, 0.4, 'sawtooth', 0.12, 60); },
  squid: () => tone(180, 0.5, 'sine', 0.12, 120),
  deny: () => tone(200, 0.08, 'sine', 0.06, 160),
};

export function playMusic(kind) {
  if (!ctx || !musicOn) return;
  stopMusic();
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.05;
  musicGain.connect(ctx.destination);
  // simple ambient arpeggio loop
  const scale = kind === 'game' ? [220, 277, 330, 440] : [196, 247, 294, 392];
  let i = 0;
  const step = () => {
    if (!musicGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = scale[i % scale.length] * (i % 8 < 4 ? 1 : 1.5);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    o.connect(g); g.connect(musicGain);
    o.start(now); o.stop(now + 0.55);
    i++;
    musicNodes.push(setTimeout(step, 480));
  };
  step();
}

export function stopMusic() {
  for (const t of musicNodes) clearTimeout(t);
  musicNodes = [];
  if (musicGain) { try { musicGain.disconnect(); } catch (e) {} musicGain = null; }
}
