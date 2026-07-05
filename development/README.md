# Fish Friends — developer notes

**Working title decision:** the master plan called this *Counter Current*; shipped
as **Fish Friends** per the owner's brief (matched opposite-colored fish "swim off
paired off like friends"). Same design, one-word-friendly name.

Design source of truth: `../CounterCurrent/development/OPUS_MASTER_PLAN.md`.

## Run it
```
cd game
node server.cjs         # http://localhost:8123
```
Open `http://localhost:8123/index.html` (add `?debug=1` for the perf overlay).

## Test it
```
cd game
node test/run.js        # headless unit + validator + autoplay bots + determinism (4900+ asserts)
node test/smoke.cjs     # real Chromium: boot, draw, collide, render (needs server running)
node test/extended.cjs  # real Chromium: specials, shop, results, The Deep, squid
```
The browser tests use `playwright-core` against the locally-installed Chromium.

## Architecture (game/js)
- `config.js` — all tuning (colors/pairs, speeds, cooldown, thresholds, prices).
- `levels.js` — 40 authored level params + deterministic `compileLevel()` + The Deep generator.
- `sim.js` — **pure** game logic (no three.js / DOM). Ticks at 60 Hz, emits events.
- `render3d.js`, `fish_models.js`, `fx.js` — three.js layer (instanced fish, vertex-shader swim, friend swim-off, particles/floaters).
- `input.js` — pointer→lane drag/cooldown gate.
- `ui.js`, `shop.js` — DOM screen state machine + shop economy.
- `save.js`, `audio.js`, `debug.js`, `main.js` — versioned save, WebAudio SFX, perf overlay, controller + fixed-timestep loop.

## Invariants worth preserving
- `sim.js` must never import three.js or touch the DOM (keeps it headless-testable).
- A level's max score & pass target are **computed from its spawn script**, never hand-typed.
- The picker-restricted PERFECT bot must reach 3★ on every level (feasibility proof);
  NULL and GREEDY-WRONG bots must fail every level (proves color choice matters).
- Levels containing **black fish** must have a picker closed under `opposite`
  (black becomes an arbitrary picker color, then needs its opposite — see `compileLevel`).
