import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";

// ── Types ──
type Dims = { W: number; H: number; mobile: boolean };
type Rect = { x: number; y: number; w: number; h: number };
type Sprite = { palette: Record<number, string>; grid: number[][] };
type Phase = "title" | "waves" | "boss" | "dead" | "won";
type Nozzle = { cells: number[]; top: number };

interface Player { x: number; y: number; w: number; h: number; vx: number; hitT: number; }
interface Bullet { x: number; y: number; w: number; h: number; }
interface EnemyBullet { x: number; y: number; vx?: number; vy?: number; r?: number; color?: string; big?: boolean; }
interface Enemy { x: number; y: number; w: number; h: number; alive: boolean; homeX?: number; phase?: number; }
interface Mothership { x: number; y: number; w: number; h: number; hp: number; maxHp: number; vx: number; sideCD: number; coreCD: number; chargeT: number; beamT: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface Star { x: number; y: number; size: number; b: number; }

interface GameState {
  t: number; sc: number; mobile: boolean;
  W: number; H: number;      // the box this state was laid out for; rescale() uses it
  player: Player;
  bullets: Bullet[]; enemyBullets: EnemyBullet[];
  enemies: Enemy[];
  mothership: Mothership;
  phase: Phase; wave: number; score: number; lives: number; enemyDir: number;
  fireCD: number; enemyFireCD: number; bossFireCD: number;
  introT: number;
  particles: Particle[];
  stars: Star[];
  waveMsg: number;
  overStart: number;   // ms timestamp the run ended; 0 until then
  endSel: number;      // end-screen selection: 0 = YES (default), 1 = NO
}

// Set to false to resume normal play. true = freeze gameplay + show wave/boss preview switcher.
const VISUAL_PAUSE = false;   // set true to use the wave/boss preview switcher

// Classify from the measured box, not from `window`: the game may be embedded
// in an iframe far smaller than the window it lives in.
function dimsFor(W: number, H: number): Dims {
  const mobile = W < 600 || ('ontouchstart' in window && W < H);
  return { W, H, mobile };
}

// Only used for the very first paint, before the container has been measured.
function initialDims(): Dims {
  return dimsFor(window.innerWidth || 0, window.innerHeight || 0);
}

function rand(a: number, b: number): number { return Math.random()*(b-a)+a; }
function overlap(a: Rect, b: Rect): boolean { return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y; }

// ── HUD styling ──
const FONT = "'Courier New', ui-monospace, monospace";
const MAX_LIVES = 5;
const SPEED = 1.5;      // global gameplay speed multiplier (1 = original pace)
const MAX_SCORE = 640;                          // 49 grunts x10 + boss 30 hits x5
const SCORE_DIGITS = String(MAX_SCORE).length;  // 3 -> displays as 000

// ── Sound — tiny Web Audio synth, no assets. The muted flag lives inside the
// closure so the game loop can fire-and-forget without touching React state. ──
const MUTE_BTN = 30;   // speaker button size (CSS px at sc=1); the score HUD shifts right past it

// The jet/HUD scale. Shared by initGame and the render pass so the DOM speaker
// button lines up with the canvas-drawn score at any viewport size.
function scaleFor(W: number, H: number, mobile: boolean): number {
  return mobile ? (W/360)*0.85 : Math.min(W/900, H/560);
}
// Speaker button box, vertically centered against the two-line score block.
function muteBox(sc: number): { size: number; left: number; top: number } {
  const size = Math.round(MUTE_BTN * Math.min(1.6, Math.max(0.85, sc)));
  return { size, left: Math.round(12*sc), top: Math.max(4, Math.round(23*sc - size/2)) };
}
// Where the ship rests, vertically — shared by the title screen and gameplay
// so they can't independently drift apart the way they did twice already
// (once on mobile, once on desktop). Desktop mirrors the title wordmark's
// H*0.09 top margin on the bottom edge for a symmetric top/bottom pad;
// mobile keeps its own hand-tuned bottom margin from the last round.
function shipRestY(H: number, sc: number, mobile: boolean): number {
  const shipHalfH = JET_SPRITE.grid.length * Math.max(1, 1.5*sc) / 2;
  const fpx = Math.round(13*sc);
  const bottomPad = mobile ? 32 : H*0.09;
  const promptY = H - bottomPad - fpx;      // matches the title screen's prompt-text top
  return promptY - 48 - shipHalfH;          // ship sits 48px above the prompt
}
// ── Title screen ──────────────────────────────────────────────────────────
// "Space Invaders" is a registered trademark of Taito (USPTO 88984221, live in
// the entertainment-services class), so the game ships under its own name.
// Swap this one string to retitle; "\n" splits lines and the block auto-fits.
// VOID INVADERS was rejected too: existing Steam shoot-em-up of the same name.
const TITLE = "COSMIC\nINTERCEPTOR";
const TITLE_FILL = "#db6d24";   // the player jet's orange
const TITLE_EDGE = "#db6d24";   // same orange — the offset copy is outline-only

// Blocky 5x7 uppercase font — drawn as separated cells so the letterforms read
// as a grid of blocks rather than solid strokes.
const GLYPH_W = 5, GLYPH_H = 7;
const FONT5X7: Record<string, string> = {
  " ": "0000000000000000000000000000000000000",
  A: "11111" + "10001" + "10001" + "11111" + "10001" + "10001" + "10001",
  B: "11110" + "10001" + "10001" + "11110" + "10001" + "10001" + "11110",
  C: "11111" + "10000" + "10000" + "10000" + "10000" + "10000" + "11111",
  D: "11110" + "10001" + "10001" + "10001" + "10001" + "10001" + "11110",
  E: "11111" + "10000" + "10000" + "11110" + "10000" + "10000" + "11111",
  F: "11111" + "10000" + "10000" + "11110" + "10000" + "10000" + "10000",
  G: "11111" + "10000" + "10000" + "10111" + "10001" + "10001" + "11111",
  H: "10001" + "10001" + "10001" + "11111" + "10001" + "10001" + "10001",
  I: "11111" + "00100" + "00100" + "00100" + "00100" + "00100" + "11111",
  J: "00111" + "00010" + "00010" + "00010" + "00010" + "10010" + "11110",
  K: "10001" + "10010" + "10100" + "11000" + "10100" + "10010" + "10001",
  L: "10000" + "10000" + "10000" + "10000" + "10000" + "10000" + "11111",
  M: "10001" + "11011" + "10101" + "10001" + "10001" + "10001" + "10001",
  N: "10001" + "11001" + "10101" + "10011" + "10001" + "10001" + "10001",
  O: "11111" + "10001" + "10001" + "10001" + "10001" + "10001" + "11111",
  P: "11111" + "10001" + "10001" + "11111" + "10000" + "10000" + "10000",
  Q: "11111" + "10001" + "10001" + "10001" + "10101" + "10010" + "11101",
  R: "11111" + "10001" + "10001" + "11111" + "10100" + "10010" + "10001",
  S: "11111" + "10000" + "10000" + "11111" + "00001" + "00001" + "11111",
  T: "11111" + "00100" + "00100" + "00100" + "00100" + "00100" + "00100",
  U: "10001" + "10001" + "10001" + "10001" + "10001" + "10001" + "11111",
  V: "10001" + "10001" + "10001" + "10001" + "10001" + "01010" + "00100",
  W: "10001" + "10001" + "10001" + "10001" + "10101" + "11011" + "10001",
  X: "10001" + "10001" + "01010" + "00100" + "01010" + "10001" + "10001",
  Y: "10001" + "10001" + "01010" + "00100" + "00100" + "00100" + "00100",
  Z: "11111" + "00001" + "00010" + "00100" + "01000" + "10000" + "11111",
};
// Width in cells, including one cell of letter-spacing between glyphs.
function titleCells(line: string): number {
  return line.length * GLYPH_W + Math.max(0, line.length - 1);
}
// Two passes: an offset copy for the edge, then the fill on top. Where they
// two layers, as in the Claude Code wordmark: an offset copy drawn as a HOLLOW
// silhouette outline (unfilled, so the background reads through it), then the
// solid glyph on top. Only the down-right sliver of the outline stays visible.
function drawPixelText(ctx: CanvasRenderingContext2D, line: string, cx: number, top: number, cell: number, fill: string = TITLE_FILL, edgeCol: string = TITLE_EDGE): void {
  const gap = Math.max(1, Math.floor(cell*0.14));      // the grid line between cells
  const off = Math.max(2, Math.round(cell*0.34));      // offset of the outline copy
  const lw  = Math.max(1, Math.round(cell*0.11));      // outline stroke weight
  const x0 = Math.round(cx - (titleCells(line)*cell)/2);
  const chars = [...line.toUpperCase()];
  const lit = (g: string, r: number, c: number): boolean =>
    r>=0 && r<GLYPH_H && c>=0 && c<GLYPH_W && g[r*GLYPH_W+c]==="1";

  // Pass 1 — outline only. Each lit cell contributes just the edges that face a
  // dark neighbour, so adjacent cells fuse into one contour around the glyph.
  ctx.fillStyle = edgeCol;
  let cur = x0;
  for(const ch of chars){
    const g = FONT5X7[ch] ?? FONT5X7[" "];
    for(let r=0;r<GLYPH_H;r++) for(let c=0;c<GLYPH_W;c++){
      if(!lit(g,r,c)) continue;
      const x = cur + c*cell + off, y = top + r*cell + off;
      if(!lit(g,r-1,c)) ctx.fillRect(x, y, cell, lw);
      if(!lit(g,r+1,c)) ctx.fillRect(x, y+cell-lw, cell, lw);
      if(!lit(g,r,c-1)) ctx.fillRect(x, y, lw, cell);
      if(!lit(g,r,c+1)) ctx.fillRect(x+cell-lw, y, lw, cell);
    }
    cur += (GLYPH_W+1)*cell;
  }

  // Pass 2 — the solid glyph, cells inset by `gap` so the block grid reads.
  ctx.fillStyle = fill;
  cur = x0;
  for(const ch of chars){
    const g = FONT5X7[ch] ?? FONT5X7[" "];
    for(let r=0;r<GLYPH_H;r++) for(let c=0;c<GLYPH_W;c++){
      if(!lit(g,r,c)) continue;
      ctx.fillRect(cur + c*cell, top + r*cell, cell-gap, cell-gap);
    }
    cur += (GLYPH_W+1)*cell;
  }
}

function drawTitleScreen(ctx: CanvasRenderingContext2D, W: number, H: number, sc: number, t: number, stars: Star[], mobile: boolean): void {
  ctx.fillStyle="#050a1a"; ctx.fillRect(0,0,W,H);

  // Scrolling starfield, wrapped so it loops forever — gives the impression
  // the (idle, stationary) ship is flying forward. Nearer-looking (bigger)
  // stars drift faster for a cheap parallax read. Speed is driven by `t`,
  // which only advances once per fixed 60Hz simulation tick (see step()) —
  // never by wall-clock or raw rAF frames — so this can't silently double
  // speed on a 120Hz display the way the pre-fix game loop once did.
  stars.forEach(st=>{
    const speed = sc * (0.35 + st.size*0.35);
    const y = ((st.y + t*speed) % H + H) % H;
    ctx.globalAlpha=st.b; ctx.fillStyle="#fff"; ctx.fillRect(st.x, y, st.size, st.size);
  });
  ctx.globalAlpha=1;

  // Wordmark — shrunk and pinned near the top, leaving the middle for the ship
  // and the bottom for the prompt instead of the old single centred stack.
  const lines = TITLE.split("\n");
  const wide = Math.max(...lines.map(titleCells));
  const LINE_GAP = 2;                                   // cells between lines
  const tallCells = lines.length*GLYPH_H + (lines.length-1)*LINE_GAP;
  const cell = Math.max(2, Math.min((W*(mobile?0.74:0.52))/wide, (H*0.24)/tallCells));
  let top = H*(mobile?0.10:0.09);
  for(const ln of lines){ drawPixelText(ctx, ln, W/2, top, cell); top += (GLYPH_H+LINE_GAP)*cell; }

  // Ship + prompt are anchored to the BOTTOM edge as a pair, not centred, so
  // the layout reads title-top / empty-middle / controls-bottom. The bottom
  // padding mirrors the H*0.09 top margin on desktop (see shipRestY) so the
  // whole composition reads symmetric top-to-bottom, not just bottom-heavy.
  // Ship scale matches the in-flight ship (not a bumped-up "hero" size) - it
  // used to run 35-60% bigger here, which read fine alone but visibly
  // changed size the instant a run started.
  const msg = mobile ? "TAP TO START" : "PRESS ENTER TO START";
  const fpx = Math.round(13*sc);
  ctx.textBaseline="top"; ctx.textAlign="left";
  ctx.font=`bold ${fpx}px ${FONT}`;
  const tw = ctx.measureText(msg).width, cw = Math.round(9*sc);
  const y = H - (mobile ? 32 : H*0.09) - fpx;      // prompt text top
  const px = W/2 - (tw + 5*sc + cw)/2;

  // Idle ship 48px above the prompt (see shipRestY - also what gameplay uses,
  // so the ship doesn't jump position the instant a run starts). moving=false,
  // but the thruster still animates so the screen isn't static before a run
  // starts.
  const shipY = shipRestY(H, sc, mobile);
  drawJet(ctx, W/2, shipY, sc, t, false);

  ctx.fillStyle="#8aa0c8"; ctx.fillText(msg, px, y);
  if(Math.floor(t/28)%2===0){
    ctx.fillStyle=TITLE_FILL;
    ctx.fillRect(px + tw + 5*sc, y, cw, fpx);
  }
  ctx.textAlign="center"; ctx.textBaseline="alphabetic";
}

// ── Result screens (defeat / victory) ─────────────────────────────────────
// Both share one renderer so the two endings stay visually identical apart
// from wordmark, palette, and stats.
const OVER_FILL = "#ff2e4d";      // danger red, distinct from the jet-orange title
const OVER_EDGE = "#7a1626";
const WIN_FILL  = "#e8b53a";      // victory gold, picked up from the boss's trim
const WIN_EDGE  = "#7a5410";
const GAMEOVER_SECS = 15;         // auto-restart countdown, both endings

interface ResultOpts {
  lines: string[];                 // wordmark, one entry per line
  fill: string; edge: string;
  stats: Array<[string, string]>;  // [label, value] rows
  sel: number;                     // 0 = YES, 1 = NO
  secsLeft: number;
}
// Where the YES/NO options landed, so touches can be hit-tested against them.
type EndButtons = { yes: Rect; no: Rect };

// Centered "LABEL  value" row: dim label, bright value, so the eye lands on
// the number. Returns the y below the row so callers can stack.
function drawStatRow(ctx: CanvasRenderingContext2D, label: string, value: string, cx: number, y: number, sc: number): number {
  const lpx = Math.round(11*sc), vpx = Math.round(17*sc);
  ctx.textBaseline="top"; ctx.textAlign="left";
  ctx.font=`bold ${lpx}px ${FONT}`;
  const lw = ctx.measureText(label).width;
  ctx.font=`bold ${vpx}px ${FONT}`;
  const vw = ctx.measureText(value).width;
  const gap = 10*sc, x0 = cx - (lw + gap + vw)/2;
  ctx.font=`bold ${lpx}px ${FONT}`;   ctx.fillStyle="#5a6b88";
  ctx.fillText(label, x0, y + (vpx-lpx)*0.65);          // baseline-align to the value
  ctx.font=`bold ${vpx}px ${FONT}`;   ctx.fillStyle="#ffffff";
  ctx.fillText(value, x0 + lw + gap, y);
  return y + vpx;
}

function drawResultScreen(ctx: CanvasRenderingContext2D, W: number, H: number, sc: number, _t: number, stars: Star[], mobile: boolean, o: ResultOpts): EndButtons {
  ctx.fillStyle="#050a1a"; ctx.fillRect(0,0,W,H);
  stars.forEach(st=>{ ctx.globalAlpha=st.b*0.5; ctx.fillStyle="#fff"; ctx.fillRect(st.x,st.y,st.size,st.size); });
  ctx.globalAlpha=1;

  const wide = Math.max(...o.lines.map(titleCells));
  const LINE_GAP = 2;
  const tallCells = o.lines.length*GLYPH_H + (o.lines.length-1)*LINE_GAP;
  const cell = Math.max(2, Math.min((W*0.62)/wide, (H*0.30)/tallCells));
  const blockH = tallCells*cell;
  const blockTop = H*(mobile ? 0.24 : 0.22);
  let top = blockTop;
  for(const ln of o.lines){ drawPixelText(ctx, ln, W/2, top, cell, o.fill, o.edge); top += (GLYPH_H+LINE_GAP)*cell; }

  // Run result
  let y = blockTop + blockH + (mobile ? 32 : 46);
  o.stats.forEach(([label, value], i)=>{ y = drawStatRow(ctx, label, value, W/2, i===0 ? y : y + 8*sc, sc); });

  // "PLAY AGAIN?" prompt
  const fpx = Math.round(13*sc);
  ctx.textBaseline="top"; ctx.textAlign="center";
  ctx.font=`bold ${fpx}px ${FONT}`;
  const py = y + (mobile ? 30 : 42);
  ctx.fillStyle="#ffffff"; ctx.fillText("PLAY AGAIN?", W/2, py);

  // YES / NO with a caret marking the selection, rather than boxing both.
  const optPx = Math.round(17*sc);
  const oy = py + fpx + 14*sc;
  const caretW = 9*sc, caretGap = 7*sc;
  const slot = caretW + caretGap;

  // Centre the YES/NO *words* themselves, not the caret's reserved slot — the
  // caret is a decoration that hangs off the left of whichever word is
  // selected, so it can't be part of the centering math or the pair reads as
  // off-centre (only one caret is ever inked, so a slot reserved on both
  // sides leaves asymmetric dead space). Same side-by-side layout on mobile
  // and desktop; only the tap target's height differs below.
  ctx.font=`bold ${optPx}px ${FONT}`; ctx.textAlign="left";
  const yesW = ctx.measureText("YES").width, noW = ctx.measureText("NO").width;
  const optGap = 48*sc;
  const totalW = yesW + optGap + noW;
  const x0 = W/2 - totalW/2;
  const yesX = x0;
  const noX = x0 + yesW + optGap;

  const caret = (labelX: number): void => {
    const cx = labelX - slot;
    ctx.beginPath();
    ctx.moveTo(cx, oy + optPx*0.14);
    ctx.lineTo(cx + caretW, oy + optPx*0.50);
    ctx.lineTo(cx, oy + optPx*0.86);
    ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = o.fill; caret(o.sel === 0 ? yesX : noX);
  ctx.fillStyle = o.sel === 0 ? "#ffffff" : "#5a6b88"; ctx.fillText("YES", yesX, oy);
  ctx.fillStyle = o.sel === 1 ? "#ffffff" : "#5a6b88"; ctx.fillText("NO",  noX,  oy);

  // Hit box hugs the caret+label rather than stretching into a wide bar.
  // Mobile forces the 48px accessibility floor on height; desktop just pads
  // generously since it's mouse-driven and doesn't need that floor.
  const padX = 10*sc, padY = 14*sc;
  const boxH = mobile ? 48 : optPx + padY*2;
  const boxY = oy + optPx/2 - boxH/2;
  const yesBox: Rect = { x: yesX - slot - padX, y: boxY, w: slot + yesW + padX*2, h: boxH };
  const noBox: Rect  = { x: noX  - slot - padX, y: boxY, w: slot + noW  + padX*2, h: boxH };
  const afterOptionsY = boxY + boxH;

  // Countdown to the automatic restart — unchanged behaviour, just moved below.
  const cpx = Math.round(11*sc);
  ctx.font=`bold ${cpx}px ${FONT}`; ctx.textAlign="center"; ctx.fillStyle="#5a6b88";
  ctx.fillText(`RESTARTING IN ${o.secsLeft}`, W/2, afterOptionsY + 16*sc);
  ctx.textBaseline="alphabetic";

  return { yes: yesBox, no: noBox };
}

interface Sfx { unlock(): void; setMuted(m: boolean): void; setBgmWanted(w: boolean): void; shoot(): void; enemyShoot(): void; win(): void; lose(): void; dispose(): void; }
function makeSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let muted = false;

  // ── Title-screen BGM ──────────────────────────────────────────────────
  // A short arpeggiated loop over Am-F-C-G, synthesized the same way as the
  // SFX cues — no audio file, so the game stays a single portable component.
  // Scheduled with the standard Web-Audio lookahead pattern (queue ~200ms of
  // notes, re-check every 100ms) rather than one setTimeout per note, so
  // playback stays sample-accurate regardless of setTimeout jitter.
  const BGM_BPM = 112;
  const BGM_STEP = 60/BGM_BPM/2;                    // eighth notes
  const BGM_CHORDS: number[][] = [
    [220.00, 261.63, 329.63],   // Am
    [174.61, 220.00, 261.63],   // F
    [261.63, 329.63, 392.00],   // C
    [196.00, 246.94, 293.66],   // G
  ];
  const BGM_ARP = [0,1,2,3,2,1,0,1];                // step -> chord-tone index; 3 = root one octave up
  let bgmWanted = false;   // what the game currently wants (tracks the title phase)
  let bgmOn = false;       // whether the scheduler is actually running
  let bgmTimer: ReturnType<typeof setTimeout> | null = null;
  let bgmStep = 0;
  let bgmNextTime = 0;

  const bgmNote = (freq: number, t0: number, dur: number, vol: number, type: OscillatorType): void => {
    if(!ctx) return;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);         // soft attack — no click
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  };
  const bgmScheduleAhead = (): void => {
    if(!ctx || !bgmOn) return;
    const lookahead = 0.2;
    // The clock always advances, muted or not — otherwise a long mute would
    // leave bgmNextTime far behind ctx.currentTime, and unmuting would dump
    // every skipped note out at once instead of just resuming in place.
    while(bgmNextTime < ctx.currentTime + lookahead){
      if(!muted){
        const chord = BGM_CHORDS[Math.floor(bgmStep/8) % BGM_CHORDS.length];
        const idx = BGM_ARP[bgmStep % 8];
        bgmNote(idx===3 ? chord[0]*2 : chord[idx], bgmNextTime, BGM_STEP*0.9, 0.045, "triangle");
        if(bgmStep % 8 === 0){
          // one sustained bass note per bar, an octave below the chord root
          bgmNote(chord[0]/2, bgmNextTime, BGM_STEP*8*0.95, 0.03, "sine");
        }
      }
      bgmNextTime += BGM_STEP;
      bgmStep++;
    }
  };
  const bgmTick = (): void => {
    bgmScheduleAhead();
    if(bgmOn) bgmTimer = setTimeout(bgmTick, 100);
  };
  // Reconciles "what the game wants" against "what the audio subsystem can
  // currently do" — called on every unlock() and every setBgmWanted(), since
  // the context typically isn't running yet the first time either fires.
  function syncBgm(): void {
    if(bgmWanted && ctx && ctx.state === "running"){
      if(!bgmOn){ bgmOn = true; bgmStep = 0; bgmNextTime = ctx.currentTime + 0.05; bgmTick(); }
    } else if(bgmOn){
      bgmOn = false;
      if(bgmTimer !== null){ clearTimeout(bgmTimer); bgmTimer = null; }
    }
  }

  const ensure = (): AudioContext | null => {
    if(typeof window === "undefined") return null;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if(!AC) return null;
    if(!ctx) ctx = new AC();
    if(ctx.state === "suspended") void ctx.resume().then(syncBgm);   // resume() is async
    return ctx;
  };
  // `at` offsets the note from now, so multi-note cues schedule in one call.
  const blip = (f0: number, f1: number, dur: number, type: OscillatorType, vol: number, at: number = 0): void => {
    if(muted) return;
    const ac = ensure();
    if(!ac || ac.state !== "running") return;   // before the first user gesture: stay silent
    const t0 = ac.currentTime + at;
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur);
  };
  return {
    unlock(){ void ensure(); syncBgm(); },                // call from inside a user gesture
    setMuted(m){ muted = m; },
    setBgmWanted(w){ bgmWanted = w; syncBgm(); },
    shoot(){ blip(880, 320, 0.07, "square", 0.05); },        // player: bright descending pew
    enemyShoot(){ blip(240, 90, 0.12, "sawtooth", 0.06); },  // enemy/boss: low buzzy zap
    // Victory: rising C-E-G-C arpeggio, last note held.
    win(){ [523,659,784,1047].forEach((f,i,a)=> blip(f, f, i===a.length-1 ? 0.36 : 0.13, "square", 0.055, i*0.11)); },
    // Defeat: two detuned voices sliding to the floor — a power-down.
    lose(){ blip(320, 55, 0.85, "sawtooth", 0.07); blip(240, 45, 0.95, "square", 0.035, 0.04); },
    dispose(){
      bgmOn = false;
      if(bgmTimer !== null){ clearTimeout(bgmTimer); bgmTimer = null; }
      void ctx?.close(); ctx = null;
    },
  };
}
const HEART: number[][] = [
  [0,1,1,0,1,1,0],
  [1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
];
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, ps: number, color: string, filled: boolean): void {
  ctx.fillStyle = color;
  const rows = HEART.length, cols = HEART[0].length;
  const on = (r: number, c: number): boolean => r>=0 && r<rows && c>=0 && c<cols && HEART[r][c]===1;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    if(HEART[r][c]!==1) continue;
    // when empty, draw only the perimeter so the heart reads as a hollow outline
    if(!filled && on(r-1,c) && on(r+1,c) && on(r,c-1) && on(r,c+1)) continue;
    ctx.fillRect(Math.round(x+c*ps), Math.round(y+r*ps), Math.ceil(ps), Math.ceil(ps));
  }
}

// ── Pixel-art sprite system ──
// 0 = transparent. Each number maps to a color in the sprite's palette.
function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, cx: number, cy: number, pixel: number): void {
  const { grid, palette } = sprite;
  const rows = grid.length, cols = grid[0].length;
  const ox = Math.round(cx - (cols * pixel) / 2);
  const oy = Math.round(cy - (rows * pixel) / 2);
  const ps = Math.ceil(pixel);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c];
      if (!v) continue;
      ctx.fillStyle = palette[v];
      ctx.fillRect(ox + Math.floor(c * pixel), oy + Math.floor(r * pixel), ps, ps);
    }
  }
}

// Player jet — converted from reference. Flame rows removed (drawn dynamically). 30w x 19h
const JET_SPRITE: Sprite = {
  palette: {
    1: "#2e2e2e", 2: "#494949", 3: "#db6d24", 4: "#b6dbdb", 5: "#929292",
    6: "#dbdbdb", 7: "#db6d24", 8: "#db6d24", 9: "#db6d24", 10: "#db6d24",
    11: "#00dbdb", 12: "#00b6b6",
  },
  grid: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,3,4,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,3,4,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,3,4,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,1,3,5,5,3,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,5,4,4,5,1,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,5,1,5,4,4,5,1,5,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,3,5,1,5,4,4,5,1,5,3,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,3,5,1,2,4,4,2,1,5,3,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,1,5,5,1,3,2,2,3,1,5,5,1,0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,1,5,5,1,1,3,5,5,3,1,1,5,5,1,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,1,5,5,1,3,3,2,5,5,2,3,3,1,5,5,1,0,0,1,0,0,0,0],
    [0,0,0,0,1,5,5,3,3,1,7,8,9,1,5,5,1,3,8,3,1,3,3,5,5,1,0,0,0,0],
    [0,0,0,0,1,5,5,3,3,1,8,10,8,1,5,5,1,8,10,8,1,3,3,5,5,1,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,5,5,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ],
};

// ── Turbulent tapering flame ──
const FLAME_COLS = [11, 18];
const FL = { core:"#aef6ff", coreHot:"#ffffff", mid:"#00dbdb", deep:"#0066a8", edge:"#003d6b" };

function drawFlames(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number, moving: boolean): void {
  const pixel = Math.max(1, 1.5 * sc);
  const cols = 30, rows = 19;
  const ox = Math.round(x - (cols * pixel) / 2);
  const oy = Math.round(y - (rows * pixel) / 2);
  const ps = Math.ceil(pixel);
  const baseY = oy + rows * pixel;

  FLAME_COLS.forEach((col, idx) => {
    const stagger = idx * Math.PI;
    const fast = t * 0.55 + stagger;
    const turb = Math.sin(fast) * 0.6 + Math.sin(fast * 2.7 + 1.1) * 0.3 + Math.sin(fast * 0.4) * 0.2;
    const base = moving ? 7 : 4;
    let len = Math.round(base + turb * (moving ? 3.5 : 2));
    if (len < 2) len = 2;
    const cx = ox + col * pixel;

    for (let i = 0; i < len; i++) {
      const frac = i / len;
      const edgeFlick = Math.sin(fast * 3.1 + i * 1.4) > 0;
      const isTipZone = frac > 0.7;
      if (isTipZone) {
        const breakUp = Math.sin(fast * 4.3 + i * 2.1);
        if (breakUp < -0.1) continue;
      }
      const yy = baseY + i * pixel;
      let coreColor;
      if (frac < 0.18) coreColor = FL.coreHot;
      else if (frac < 0.4) coreColor = FL.core;
      else if (frac < 0.7) coreColor = FL.mid;
      else coreColor = FL.deep;

      if (frac < 0.45) {
        ctx.fillStyle = FL.deep;
        if (edgeFlick) ctx.fillRect(cx - pixel, yy, ps, ps);
        ctx.fillStyle = FL.edge;
        ctx.fillRect(cx + 2*pixel, yy, ps, ps);
        ctx.fillStyle = coreColor;
        ctx.fillRect(cx, yy, ps, ps);
        ctx.fillRect(cx + pixel, yy, ps, ps);
      } else if (frac < 0.72) {
        ctx.fillStyle = FL.deep;
        const side = edgeFlick ? -1 : 1;
        ctx.fillRect(cx + Math.floor(pixel*0.5) + side*pixel, yy, ps, ps);
        ctx.fillStyle = coreColor;
        ctx.fillRect(cx + Math.floor(pixel*0.5), yy, ps, ps);
      } else {
        const jitter = Math.sin(fast*5 + i) > 0.4 ? pixel : 0;
        ctx.fillStyle = coreColor;
        ctx.fillRect(cx + Math.floor(pixel*0.5) + jitter*0.3, yy, ps, ps);
      }
    }
  });
}

// Enemy fighter — body only (flames cropped, drawn dynamically). 40w x 18h
const ENEMY_SPRITE: Sprite = {
  palette: {
    5:"#000000", 6:"#555555", 7:"#e8443a", 8:"#e8443a", 9:"#2b2b2b",
    10:"#e8443a", 11:"#e8443a", 12:"#e8443a", 13:"#e8443a", 15:"#e8443a",
    16:"#e8443a", 17:"#e8443a", 18:"#e8443a", 19:"#e8443a", 20:"#808080",
    21:"#80d5ff", 22:"#e8443a",
  },
  grid: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,5,5,5,5,6,5,6,6,5,6,5,5,5,5,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,11,10,10,5,5,5,5,5,5,5,5,10,10,11,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,6,5,10,10,10,10,11,10,10,5,10,9,6,6,9,10,5,10,10,11,10,10,10,10,5,6,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,5,17,10,12,12,16,16,11,10,10,5,10,9,6,6,9,10,5,10,10,11,16,16,12,12,10,17,5,0,0,0,0,0,0],
    [0,0,0,0,0,5,7,12,12,6,6,9,6,5,6,6,5,10,9,6,6,9,10,5,6,6,5,6,9,6,6,12,12,7,5,0,0,0,0,0],
    [0,0,0,0,0,5,13,18,6,6,6,6,6,5,6,6,5,16,17,6,6,17,16,5,6,6,5,6,6,6,6,6,18,13,5,0,0,0,0,0],
    [0,0,0,0,0,5,6,6,6,6,6,6,6,6,6,9,9,6,9,16,16,9,6,9,9,6,6,6,6,6,6,6,6,6,5,0,0,0,0,0],
    [0,0,0,0,0,5,6,6,6,6,6,9,6,6,6,12,17,6,6,9,9,6,6,17,12,6,6,6,9,6,6,6,6,6,5,0,0,0,0,0],
    [0,0,0,0,0,5,6,6,6,20,5,5,20,20,6,6,9,6,6,6,6,6,6,9,6,6,20,20,5,5,20,6,6,6,5,0,0,0,0,0],
    [0,0,0,0,0,5,10,18,6,5,5,0,5,5,20,6,9,6,20,6,6,20,6,9,6,20,5,5,0,5,5,6,18,10,5,0,0,0,0,0],
    [0,0,0,0,0,5,19,18,6,5,0,0,0,5,5,6,9,6,6,21,21,6,6,9,6,5,5,0,0,0,5,6,18,19,5,0,0,0,0,0],
    [0,0,0,0,0,5,5,22,6,5,0,0,0,0,5,6,9,6,21,21,21,21,6,9,6,5,0,0,0,0,5,6,22,5,5,0,0,0,0,0],
    [0,0,0,0,0,0,5,16,12,5,0,0,0,0,0,5,9,6,21,21,21,21,6,9,5,0,0,0,0,0,5,12,16,5,0,0,0,0,0,0],
    [0,0,0,0,0,0,5,5,12,5,0,0,0,0,0,5,5,6,21,21,21,21,6,5,5,0,0,0,0,0,5,12,5,5,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,6,12,5,0,0,0,0,0,0,5,20,6,21,21,6,20,5,0,0,0,0,0,0,5,12,6,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,5,5,0,0,0,0,0,0,5,20,20,6,6,20,20,5,0,0,0,0,0,0,5,5,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,20,20,20,20,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,20,20,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
};

// Dynamic enemy thrusters — orange, simple flicker, pointing UP (trailing the descending enemy).
const ENEMY_NOZZLES = [14.5, 19.5, 24.5];
const EFLAME = { core:"#ffd27a", mid:"#ff9a2b", deep:"#ff6a1f" };

function drawEnemyThrusters(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number): void {
  const epx = Math.max(0.5, 0.8 * sc);            // enemy grid pixel (for alignment)
  const cols = 40, rows = 18;
  const ox = Math.round(x - (cols * epx) / 2);
  const oy = Math.round(y - (rows * epx) / 2);
  const fps = Math.max(2, Math.round(1.8 * sc));  // bigger flame cells so the jets read clearly
  const topY = oy + 1 * epx;
  ENEMY_NOZZLES.forEach((col, idx) => {
    const phase = t * 0.4 + idx * 1.3 + x * 0.04;
    const flick = Math.sin(phase);
    const len = Math.round(1 + (flick * 0.5 + 0.5) * 1.5); // short flame
    const cx = Math.round(ox + col * epx - fps / 2);
    for (let i = 0; i < len; i++) {
      if (i >= len - 1 && Math.sin(phase * 2.1 + i) < 0) continue;
      const yy = topY - (i + 1) * fps;
      const f = i / len;
      ctx.fillStyle = f < 0.18 ? EFLAME.core : f < 0.6 ? EFLAME.mid : EFLAME.deep;
      ctx.fillRect(cx, yy, fps, fps);
    }
  });
}

// Boss — finalized 56w x 64h mech (grey body, red cannons, dark-gold trim, purple core + ring).
const BOSS_SPRITE: Sprite = {
  palette: { 1:"#000000", 2:"#9a7d3e", 3:"#5e525a", 4:"#b3a9b0", 5:"#7a1626", 6:"#a8313f", 7:"#d6cdd4", 8:"#2d1820", 9:"#5a2186", 10:"#3c1659" },
  grid: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,4,4,4,4,3,3,1,0,0,0,0,0,0,0,0,1,3,3,4,4,4,4,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,3,3,3,3,3,5,3,1,1,5,5,5,5,1,1,3,5,3,3,3,3,3,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,3,3,4,3,5,1,1,1,5,6,6,5,1,1,1,5,3,4,3,3,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,4,4,2,4,3,0,1,5,3,3,3,3,3,3,5,1,0,3,4,2,4,4,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,2,2,2,2,0,0,2,4,4,2,4,4,0,4,4,4,4,4,4,4,4,4,4,0,4,4,2,4,4,2,0,0,2,2,2,2,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,2,2,2,2,1,0,5,5,5,5,5,1,0,3,3,4,4,4,4,4,4,3,3,0,1,5,5,5,5,5,0,1,2,2,2,2,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,1,1,1,3,1,1,0,4,4,4,4,4,4,4,4,4,4,0,1,1,3,1,1,1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,3,1,1,4,4,4,4,1,1,4,4,4,4,3,1,0,4,4,4,4,4,4,4,4,4,4,0,1,3,4,4,4,4,1,1,4,4,4,4,1,1,3,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,3,3,1,1,3,3,3,3,1,3,3,3,4,3,3,1,0,4,4,4,4,4,4,4,4,4,4,0,1,3,3,4,3,3,3,1,3,3,3,3,1,1,3,3,1,0,0,0,0,0],
    [0,0,5,1,1,1,3,3,1,1,3,3,3,3,1,3,3,3,4,3,3,1,0,4,4,3,4,4,4,4,3,4,4,0,1,3,3,4,3,3,3,1,3,3,3,3,1,1,3,3,1,1,1,5,0,0],
    [0,1,6,5,5,1,3,3,1,3,3,3,3,3,1,3,3,3,4,3,3,1,0,4,4,3,4,4,4,4,3,4,4,0,1,3,3,4,3,3,3,1,3,3,3,3,3,1,3,3,1,5,5,6,1,0],
    [0,5,6,5,5,5,3,3,4,3,3,3,3,3,1,3,3,3,4,3,3,1,0,4,4,4,4,4,4,4,4,4,4,0,1,3,3,4,3,3,3,1,3,3,3,3,3,4,3,3,5,5,5,6,5,0],
    [1,5,0,5,0,5,3,3,4,4,4,4,4,3,1,4,4,4,3,3,3,1,0,4,4,4,1,1,1,1,4,4,4,0,1,3,3,3,4,4,4,1,3,4,4,4,4,4,3,3,5,0,5,0,5,1],
    [1,6,6,5,5,6,5,3,4,4,4,4,4,3,1,5,3,5,3,3,3,5,0,10,1,1,10,10,10,10,1,1,10,0,5,3,3,3,5,3,5,1,3,4,4,4,4,4,3,5,6,5,5,6,6,1],
    [6,2,6,6,5,5,6,1,3,3,3,3,4,3,3,1,4,4,4,3,1,0,0,10,4,4,1,1,1,1,4,4,10,0,0,1,3,4,4,4,1,3,3,4,3,3,3,3,1,6,5,5,6,6,2,6],
    [6,2,6,6,5,5,6,1,4,4,4,4,3,3,3,1,1,1,1,1,5,5,1,10,1,10,10,10,10,10,10,1,10,1,5,5,1,1,1,1,1,3,3,3,4,4,4,4,1,6,5,5,6,6,2,6],
    [6,2,6,5,5,5,6,1,4,4,4,4,4,4,3,1,5,6,5,1,0,1,1,10,10,10,9,9,9,9,10,10,10,1,1,0,1,5,6,5,1,3,4,4,4,4,4,4,1,6,5,5,5,6,2,6],
    [6,5,6,5,5,5,6,1,4,4,4,4,4,4,3,1,2,5,5,1,0,1,4,3,10,10,9,9,9,9,10,10,3,4,1,0,1,5,5,2,1,3,4,4,4,4,4,4,1,6,5,5,5,6,5,6],
    [1,6,5,5,5,5,6,1,4,4,4,4,4,4,3,1,2,2,5,1,5,1,4,4,10,9,9,9,9,9,9,10,4,4,1,5,1,5,2,2,1,3,4,4,4,4,4,4,1,6,5,5,5,5,6,1],
    [1,5,5,5,5,5,5,3,3,4,4,4,4,4,3,1,2,2,5,1,0,1,4,4,10,9,9,9,9,9,9,10,4,4,1,0,1,5,2,2,1,3,4,4,4,4,4,3,3,5,5,5,5,5,5,1],
    [0,0,5,6,1,1,3,4,4,3,3,4,4,4,4,3,2,5,5,1,5,1,4,4,10,9,9,9,9,9,9,10,4,4,1,5,1,5,5,2,3,4,4,4,4,3,3,4,4,3,1,1,6,5,0,0],
    [0,0,5,6,5,1,1,4,4,4,3,3,3,4,4,4,5,5,1,1,5,1,4,4,10,9,9,9,9,9,9,10,4,4,1,5,1,1,5,5,4,4,4,3,3,3,4,4,4,1,1,5,6,5,0,0],
    [0,0,5,6,5,1,0,4,4,4,4,4,4,3,4,4,1,6,5,6,1,1,3,10,10,9,9,9,9,9,9,10,10,3,1,1,6,5,6,1,4,4,3,4,4,4,4,4,4,0,1,5,6,5,0,0],
    [0,0,5,6,5,0,0,0,3,4,4,4,4,4,3,3,1,2,2,6,1,4,3,10,10,10,9,9,9,9,10,10,10,3,4,1,6,2,2,1,3,3,4,4,4,4,4,3,0,0,0,5,6,5,0,0],
    [0,0,5,5,5,0,0,0,0,0,1,4,4,4,4,3,1,2,2,6,0,4,4,3,10,10,9,9,9,9,10,10,3,4,4,0,6,2,2,1,3,4,4,4,4,1,0,0,0,0,0,5,5,5,0,0],
    [0,0,2,2,2,0,0,0,0,0,0,0,4,4,4,4,1,2,2,6,1,4,4,3,1,10,10,10,10,10,10,1,3,4,4,1,6,2,2,1,4,4,4,4,0,0,0,0,0,0,0,2,2,2,0,0],
    [0,0,5,5,5,0,0,0,0,0,0,0,0,1,4,4,1,6,5,6,1,4,4,4,4,4,1,1,1,1,4,4,4,4,4,1,6,5,6,1,4,4,1,0,0,0,0,0,0,0,0,5,5,5,0,0],
    [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,1,1,1,3,4,4,4,4,4,4,4,4,4,4,4,4,3,1,1,1,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,3,1,4,3,3,4,4,4,4,4,4,4,4,3,3,4,1,3,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,3,1,4,4,3,3,4,4,4,4,4,4,3,3,4,4,1,3,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,3,1,4,4,4,3,3,3,3,3,3,3,3,4,4,4,1,3,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,3,1,4,4,4,4,4,4,4,4,4,4,4,4,4,4,1,3,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,4,3,3,4,4,4,4,4,4,4,4,4,4,4,4,3,3,4,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,3,1,4,4,4,3,3,3,3,3,3,4,4,4,1,3,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,3,3,1,4,4,3,4,4,4,4,3,4,4,1,3,3,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,4,4,4,3,3,1,4,4,3,4,4,4,4,3,4,4,1,3,3,4,4,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,4,4,4,3,3,1,4,4,4,4,4,4,4,4,4,4,1,3,3,4,4,4,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,3,4,4,4,3,1,4,3,3,4,4,4,4,3,3,4,1,3,4,4,4,3,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,3,4,4,4,3,1,4,3,4,4,4,4,4,4,3,4,1,3,4,4,4,3,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,4,4,4,3,1,4,3,1,1,1,1,1,1,3,4,1,3,4,4,4,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,3,4,4,4,3,1,1,5,5,2,2,2,2,5,5,1,1,3,4,4,4,3,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,3,4,4,4,3,1,1,5,5,5,5,5,5,5,5,1,1,3,4,4,4,3,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,4,4,4,3,1,6,5,2,0,0,0,0,2,5,6,1,3,4,4,4,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,3,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,3,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,3,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,3,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,3,4,3,3,6,2,2,0,0,0,0,2,2,6,3,3,4,3,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,3,4,3,3,6,2,2,0,0,0,0,2,2,6,3,3,4,3,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,3,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,3,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,3,4,3,3,6,2,2,0,0,0,0,2,2,6,3,3,4,3,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,3,3,1,6,2,2,0,0,0,0,2,2,6,1,3,3,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,3,1,6,2,2,0,0,0,0,2,2,6,1,3,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,3,1,1,1,1,0,0,0,0,1,1,1,1,3,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,3,0,0,0,0,0,0,0,0,0,0,3,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,1,0,0,0,0,0,0,0,0,0,0,1,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,1,0,0,0,0,0,0,0,0,0,0,1,2,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
};
function drawJet(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number, moving: boolean): void {
  drawFlames(ctx, x, y, sc, t, moving);
  drawSprite(ctx, JET_SPRITE, x, y, Math.max(1, 1.5 * sc));
}
function drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, sc: number): void {
  const bob = Math.sin(t*0.05 + x*0.1) * 1.5 * sc;
  drawEnemyThrusters(ctx, x, y + bob, sc, t);
  drawSprite(ctx, ENEMY_SPRITE, x, y + bob, Math.max(0.5, 0.8 * sc));
}

// Boss render metrics — shared by draw + hit/fire logic so they stay in sync.
const BOSS_PX = (sc: number): number => Math.max(2, 3.6 * sc);
const BOSS_COLS = 56, BOSS_ROWS = 64;
const CORE_CHARGE = 55;    // beam charge-up (telegraph) frames
const BEAM_TIME = 120;     // ~2s beam (boss freezes)
const INVULN = 60;         // player i-frames after any hit (beam can't drain all lives)

// Boss thrusters — 4 jets off the back vents (2 inner shoulder, 2 outer), flames trail UP.
// Orange palette matched to the enemy grunts (EFLAME) so the faction reads consistently.
const BFLAME = { core:"#ffd27a", mid:"#ff9a2b", deep:"#ff6a1f" };
const BOSS_NOZZLES: Nozzle[] = [
  { cells:[10,11,12], top:6 },  // outer-left vent
  { cells:[17,18,19], top:0 },  // inner-left vent
  { cells:[36,37,38], top:0 },  // inner-right vent
  { cells:[43,44,45], top:6 },  // outer-right vent
];

function drawBossThrusters(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, sc: number): void {
  const bp = BOSS_PX(sc);
  const ox = Math.round(x - BOSS_COLS*bp/2);
  const oy = Math.round(y - BOSS_ROWS*bp/2);
  const ps = Math.ceil(bp);
  BOSS_NOZZLES.forEach((nz, idx)=>{
    const phase = t*0.45 + idx*1.7;                 // staggered flicker per nozzle
    const flick = Math.sin(phase);
    const len = Math.round(3 + (flick*0.5+0.5)*4);  // ~3..7 cells of flame
    const topY = oy + nz.top*bp;                    // emerge from the vent's top edge
    for(let i=0;i<len;i++){
      if(i>=len-1 && Math.sin(phase*2.1+i)<0) continue;  // flickering tip
      const yy = topY - (i+1)*bp;
      const f = i/len;
      ctx.fillStyle = f<0.18 ? BFLAME.core : f<0.6 ? BFLAME.mid : BFLAME.deep;
      const w = f<0.5 ? 3 : f<0.8 ? 2 : 1;          // taper toward the tip
      const start = (3 - w) >> 1;
      for(let k=0;k<w;k++){
        ctx.fillRect(ox + nz.cells[start+k]*bp, yy, ps, ps);
      }
    }
  });
}

function drawMothership(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, maxHp: number, t: number, sc: number, charge: number): void {
  const bp = BOSS_PX(sc);
  const shk = hp<maxHp*0.3 ? Math.sin(t*0.3)*3 : 0;

  // Purple core glow behind the sprite (centered on the cockpit core)
  const coreY = y - 4*bp;
  ctx.save();
  const ga = 0.32 + Math.sin(t*0.12)*0.16;
  const g = ctx.createRadialGradient(x, coreY, 1, x, coreY, 9*bp);
  g.addColorStop(0, `rgba(150,60,220,${ga})`);
  g.addColorStop(1, "rgba(150,60,220,0)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x, coreY, 9*bp, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  drawBossThrusters(ctx, x+shk, y, t, sc);
  drawSprite(ctx, BOSS_SPRITE, x+shk, y, bp);

  // Purple-core charge-up telegraph: ring converges + flash builds as charge -> 1
  if(charge>0){
    ctx.save();
    const rr=(1-charge)*13*bp + 3*bp;
    ctx.strokeStyle=`rgba(178,76,255,${0.35+charge*0.5})`; ctx.lineWidth=2+charge*3;
    ctx.beginPath(); ctx.arc(x+shk, coreY, rr, 0, Math.PI*2); ctx.stroke();
    const fr=Math.max(1, charge*7*bp);
    const cg=ctx.createRadialGradient(x+shk, coreY, 1, x+shk, coreY, fr);
    cg.addColorStop(0, `rgba(225,150,255,${charge})`);
    cg.addColorStop(1, "rgba(178,76,255,0)");
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(x+shk, coreY, fr, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

}

// Boss HP — pinned to the top-centre HUD strip rather than floating above the
// sprite. Anchored to the sprite it sat at `-bh/2 - 16*sc`, which with the boss
// at y=150*sc pushed it hard against the screen edge and straight through the
// HUD's wave label. Screen-pinned it can neither clip nor collide, and it stops
// jittering as the boss drifts.
function drawBossBar(ctx: CanvasRenderingContext2D, W: number, hp: number, maxHp: number, sc: number): void {
  const barW = Math.min(200*sc, W*0.5), barH = 9*sc;
  const x0 = W/2 - barW/2, barTop = 22*sc;
  ctx.save();
  ctx.textAlign="center"; ctx.textBaseline="top";
  ctx.font=`bold ${Math.round(11*sc)}px ${FONT}`;
  // The boss sits high enough that its upward thrusters reach this strip, so
  // the group gets a dark backing to stay legible over whatever is behind it.
  const padX = 10*sc, padY = 5*sc;
  const panelW = Math.max(barW, ctx.measureText("FINAL BOSS").width) + padX*2;
  ctx.fillStyle = "rgba(5,10,26,0.72)";
  ctx.fillRect(W/2 - panelW/2, 8*sc - padY, panelW, (barTop + barH) - 8*sc + padY*2);
  ctx.fillStyle="#caa24a";
  ctx.fillText("FINAL BOSS", W/2, 8*sc);
  ctx.fillStyle="#23232c"; ctx.fillRect(x0, barTop, barW, barH);
  ctx.fillStyle = hp>maxHp*0.5?"#a23cdb":hp>maxHp*0.25?"#e0a020":"#ff2e4d";
  ctx.fillRect(x0, barTop, barW*Math.max(0, hp/maxHp), barH);
  ctx.strokeStyle="rgba(255,255,255,0.7)"; ctx.lineWidth=1; ctx.strokeRect(x0, barTop, barW, barH);
  ctx.restore();
}

interface BossPart { idx: number; name: string; sideCD: number; beam: boolean; color: string; }
function bossPart(f: number): BossPart {
  // Two parts, split at 50% HP.
  return f > 0.5
    ? { idx:1, name:"SIDE CANNONS", sideCD:32, beam:false, color:"#a23cdb" }
    : { idx:2, name:"OVERDRIVE",    sideCD:22, beam:true,  color:"#ff7a2b" };
}

// Thin orange warning column that widens + a building core flash as charge -> 1
function drawBeamTelegraph(ctx: CanvasRenderingContext2D, cx: number, originY: number, H: number, sc: number, charge: number): void {
  const w = (1.5 + charge*5) * sc;
  ctx.save();
  ctx.fillStyle = `rgba(255,110,40,${0.12 + charge*0.45})`;
  ctx.fillRect(cx - w, originY, w*2, H - originY);
  const fr = Math.max(1, charge*9*sc);
  const g = ctx.createRadialGradient(cx, originY, 1, cx, originY, fr);
  g.addColorStop(0, `rgba(255,240,200,${charge})`); g.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, originY, fr, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// Sustained beam: layered orange column, white-hot center, origin flare
function drawBeam(ctx: CanvasRenderingContext2D, cx: number, originY: number, H: number, _sc: number, t: number, hw: number): void {
  const halfW = hw;
  const fl = 1 + Math.sin(t*0.9)*0.08 + Math.sin(t*2.3)*0.04;
  ctx.save();
  ctx.fillStyle = "rgba(255,106,31,0.5)";   ctx.fillRect(cx - halfW*fl, originY, halfW*2*fl, H - originY);
  ctx.fillStyle = "rgba(255,154,43,0.85)";  ctx.fillRect(cx - halfW*0.62, originY, halfW*1.24, H - originY);
  ctx.fillStyle = "rgba(255,210,122,0.9)";  ctx.fillRect(cx - halfW*0.4, originY, halfW*0.8, H - originY);
  ctx.fillStyle = "rgba(255,250,240,0.95)"; ctx.fillRect(cx - halfW*0.2, originY, halfW*0.4, H - originY);
  const fr = halfW*1.7;
  const g = ctx.createRadialGradient(cx, originY, 1, cx, originY, fr);
  g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.45, "rgba(255,154,43,0.6)"); g.addColorStop(1, "rgba(255,106,31,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, originY, fr, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function makeWave(wave: number, W: number, H: number, sc: number, mobile: boolean): Enemy[] {
  const cols=Math.min(4+wave, mobile?5:8);
  const rows=Math.min(1+wave,3);
  const spacingX=Math.min(62*sc,(W-80)/cols);
  const startX=(W-spacingX*(cols-1))/2;
  const startY = mobile ? H*0.12 : H*0.22;
  return Array.from({length:rows*cols},(_,i)=>({
    x:startX+(i%cols)*spacingX,
    y:startY+Math.floor(i/cols)*52*sc,
    w:28*sc, h:20*sc, alive:true,
  }));
}

function initGame(W: number, H: number, mobile: boolean): GameState {
  const sc = scaleFor(W, H, mobile);
  const playerY = mobile ? H * 0.93 : shipRestY(H, sc, mobile);
  return {
    t:0, sc, mobile, W, H,
    player:{ x:W/2, y:playerY, w:28*sc, h:28*sc, vx:0, hitT:0 },
    bullets:[], enemyBullets:[],
    enemies:makeWave(1,W,H,sc,mobile),
    mothership:{ x:W/2, y: 150*sc, w:BOSS_COLS*BOSS_PX(sc), h:BOSS_ROWS*BOSS_PX(sc), hp:30, maxHp:30, vx:1.5*sc*SPEED, sideCD:0, coreCD:Math.floor(rand(5,7)*60), chargeT:0, beamT:0 },
    phase:"title", wave:1, score:0, lives:MAX_LIVES, enemyDir:1,
    fireCD:0, enemyFireCD:60, bossFireCD:90,
    introT: 180,
    particles:[],
    stars:Array.from({length:80},()=>({x:rand(0,W),y:rand(0,H),size:rand(1,2.5),b:rand(0.3,1)})),
    waveMsg:0,
    overStart:0, endSel:0,
  };
}

// Re-fit a live run to a new box. Positions move proportionally and sizes
// follow the new scale, so a phone's URL bar collapsing (or a window resize,
// or a rotation) no longer throws the player back to the title screen.
function rescale(s: GameState, W: number, H: number, mobile: boolean): void {
  if(s.W === W && s.H === H && s.mobile === mobile) return;   // nothing moved
  const rx = s.W > 0 ? W/s.W : 1, ry = s.H > 0 ? H/s.H : 1;
  const sc = scaleFor(W, H, mobile);
  s.sc = sc; s.mobile = mobile; s.W = W; s.H = H;

  const p = s.player;
  p.x = Math.max(14*sc, Math.min(W-14*sc, p.x*rx));
  p.w = 28*sc; p.h = 28*sc;

  s.enemies.forEach(e=>{ e.x*=rx; e.y*=ry; e.w=28*sc; e.h=20*sc; if(e.homeX!=null) e.homeX*=rx; });
  s.bullets.forEach(b=>{ b.x*=rx; b.y*=ry; b.w=4*sc; b.h=14*sc; });
  s.enemyBullets.forEach(b=>{
    b.x*=rx; b.y*=ry;
    if(b.vx!=null) b.vx*=rx; if(b.vy!=null) b.vy*=ry; if(b.r!=null) b.r*=rx;
  });
  s.particles.forEach(pt=>{ pt.x*=rx; pt.y*=ry; });

  const m = s.mothership;
  m.x = Math.max(0, Math.min(W, m.x*rx));
  m.y = 150*sc;
  m.w = BOSS_COLS*BOSS_PX(sc); m.h = BOSS_ROWS*BOSS_PX(sc);
  m.vx = (m.vx < 0 ? -1 : 1) * 1.5*sc*SPEED;

  // Stars are decorative and uniformly random, so respreading beats stretching.
  s.stars = Array.from({length:80},()=>({x:rand(0,W),y:rand(0,H),size:rand(1,2.5),b:rand(0.3,1)}));
}

export default function InvadersGame(){
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchState = useRef<{ active: boolean; x: number | null }>({ active: false, x: null });
  const endBtnsRef = useRef<EndButtons | null>(null);   // YES/NO hit areas, set while drawing
  const [dims, setDims] = useState<Dims>(initialDims);
  const [previewWave, setPreviewWave] = useState<number>(1); // 1,2,3 = waves, 4 = boss
  const sfxRef = useRef<Sfx>(makeSfx());
  const [muted, setMuted] = useState<boolean>(false);

  const toggleMute = useCallback((): void => {
    setMuted(m => {
      const next = !m;
      sfxRef.current.setMuted(next);
      if(!next) sfxRef.current.unlock();   // unmuting is a gesture — a good moment to unlock audio
      return next;
    });
    containerRef.current?.focus();         // hand keyboard focus back to the game
  },[]);
  useEffect(()=>{ const sfx = sfxRef.current; return ()=>sfx.dispose(); },[]);

  const restart = useCallback((): void => {
    const {W,H,mobile}=dims;
    const s = initGame(W,H,mobile);
    s.phase = "waves";                     // PLAY AGAIN drops straight into a run
    stateRef.current = s;
  },[dims]);

  // Abandon the run and go back to the title screen (the end screen's NO).
  const toTitle = useCallback((): void => {
    const {W,H,mobile}=dims;
    stateRef.current = initGame(W,H,mobile);   // initGame already opens on "title"
  },[dims]);

  // Commit the end-screen choice: YES replays, NO returns to the title.
  const confirmEnd = useCallback((): void => {
    const s = stateRef.current;
    if(!s) return;
    if(s.endSel === 0) restart(); else toTitle();
  },[restart, toTitle]);


  // Primary "advance" input — Enter/Space, or a tap. Starts the run from the
  // title screen; on an end screen it confirms whichever option is selected.
  const startRun = useCallback((): void => {
    const s = stateRef.current;
    if(!s) return;
    sfxRef.current.unlock();               // this is a user gesture — good moment to arm audio
    if(s.phase === "title"){ s.phase = "waves"; s.introT = 180; }
    else if(s.phase === "dead" || s.phase === "won") confirmEnd();
  },[confirmEnd]);

  // Mouse clicks on the container. Touch is deliberately ignored here because
  // the canvas's touchstart handler owns it — pointerdown fires first, and
  // letting both act would run the choice twice.
  const handlePointerDown = useCallback((e: { clientX: number; clientY: number; pointerType?: string }): void => {
    containerRef.current?.focus();
    if(e.pointerType === "touch") return;
    const s = stateRef.current, canvas = canvasRef.current;
    if(s && canvas && (s.phase === "dead" || s.phase === "won")){
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width/rect.width);
      const y = (e.clientY - rect.top) * (canvas.height/rect.height);
      const b = endBtnsRef.current;
      const inside = (r: Rect): boolean => x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h;
      if(b && inside(b.yes)){ s.endSel = 0; startRun(); }
      else if(b && inside(b.no)){ s.endSel = 1; startRun(); }
      return;                                // a click off the options does nothing
    }
    startRun();
  },[startRun]);

  useEffect(()=>{
    // Measure the container, not the window. A window `resize` listener never
    // fires when an iframe is laid out after mount, which left the canvas stuck
    // at 0x0 with no way to recover. ResizeObserver catches that first layout.
    const el = containerRef.current;
    if(!el) return;
    const apply = (): void => {
      const r = el.getBoundingClientRect();
      const W = Math.round(r.width), H = Math.round(r.height);
      if(W === 0 || H === 0) return;                  // not laid out yet; wait
      // Return the SAME object when nothing changed so React bails out — an
      // always-new object re-ran the whole game effect on every spurious resize.
      setDims(prev => (prev.W===W && prev.H===H) ? prev : dimsFor(W,H));
    };
    apply();
    // Belt and braces: ResizeObserver covers container/iframe layout, the window
    // listener covers plain viewport changes. Both funnel through the same
    // deduped apply(), so whichever fires first wins and the other is a no-op.
    let ro: ResizeObserver | null = null;
    if(typeof ResizeObserver !== "undefined"){ ro = new ResizeObserver(apply); ro.observe(el); }
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return ()=>{
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  },[]);

  // Visual-pause preview: rebuild the formation when switching waves/boss
  useEffect(()=>{
    if(!VISUAL_PAUSE) return;  // dev tool only — must not touch live game state on resize
    const s = stateRef.current;
    if(!s) return;
    const {W,H,mobile}=dims;
    if(previewWave <= 3){
      s.phase = "waves";
      s.wave = previewWave;
      s.enemies = makeWave(previewWave, W, H, s.sc, mobile);
      s.enemyDir = 1;
    } else {
      s.phase = "boss";
      s.enemies = [];
      s.mothership.hp = s.mothership.maxHp;
    }
  },[previewWave, dims]);

  useEffect(()=>{
    const {W,H,mobile}=dims;
    // Build the run once; later size changes re-fit it rather than restarting.
    const existing = stateRef.current;
    if(existing) rescale(existing, W, H, mobile);
    else stateRef.current = initGame(W,H,mobile);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onKey = (e: KeyboardEvent): void => {
      if(e.code==="ArrowLeft"||e.code==="ArrowRight"||e.code==="ArrowUp"||e.code==="ArrowDown"||e.code==="Space") e.preventDefault();
      keysRef.current[e.code] = e.type === "keydown";
      if(e.type === "keydown"){
        sfxRef.current.unlock();          // audio needs a user gesture once
        if(e.code === "KeyM") toggleMute();
        // On an end screen the arrows move the YES/NO selection instead of the
        // ship. Both axes select — desktop lays the options out left/right,
        // mobile stacks them top/bottom, and either input device might be
        // present on either layout (a phone with a keyboard, a narrow desktop
        // window), so all four arrows just mean "previous / next option".
        const st = stateRef.current;
        if(st && (st.phase === "dead" || st.phase === "won")){
          if(e.code === "ArrowLeft"  || e.code === "KeyA" || e.code === "ArrowUp")   st.endSel = 0;
          if(e.code === "ArrowRight" || e.code === "KeyD" || e.code === "ArrowDown") st.endSel = 1;
        }
        if(e.code === "Enter" || e.code === "Space") startRun();
      }
    };
    // If focus leaves mid-hold (alt-tab, click outside the iframe) the matching
    // keyup never fires and the key stays stuck "down" forever — release all keys.
    const onBlur = (): void => { keysRef.current = {}; touchState.current.active = false; };
    window.addEventListener("keydown",onKey);
    window.addEventListener("keyup",onKey);
    window.addEventListener("blur",onBlur);
    document.addEventListener("visibilitychange",onBlur);
    // The artifact iframe needs focus before it receives key events.
    containerRef.current?.focus();

    const ctx = canvas.getContext("2d")!;

    const onTouchStart = (e: TouchEvent): void => {
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      const scaleX = canvas.width/rect.width, scaleY = canvas.height/rect.height;
      const tx = (e.touches[0].clientX - rect.left)*scaleX;
      const ty = (e.touches[0].clientY - rect.top)*scaleY;
      const st = stateRef.current;
      if(st && (st.phase === "dead" || st.phase === "won")){
        // On an end screen a tap only counts when it lands on YES or NO, so a
        // stray tap can't restart the run out from under you.
        const b = endBtnsRef.current;
        const inside = (r: Rect): boolean => tx>=r.x && tx<=r.x+r.w && ty>=r.y && ty<=r.y+r.h;
        if(b && inside(b.yes)){ st.endSel = 0; startRun(); }
        else if(b && inside(b.no)){ st.endSel = 1; startRun(); }
        return;
      }
      startRun();
      touchState.current={ active:true, x:tx };
    };
    const onTouchMove = (e: TouchEvent): void => {
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      touchState.current.x = (e.touches[0].clientX - rect.left)*(canvas.width/rect.width);
    };
    const onTouchEnd = (e: TouchEvent): void => { e.preventDefault(); touchState.current.active = false; };

    canvas.addEventListener("touchstart",onTouchStart,{passive:false});
    canvas.addEventListener("touchmove",onTouchMove,{passive:false});
    canvas.addEventListener("touchend",onTouchEnd,{passive:false});
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });


    function addParticles(x: number, y: number, color: string, n = 10): void {
      const s = stateRef.current;
      if (!s) return;
      for(let i=0;i<n;i++) s.particles.push({x,y,vx:rand(-4,4),vy:rand(-5,1),life:1,color,size:rand(3,7)});
    }

    // One simulation tick. Every speed and cooldown in here is expressed in
    // frames at 60Hz, so `frame()` below is responsible for calling this at a
    // fixed 60Hz regardless of the display's actual refresh rate.
    function step(): void {
      const s = stateRef.current;
      if (!s) return;
      const keys = keysRef.current;
      const {sc,mobile}=s;
      s.t++;
      // BGM plays on the entry screen, and through the "GET READY" intro beat.
      // The intro extends the window on purpose: unlock() and this phase flip
      // both fire inside the same tap, but AudioContext.resume() is async, so
      // gating strictly to "title" raced the very next frame's bgmWanted=false
      // against resume() finishing - on a fast resume the music never audibly
      // started. Riding through the 3s intro gives resume() many frames to
      // land instead of one, and doubles as a calm-before-the-fight beat.
      sfxRef.current.setBgmWanted(s.phase==="title" || (s.phase==="waves" && s.introT>0));

      // Title screen: no ship, no waves, no HUD — just the wordmark over the starfield.
      if(s.phase==="title"){
        drawTitleScreen(ctx, W, H, sc, s.t, s.stars, mobile);
        return;
      }

      // Both endings share one screen and one countdown; only the wordmark,
      // palette and stat rows differ.
      if(s.phase==="dead" || s.phase==="won"){
        const won = s.phase==="won";
        // Wall-clock, not frame count: the countdown is user-visible, so it must
        // read 15s on a 120Hz display too.
        // overStart doubles as a once-guard, so the cue can't retrigger every frame.
        if(s.overStart===0){ s.overStart = performance.now(); s.endSel = 0; if(won) sfxRef.current.win(); else sfxRef.current.lose(); }
        const elapsed = (performance.now() - s.overStart)/1000;
        const secsLeft = Math.max(0, Math.ceil(GAMEOVER_SECS - elapsed));
        const scoreStr = String(s.score).padStart(SCORE_DIGITS,"0");
        endBtnsRef.current = drawResultScreen(ctx, W, H, sc, s.t, s.stars, mobile, won
          ? { lines:["MISSION","COMPLETE"], fill:WIN_FILL, edge:WIN_EDGE, sel:s.endSel, secsLeft,
              stats:[["SCORE", scoreStr], ["LIVES LEFT", String(Math.max(0, s.lives))]] }
          : { lines:["GAME","OVER"], fill:OVER_FILL, edge:OVER_EDGE, sel:s.endSel, secsLeft,
              stats:[["SCORE", scoreStr], ["REACHED", s.wave > 3 ? "FINAL BOSS" : `WAVE ${s.wave}`]] });
        // Timing out is the same as choosing YES.
        if(elapsed >= GAMEOVER_SECS) restart();
        return;
      }

      const inIntro = (s.introT > 0) || VISUAL_PAUSE;
      if(s.introT > 0){ s.introT--; }

      const p=s.player;
      const spd=5*sc*SPEED;
      p.y = mobile ? H * 0.93 : shipRestY(H, sc, mobile);
      const prevX = p.x;

      // Pointer steering — touch on mobile, mouse on desktop — eases the ship toward the cursor.
      if(touchState.current.active && touchState.current.x !== null){
        const targetX = Math.max(p.w/2, Math.min(W-p.w/2, touchState.current.x));
        p.x += (targetX - p.x) * 0.30;
      }
      if(keys["ArrowLeft"]||keys["KeyA"]) p.x=Math.max(p.w/2,p.x-spd);
      if(keys["ArrowRight"]||keys["KeyD"]) p.x=Math.min(W-p.w/2,p.x+spd);

      // Fire while a control is held — touch on mobile, or a move/fire key on desktop.
      // (Releasing everything stops the shooting.)
      const moveHeld = keys["ArrowLeft"]||keys["ArrowRight"]||keys["KeyA"]||keys["KeyD"];
      const firing = mobile ? touchState.current.active : (moveHeld||keys["Space"]||keys["ArrowUp"]);
      s.fireCD--;
      if(firing && s.fireCD<=0 && !inIntro){
        s.bullets.push({x:p.x,y:p.y-20*sc,w:4*sc,h:14*sc}); s.fireCD = Math.round(14/SPEED);
        sfxRef.current.shoot();
      }

      const bspd=9*sc*SPEED, espd=4*sc*SPEED;
      s.bullets=s.bullets.filter(b=>{b.y-=bspd; return b.y>-20;});
      s.enemyBullets=s.enemyBullets.filter(b=>{ b.x+=b.vx||0; b.y+=(b.vy!=null?b.vy:espd); return b.y<H+40 && b.y>-40 && b.x>-40 && b.x<W+40; });

      if(p.hitT>0) p.hitT--;
      s.enemyBullets=s.enemyBullets.filter(b=>{
        const br=b.r||3*sc;
        if(overlap({x:b.x-br,y:b.y-br,w:br*2,h:br*2},{x:p.x-14*sc,y:p.y-14*sc,w:28*sc,h:28*sc})){
          if(p.hitT<=0){ addParticles(p.x,p.y,"#00cfff",12); s.lives--; p.hitT=INVULN; if(s.lives<=0) s.phase="dead"; }
          return false;
        }
        return true;
      });

      if(!inIntro && s.phase==="waves"){
        s.enemyFireCD--;
        if(s.enemyFireCD<=0){
          const alive=s.enemies.filter(e=>e.alive);
          if(alive.length){ const e=alive[Math.floor(Math.random()*alive.length)]; s.enemyBullets.push({x:e.x,y:e.y+10*sc,vx:rand(-0.5,0.5)*sc}); sfxRef.current.enemyShoot(); }
          s.enemyFireCD=Math.max(25,60-s.wave*5);
        }
        const alive=s.enemies.filter(e=>e.alive);
        // ── Descent drive (1-grid) ── the whole formation moves as ONE rigid block:
        // uniform side-to-side march that bounces at the walls + a steady sink toward you.
        const stepX=(0.9+s.wave*0.15)*sc*(mobile?0.6:1)*SPEED;
        const descend=(0.24+s.wave*0.05)*sc*(mobile?0.85:1)*SPEED;
        alive.forEach(e=>{ e.x+=s.enemyDir*stepX; e.y+=descend; });
        const hitWall=alive.some(e=>e.x>W-40||e.x<40);
        if(hitWall){ s.enemyDir*=-1; alive.forEach(e=>{ e.x+=s.enemyDir*stepX*2; }); }

        // breach — an enemy slipping past your line ends the run
        if(alive.some(e=>e.y>p.y)){ s.lives=0; s.phase="dead"; }

        if(alive.some(e=>overlap({x:e.x-11*sc,y:e.y-8*sc,w:22*sc,h:16*sc},{x:p.x-14*sc,y:p.y-14*sc,w:28*sc,h:28*sc}))){
          s.lives=0; s.phase="dead";
        }

        s.bullets=s.bullets.filter(b=>{
          for(let e of s.enemies){
            if(!e.alive) continue;
            if(overlap({x:b.x-2*sc,y:b.y-7*sc,w:4*sc,h:14*sc},{x:e.x-11*sc,y:e.y-8*sc,w:22*sc,h:16*sc})){
              e.alive=false; addParticles(e.x,e.y,"#ff3366"); s.score+=10; return false;
            }
          }
          return true;
        });
        if(s.enemies.every(e=>!e.alive)){
          s.wave++;
          if(s.wave>3){ s.phase="boss"; s.enemyBullets=[]; s.introT=120; s.mothership.sideCD=30; s.mothership.coreCD=Math.floor(rand(5,7)*60); s.mothership.chargeT=0; s.mothership.beamT=0; }
          else{ s.enemies=makeWave(s.wave,W,H,sc,mobile); s.enemyDir=1; s.waveMsg=90; s.introT=90; }
        }
      }

      if(!inIntro && s.phase==="boss"){
        const m=s.mothership;
        const bp=BOSS_PX(sc);
        const margin=BOSS_COLS*bp*0.5 + 6;
        if(m.beamT<=0){ m.x+=m.vx; if(m.x>W-margin||m.x<margin) m.vx*=-1; }  // freeze while the beam fires

        const part=bossPart(m.hp/m.maxHp);
        const muzzleY=m.y+14*bp;                 // center barrel muzzle
        const sidePod=25*bp, sideY=m.y-4*bp;     // red side-cannon muzzles

        // ── Side cannons (both parts) ── aimed red bolts; silenced while the beam fires
        m.sideCD--;
        if(m.beamT<=0 && m.sideCD<=0){
          [-sidePod,sidePod].forEach(px=>{
            const ox=m.x+px, oy=sideY;
            const ang=Math.atan2(p.y-oy, p.x-ox);
            s.enemyBullets.push({ x:ox, y:oy, vx:Math.cos(ang)*espd*0.9, vy:Math.max(1.2*sc, Math.sin(ang)*espd*0.9), r:3*sc, color:"#ff5a4a" });
          });
          sfxRef.current.enemyShoot();   // one cue for the salvo, not one per barrel
          m.sideCD=part.sideCD;
        }

        // ── Overdrive beam (Part 2, <50% HP) ── charge telegraph, then a ~2s triple beam; boss frozen
        if(part.beam){
          if(m.beamT>0){
            m.beamT--;
            const inC=Math.abs(p.x-m.x)<3*bp && p.y>muzzleY;
            const inL=Math.abs(p.x-(m.x-sidePod))<2*bp && p.y>sideY;
            const inR=Math.abs(p.x-(m.x+sidePod))<2*bp && p.y>sideY;
            if((inC||inL||inR) && p.hitT<=0){ addParticles(p.x,p.y,"#00cfff",12); s.lives--; p.hitT=INVULN; if(s.lives<=0) s.phase="dead"; }  // INVULN(60) within BEAM_TIME(120) => up to 2 lives per beam
            if(m.beamT<=0) m.coreCD=Math.floor(rand(6,9)*60);
          } else if(m.chargeT>0){
            m.chargeT--;
            if(m.chargeT<=0){ m.beamT=BEAM_TIME; addParticles(m.x,muzzleY,"#ff9a2b",26); }
          } else {
            m.coreCD--;
            if(m.coreCD<=0) m.chargeT=CORE_CHARGE;
          }
        } else { m.chargeT=0; m.beamT=0; }

        // Hitbox locked to the central body so the arms don't take unfair hits.
        const hbW=26*bp, hbH=54*bp;
        s.bullets=s.bullets.filter(b=>{
          if(overlap({x:b.x-2*sc,y:b.y-7*sc,w:4*sc,h:14*sc},{x:m.x-hbW/2,y:m.y-hbH/2,w:hbW,h:hbH})){
            m.hp--; addParticles(b.x,b.y,part.color,5); s.score+=5;
            if(m.hp<=0){ addParticles(m.x,m.y,"#ff7a2b",30); addParticles(m.x-40*sc,m.y,"#caa24a",18); addParticles(m.x+40*sc,m.y,"#ff2e4d",18); s.phase="won"; }
            return false;
          }
          return true;
        });
      }

      s.particles=s.particles.filter(pt=>pt.life>0);
      s.particles.forEach(pt=>{pt.x+=pt.vx;pt.y+=pt.vy;pt.vy+=0.2;pt.life-=0.03;});
      if(s.waveMsg>0) s.waveMsg--;

      // ── Draw ──
      ctx.fillStyle="#050a1a"; ctx.fillRect(0,0,W,H);
      s.stars.forEach(st=>{ ctx.globalAlpha=st.b; ctx.fillStyle="#fff"; ctx.fillRect(st.x,st.y,st.size,st.size); });
      ctx.globalAlpha=1;

      if(s.phase==="waves") s.enemies.forEach(e=>{ if(e.alive) drawEnemy(ctx,e.x,e.y,s.t,sc); });
      if(((s.phase as Phase)==="boss"||(s.phase as Phase)==="won")&&s.mothership.hp>0){
        const m=s.mothership, bp=BOSS_PX(sc);
        const muzzleY=m.y+14*bp, sidePod=25*bp, sideY=m.y-4*bp;
        drawMothership(ctx,m.x,m.y,m.hp,m.maxHp,s.t,sc,0);
        if(m.chargeT>0){
          const tch=1-m.chargeT/CORE_CHARGE;
          drawBeamTelegraph(ctx,m.x,muzzleY,H,sc,tch);
          drawBeamTelegraph(ctx,m.x-sidePod,sideY,H,sc,tch);
          drawBeamTelegraph(ctx,m.x+sidePod,sideY,H,sc,tch);
        }
      }
      const isMoving = Math.abs(p.x - prevX) > 0.5;
      const blink = p.hitT>0 && Math.floor(s.t/3)%2===0;
      if(s.lives>0 && !blink) drawJet(ctx,p.x,p.y,sc,s.t,isMoving);
      // triple beam drawn over the player so a caught ship reads as "in the beam"
      if((s.phase as Phase)==="boss" && s.mothership.beamT>0){
        const m=s.mothership, bp=BOSS_PX(sc);
        const muzzleY=m.y+14*bp, sidePod=25*bp, sideY=m.y-4*bp;
        drawBeam(ctx,m.x-sidePod,sideY,H,sc,s.t,2*bp);
        drawBeam(ctx,m.x+sidePod,sideY,H,sc,s.t,2*bp);
        drawBeam(ctx,m.x,muzzleY,H,sc,s.t,3*bp);
      }

      ctx.fillStyle="#00ffcc";
      s.bullets.forEach(b=>{ ctx.shadowColor="#00ffcc"; ctx.shadowBlur=8; ctx.fillRect(b.x-2*sc,b.y-7*sc,4*sc,14*sc); });
      s.enemyBullets.forEach(b=>{
        const col=b.color||"#ff4455", r=b.r||3*sc;
        ctx.fillStyle=col; ctx.shadowColor=col;
        if(b.big){ ctx.shadowBlur=16; ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.fill(); }
        else { ctx.shadowBlur=6; ctx.fillRect(b.x-r, b.y-r*2, r*2, r*4); }
      });
      ctx.shadowBlur=0;

      // particles
      s.particles.forEach(pt=>{ ctx.globalAlpha=Math.max(0,pt.life); ctx.fillStyle=pt.color; ctx.fillRect(pt.x,pt.y,pt.size,pt.size); });
      ctx.globalAlpha=1;

      // ── HUD ──
      const pad=12*sc;
      ctx.textBaseline="top";
      // Score — stacked label over zero-padded value (top-left), cleared past the
      // speaker button, which is a DOM overlay pinned at the same padding.
      const mbox = muteBox(sc);
      const scoreX = mbox.left + mbox.size + Math.round(10*sc);
      ctx.textAlign="left";
      ctx.fillStyle="#5a6b88"; ctx.font=`bold ${Math.round(10*sc)}px ${FONT}`;
      ctx.fillText("SCORE:", scoreX, 8*sc);
      ctx.fillStyle="#9fb4d6"; ctx.font=`bold ${Math.round(16*sc)}px ${FONT}`;
      ctx.fillText(String(s.score).padStart(SCORE_DIGITS,"0"), scoreX, 20*sc);
      // Wave — top-center, with a blinking GET READY tucked underneath during
      // the intro. Replaces the old full-screen banner, which covered the field.
      ctx.textAlign="center";
      if(s.phase==="boss"){
        // The bar's own "FINAL BOSS" caption names the phase, so a wave label
        // here would just be a second thing in the same 20px of screen.
        // Held back during the intro so it doesn't overlap the GET READY blink.
        if(s.introT<=0) drawBossBar(ctx, W, s.mothership.hp, s.mothership.maxHp, sc);
      } else {
        ctx.fillStyle="#5a6b88"; ctx.font=`bold ${Math.round(11*sc)}px ${FONT}`;
        ctx.fillText(`WAVE ${s.wave}`, W/2, 8*sc);
      }
      if(s.introT>0 && !VISUAL_PAUSE && Math.floor(s.t/20)%2===0){
        ctx.fillStyle=TITLE_FILL; ctx.font=`bold ${Math.round(10*sc)}px ${FONT}`;
        ctx.fillText("GET READY", W/2, 22*sc);
      }
      // Lives — label + red pixel hearts (top-right)
      ctx.textAlign="right";
      ctx.fillStyle="#5a6b88"; ctx.font=`bold ${Math.round(10*sc)}px ${FONT}`;
      ctx.fillText("LIVES", W-pad, 8*sc);
      const hps=Math.max(1, Math.round(2*sc));
      const hw=HEART[0].length*hps, hgap=Math.max(2,Math.round(4*sc));
      const totalW=MAX_LIVES*hw+(MAX_LIVES-1)*hgap;
      let hx=W-pad-totalW;
      for(let i=0;i<MAX_LIVES;i++){
        const filled = i >= MAX_LIVES - Math.max(0,s.lives);  // empty left-to-right
        drawHeart(ctx, hx, 22*sc, hps, filled ? "#ff3b56" : "#8a3a48", filled);
        hx+=hw+hgap;
      }
      ctx.textBaseline="alphabetic";
    }

    // ── Fixed-timestep driver ────────────────────────────────────────────────
    // The simulation is frame-counted, so running it once per rAF tied its speed
    // to the refresh rate: 2x on a 120Hz panel. Phones make that worse by ramping
    // the panel from ~60Hz to 120Hz the moment you touch the screen, so the game
    // visibly doubled speed mid-drag. Accumulate real elapsed time instead and
    // spend it in whole 60Hz ticks, which keeps every tuned constant valid.
    const STEP_MS = 1000/60;
    const MAX_CATCHUP = 3;     // cap so a long stall can't trigger a burst of ticks
    let acc = 0, last = 0;
    function frame(now: number): void {
      if(last === 0) last = now;
      acc += Math.min(now - last, 250);   // clamp: returning from a background tab
      last = now;
      let ran = 0;
      while(acc >= STEP_MS && ran < MAX_CATCHUP){ step(); acc -= STEP_MS; ran++; }
      if(ran === MAX_CATCHUP) acc = 0;    // gave up catching up; drop the backlog
      animRef.current = requestAnimationFrame(frame);
    }
    animRef.current = requestAnimationFrame(frame);

    return ()=>{
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown",onKey);
      window.removeEventListener("keyup",onKey);
      window.removeEventListener("blur",onBlur);
      document.removeEventListener("visibilitychange",onBlur);
      canvas.removeEventListener("touchstart",onTouchStart);
      canvas.removeEventListener("touchmove",onTouchMove);
      canvas.removeEventListener("touchend",onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  },[dims, toggleMute, startRun, restart]);

  const navBtn: CSSProperties = { pointerEvents:"auto", width:46, height:46, borderRadius:10, border:"1px solid #3a4a6a", background:"rgba(16,26,46,0.9)", color:"#cdd9f0", fontSize:18, cursor:"pointer" };

  const mbox = muteBox(scaleFor(dims.W, dims.H, dims.mobile));
  const muteBtn: CSSProperties = {
    position:"absolute", left:mbox.left, top:mbox.top, width:mbox.size, height:mbox.size,
    display:"grid", placeItems:"center", padding:0, lineHeight:0,
    borderRadius:Math.round(mbox.size*0.27), border:"1px solid #2a3a5a",
    background:"rgba(16,26,46,0.72)", color: muted ? "#5a6b88" : "#9fb4d6", cursor:"pointer",
  };

  return (
    <>
      {/* 100vh is the LARGEST possible viewport — as if the browser's address/
         nav bars were hidden — so on a phone with the bars showing (the common
         case on first load) it measures taller than what's actually visible,
         and bottom-anchored content like the entry prompt ends up drawn
         underneath the chrome. 100dvh tracks the real visible height instead;
         listed second so it's the one browsers that support it use, while the
         100vh above it still serves as the fallback for the few that don't.
         (Two same-property declarations can't both live in one React style
         object, hence the dedicated rule here.) */}
      <style>{`.ci-viewport{width:100vw;width:100dvw;height:100vh;height:100dvh}`}</style>
      <div ref={containerRef} tabIndex={0} onPointerDown={handlePointerDown} className="ci-viewport"
        style={{position:"relative", background:"#050a1a", touchAction:"none", overflow:"hidden", fontFamily:FONT, outline:"none"}}>
        <canvas ref={canvasRef} width={dims.W} height={dims.H} style={{display:"block", width:"100%", height:"100%"}} />

      {/* stopPropagation: pre-muting on the title screen must not also start the run */}
      <button onClick={toggleMute} style={muteBtn} aria-pressed={muted}
        onPointerDown={e=>e.stopPropagation()}
        aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
        title={muted ? "Sound off — press M" : "Sound on — press M"}>
        <svg width={Math.round(mbox.size*0.6)} height={Math.round(mbox.size*0.6)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 9h3.2L12 5v14l-4.8-4H4z" fill="currentColor" />
          {muted
            ? <path d="M16 9.5l5.5 5.5M21.5 9.5L16 15" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            : <><path d="M15.6 9.2a4 4 0 010 5.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                <path d="M18.6 6.6a8 8 0 010 10.8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>}
        </svg>
      </button>

      {VISUAL_PAUSE && (
        <div style={{position:"absolute", left:0, right:0, bottom:18, display:"flex", justifyContent:"center", alignItems:"center", gap:18, pointerEvents:"none"}}>
          <button onClick={()=>setPreviewWave(w=>w>1?w-1:4)} style={navBtn} aria-label="Previous">◀</button>
          <div style={{color:"#caa24a", fontWeight:"bold", letterSpacing:2, fontSize:14, textShadow:"0 1px 3px #000"}}>
            PREVIEW — {previewWave<=3 ? `WAVE ${previewWave}` : "BOSS"}
          </div>
          <button onClick={()=>setPreviewWave(w=>w<4?w+1:1)} style={navBtn} aria-label="Next">▶</button>
        </div>
      )}

      {/* Both endings are drawn on the canvas now — no DOM overlay. */}
      </div>
    </>
  );
}
