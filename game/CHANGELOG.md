# Changelog

All notable changes to Fish Friends.

## [1.8.0] — 2026-07-05
- **Friendlier copy:** pre-level hint now says "Touch, or touch and drag, on the
  beach to draw fish…"; Ice Cube reads "all fish friends swim at half speed";
  Rainbow reads "your fish become friends with fish of any color".
- **Own up to 4** of each item (inventory cap 3 → 4).

## [1.7.1] — 2026-07-05
- **Shark Autodeploy checkbox** added directly to the Shark card in the shop,
  synced with the Settings toggle.

## [1.7.0] — 2026-07-05
- **No draw cooldown:** you can now create fish as fast as you want — the launch
  recharge is disabled and its bar is hidden. Levels re-paced accordingly (rows
  spaced by their minimum gap); all 40 re-validated and still 3★-clearable.

## [1.6.0] — 2026-07-04
- **Squid now scores:** the Giant Squid gives **+1 point for every 2 fish** it eats
  (was 0). Shark still eats every fish in its lanes for **full value**.
- **Per-level item limits:** you may use a **max of 3 items per level**, and **each
  item only once** per level. Used / over-limit items grey out in the dock. (The
  Deep is unrestricted.)
- **Sharks come in pairs:** buying a Shark in the shop now gives **×2**.
- **Special fish scoring** confirmed at white = 2, black = 2, tri = 3 points total
  (awarded per correct hit), and level max-scores reflect this.
- **GitHub Pages ready:** added a root redirect `index.html` → `game/index.html`
  plus `.nojekyll`, so the repo can be served directly from Pages.

## [1.5.1] — 2026-07-04
- **Starfish icon redesign:** the currency/rating icon now looks like an actual
  chunky sea-star (fat rounded arms + spots) instead of a plain sharp star.

## [1.5.0] — 2026-07-04
- **Auto-deploy shark setting:** new Settings toggle "Auto-deploy shark near
  bottom". When on, if an enemy comes within **~1 second** of reaching the bottom
  and you have a shark in your inventory, a shark is automatically launched in that
  lane (consuming one). Verified it eats the threatened fish before it can leak.
- **Smaller octopus:** the Giant Squid is now wider and flatter with a shorter
  tentacle fan — it spreads across the lanes but no longer reaches the bottom.

## [1.4.0] — 2026-07-04
- **Faster complexity ramp** (rebuilt the level table around an explicit schedule):
  colors reach **3 by L4, 4 by L6, 5 by L8, all 6 by L10**; **white fish from L12**,
  **black fish from L14**, **tri-color fish from L20**. Speed / row-size / gap now
  ramp smoothly per level. All 40 levels re-validated (perfect bot 3★, APM guard,
  soft-lock guard, determinism all green).

## [1.3.0] — 2026-07-04
- **Rendered shark:** the Shark power-up is now a big grey 3-lane shark that swims
  **up** like a fish at **half a fish's speed**, eating every fish in its lanes for
  full points (procedural model: snout, torpedo body, pectoral fins, forked tail).
- **Rendered octopus:** the Giant Squid now draws a purple mantle + tentacle fan
  spanning the interior lanes while active.
- **Wasted-fish penalty:** for every **2** player fish that miss and swim off the
  top, you lose **1 point** (with a floating −1).
- **God mode anywhere:** typing **`fish`** now toggles god mode on the **main menu**
  and level map too (not just in a level), reflecting instantly.
- **Level select:** added a **🏠 main-menu** button.
- **The Deep** is now **hidden** (not just greyed) until it's unlocked.
- **Settings:** added a **🗑️ Delete All Data** button (with confirm) to start fresh.

## [1.2.0] — 2026-07-04
- **God mode (cheat):** type **`fish`** while in a level to toggle god mode —
  unlimited starfish to spend (shows ∞), all 40 levels + The Deep unlocked so you
  can jump to any level, and shop purchases are free and ignore the stack cap.
  Type `fish` again to turn it off. (Session-only; not saved.)
- **Starfish currency icon:** replaced the star emoji/★ glyphs everywhere (map,
  shop, results, level ratings) with a proper inline-SVG **starfish**.

## [1.1.1] — 2026-07-04
- **Fixed enemy fish orientation:** a missing render argument made descending
  enemies face *up* (same as the player). Enemies now correctly point **down**
  (head-down, tail trailing up) so their travel direction reads at a glance.

## [1.1.0] — 2026-07-04 (Alpha1 feedback pass)
- **One-minute levels:** level duration 120s → 60s (spawn window 105s → 50s); HUD starts at 1:00.
- **Faster power-ups:** timed items halved — Ice 30→15s, Rainbow 30→15s, Squid 60→30s.
- **Tighter columns:** +50% lanes (5→8, 6→9, 7→11; The Deep → 11) so fish pack closer together.
- **Rows of fish:** from Level 2 on, enemies arrive as contiguous blocks of 2-3 same-colored fish (larger rows use contiguous same-color runs).
- **Cuter fish:** new procedural model — plump rounded body, forked caudal tail fin, dorsal fin, and two pectoral side fins (rendered double-sided).
- **Rebalanced specials** for the shorter levels; APM guardrail now measured against the full 60s play window. All 40 levels re-validated: perfect bot still 3★s every level; determinism, bots, and soft-lock guards green.

## [1.0.0] — 2026-07-04
Initial build. Full six-phase implementation from the Counter Current master plan.

### Core (Phase 1)
- Invisible lane grid (5/6/7 lanes), drag-to-draw fish on the seabed strip.
- Row cooldown `0.4s + 0.35s/fish`, radial recharge, grey-ghost denial.
- 1D per-lane collision, +1 pairing / −1 leak (score floor 0), 120s clock.
- Instanced 3D fish with vertex-shader swim animation, debug overlay `?debug=1`.

### Colors + levels (Phase 2)
- Fixed opposite pairs Blue↔Orange, Red↔Green, Yellow↔Purple with shared fin
  patterns (stripes/dots/chevrons) for colorblind readability.
- Sticky color picker; 40 authored levels + pre-level cards, results, starfish.
- Wrong-color meetings weave past with a soft blub.

### Shop + power-ups (Phase 3)
- Stacking inventory (cap 3), tap-to-use dock: 🧊 Ice 2★, 🦈 Shark 3★,
  🌈 Rainbow 5★, 🦑 Squid 6★. Squid kills award 0; shark awards full value.

### Specials (Phase 4)
- White (L20, 0.6×), Black (L25), Tri-color (L30, 0.8×) state machines;
  rainbow advances specials one step.

### The Deep (Phase 5)
- Endless generator, depth meter, life-based end, +1★ per 100m.

### Polish (Phase 6)
- WebAudio SFX + ambient music, FTUE hints, settings (patterns, reduced motion,
  mirror layout, sfx/music), PWA manifest + service worker, portrait rotate gate.

### Testing
- Headless `sim.js`; 4700+ assertions: color table, collisions, special state
  machines, cooldown, power-up rules, level validator (max score / pass target /
  spawn window / APM guardrail), autoplay bots (perfect 3★, null fail,
  greedy-wrong fail) on all 40 levels, and determinism.
