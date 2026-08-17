# Cosmic Interceptor — Game Document

## 1. What the game is

**Cosmic Interceptor** is a Galaga-style arcade shoot-'em-up built in React + Canvas (TypeScript). You fly a jet along the bottom of the screen, clear three descending waves of enemy grunts, then fight a mothership boss with a two-part attack pattern.

It began as a portfolio 404 page, was promoted to a standalone game, and now ships as a static site on Vercel.

### Why it isn't called "Space Invaders"

**SPACE INVADERS is a live registered trademark of Taito Corporation** (USPTO serial 88984221, registered 2022-10-04) covering *Education & Entertainment Services* — the class a browser game falls into. Taito also holds registrations on the alien sprite bitmaps themselves. The name is not usable.

Rejected alternatives, all verified by search:

| Candidate | Why not |
|---|---|
| Void Invaders | Existing Steam shoot-'em-up (2015, VoidDev), same genre |
| Orbital Decay | Existing Steam title |
| Galaxy Shooter / Galaxy Raiders | Both heavily used; "Galaxy" also sits beside Namco's Galaxian/Galaga |
| Nova Strike | 2023 Nacon/Sanuk Steam release — vertical shooter, waves, final boss |
| Space Aircraft / Void Shooter | Trademark-safe but generic; "aircraft" is also wrong for vacuum |

**The sprites carry no resemblance to Taito's aliens.** Theirs are 8×8–12×8 single-colour organisms with tentacles, claws and splayed legs, plus a flat wide saucer. Ours are 30×19, 40×18 and 56×64 multi-colour *vehicles* — a delta-wing jet, a swept-wing fighter, and a legged mech. The boss is 0.88:1 portrait where Taito's mystery ship is 2.3:1 landscape.

Retitling is a one-line change to `TITLE`; `"\n"` splits lines and the block auto-fits.

---

## 2. Screens

| Screen | Behaviour |
|---|---|
| **Entry** | Wordmark over the starfield only — no HUD, no ship, no waves. Terminal-style `PRESS ENTER TO START` (`TAP TO START` on mobile) with a blinking block cursor. Enter, Space or a tap begins the run. |
| **Play** | Waves 1–3, then the boss. HUD returns: score top-left, wave top-centre, lives top-right. |
| **Game over** | `GAME OVER` in red, `SCORE`, `REACHED WAVE n` / `FINAL BOSS`, retry prompt, and a 15-second countdown that auto-restarts at zero. |
| **Win** | `MISSION COMPLETE` in gold, `SCORE`, `LIVES LEFT`, same prompt and countdown. |

Both endings share one renderer (`drawResultScreen`), one countdown and one restart path, differing only in wordmark, palette and stat rows. Neither uses a DOM overlay — everything is drawn on the canvas.

The countdown is measured in **wall-clock time**, not frames, because it is user-visible and would otherwise read 7.5s on a 120 Hz display.

### Wordmark rendering

A 5×7 blocky font (`FONT5X7`, uppercase A–Z plus space) drawn in two passes, matching the Claude Code wordmark:

1. **Outline pass** — an offset copy drawn as a *hollow silhouette*: each lit cell contributes only the edges facing a dark neighbour, so adjacent cells fuse into a single contour. Unfilled, so the background reads through it.
2. **Fill pass** — the solid glyph on top, cells inset by `gap` so the block grid stays visible.

Only the down-right sliver of the outline survives, which is what produces the poster look. No digits in the font — stat values use Courier.

---

## 3. Controls

- **Move** — arrow keys or A/D on desktop; drag on mobile (the ship eases toward your finger at `0.30`).
- **Fire** — automatic *while a control is held*: a move/fire key on desktop (arrows, A/D, Space, ArrowUp), or touch on mobile. Releasing everything stops the shooting.
- **Mute** — the speaker button left of the score, or the **M** key.
- Click the game once so it has keyboard focus.

Held keys are released on `blur` and `visibilitychange`, and touch is released on `touchcancel` — without these, focus lost mid-hold leaves a key stuck down and pins the ship to a wall.

---

## 4. Audio

Synthesized with Web Audio — **no asset files**, so the component stays portable. One lazily-created `AudioContext`, resumed on the first keypress or on unmute, since browsers block audio before a user gesture.

| Cue | Sound |
|---|---|
| Player shot | Square wave, 880→320 Hz over 70 ms |
| Enemy / boss shot | Sawtooth, 240→90 Hz over 120 ms. Boss side cannons fire one cue per salvo, not per barrel |
| Win | Rising C–E–G–C arpeggio, last note held |
| Lose | Two detuned voices sliding to the floor — a power-down |

Muting flips a flag inside the sfx closure, so the game loop can fire-and-forget without touching React state. The win/lose cues fire from the `overStart === 0` guard, which doubles as a once-guard so they cannot retrigger every frame.

---

## 5. Boss attack — two parts, split at 50 % HP

- **Part 1 · SIDE CANNONS (>50 %)** — the two red side cannons fire aimed red bolts.
- **Part 2 · OVERDRIVE (<50 %)** — side cannons fire faster *and* the boss telegraphs three lanes, **freezes for ~2 s**, then fires three orange beams at once (centre barrel + both side cannons). Brief invulnerability after each hit stops a sustained beam draining every life.

---

## 6. Customizable parameters

### Boss
| Parameter | Meaning |
|---|---|
| `BOSS_PX = 3.6 * sc` | Boss sprite pixel scale; everything boss-related is in `bp` units |
| `bossPart()` `0.5` threshold | HP fraction where Part 2 begins |
| `sideCD` 32 / 22 | Side-cannon interval (frames), Part 1 / Part 2. Lower = faster |
| `CORE_CHARGE = 55` | Beam charge / telegraph length (frames) |
| `BEAM_TIME = 120` | Beam duration **and** boss-freeze length (~2 s) |
| `coreCD = rand(6,9)*60` | Cooldown between beams (≈6–9 s) |
| `muzzleY = m.y + 14*bp` | Centre-beam origin (smaller = higher up the barrel) |
| `sidePod = 25*bp`, `sideY = m.y - 4*bp` | Side-cannon / side-beam origin |
| beam widths `3*bp` / `2*bp` | Centre / side beam width — keep visual and damage equal |
| `hbW = 26*bp, hbH = 54*bp` | Boss central hitbox (arms don't take hits) |
| `hp/maxHp = 30` | Boss health in hits; the 50 % split is `hp/maxHp` |

### Player & feel
| Parameter | Meaning |
|---|---|
| `SPEED = 1.5` | **Global speed multiplier** — scales move, bullets, boss drift, wave march/sink, fire rate. `1` = original pace |
| `INVULN = 60` | Player i-frames after any hit (frames) |
| `fireCD = round(14 / SPEED)` | Auto-fire interval (frames); lower = faster |
| `spd = 5*sc*SPEED` | Keyboard move speed |
| pointer ease `0.30` | Mobile drag follow speed (higher = snappier) |
| `MAX_LIVES = 5` | Starting lives (hearts) |
| `bspd = 9*sc`, `espd = 4*sc` | Player-bullet / enemy-bullet base speed |

### Presentation
| Parameter | Meaning |
|---|---|
| `TITLE` | Wordmark text; `"\n"` splits lines, block auto-fits width and height |
| `TITLE_FILL` / `TITLE_EDGE` | `#db6d24`, the player jet's own orange. Same value — the offset copy is outline-only |
| `OVER_FILL` / `WIN_FILL` | `#ff2e4d` danger red / `#e8b53a` victory gold |
| `GAMEOVER_SECS = 15` | Auto-restart countdown on both endings |
| `MUTE_BTN = 30` | Speaker button size in CSS px at `sc = 1`; `muteBox()` scales it and the score clears it |
| `VISUAL_PAUSE` | `false` = play. `true` = static preview with the ◀▶ wave/boss switcher (dev tool) |

### Layout
| Parameter | Meaning |
|---|---|
| `scaleFor()` | The `sc` scale, shared by `initGame` and the render pass so the DOM button lines up with the canvas HUD |
| desktop `sc = min(W/900, H/560)` | Fits width and height so a wide window doesn't oversize sprites |
| mobile `sc = (W/360)*0.85` | Mobile scale |
| `getDims()` | Full viewport on every device |

The mobile entry screen pins the prompt a fixed **32 px** below the wordmark; the desktop keeps a proportional placement at `H*0.74`. A tall phone viewport made the proportional gap read far too wide.

---

## 7. Files

Single-source-of-truth build. `Invaders.tsx` is the **only** game file.

- **`Invaders.tsx`** — the entire game. `VISUAL_PAUSE = false`. Passes `tsc --strict`.
- **`src/main.tsx`** — Vite entry. Imports `../Invaders.tsx` **with the extension on purpose**: Vite's resolver tries `.jsx` before `.tsx`, so a bare `"../Invaders"` would silently bundle a `.jsx` twin if one ever reappears. Do not drop the extension.
- **`index.html`**, **`vite.config.ts`**, **`tsconfig.json`** — Vite scaffold.
- **`GAME_DOC.md`** — this document.
- **`COMMITS.md`** — the pre-git checkpoint log. Git history is authoritative for everything after the initial import.

The earlier `.jsx` twin, `Invaders_Framer.*`, `Invaders_Demo.*` and `BossArena.*` were **deleted** once the project committed to a single-file Vercel deploy — they had diverged and the `.jsx` twin was a live resolver hazard. Recover any of them from git history if needed, e.g. `git show b6b0285:Invaders_Framer.tsx`.

---

## 8. Development notes

```bash
npm run dev
```

```bash
npm run build
```

Two traps worth knowing:

- **`useRef` survives Vite Fast Refresh.** After editing the sfx factory, the old object persists and you get `sfxRef.current.lose is not a function`. Hard-reload rather than trusting HMR.
- **A hidden tab freezes `requestAnimationFrame` entirely**, so the game loop never ticks and the canvas stays blank. To drive it programmatically, patch `requestAnimationFrame` to capture the callback and pump it synchronously, with a stubbed `performance.now` for the time-based countdown.

---

## 9. Next steps

1. **Deploy to Vercel** — the build is ready; only hosting setup remains.
2. **Verify the win screen by eye.** Its countdown, restart and layout are shared with the game-over screen and verified, but the gold palette and `MISSION COMPLETE` wordmark have not been seen rendered — scripted play could not beat the boss.
3. **Background depth** — the flat starfield could use parallax layers or a nebula gradient, without distracting from bullets and beams.
4. **Difficulty & scoring polish** — tune `INVULN`, `coreCD` and `BEAM_TIME` against real play-testing; consider a score multiplier or best-score display.
5. **More audio** — hit, explosion, beam-charge and beam-fire cues would fill out the mix now that the harness exists.

### Open tuning question

At `INVULN = 60`, sitting in the full 2-second beam costs about two lives — punishing but survivable. Decide whether that, `fireCD`, and the pointer ease `0.30` feel right after real play on both desktop and mobile.
