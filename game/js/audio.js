// audio.js — WebAudio synth SFX + a looping mp3 music track. Unlocked on gesture.
let ctx = null;
let enabled = true;
let musicOn = true;

export function setEnabled(v) { enabled = v; }
export function setMusicEnabled(v) {
  musicOn = v;
  if (!v) stopMusic();
  else playMusic();
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
  splat: () => { noise(0.08, 0.07); tone(540, 0.1, 'sine', 0.11, 300); },
};

// Background music: a looping mp3 track. Plays continuously across menu and
// gameplay (started on the first navigation gesture); pauses when muted.
let musicEl = null;
export function playMusic(kind) {
  if (!musicOn) return;
  if (!musicEl) {
    musicEl = new Audio('assets/FishFriendsSong.mp3?v=1');
    musicEl.loop = true;
    musicEl.volume = 0.5;
    musicEl.preload = 'auto';
  }
  if (musicEl.paused) { const p = musicEl.play(); if (p && p.catch) p.catch(() => {}); }
}

export function stopMusic() {
  if (musicEl) { try { musicEl.pause(); } catch (e) {} }
}

// Pause the music while the app is backgrounded (browsers keep <audio> playing
// otherwise), and resume it when the app returns — but only if we're the ones
// who paused it and music is still enabled.
let _bgPausedMusic = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (musicEl && !musicEl.paused) { try { musicEl.pause(); } catch (e) {} _bgPausedMusic = true; }
    } else if (_bgPausedMusic) {
      _bgPausedMusic = false;
      if (musicOn) playMusic();
    }
  });
  // iOS/Safari can freeze a backgrounded page and fire pagehide instead.
  window.addEventListener('pagehide', () => {
    if (musicEl && !musicEl.paused) { try { musicEl.pause(); } catch (e) {} _bgPausedMusic = true; }
  });
}

