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

## Privacy Policy

**Publisher:** Cooper Unlimited Games · **Effective date:** July 6, 2026 · **Contact:** rocmat21@gmail.com

Fish Friends does not collect, transmit, store on any server, or share any
personal information. The game runs entirely on your device and can be played
completely offline.

- **Information we collect: none.** Fish Friends does not collect or process any
  personal data. It does not ask for your name, email, location, or contacts, and
  has no user accounts. It uses no analytics, advertising, tracking technologies,
  cookies, or third‑party data‑collecting SDKs.
- **Data stored on your device.** The app saves your game progress and settings
  (level completion, starfish, options) **locally on your device only**. This
  information never leaves your device and is used solely to let you continue
  playing. You can remove it at any time by clearing the app's data or
  uninstalling the app.
- **No accounts, ads, or purchases.** There is no sign‑in, no advertising, and no
  in‑app purchases. The app is a one‑time purchase.
- **Network use.** The game requires no internet connection and does not send or
  receive personal data over the network. All game content is included in the app.
- **Children's privacy.** Fish Friends is suitable for all ages and does not
  knowingly collect any personal information from anyone, including children.
  Because the app collects no data, no parental consent is required and there is
  nothing to disclose under COPPA or GDPR.
- **Third parties.** We do not share, sell, or disclose any information to third
  parties, because we do not collect any.
- **Security.** No personal data is collected or transmitted, so there is none on
  a server to secure. Any locally stored game data is protected by your device's
  own security.
- **Your rights.** As we hold no personal data about you, there is nothing to
  access, correct, export, or delete on our side. Data on your device is fully
  under your control.
- **Changes to this policy.** If this policy changes, we will update the effective
  date above and post the revised policy here.

Questions about this policy can be sent to **Cooper Unlimited Games —
rocmat21@gmail.com**.

## License
All rights reserved (personal project).
