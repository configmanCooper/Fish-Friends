# Fish Friends 🐟

A one-thumb, portrait HTML5 + three.js arcade game. Rows of enemy fish swim **down**;
you drag along the seabed to draw fish that swim **up**. Match a fish with its
**opposite color** and the two pair off and swim away as friends (+1). Let an enemy
reach the sand and you lose a point. Clear levels to earn **starfish**, then spend
them in the shop on power-ups.

> Built with vanilla JavaScript + three.js — **no build step**. Open `game/index.html`
> in a browser (served over http) and play.

## Play

```bash
cd game
node server.cjs          # http://localhost:8123
```

Then open <http://localhost:8123/index.html>. Add `?debug=1` for a perf overlay.
It's portrait-first — narrow the window (or use device emulation) for the intended
layout.

### How to play
- **Draw:** drag across the sandy seabed strip to create a row of fish.
- **Colors are opposite pairs:** Blue ↔ Orange, Red ↔ Green, Yellow ↔ Purple
  (each pair shares a fin pattern for colorblind readability). A fish is only
  destroyed by its **opposite**; wrong colors weave past.
- **Specials:** white → hit twice with the same color; black → a color then its
  opposite; tri-color → counter the **front** band first.
- **Power-ups:** 🧊 Ice, 🦈 Shark, 🌈 Rainbow, 🦑 Giant Squid.
- **The Deep:** endless mode after Level 40.

## Project layout
- `game/` — the game (ES-module JS, `js/`, `css/`, vendored three.js, PWA files).
  - `js/sim.js` — pure game logic (no three.js / DOM), unit-tested headlessly.
  - `js/render3d.js`, `js/fish_models.js`, `js/fx.js` — three.js presentation.
  - `js/levels.js`, `js/config.js` — data-driven levels & tuning.
  - `test/` — headless test suite + Playwright browser tests.
- `development/` — design notes and the master plan.

## Tests

```bash
cd game
node test/run.js         # 2600+ headless assertions: units, level validator,
                         # autoplay bots on all 40 levels, determinism
```

Browser tests (`test/*.cjs`) drive the real game in Chromium via `playwright-core`.

## License
All rights reserved (personal project).
