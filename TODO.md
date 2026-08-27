# Cosmic Interceptor — Checklist

Open work, newest first. Tick items as they land.

---

## [x] 1. End screens — `PLAY AGAIN?` with YES / NO — **built, uncommitted**

**Decided:** YES is the default selection; NO returns to the title screen.
Timing out on the countdown behaves as YES.

Applies to **both** end screens: `GAME OVER` and `MISSION COMPLETE`.

- [x] Add a `PLAY AGAIN?` prompt under the stat rows.
- [x] Add **YES** / **NO** options side by side.
- [x] Use the **arrow variant** for selection — a `▶` marker sits to the left of the
      currently highlighted option and moves between them, rather than each option
      being permanently boxed.
- [x] **Keep the existing `RESTARTING IN NN` countdown, positioned below the buttons.**
      The 15s auto-restart behaviour stays exactly as it is now.

**Interaction**
- Desktop: `←` / `→` move the selection, `Enter` / `Space` confirms.
- Mobile: tap directly on YES or NO.
- Default selection: **YES**, so `Enter` still restarts in one keypress like today.

**Behaviour change to be aware of:** right now `Enter` / tap *immediately* restarts.
Introducing a selection means confirm is a two-step action. Keep the countdown as
the no-input fallback so an idle player still gets restarted.

**Resolved:** NO returns to the title screen.

**Reference:** the boxed `YES` / `NO` on the Game Over mock, but with the `▶YES  NO`
pointer treatment from the `CONTINUE?` mock — pointer, not boxes.

---

## [x] 2. Entry screen — retune the layout — **built, uncommitted**

Move from the current vertically-centred stack to a three-zone layout.

- [x] **Title shrinks and moves to the top.** Smaller than now, anchored near the
      top edge instead of sitting at `H*0.40`.
- [x] **Player ship sits in the centre** of the screen — idle, with the animated
      thruster running so the screen isn't static.
- [x] **48px of spacing between the ship and the prompt.** Fixed gap, same idea
      as the existing mobile title→prompt rule, just applied here instead.
- [x] **Prompt moves to the bottom** — `PRESS ENTER TO START` on desktop,
      `TAP TO START` on mobile.
- [x] **Background scrolls, looping infinitely**, so the ship reads as moving
      forward even though it's stationary on screen. Applies to the starfield
      (and any parallax layers, if item 3's background-depth work lands first).

**Reference:** the `DODGE BLAST` mock — wordmark top, ship centred, call-to-action
pinned bottom.

**Watch out for:**
- The mobile 32px title→prompt spacing rule no longer applies once they're at
  opposite ends of the screen; it needs replacing with top/bottom margins.
- `drawTitleScreen` currently auto-fits the wordmark to `H*0.42`. That cap comes
  down once the title is a top-anchored band.
- The ship is drawn by `drawJet(ctx, x, y, sc, t, moving)`, which already handles
  the idle flame — pass `moving=false`.
- **Scrolling stars, done wrong, is the exact bug already fixed once this
  session** (`Invaders.tsx`, commit `6b0ab25`): the sim used to be frame-counted
  and tied to `requestAnimationFrame`, so speed silently doubled on a 120Hz
  phone mid-drag. Star scroll speed must come from the same fixed-timestep
  `step()` — never from `s.t` directly scaled by an ad-hoc constant — or the
  drift-speed bug comes back specifically on the screen meant to look smoothest.
- Stars currently respawn via `rand(0,W)/rand(0,H)` on resize (see `rescale()`).
  A looping scroll needs each star's `y` wrapped mod `H` per tick, not
  reshuffled — reshuffling on every frame would look like static, not motion.

---

## [ ] 3. Carried over from earlier

- [x] **README** — committed (`README.md`), MIT `LICENSE` added.
- [ ] README still needs a screenshot dropped into the placeholder — a mid-fight
      action shot or the boss OVERDRIVE beam, rather than a spawn-position formation.

---

## Recently done

- [x] Boss HP bar no longer collides with the HUD wave label, and can't clip the
      top edge — pinned to the HUD strip with its own backing panel. *(uncommitted)*
- [x] Simulation decoupled from display refresh rate (fixed-timestep loop).
- [x] Sizing via `ResizeObserver`; a resize re-fits a live run instead of
      restarting it.
- [x] Win screen (`MISSION COMPLETE`) — confirmed working in play.
- [x] Entry screen, game-over screen, shooting/win/lose SFX, mute button.
- [x] Deployed to Vercel with auto-deploy on push.
