# Cosmic Interceptor — Pre-Git Checkpoint Log

> **This file is a historical record only.** It logs the work done *before* the
> project had a git repository, when the game was built iteratively in Claude
> conversations and only the final code was kept. None of these entries
> correspond to real commits, and the intermediate states no longer exist.
>
> **Git history is authoritative for everything from the initial import onward.**
> Use `git log` rather than this file:
>
> ```bash
> git log --oneline
> ```
>
> The import commit is `c705cd6`. Everything after it — the stuck-key and
> auto-fire fixes, the Vite scaffold, audio, and the title/game-over/win
> screens — is in real history with real diffs.

---

## Earlier history (prototypes → art pass)

```
feat: scaffold two 404-page game prototypes (Mario stomper + Space Invaders)
    - Mario-style block stomper: jump/stomp to destroy "404" bricks
    - 404 Invaders: waves of enemies → 404 mothership boss
    - Canvas + requestAnimationFrame, keyboard controls

feat: make both prototypes mobile-friendly
    - Responsive canvas scaled to screen width
    - On-screen touch buttons (left/right/action)
    - Auto-resize + rebuild on orientation change

fix(invaders): enemy formation drifting off-screen
    - Replace per-enemy wall-bounce with shared enemyDir + step-down

fix(invaders): instant game-over when enemy reaches player
    - Enemy-player overlap now ends game immediately

feat(invaders): add swipe-to-move + tap-to-shoot variant

feat(invaders): full-screen responsive layout
    - Vertical fullscreen on mobile, horizontal widescreen on desktop
    - isMobile() detection via width + orientation

tune(invaders): slow mobile enemy speed 0.5x, shrink sprites

feat(controls): switch mobile to drag-to-follow + auto-fire (Sky Force style)
    - Ship lerps to finger X (0.25); auto-fires while held
    - Replaces swipe/tap after UX review

fix(controls): pin player Y to H ratio each frame (ship no longer off-screen)

feat(sprites): pixel-art grid sprite system
    - drawSprite(ctx, {palette, grid}, x, y, pixel); 0 = transparent

feat(tools): image → pixel-grid converter (standalone HTML)
    - Upload image, tune grid size + color levels, export grid code
    - Background auto-removal from corners
    - Non-square W/H sliders (max 64 each)
    - Fixed file upload + copy button (execCommand fallback)

feat(tools): add Grid → Image PNG export tab
    - Paste sprite code → export white-bg reference PNG
    - Square 1:1 framing with padding; robust brace-matching parser

feat(player): replace ship with converted orange/steel pixel sprite (30×19)

feat(flames): turbulent animated player thruster
    - Staggered L/R phases, erratic elongation, cyan core,
      deep-blue breaking-apart tips, movement-reactive

style(player): outline black → dark grey (#2e2e2e)
style(player): unify wing oranges to single #db6d24
fix(player): remove white pixels inside cockpit → cyan

feat(enemy): converted red/grey pixel sprite (40×18), body-only
feat(enemy): dynamic orange thrusters (simple flicker, points up)
tune(enemy): scale to 0.8/cell; lock hitbox to body (22×16)
style(enemy): harmonize palette then unify all reds to #e8443a
fix(enemy): remove cockpit white dot; complete wing outline
refactor(enemy): full mirror symmetry (right wing → left as master)

chore: add VISUAL_PAUSE flag + wave-switcher (◀▶) for art review
    - Freezes enemies/boss; preview Wave 1/2/3/Boss formations

style(boss): rename HP label to "FINAL BOSS", remove top tag

feat(boss): replace mothership sprite + 3-cannon attack
    - New mothership (grey body, red side cannons, gold barrel, purple core)
    - 2 side cannons (frequent) + center core charge→spread blast (~8-12s telegraph)
    - Enrage <40%: 5-way spread
```

---

## This session (boss redesign → integration → Framer + demo)

```
refactor(boss): rework attack into 2 parts split at 50% HP
    - Part 1 (>50%): two side cannons only
    - Part 2 (<50%): side cannons + center barrel ORANGE BEAM
    - Prototyped in standalone BossArena demo

feat(boss): center beam fires from the lower barrel muzzle
    - Layered orange column, white-hot core, origin flare
    - Charge-up telegraph + narrowed to barrel width

tune(boss): raise beam muzzle to the dark-red barrel top
    - muzzleY worked through 28 → 18 → 12 → final m.y + 14*bp

feat(boss): stop-and-fire triple beam (OVERDRIVE)
    - On fire the boss FREEZES ~2s (BEAM_TIME=120)
    - Both side cannons convert to orange beams (center barrel + 2 sides)
    - All 3 lanes telegraphed during charge so safe gaps are readable

fix(boss): align side beams to red cannon muzzles; lower center beam
    - sidePod 20→25*bp at sideY = m.y-4*bp (cannon height)
    - Consolidated muzzle offsets into shared muzzleY/sidePod/sideY

feat(boss): integrate 2-part + triple beam into main game
    - Replaces the old purple spread attack
    - Player i-frames (INVULN) for both bullets and the beam
    - Boss freezes + side bolts silenced during the beam

feat(game): full-screen viewport + drop "404" framing
    - getDims fills the whole viewport on every device
    - Rename Invaders404Swipe → InvadersGame; files Invaders.*

feat(controls): easy mode — pointer steer + continuous auto-fire
    - Mouse/touch moves the ship; auto-fire while playing

feat(controls): desktop → arrow keys + faster auto-fire
    - Remove mouse-steer; move with ←/→ or A-D (fireCD 14→7)

fix(controls): iframe keyboard focus + speed parity
    - Container tabIndex + focus-on-load/tap; preventDefault arrows/space
    - Unify fire + move speed to the mobile values

feat(game): global SPEED multiplier (2×)
    - Scales player move, both bullet speeds, boss drift, wave march/sink, fire rate

tune(game): SPEED → 1.5× + gate auto-fire on input
    - Fire only while a control is held (fixes "keeps shooting after release")

style(boss): remove pulsing purple shield ring
feat(game): starting lives 3 → 5 (MAX_LIVES)

chore(preview): boss-fight test build (boots straight to boss)
    - Starts in Part 2 (~55% HP) + extra lives to inspect visuals
fix(preview): boot to boss AFTER state init (was falling through to wave 1)

tune(boss): cap beam to 1 life (extend i-frames over the beam)
fix(hud): full life bar on start + beam ≤ 2 lives max
    - initGame lives was hardcoded 3 → now lives: MAX_LIVES
    - Revert 1-life cap: INVULN(60) within BEAM_TIME(120) = up to 2 hits

feat(framer): Framer-ready component (from wave 1)
    - @framerSupportedLayout* fixed + @framerIntrinsic 800×600
    - ResizeObserver container sizing (fills the frame, no window measure)
    - Property controls: Speed, Lives, Start-on-Boss

feat(demo): self-playing attract mode
    - Autopilot: tracks lowest enemy; hunts boss, dodges to safe gap on beam
    - Invincible + auto-restart on win; "Demo (auto-play)" toggle (default on)

style(demo): fixed 4:3 landscape preview window (800×600) at native scale
    - Centered game window instead of full-panel stretch
```

---

## File map at the end of the pre-git era

This was the layout when the code was first imported into git. It is **no longer
current** — see `GAME_DOC.md` for the live file map.

- `Invaders.tsx` / `.jsx` — the game (playable, full-screen). `VISUAL_PAUSE=false`.
- `Invaders_Framer.tsx` — Framer code component (annotations + sizing + controls), wave 1.
- `Invaders_Demo.tsx` — Framer component with autopilot (`demo` prop, default on).
- `Invaders_Demo_preview.jsx` — plain-React 4:3 preview of the self-playing demo.
- `BossArena.tsx` / `.jsx` — standalone boss sandbox (PART 1 / PART 2 presets).
- `GAME_DOC.md` — overview, version table, parameter reference, next steps.

All of these except `Invaders.tsx` and `GAME_DOC.md` were deleted when the
project committed to a single-file Vercel deploy. Recover any of them from git
history if needed, e.g. `git show b6b0285:BossArena.tsx`.
