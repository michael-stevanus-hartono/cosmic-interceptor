import { useEffect, useRef, useState, type CSSProperties } from "react";

// ── Types ──
type Rect = { x: number; y: number; w: number; h: number };
type Sprite = { palette: Record<number, string>; grid: number[][] };

interface Bullet { x: number; y: number; }
interface EBullet { x: number; y: number; vx: number; vy: number; r: number; color: string; big?: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface Star { x: number; y: number; size: number; b: number; }
interface Boss { x: number; y: number; hp: number; maxHp: number; vx: number; sideCD: number; coreCD: number; chargeT: number; beamT: number; }
interface Player { x: number; y: number; hitT: number; }

interface State {
  t: number; sc: number; W: number; H: number;
  player: Player;
  bullets: Bullet[]; eb: EBullet[];
  boss: Boss;
  particles: Particle[]; stars: Star[];
  fireCD: number; flash: number;
}

interface Phase {
  idx: number; name: string;
  sideCD: number; beam: boolean;
  color: string;
}

const FONT = "'Courier New', ui-monospace, monospace";
const BOSS_PX = (sc: number): number => Math.max(2, 3.6 * sc);
const BOSS_COLS = 56, BOSS_ROWS = 64;
const CORE_CHARGE = 55;   // beam charge-up (telegraph) frames
const BEAM_TIME = 120;    // ~2s beam (ship freezes)

const BFLAME = { core: "#ffd27a", mid: "#ff9a2b", deep: "#ff6a1f" };
const BOSS_NOZZLES = [
  { cells: [10, 11, 12], top: 6 },
  { cells: [17, 18, 19], top: 0 },
  { cells: [36, 37, 38], top: 0 },
  { cells: [43, 44, 45], top: 6 },
];

function rand(a: number, b: number): number { return Math.random() * (b - a) + a; }
function overlap(a: Rect, b: Rect): boolean { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ── Boss attack states, gated by remaining HP fraction ──
function bossPhase(f: number): Phase {
  // Two parts, split at 50% HP.
  return f > 0.5
    ? { idx: 1, name: "SIDE CANNONS", sideCD: 32, beam: false, color: "#a23cdb" }
    : { idx: 2, name: "OVERDRIVE",    sideCD: 22, beam: true,  color: "#ff7a2b" };
}

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
function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, cx: number, cy: number, pixel: number): void {
  const { grid, palette } = sprite;
  const rows = grid.length, cols = grid[0].length;
  const ox = Math.round(cx - (cols * pixel) / 2);
  const oy = Math.round(cy - (rows * pixel) / 2);
  const ps = Math.ceil(pixel);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = grid[r][c]; if (!v) continue;
    ctx.fillStyle = palette[v];
    ctx.fillRect(ox + Math.floor(c * pixel), oy + Math.floor(r * pixel), ps, ps);
  }
}

function drawBossThrusters(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, sc: number): void {
  const bp = BOSS_PX(sc);
  const ox = Math.round(x - BOSS_COLS * bp / 2);
  const oy = Math.round(y - BOSS_ROWS * bp / 2);
  const ps = Math.ceil(bp);
  BOSS_NOZZLES.forEach((nz, idx) => {
    const phase = t * 0.45 + idx * 1.7;
    const flick = Math.sin(phase);
    const len = Math.round(3 + (flick * 0.5 + 0.5) * 4);
    const topY = oy + nz.top * bp;
    for (let i = 0; i < len; i++) {
      if (i >= len - 1 && Math.sin(phase * 2.1 + i) < 0) continue;
      const yy = topY - (i + 1) * bp;
      const f = i / len;
      ctx.fillStyle = f < 0.18 ? BFLAME.core : f < 0.6 ? BFLAME.mid : BFLAME.deep;
      const w = f < 0.5 ? 3 : f < 0.8 ? 2 : 1;
      const start = (3 - w) >> 1;
      for (let k = 0; k < w; k++) ctx.fillRect(ox + nz.cells[start + k] * bp, yy, ps, ps);
    }
  });
}

function drawMothership(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, maxHp: number, t: number, sc: number): void {
  const bp = BOSS_PX(sc);
  const bw = BOSS_COLS * bp, bh = BOSS_ROWS * bp;
  const shk = hp < maxHp * 0.3 ? Math.sin(t * 0.3) * 3 : 0;

  if (hp > maxHp * 0.5) {
    ctx.save(); ctx.translate(x + shk, y);
    const a = 0.20 + Math.sin(t * 0.07) * 0.14;
    ctx.strokeStyle = `rgba(150,80,220,${a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.60, bh * 0.50, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  const coreY = y - 4 * bp;
  ctx.save();
  const ga = 0.32 + Math.sin(t * 0.12) * 0.16;
  const g = ctx.createRadialGradient(x, coreY, 1, x, coreY, 9 * bp);
  g.addColorStop(0, `rgba(150,60,220,${ga})`); g.addColorStop(1, "rgba(150,60,220,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, coreY, 9 * bp, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  drawBossThrusters(ctx, x + shk, y, t, sc);
  drawSprite(ctx, BOSS_SPRITE, x + shk, y, bp);
}

// Telegraph: thin orange warning column that widens + a building core flash as charge -> 1
function drawBeamTelegraph(ctx: CanvasRenderingContext2D, cx: number, coreY: number, H: number, sc: number, charge: number): void {
  const w = (1.5 + charge * 5) * sc;
  ctx.save();
  ctx.fillStyle = `rgba(255,110,40,${0.12 + charge * 0.45})`;
  ctx.fillRect(cx - w, coreY, w * 2, H - coreY);
  const fr = Math.max(1, charge * 9 * sc);
  const g = ctx.createRadialGradient(cx, coreY, 1, cx, coreY, fr);
  g.addColorStop(0, `rgba(255,240,200,${charge})`); g.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, coreY, fr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// The sustained beam: layered orange column, white-hot center, origin flare
function drawBeam(ctx: CanvasRenderingContext2D, cx: number, coreY: number, H: number, sc: number, t: number, hw: number): void {
  const bp = BOSS_PX(sc);
  const halfW = hw;
  const fl = 1 + Math.sin(t * 0.9) * 0.08 + Math.sin(t * 2.3) * 0.04;
  ctx.save();
  ctx.fillStyle = "rgba(255,106,31,0.5)";   ctx.fillRect(cx - halfW * fl, coreY, halfW * 2 * fl, H - coreY);
  ctx.fillStyle = "rgba(255,154,43,0.85)";  ctx.fillRect(cx - halfW * 0.62, coreY, halfW * 1.24, H - coreY);
  ctx.fillStyle = "rgba(255,210,122,0.9)";  ctx.fillRect(cx - halfW * 0.4, coreY, halfW * 0.8, H - coreY);
  ctx.fillStyle = "rgba(255,250,240,0.95)"; ctx.fillRect(cx - halfW * 0.2, coreY, halfW * 0.4, H - coreY);
  const fr = halfW * 1.7;
  const g = ctx.createRadialGradient(cx, coreY, 1, cx, coreY, fr);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.45, "rgba(255,154,43,0.6)");
  g.addColorStop(1, "rgba(255,106,31,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, coreY, fr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number, t: number, hit: boolean): void {
  if (hit && Math.floor(t / 3) % 2 === 0) return;
  const fl = 6 + Math.sin(t * 0.5) * 3;
  ctx.fillStyle = "#00dbdb";
  ctx.beginPath(); ctx.moveTo(x - 5 * sc, y + 10 * sc); ctx.lineTo(x + 5 * sc, y + 10 * sc); ctx.lineTo(x, y + (10 + fl) * sc); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#cdd9f0";
  ctx.beginPath(); ctx.moveTo(x, y - 12 * sc); ctx.lineTo(x - 11 * sc, y + 10 * sc); ctx.lineTo(x + 11 * sc, y + 10 * sc); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3a4a6a"; ctx.fillRect(x - 3 * sc, y - 2 * sc, 6 * sc, 8 * sc);
}

function initState(W: number, H: number): State {
  const sc = W / 480;
  return {
    t: 0, sc, W, H,
    player: { x: W / 2, y: H - 70 * sc, hitT: 0 },
    bullets: [], eb: [],
    boss: { x: W / 2, y: 160 * sc, hp: 100, maxHp: 100, vx: 1.0 * sc, sideCD: 30, coreCD: 100, chargeT: 0, beamT: 0 },
    particles: [], stars: Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H), size: rand(1, 2.5), b: rand(0.3, 1) })),
    fireCD: 0, flash: 0,
  };
}

export default function BossArena() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<State | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const touchRef = useRef<{ active: boolean; x: number | null }>({ active: false, x: null });
  const [phaseName, setPhaseName] = useState("SIDE CANNONS");

  const W = 480, H = 600;

  const setHp = (frac: number): void => {
    const s = stateRef.current;
    if (s) { s.boss.hp = Math.max(1, Math.round(s.boss.maxHp * frac)); s.boss.chargeT = 0; s.boss.beamT = 0; s.boss.coreCD = 60; }
  };

  useEffect(() => {
    stateRef.current = initState(W, H);
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const onKey = (e: KeyboardEvent): void => { keysRef.current[e.code] = e.type === "keydown"; };
    // If focus leaves mid-hold (alt-tab, click outside the iframe) the matching
    // keyup never fires and the key stays stuck "down" forever — release all keys.
    const onBlur = (): void => { keysRef.current = {}; touchRef.current.active = false; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur); document.addEventListener("visibilitychange", onBlur);

    const rectX = (cx: number): number => {
      const r = canvas.getBoundingClientRect();
      return (cx - r.left) * (W / r.width);
    };
    const onTS = (e: TouchEvent): void => { e.preventDefault(); touchRef.current = { active: true, x: rectX(e.touches[0].clientX) }; };
    const onTM = (e: TouchEvent): void => { e.preventDefault(); touchRef.current.x = rectX(e.touches[0].clientX); };
    const onTE = (e: TouchEvent): void => { e.preventDefault(); touchRef.current.active = false; };
    canvas.addEventListener("touchstart", onTS, { passive: false });
    canvas.addEventListener("touchmove", onTM, { passive: false });
    canvas.addEventListener("touchend", onTE, { passive: false });
    canvas.addEventListener("touchcancel", onTE, { passive: false });

    function addParticles(x: number, y: number, color: string, n = 10): void {
      const s = stateRef.current; if (!s) return;
      for (let i = 0; i < n; i++) s.particles.push({ x, y, vx: rand(-4, 4), vy: rand(-5, 1), life: 1, color, size: rand(3, 7) });
    }

    function loop(): void {
      const s = stateRef.current; if (!s) { animRef.current = requestAnimationFrame(loop); return; }
      const keys = keysRef.current; const { sc } = s; const p = s.player; const m = s.boss;
      s.t++;

      const bspd = 7 * sc, espd = 3.4 * sc, spd = 5 * sc;
      if (keys["ArrowLeft"] || keys["KeyA"]) p.x = Math.max(16 * sc, p.x - spd);
      if (keys["ArrowRight"] || keys["KeyD"]) p.x = Math.min(W - 16 * sc, p.x + spd);
      if (touchRef.current.active && touchRef.current.x !== null) p.x += (Math.max(16 * sc, Math.min(W - 16 * sc, touchRef.current.x)) - p.x) * 0.25;

      s.fireCD--;
      const firing = keys["Space"] || keys["ArrowUp"] || touchRef.current.active;
      if (firing && s.fireCD <= 0) { s.bullets.push({ x: p.x, y: p.y - 14 * sc }); s.fireCD = 9; }
      s.bullets = s.bullets.filter(b => { b.y -= bspd; return b.y > -20; });

      const bp = BOSS_PX(sc); const hbW = 26 * bp, hbH = 54 * bp;
      s.bullets = s.bullets.filter(b => {
        if (overlap({ x: b.x - 2 * sc, y: b.y - 7 * sc, w: 4 * sc, h: 14 * sc }, { x: m.x - hbW / 2, y: m.y - hbH / 2, w: hbW, h: hbH })) {
          m.hp = Math.max(0, m.hp - 1);
          addParticles(b.x, b.y, bossPhase(m.hp / m.maxHp).color, 4);
          if (m.hp <= 0) { addParticles(m.x, m.y, "#ff7a2b", 40); addParticles(m.x, m.y, "#b24cff", 30); m.hp = m.maxHp; m.chargeT = 0; m.beamT = 0; }
          return false;
        }
        return true;
      });

      const margin = BOSS_COLS * bp * 0.5 + 6;
      if (m.beamT <= 0) { m.x += m.vx; if (m.x > W - margin || m.x < margin) m.vx *= -1; }  // freeze during beam

      const ph = bossPhase(m.hp / m.maxHp);
      const muzzleY = m.y + 14 * bp;        // center barrel muzzle
      const sidePod = 25 * bp, sideY = m.y - 4 * bp;  // red side-cannon muzzles

      // ── Side cannons (both parts) ── two red pods, rapid aimed bolts
      m.sideCD--;
      if (m.beamT <= 0 && m.sideCD <= 0) {
        [-sidePod, sidePod].forEach(px => {
          const ox = m.x + px, oy = sideY;
          const a = Math.atan2(p.y - oy, p.x - ox), sp = espd * 1.05;
          s.eb.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.max(1.2 * sc, Math.sin(a) * sp), r: 3 * sc, color: "#ff5a4a" });
        });
        m.sideCD = ph.sideCD;
      }

      // ── Middle beam (Part 2 only) ── charge-up telegraph, then a sustained orange beam
      if (ph.beam) {
        if (m.beamT > 0) {
          m.beamT--;
          const inC = Math.abs(p.x - m.x) < 3 * bp && p.y > muzzleY;
          const inL = Math.abs(p.x - (m.x - sidePod)) < 2 * bp && p.y > sideY;
          const inR = Math.abs(p.x - (m.x + sidePod)) < 2 * bp && p.y > sideY;
          if (inC || inL || inR) { p.hitT = Math.max(p.hitT, 6); s.flash = Math.max(s.flash, 12); }
          if (m.beamT <= 0) m.coreCD = Math.floor(rand(6, 9) * 60);
        } else if (m.chargeT > 0) {
          m.chargeT--;
          if (m.chargeT <= 0) { m.beamT = BEAM_TIME; addParticles(m.x, muzzleY, "#ff9a2b", 26); }
        } else {
          m.coreCD--;
          if (m.coreCD <= 0) m.chargeT = CORE_CHARGE;
        }
      } else { m.chargeT = 0; m.beamT = 0; }

      // enemy bullets
      s.eb = s.eb.filter(b => { b.x += b.vx; b.y += b.vy; return b.y < H + 40 && b.y > -60 && b.x > -40 && b.x < W + 40; });
      if (p.hitT > 0) p.hitT--;
      s.eb = s.eb.filter(b => {
        if (overlap({ x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 }, { x: p.x - 11 * sc, y: p.y - 11 * sc, w: 22 * sc, h: 22 * sc })) {
          addParticles(p.x, p.y, "#00cfff", 12); p.hitT = 18; s.flash = 14;
          return false;
        }
        return true;
      });

      s.particles = s.particles.filter(pt => pt.life > 0);
      s.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.life -= 0.03; });
      if (s.flash > 0) s.flash--;

      // ── draw ──
      ctx.fillStyle = "#070b1c"; ctx.fillRect(0, 0, W, H);
      s.stars.forEach(st => { ctx.globalAlpha = st.b; ctx.fillStyle = "#fff"; ctx.fillRect(st.x, st.y, st.size, st.size); });
      ctx.globalAlpha = 1;

      drawMothership(ctx, m.x, m.y, m.hp, m.maxHp, s.t, sc);
      drawPlayer(ctx, p.x, p.y, sc, s.t, p.hitT > 0);

      if (ph.beam && m.chargeT > 0) {
        const tch = 1 - m.chargeT / CORE_CHARGE;
        drawBeamTelegraph(ctx, m.x, muzzleY, H, sc, tch);
        drawBeamTelegraph(ctx, m.x - sidePod, sideY, H, sc, tch);
        drawBeamTelegraph(ctx, m.x + sidePod, sideY, H, sc, tch);
      }
      if (ph.beam && m.beamT > 0) {
        drawBeam(ctx, m.x - sidePod, sideY, H, sc, s.t, 2 * bp);
        drawBeam(ctx, m.x + sidePod, sideY, H, sc, s.t, 2 * bp);
        drawBeam(ctx, m.x, muzzleY, H, sc, s.t, 3 * bp);
      }

      ctx.fillStyle = "#00ffcc";
      s.bullets.forEach(b => { ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 8; ctx.fillRect(b.x - 2 * sc, b.y - 7 * sc, 4 * sc, 14 * sc); });
      s.eb.forEach(b => {
        ctx.fillStyle = b.color; ctx.shadowColor = b.color;
        if (b.big) { ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.shadowBlur = 6; ctx.fillRect(b.x - b.r, b.y - b.r * 2, b.r * 2, b.r * 4); }
      });
      ctx.shadowBlur = 0;
      s.particles.forEach(pt => { ctx.globalAlpha = Math.max(0, pt.life); ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, pt.size, pt.size); });
      ctx.globalAlpha = 1;

      if (s.flash > 0) { ctx.fillStyle = `rgba(255,80,40,${(s.flash / 14) * 0.22})`; ctx.fillRect(0, 0, W, H); }

      // segmented HP bar (single split at 50%) + part label
      const frac = m.hp / m.maxHp;
      const barW = W - 80 * sc, bx = 40 * sc, by = 30 * sc, bh2 = 14 * sc;
      ctx.fillStyle = "#23232c"; ctx.fillRect(bx, by, barW, bh2);
      ctx.fillStyle = ph.color; ctx.fillRect(bx, by, barW * frac, bh2);
      ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + barW * 0.5, by - 3); ctx.lineTo(bx + barW * 0.5, by + bh2 + 3); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.strokeRect(bx, by, barW, bh2);
      ctx.textBaseline = "alphabetic"; ctx.font = `bold ${Math.round(13 * sc)}px ${FONT}`;
      ctx.textAlign = "left"; ctx.fillStyle = ph.color; ctx.fillText(`PART ${ph.idx} · ${ph.name}`, bx, by - 7 * sc);
      ctx.textAlign = "right"; ctx.fillStyle = "#9fb4d6"; ctx.fillText(`${Math.round(frac * 100)}%`, bx + barW, by - 7 * sc);
      if (ph.beam && (m.chargeT > 0 || m.beamT > 0)) {
        ctx.textAlign = "center"; ctx.fillStyle = m.beamT > 0 ? "#fff5e0" : "#ffc890"; ctx.font = `bold ${Math.round(12 * sc)}px ${FONT}`;
        ctx.fillText(m.beamT > 0 ? "ORBITAL BEAM" : "BEAM CHARGING", W / 2, by + bh2 + 18 * sc);
      }
      if (ph.name !== phaseName) setPhaseName(ph.name);

      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onBlur);
      canvas.removeEventListener("touchstart", onTS); canvas.removeEventListener("touchmove", onTM); canvas.removeEventListener("touchend", onTE);
      canvas.removeEventListener("touchcancel", onTE);
    };
  }, []);

  const wrap: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 12, fontFamily: FONT, background: "#070b1c", padding: 16, borderRadius: 12 };
  const btnRow: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" };
  const btn = (active: boolean): CSSProperties => ({ padding: "8px 14px", borderRadius: 8, border: "1px solid #3a4a6a", background: active ? "#22345a" : "#101a2e", color: "#cdd9f0", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer" });

  const presets: { label: string; frac: number; name: string }[] = [
    { label: "PART 1 · 100%", frac: 1.0, name: "SIDE CANNONS" },
    { label: "PART 2 · 40%", frac: 0.40, name: "OVERDRIVE" },
  ];

  return (
    <div style={wrap}>
      <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, borderRadius: 8, touchAction: "none", display: "block" }} />
      <div style={btnRow}>
        {presets.map(pp => (
          <button key={pp.label} onClick={() => setHp(pp.frac)} style={btn(phaseName === pp.name)}>{pp.label}</button>
        ))}
      </div>
      <div style={{ color: "#5a6b88", fontSize: 12, letterSpacing: 0.5 }}>← / → move · space shoot · or jump between parts</div>
    </div>
  );
}
