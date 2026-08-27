# Cosmic Interceptor

A Galaga-style arcade shoot-'em-up built with React and Canvas — no game engine, no sprite sheets, no audio files. Clear three descending waves, then fight a mothership boss that stops dead and fires a three-lane beam.

**▶ Play it: [cosmic-interceptor.vercel.app](https://cosmic-interceptor.vercel.app)**

<!-- TODO: drop a screenshot or a short GIF here — it's the first thing anyone looks at.
     Suggested: the title screen, and the boss mid-OVERDRIVE beam.
     ![Cosmic Interceptor](docs/screenshot.png) -->

---

## Controls

|  | Desktop | Mobile |
|---|---|---|
| **Move** | `←` `→` or `A` `D` | Drag — the ship eases toward your finger |
| **Fire** | Automatic while a control is held | Automatic while touching |
| **Start / retry** | `Enter` or `Space` | Tap |
| **Mute** | `M`, or the speaker button | Speaker button |

Click the game once so it has keyboard focus.

---

## What's in it

- **Three waves into a boss.** A rigid formation marches side to side and sinks toward you. Let one past your line and the run ends immediately.
- **A two-part boss.** Above 50% HP it fires aimed bolts from two side cannons. Below 50% it enters **OVERDRIVE**: it telegraphs three lanes, freezes for two seconds, and fires beams from all three emitters at once. The telegraph is the whole fight — the safe gap is readable before the beam lands.
- **Four screens** — title, play, game over, and win — sharing one canvas. The two endings share a single renderer and a 15-second countdown that auto-restarts.
- **Everything is generated at runtime.** Sprites are hand-authored pixel grids, the wordmark is a bitmap font drawn in two passes, and all audio is synthesized. The entire game ships as one JS bundle — 176 KB, 56 KB gzipped — with zero asset requests.

---

## Engineering notes

A few problems that were more interesting than they looked:

**Frame-rate independence.** Every speed and cooldown is counted in frames, and the loop originally ran once per `requestAnimationFrame` — which made the simulation speed literally the display's refresh rate. Phones expose this badly: adaptive-refresh panels idle near 60 Hz and ramp to 120 Hz the moment you touch the screen, so the game visibly doubled speed mid-drag. Measured on the old build: 120 / 240 / 288 simulation steps per two seconds at 60 / 120 / 144 Hz. It's now driven by a fixed-timestep accumulator that spends real elapsed time in whole 60 Hz ticks, which keeps every tuned constant valid instead of threading a delta multiplier through dozens of call sites.

**Surviving a resize.** Sizing reads the container through a `ResizeObserver` rather than `window`, so the game can be embedded in an iframe and still measure itself correctly. A resize used to call `initGame` and throw an in-progress run back to the title screen — a phone's URL bar collapsing was enough to trigger it. Now a `rescale()` pass re-fits the live run: positions move by the width and height ratios, sizes and speeds follow the new scale, and the ship is clamped back inside the new bounds.

**Stuck inputs.** Losing focus mid-keypress means the matching `keyup` never arrives, so the key stays held and pins the ship against a wall with no way back. Held keys are released on `blur` and `visibilitychange`, and touches on `touchcancel` — the mobile equivalent, which fires instead of `touchend` when the OS interrupts a gesture.

**Audio without assets.** Each cue is a short oscillator burst built at call time: a bright square-wave sweep for the player, a lower sawtooth for enemies, a rising arpeggio on victory, and two detuned voices sliding to the floor on defeat. The context is created lazily and resumed on the first gesture, since browsers block audio before one.

**The wordmark.** A 5×7 bitmap font rendered in two passes — an offset copy drawn as a hollow silhouette outline, where each lit cell contributes only the edges facing a dark neighbour so adjacent cells fuse into a single contour, then the solid glyph on top. Only the lower-right sliver of the outline survives, which is what gives it the printed-poster look.

---

## About the name

**Space Invaders** is a live registered trademark of Taito Corporation (USPTO 88984221) covering entertainment services, and Taito holds separate registrations on the alien sprites themselves — so it was never an option. Several obvious alternatives turned out to be taken by existing games in the same genre, including *Void Invaders*, *Nova Strike*, and *Galaxy Raiders*.

The artwork is original and shares no lineage with Taito's: theirs are small single-colour organisms with tentacles and claws, ours are multi-colour vehicles — a delta-wing jet, a swept-wing fighter, and a legged mech several times the pixel resolution.

---

## Running locally

Requires Node 18+.

```bash
npm install
```

```bash
npm run dev
```

Then open `http://localhost:5173`. To produce a production build:

```bash
npm run build
```

`build` runs `tsc -b` before Vite, with `noUnusedLocals` enabled — so type errors and dead symbols fail the build rather than shipping.

---

## Project structure

```
Invaders.tsx      the entire game — state, loop, rendering, audio, screens
src/main.tsx      Vite entry point
GAME_DOC.md       design doc: screens, boss pattern, tunable parameters
COMMITS.md        pre-git checkpoint log (historical)
```

`Invaders.tsx` is deliberately a single ~1,200-line file. It's one self-contained component with no cross-module state, and keeping it whole makes the game loop readable top to bottom.

Every tunable lives in a named constant near the top — `SPEED`, `MAX_LIVES`, `INVULN`, `BEAM_TIME`, `GAMEOVER_SECS` and the rest are documented in [GAME_DOC.md](GAME_DOC.md).

---

## Deployment

Auto-deploys to Vercel on every push to `main`. Vite preset, repo root, `dist` output, no configuration file needed.

---

## License

[MIT](LICENSE)
