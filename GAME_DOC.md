# Invaders — Game Document

## 1. What the game is

**Invaders** is a Space Invaders–style arcade mini-game built in React + Canvas (TypeScript). The player flies a small jet at the bottom of the screen, clears descending waves of enemy grunts, and then fights a single large **mothership boss**. It was originally conceived as a portfolio 404 page, but has been promoted to a standalone game (the 404 framing was dropped — see v1.6).

**Run structure**
- **Waves 1–3** — a rigid formation of grunts marches side-to-side, bounces at the walls, and steadily sinks toward the player. Letting any grunt slip past your line ends the run.
- **Final boss** — a tall mech mothership with a purple cockpit core, grey armored body, gold-trim barrel, and two red side cannons. It has its own two-part attack pattern (below).

**Controls (as of v1.8)**
- **Move:** arrow keys or A-D on desktop; drag on mobile (the ship eases toward your finger). Click the game once so it has keyboard focus.
- **Shoot:** automatic — the ship auto-fires continuously while the game is active (no fire button).

**HUD**
- Top-left: `SCORE` label over a zero-padded value (e.g. `000`).
- Top-right: `LIVES` with a row of pixel hearts (filled = remaining, hollow = lost).

**Boss attack — two parts, split at 50% HP**
- **Part 1 · SIDE CANNONS (>50%)** — the two red side cannons fire aimed red bolts.
- **Part 2 · OVERDRIVE (<50%)** — side cannons fire faster **and** the boss does a stop-and-fire beam: it telegraphs three lanes, then **freezes for ~2 seconds** and fires three orange beams at once (center barrel + both side cannons). The player gets brief invulnerability after each hit so a sustained beam can't drain every life instantly.

---

## 2. Changes by version

| Version | Summary |
|---|---|
| **v1.0** | Base game: 3 descending waves + final boss. Boss fired side-cannon bolts plus a **purple core spread-blast** (3-way, 5-way when enraged below 40%). HUD with score + hearts. Keyboard (desktop) / touch (mobile) controls. Portfolio-404 framing. |
| **v1.1** | Boss attack redesigned from the 4-phase spread into **2 parts** split at 50% HP. Part 2 replaced the purple blast with a single **orange center beam** fired from the lower barrel. |
| **v1.2** | Beam **origin tuned** onto the barrel itself (worked through offsets 28 → 18 → 12 → 14 `bp`) and **narrowed** to match the barrel width. |
| **v1.3** | **Stop-and-fire** behavior: during the beam the boss **freezes ~2 s**, the side cannons convert into orange beams too (so all three emitters fire), and all three lanes are telegraphed during the charge so the safe gaps are readable. |
| **v1.4** | **Side beams aligned to the red side-cannon muzzles** (moved from `20*bp` inboard out to `25*bp` at the cannon height) and the **center beam lowered** slightly (`muzzleY = m.y + 14*bp`). |
| **v1.5** | Folded the whole 2-part + triple-beam boss into the **main game**, replacing the old purple attack. Added **player invulnerability** (`INVULN` i-frames) for both bullets and the beam; the jet blinks while invulnerable. |
| **v1.6** | **Desktop-friendly pass:** full-screen on every device; continuous auto-fire; **dropped the "404" name** — component renamed `InvadersGame`, files renamed `Invaders.*`. |
| **v1.7** | Desktop controls set to **arrow keys / A-D** (mouse-steer removed). Mobile keeps drag-to-move. |
| **v2.1** | Removed the boss's purple shield ring; **starting lives raised to 5** (`MAX_LIVES = 5`). |
| **v2.0** | Speed dialed to `SPEED = 1.5`. **Fixed desktop "keeps shooting after key release"** — firing is now gated on input (touch on mobile; move/fire keys on desktop), so releasing everything stops the shooting. |
| **v1.9** | **Global speed multiplier** `SPEED = 2` — doubled player move, both bullet speeds, boss drift, wave march/sink, and fire rate. One knob to retune overall pace. |
| **v1.8** | Fixed **keyboard movement** (the iframe wasn't getting focus): container is now focusable + grabs focus on load/tap, and arrow/space keys are captured so the page doesn't scroll. **Fire rate unified to the mobile value** (`fireCD = 14`); move speed already matched. |

---

## 3. Customizable parameters

All live near the top of `Invaders.tsx` or inside the game loop.

### Boss
| Parameter | Meaning |
|---|---|
| `BOSS_PX = 3.6 * sc` | Boss sprite pixel scale; everything boss-related is expressed in `bp` units and scales with it. |
| `bossPart()` `0.5` threshold | HP fraction where Part 2 (the beam) begins. |
| `sideCD` 32 / 22 | Side-cannon fire interval (frames), Part 1 / Part 2. Lower = faster. |
| `CORE_CHARGE = 55` | Beam charge / telegraph length (frames). |
| `BEAM_TIME = 120` | Beam duration **and** boss-freeze length (~2 s). |
| `coreCD = rand(6,9)*60` | Cooldown between beams (≈6–9 s). |
| `muzzleY = m.y + 14*bp` | Center-beam origin (smaller = higher up the barrel). |
| `sidePod = 25*bp` | Side-cannon / side-beam distance from center. |
| `sideY = m.y - 4*bp` | Side-cannon / side-beam vertical origin. |
| beam widths `3*bp` / `2*bp` | Center / side beam width — keep visual and damage equal. |
| `hbW = 26*bp, hbH = 54*bp` | Boss central hitbox. |
| `mothership.hp/maxHp = 30` | Boss health (hits to kill); the 50% split is `hp/maxHp`. |
| `mothership.vx = 1.5*sc` | Boss horizontal drift speed. |

### Player & feel
| Parameter | Meaning |
|---|---|
| `SPEED = 1.5` | **Global gameplay speed multiplier** — scales move, bullets, boss drift, wave march/sink, fire rate. Set `1` for the original pace. |
| `INVULN = 60` | Player i-frames after any hit (frames). |
| `fireCD = 14` (both platforms) | Auto-fire interval (frames); lower = faster. |
| `spd = 5*sc` | Keyboard move speed. |
| pointer ease `0.30` | Mobile drag follow speed (higher = snappier). Desktop uses arrow keys. |
| `MAX_LIVES = 5` | Starting lives (hearts). |
| `bspd = 9*sc`, `espd = 4*sc` | Player-bullet / enemy-bullet base speed. |

### Waves
| Parameter | Meaning |
|---|---|
| `makeWave()` `cols/rows` | Formation size per wave. |
| `stepX`, `descend` | Side-march step and sink speed (scale with wave number). |
| `enemyFireCD` | Grunt fire cadence. |

### Layout / platform
| Parameter | Meaning |
|---|---|
| `getDims()` | Now returns full viewport on every device. |
| desktop `sc = min(W/900, H/560)` | Desktop scale — fits width and height so a wide window doesn't oversize sprites. Adjust the `560` to trade vertical room vs sprite size. |
| mobile `sc = (W/360)*0.85` | Mobile scale. |
| `VISUAL_PAUSE` | `false` = play. `true` = static preview with the ◀▶ wave/boss switcher (dev tool). |

---

## 4. Files

- **`Invaders.tsx` / `.jsx`** — the game. `VISUAL_PAUSE = false` (playable, full-screen). `.tsx` passes `tsc --strict`; `.jsx` is the runnable twin.
- **`Invaders_bossplay.jsx`** — test build that boots straight into the boss at 45% HP (Part 2), so the triple beam fires within a second or two. Use this to play-test the boss without clearing waves.
- **`BossArena.tsx` / `.jsx`** — standalone boss-only sandbox with HP preset buttons (PART 1 / PART 2) for tuning the attack in isolation.
- **`GAME_DOC.md`** — this document.

---

## 5. Next steps

1. **Background** — replace the flat starfield with something with more depth (parallax layers, a nebula gradient, or a subtle scrolling grid) so the play space reads as space without distracting from bullets/beams.
2. **Game-over / entry states** — a proper title/start screen and a richer game-over / victory screen (score summary, best score, restart). Currently it's a minimal overlay.
3. **Difficulty & scoring polish** — tune `INVULN`, `coreCD`, and `BEAM_TIME` against real play-testing; consider a score multiplier or time bonus.
4. **Sound (optional)** — shoot, hit, beam-charge, beam-fire, and explosion cues. Web Audio or a small sprite-sound lib.
5. **Framer handoff** — copy the finished component into the Framer/portfolio project (manual copy of the `.jsx`), confirm full-screen behavior inside the Framer canvas, and wire the start/restart.

### Open tuning question
At `INVULN = 60`, sitting in the full 2-second beam costs about two lives — punishing but survivable. After play-testing on desktop with the new mouse controls, decide whether that, the auto-fire rate (`fireCD = 14`), and the pointer ease (`0.30`) feel right, or want softening.
