# Changelog

All notable changes to Fish Friends.

## [1.34.5] — 2026-07-24
- **Update notice on the installed app.** When you open the Android app, it now
  asks Google Play whether a newer version is available and, if so, shows a
  dismissible banner with an "Update" button that takes you to the store. Has no
  effect on the web version.

## [1.34.4] — 2026-07-22
- **Shoreline no longer bleeds into the ocean.** Clamped the shallow-water and
  foam shimmer to fade out exactly at the sand's top edge, so the effect stays
  on the beach and never washes up into the open water.

## [1.34.3] — 2026-07-22
- **Shallow water at the shore.** The strip between the foam line and the open
  ocean is a light-blue, gently-foamy band that shifts with the tide — a thin
  sheet of ocean lapping onto the beach, now clearly visible against the deeper
  water.

## [1.34.1] — 2026-07-22
- **Title screen: fish now swim both ways and pair off.** Alongside the fish
  rising from the bottom, fish now swim **down from the top**, and when an
  up-fish meets a down-fish of the **opposite colour** they become friends and
  peel off together with a little sparkle — just like in the game.
- **Circling title fish fixed.** The two little fish beside the title now
  properly **chase each other around a circle** (previously they faced the wrong
  way and looked joined at the tail), and they're sized to read clearly.
- **Smoother, subtler shoreline.** The beach wave is no longer grainy — it's a
  soft foam line with a faint wet-sand sheen, and it now stays **on the beach**
  only (no bright waterline floating out in the open ocean).

## [1.34.0] — 2026-07-13
- **Livelier beach & ocean.** The shoreline now has an animated foam waterline
  that washes up and down the sand (tide + wavelets) with a wet-sand sheen, and
  the beach is dotted with varied shells, starfish, spiral conches and pebbles.
- **Subtle ocean ambience.** Gentle swaying kelp in the bottom corners and a few
  very faint, slow-drifting distant fish silhouettes far in the background — kept
  low-contrast and slow so they never distract from play.
- **Living title screen.** Colorful fish (and opposite-color "friend" pairs) now
  drift up from the bottom behind the menus, and the fish emoji beside the title
  is replaced by two little game-style fish of opposite colors chasing each other
  in a tight circle — a blue/orange pair on the left and a red/green pair on the
  right.

## [1.33.1] — 2026-07-09
- **Boss-clear bonus.** After beating a boss, a celebration menu now rewards
  clean runs: **+6 starfish** and a "Fantastic Achievement!" if you spent **no**
  Oyster Tokens this run, or **+3 starfish** and a "Well Done!" if you spent
  **fewer than 15**. (Lean on 15+ tokens and there's no bonus.)

## [1.33.0] — 2026-07-09
- **New "Stuck?" catch-up system with Oyster Tokens 🦪.** Fail a level and a
  **Stuck?** button appears. It opens a menu that explains the deal: reset your
  progress to earn one **Oyster Token** for every 2 levels you'd reached, then
  spend them (this run only) on boosts — you only get to choose after you reset:
  - **Bonus Starfish** — +2 starfish now (max +10)
  - **Sluggish Current** — −3% enemy fish speed (max −30%)
  - **Swift Fins** — +5% your fish speed (max +50%)
  - **Fewer Special Fish** — −5% white/black/tri per level (max −25%)
  - **Calmer Seas** — −2% of all fish per level (max −20%)
  Boosts last until your next reset.

## [1.32.2] — 2026-07-08
- **Music stops when the app is in the background.** The soundtrack now pauses
  when you switch away from Fish Friends (or lock the screen) and resumes when
  you come back, instead of playing on in the background.

## [1.32.1] — 2026-07-08
- **Back-swipe no longer exits the game.** An Android edge-swipe / system Back
  used to navigate away — even in the installed app (the previous version's CSS
  couldn't stop the OS gesture). Back is now trapped: in a level it pauses, on
  other screens it steps up one screen, and it never drops you out of the app.

## [1.32.0] — 2026-07-08
- **Powerup countdown timers.** Using the Ice, Rainbow (or Squid) powerup now
  shows a circular badge in the upper right — the icon in a ring that drains as
  the effect runs out, with the seconds remaining underneath.
- **Fewer accidental "backs".** Added `overscroll-behavior: none` so an edge
  swipe on Android no longer navigates back. (On iPhone Safari the edge-swipe is
  a system gesture that a web page can't fully block — installing Fish Friends as
  an app, which runs fullscreen, removes it entirely.)
- **Auto-deploy shark help.** A "?" button next to the Auto-deploy Shark setting
  opens a short pop-up (with an ✕) explaining it: when a fish gets close to the
  beach, a shark is automatically used there to catch it.

## [1.31.2] — 2026-07-06
- The Legacy congratulations screen and the "upgrades locked" note now name the
  boss you actually beat / must beat — "🐢 The Ancient Sea Turtle swims free!"
  on a turtle run instead of always saying the Prism Whale.

## [1.31.1] — 2026-07-06
- **Sea Turtle phase 2:** his head now sticks out the front (narrow) end of his
  shell and spins around with it — attached like a real turtle — instead of just
  popping up in the middle. Hit it with its opposite as it sweeps past.

## [1.31.0] — 2026-07-06
- **Sea Turtle phase-3 rework.**
  - He now drops a little lower for the finale — sitting just below the highest
    current he stirs up.
  - The paint he flings now always draws **above** his shell.
  - About **10% more fish** stream in through the whole fight.
  - New loss: if **50** of your fish slip off the top of the screen without
    touching a splotch or making a friend, you lose (shown in the boss bar as
    ⬆️, alongside ⬇️ for fish reaching the beach). 50 gives plenty of room for
    his spinning.
  - **Finale animation:** at 1% he slowly stops spinning with his head-end
    turned up, slowly pokes his head out, and slowly swims up and off the top —
    you win the moment he's fully gone.

## [1.30.0] — 2026-07-06
- **God mode:** adjust your prestige level directly from the Legacy screen.

## [1.29.0] — 2026-07-06
- **Sea Turtle polish.**
  - A soft "poof" sound and a coloured burst now play every time a fish clears a
    paint splotch, so hits read clearly.
  - Phase-1 splotches are pulled inward so they all sit on the shell along its
    front edge (the outermost ones may share a lane with a neighbour, just further
    down — that's intentional).
  - Phase 2 now shows a **full ring of splotches around the shell edge** that
    **rotate with the shell**, sliding between lanes as it spins — many more to
    clear than before.
- **God mode: unlimited items.** With god mode on you can use the same item as
  many times as you like in a level (no per-level cap and items don't run out).

## [1.28.0] — 2026-07-06
- **Ambush Shark power reworked.**
  - Place a shark on the **beach** and it now rises normally — and because you
    have the Ambush power, a **second free shark** joins it two lanes over (to the
    right if you placed on the left half, to the left if on the right half, and a
    coin-flip side dead centre).
  - Place a shark in the **ocean** and it enters from the edge nearest your tap —
    far right if you tapped the right side, far left if you tapped the left (a
    dead-centre tap starts on the right).
  - The ocean sweep now makes **four full passes** across the row before swimming
    off, and moves a bit **slower** while going horizontal.

## [1.27.0] — 2026-07-06
- **Sea Turtle detail pass.** Rebuilt the turtle to actually look like a sea
  turtle: a brown, segmented (scute‑patterned) egg‑shaped shell with a marginal
  edge ring, green front/rear flippers and a tail, all drawn top‑down and facing
  **down** with the head tucked away in phase 1. The head now reads as a real
  turtle head — rounded with a snout, eyes and nostrils — when it pokes out.
- **Paint splotches moved to the shell's edge.** The colour splotches now ride
  the shell's front **rim** in an arc (centre dips toward you, sides curve up)
  instead of a flat line across the middle, and they're drawn as irregular paint
  **splatters** rather than clean circles. Their hit positions follow the same
  arc, so what you see is exactly what you hit.

## [1.26.2] — 2026-07-06
- **Fixed the Sea Turtle boss render.** The colour splotches never appeared on his
  shell (the renderer read the spot list from the wrong place, so zero splotch
  meshes were ever created) and the painted head drew at an invalid position.
  Both are fixed — every phase now shows its splotches and head correctly, and the
  splotch discs are sized to read as distinct spots on the shell. Verified all
  three phases + head‑out + paint‑shed + leaving render in‑browser.
- Legacy UI: moved the **⚡ Powers** button up into the top row so it no longer
  overlaps the note text, and the L50 map bubble now shows a 🐢 on turtle‑boss
  journeys (🐋 on whale journeys).

## [1.26.0] — 2026-07-06
- **New boss: the Ancient Sea Turtle!** The L50 boss now alternates each Legacy
  restart — Prism Whale on your first journey, Sea Turtle on your second, and so
  on. The turtle fills the back with a splotched shell: clear each colour splotch
  with its opposite to make it poke its painted head out, then hit the head with
  its opposite (×3 in phase 1). Phase 2 it advances and slowly spins an 18‑spot
  shell (×2 head hits). Phase 3 (25% hp) it spins fast, sheds colour‑changing
  paint, spawns two currents and self‑drains to 1% while you survive — then swims
  away for the win. Lose if 30 fish reach the beach. No timer.

## [1.25.1] — 2026-07-06
- **Harder god-mode code:** the cheat is now **`f1shyfr1ends`** (type it anywhere,
  or enter it on the Codes screen) instead of the simple `fish`.

## [1.25.0] — 2026-07-06
- **Seahorse Powers!** The Legacy menu now shows a big seahorse (brownish‑orange)
  in the corner with a **Powers** button. Each Seahorse Trophy lets you keep one
  power active — enable up to that many of five, swap them any time, they're never
  spent:
  - **Prism Dash** — friending a fish has a 50% chance to pass through as a
    rainbow fish (which never costs points at the top).
  - **Ambush Shark** — place a shark out in the ocean; it sweeps its row to one
    side then back the other way.
  - **Reef Voyager** — your fish pass through reefs, turn rainbow through
    anemones, and speed up 50% through currents.
  - **Schooling** — friending a fish brings along every same‑colour fish in its
    row (extra points included).
  - **Transmuter** — tri→black, black→white, white→plain colour, and double points
    for friending black & white fish.

## [1.24.2] — 2026-07-06
- **Patrol Shark upgrade buffed:** now +5% free-shark chance per level per
  purchase, up to **50%** (was +2% up to 20%).
- **Smarter level tips:** each level's pre-level description now reflects its
  *newest* fish or mechanic (currents, coral, anemone…) instead of always
  mentioning tri fish, and Level 50 describes the boss.

## [1.24.1] — 2026-07-06
- **Redrawn seahorse trophy** — the Legacy Seahorse Trophy icon is now a proper
  filled seahorse silhouette (trumpet snout, crowned spiky head, dorsal fin,
  coiled tail) matching a real seahorse.

## [1.24.0] — 2026-07-06
- **Real seahorse trophy icon.** The Legacy menu's Seahorse Trophies now use a
  hand-drawn SVG seahorse (matching the starfish style) instead of emoji.
- **First-boss congratulations.** Beating the Prism Whale for the first time now
  shows a celebration screen that explains the Legacy system before opening it.
- **Whale phase 3 tuning:** the split halves change colour 3× slower than the
  earlier phases, giving more time to line up both opposites.

## [1.23.1] — 2026-07-06
- **Whale boss balance:** fight fish friends swim 10% slower and there are ~25%
  fewer of them (50% fewer tri fish). The whale now creeps a step closer every
  **10s** (was 5s) without an opposite-colour hit, and retreats on 3 opposite-colour
  hits within **15s** (was 10s).

## [1.23.0] — 2026-07-06
- **Prism Whale boss reworked.** The whale now lurks at the back as a single
  two-lane creature (new top-down model, facing the beach) and **creeps one step
  closer every 5 seconds you fail to hit it** with its opposite colour (or a
  rainbow). Land **3 hits within 10 seconds to shove it back**; it also **strafes
  one lane every 10 seconds**. Its final phase splits it **half-and-half** — you
  must hit **both** sides with their own opposites within 5 seconds to damage it.
  The fight has **no timer**: you **win** at 0 HP and **lose** if the whale reaches
  the beach or **20 fish slip past you**. Anemone, currents and a reef are all
  active (they don't affect the whale), and a steady stream of fish — including
  white, black and tri-colour — keeps coming.

## [1.22.0] — 2026-07-06
- **10 new levels + a boss (now 50 levels).** The campaign runs to Level 50, which
  is a 3-phase **Prism Whale** boss fight: the whale cycles colours (per-lane in
  its final phase) — hit each body segment with its opposite to damage it; wrong
  colours heal it. HP bar shown top-of-screen.
- **New mechanic — Color-shift Anemone (L46+).** A drifting anemone repaints any
  enemy fish that crosses it, forcing a fresh read.
- **Legacy (prestige) system.** Beating the boss unlocks the **Legacy** menu:
  spend leftover starfish on permanent upgrades — Swift Fins (+player speed),
  Sluggish Tide (−enemy speed), Rainbow Instinct (rainbow-draw chance) and Patrol
  Shark (free shark at 0:30). Restart your journey any time to keep upgrades, earn
  a **Seahorse Trophy**, and face harder seas (one extra colour and mechanics 5
  levels earlier per restart). Upgrades lock until you beat the boss again.

## [1.21.0] — 2026-07-06
- **No more fish pile-ups:** enemy fish in the same lane no longer stack on or
  overtake each other. When a faster fish (e.g. a normal fish behind a slower
  white/tri fish) catches the one ahead, it holds a fixed gap and matches that
  fish's speed instead of overlapping it. Fixes visual piling in later levels.

## [1.20.0] — 2026-07-05
- **Microsoft Store ready:** upgraded the web manifest to store grade (id,
  categories, full 48→512 icon set + maskable icons, gameplay screenshots,
  language/scope), added a privacy policy page, and produced a Store submission
  kit (packaged separately) for PWABuilder → Microsoft Store.

## [1.19.1] — 2026-07-05
- **App icon fix:** the blue fish's whole tail section (not just the fin tip) now
  weaves over the orange fish, matching the orange tail — the two interlock evenly.

## [1.19.0] — 2026-07-05
- **One shark per level, including auto-deploy:** an auto-deployed shark now
  counts as your single shark for that level — it fires at most once per play, and
  once a shark (auto or manual) is used no more can be used until the next play.
- **Level ends only when the water is clear:** a level no longer ends the instant
  the timer hits zero — it waits until every enemy fish is off the screen. No new
  fish spawn after the timer ends, so the remaining ones just play out.

## [1.18.0] — 2026-07-05
- **Faster early fish:** enemy ("friend") fish swim **10% faster before Level 20**.
- **App icon tweak:** the blue fish's tail now crosses **over** the orange fish
  (the orange fish's tail still crosses over the blue), so the two interlock.

## [1.17.0] — 2026-07-05
- **Softer fish eyes:** eyes are now the fish's own colour, just slightly darker
  (no more creepy black dots).
- **Codes screen:** Settings has a **Codes** button that opens a code-entry
  screen — typing **`fish`** turns on god mode.
- **New app icon:** two opposite-coloured fish arranged like a yin-yang.

## [1.16.0] — 2026-07-05
- **New shark model:** a great-white-style shark — torpedo body with a pointed
  snout and broad shoulders, big swept pectoral fins, dorsal and pelvic fins, a
  large forked tail, two-tone grey shading and dark eyes.
- **New giant-squid model:** a proper squid — long tapered mantle with two
  triangular posterior fins, a head with two big eyes, and a crown of arms plus
  two long feeding tentacles.
- **Squid grabs its prey:** when the squid eats a fish, the nearest arm whips out
  toward it and drags the fish into the mouth.

## [1.15.0] — 2026-07-05
- **Realistic fish model:** replaced the blobby fish with a proper spindle body
  (pointed head, wide middle, thin tail base), a forked caudal tail, swept
  pectoral fins, the diagonal scale pattern, and two eyes near the head that lead
  the swim direction.

## [1.14.0] — 2026-07-05
- **Real music track:** replaced the synth loop with `FishFriendsSong.mp3`, playing
  as looping background music across the menu and gameplay (starts on your first tap,
  respects the Music setting). Audio is cached so it plays offline and isn't
  re-downloaded on every visit.

## [1.13.1] — 2026-07-05
- **Hazards start later:** water currents now begin at **Level 25** (two from L28),
  and the coral reef now begins at **Level 30**.

## [1.13.0] — 2026-07-05
- **Calmer pace:** enemy fish swim **20% slower**, and every level spawns **~10%
  fewer fish** (rows spaced a little wider). Pass/star targets scale automatically
  and all 40 levels remain 3★-clearable.

## [1.12.1] — 2026-07-05
- **Current direction arrows:** water-current bands now show a scrolling row of
  little translucent-blue arrows pointing the way the current flows, so the
  direction (and each 15s flip) is obvious at a glance.

## [1.12.0] — 2026-07-05
- **Water currents (from L23):** a subtle moving-water band in a middle row shoves
  the incoming (enemy) fish one lane sideways as they cross it, flipping direction
  every 15s. One current L23-27, **two** from L28. Sharks and the squid ignore them.
- **Coral reef (from L25):** a single grid cell (in a middle row) that blocks fish —
  your fish hit it and swim away, incoming fish stop and stack behind it. It drifts
  one lane every 10s and disintegrates 10s before the level ends. Sharks pass right
  through it; it doesn't affect the squid.
- **Rows of special fish:** whole rows of white (L30+), black (L33+) and tri-colour
  (L35+, all sharing one 3-colour pattern).
- **Shuffled palette (L30+):** your colour buttons are arranged in a random order.

## [1.11.0] — 2026-07-05
- **Level 1 is now 45 seconds** (down from 60). Level duration is now per-level
  (spawn window and pass targets scale with it); all other levels remain 60s.

## [1.10.0] — 2026-07-05
- **Auto-updating + offline:** the service worker is now **network-first** — every
  time you open the game online it pulls the freshest version (no more manual hard
  refresh), and when you're **offline it falls back to the cached copy** so you can
  still play what you've already loaded.

## [1.9.0] — 2026-07-05
- **Install App button** on the main menu: on Android/desktop Chrome it appears
  when the browser offers installation and launches the native "Add to Home
  screen" prompt (hidden once installed or when unsupported, e.g. iOS Safari —
  there a fallback toast points to the browser menu).
- **Proper PWA icons:** added dedicated 192px and 512px (incl. maskable) icons so
  the app installs cleanly with a real home-screen icon.

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
