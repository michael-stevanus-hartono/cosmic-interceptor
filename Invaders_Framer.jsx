import { useEffect, useRef, useState, useCallback } from "react";
import { addPropertyControls, ControlType } from "framer";
const VISUAL_PAUSE = false;
function isMobile() {
  return window.innerWidth < 600 || "ontouchstart" in window && window.innerWidth < window.innerHeight;
}
function getDims() {
  return { W: window.innerWidth, H: window.innerHeight, mobile: isMobile() };
}
function rand(a, b) {
  return Math.random() * (b - a) + a;
}
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
const FONT = "'Courier New', ui-monospace, monospace";
const MAX_LIVES = 5;
const SPEED = 1.5;
const MAX_SCORE = 640;
const SCORE_DIGITS = String(MAX_SCORE).length;
const HEART = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0]
];
function drawHeart(ctx, x, y, ps, color, filled) {
  ctx.fillStyle = color;
  const rows = HEART.length, cols = HEART[0].length;
  const on = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && HEART[r][c] === 1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (HEART[r][c] !== 1) continue;
    if (!filled && on(r - 1, c) && on(r + 1, c) && on(r, c - 1) && on(r, c + 1)) continue;
    ctx.fillRect(Math.round(x + c * ps), Math.round(y + r * ps), Math.ceil(ps), Math.ceil(ps));
  }
}
function drawSprite(ctx, sprite, cx, cy, pixel) {
  const { grid, palette } = sprite;
  const rows = grid.length, cols = grid[0].length;
  const ox = Math.round(cx - cols * pixel / 2);
  const oy = Math.round(cy - rows * pixel / 2);
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
const JET_SPRITE = {
  palette: {
    1: "#2e2e2e",
    2: "#494949",
    3: "#db6d24",
    4: "#b6dbdb",
    5: "#929292",
    6: "#dbdbdb",
    7: "#db6d24",
    8: "#db6d24",
    9: "#db6d24",
    10: "#db6d24",
    11: "#00dbdb",
    12: "#00b6b6"
  },
  grid: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 3, 5, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 5, 4, 4, 5, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 1, 5, 4, 4, 5, 1, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 1, 5, 4, 4, 5, 1, 5, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 1, 2, 4, 4, 2, 1, 5, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 5, 5, 1, 3, 2, 2, 3, 1, 5, 5, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 1, 5, 5, 1, 1, 3, 5, 5, 3, 1, 1, 5, 5, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 1, 5, 5, 1, 3, 3, 2, 5, 5, 2, 3, 3, 1, 5, 5, 1, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 5, 3, 3, 1, 7, 8, 9, 1, 5, 5, 1, 3, 8, 3, 1, 3, 3, 5, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 5, 5, 3, 3, 1, 8, 10, 8, 1, 5, 5, 1, 8, 10, 8, 1, 3, 3, 5, 5, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
  ]
};
const FLAME_COLS = [11, 18];
const FL = { core: "#aef6ff", coreHot: "#ffffff", mid: "#00dbdb", deep: "#0066a8", edge: "#003d6b" };
function drawFlames(ctx, x, y, sc, t, moving) {
  const pixel = Math.max(1, 1.5 * sc);
  const cols = 30, rows = 19;
  const ox = Math.round(x - cols * pixel / 2);
  const oy = Math.round(y - rows * pixel / 2);
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
        ctx.fillRect(cx + 2 * pixel, yy, ps, ps);
        ctx.fillStyle = coreColor;
        ctx.fillRect(cx, yy, ps, ps);
        ctx.fillRect(cx + pixel, yy, ps, ps);
      } else if (frac < 0.72) {
        ctx.fillStyle = FL.deep;
        const side = edgeFlick ? -1 : 1;
        ctx.fillRect(cx + Math.floor(pixel * 0.5) + side * pixel, yy, ps, ps);
        ctx.fillStyle = coreColor;
        ctx.fillRect(cx + Math.floor(pixel * 0.5), yy, ps, ps);
      } else {
        const jitter = Math.sin(fast * 5 + i) > 0.4 ? pixel : 0;
        ctx.fillStyle = coreColor;
        ctx.fillRect(cx + Math.floor(pixel * 0.5) + jitter * 0.3, yy, ps, ps);
      }
    }
  });
}
const ENEMY_SPRITE = {
  palette: {
    5: "#000000",
    6: "#555555",
    7: "#e8443a",
    8: "#e8443a",
    9: "#2b2b2b",
    10: "#e8443a",
    11: "#e8443a",
    12: "#e8443a",
    13: "#e8443a",
    15: "#e8443a",
    16: "#e8443a",
    17: "#e8443a",
    18: "#e8443a",
    19: "#e8443a",
    20: "#808080",
    21: "#80d5ff",
    22: "#e8443a"
  },
  grid: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 6, 5, 6, 6, 5, 6, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 10, 10, 5, 5, 5, 5, 5, 5, 5, 5, 10, 10, 11, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 6, 5, 10, 10, 10, 10, 11, 10, 10, 5, 10, 9, 6, 6, 9, 10, 5, 10, 10, 11, 10, 10, 10, 10, 5, 6, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 5, 17, 10, 12, 12, 16, 16, 11, 10, 10, 5, 10, 9, 6, 6, 9, 10, 5, 10, 10, 11, 16, 16, 12, 12, 10, 17, 5, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 7, 12, 12, 6, 6, 9, 6, 5, 6, 6, 5, 10, 9, 6, 6, 9, 10, 5, 6, 6, 5, 6, 9, 6, 6, 12, 12, 7, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 13, 18, 6, 6, 6, 6, 6, 5, 6, 6, 5, 16, 17, 6, 6, 17, 16, 5, 6, 6, 5, 6, 6, 6, 6, 6, 18, 13, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 6, 9, 16, 16, 9, 6, 9, 9, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 6, 6, 6, 6, 6, 9, 6, 6, 6, 12, 17, 6, 6, 9, 9, 6, 6, 17, 12, 6, 6, 6, 9, 6, 6, 6, 6, 6, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 6, 6, 6, 20, 5, 5, 20, 20, 6, 6, 9, 6, 6, 6, 6, 6, 6, 9, 6, 6, 20, 20, 5, 5, 20, 6, 6, 6, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 10, 18, 6, 5, 5, 0, 5, 5, 20, 6, 9, 6, 20, 6, 6, 20, 6, 9, 6, 20, 5, 5, 0, 5, 5, 6, 18, 10, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 19, 18, 6, 5, 0, 0, 0, 5, 5, 6, 9, 6, 6, 21, 21, 6, 6, 9, 6, 5, 5, 0, 0, 0, 5, 6, 18, 19, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 5, 5, 22, 6, 5, 0, 0, 0, 0, 5, 6, 9, 6, 21, 21, 21, 21, 6, 9, 6, 5, 0, 0, 0, 0, 5, 6, 22, 5, 5, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 5, 16, 12, 5, 0, 0, 0, 0, 0, 5, 9, 6, 21, 21, 21, 21, 6, 9, 5, 0, 0, 0, 0, 0, 5, 12, 16, 5, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 5, 5, 12, 5, 0, 0, 0, 0, 0, 5, 5, 6, 21, 21, 21, 21, 6, 5, 5, 0, 0, 0, 0, 0, 5, 12, 5, 5, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 6, 12, 5, 0, 0, 0, 0, 0, 0, 5, 20, 6, 21, 21, 6, 20, 5, 0, 0, 0, 0, 0, 0, 5, 12, 6, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 5, 20, 20, 6, 6, 20, 20, 5, 0, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 20, 20, 20, 20, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 20, 20, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]
};
const ENEMY_NOZZLES = [14.5, 19.5, 24.5];
const EFLAME = { core: "#ffd27a", mid: "#ff9a2b", deep: "#ff6a1f" };
function drawEnemyThrusters(ctx, x, y, sc, t) {
  const epx = Math.max(0.5, 0.8 * sc);
  const cols = 40, rows = 18;
  const ox = Math.round(x - cols * epx / 2);
  const oy = Math.round(y - rows * epx / 2);
  const fps = Math.max(2, Math.round(1.8 * sc));
  const topY = oy + 1 * epx;
  ENEMY_NOZZLES.forEach((col, idx) => {
    const phase = t * 0.4 + idx * 1.3 + x * 0.04;
    const flick = Math.sin(phase);
    const len = Math.round(1 + (flick * 0.5 + 0.5) * 1.5);
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
const BOSS_SPRITE = {
  palette: { 1: "#000000", 2: "#9a7d3e", 3: "#5e525a", 4: "#b3a9b0", 5: "#7a1626", 6: "#a8313f", 7: "#d6cdd4", 8: "#2d1820", 9: "#5a2186", 10: "#3c1659" },
  grid: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 3, 3, 3, 3, 3, 5, 3, 1, 1, 5, 5, 5, 5, 1, 1, 3, 5, 3, 3, 3, 3, 3, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 3, 3, 4, 3, 5, 1, 1, 1, 5, 6, 6, 5, 1, 1, 1, 5, 3, 4, 3, 3, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 4, 2, 4, 3, 0, 1, 5, 3, 3, 3, 3, 3, 3, 5, 1, 0, 3, 4, 2, 4, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 2, 4, 4, 2, 4, 4, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 4, 4, 2, 4, 4, 2, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 0, 5, 5, 5, 5, 5, 1, 0, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 0, 1, 5, 5, 5, 5, 5, 0, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 3, 1, 1, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 1, 3, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 1, 3, 1, 1, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4, 3, 1, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 3, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4, 1, 1, 3, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 3, 1, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 3, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1, 0, 0, 0, 0, 0],
    [0, 0, 5, 1, 1, 1, 3, 3, 1, 1, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 3, 1, 0, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 0, 1, 3, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1, 3, 3, 1, 1, 1, 5, 0, 0],
    [0, 1, 6, 5, 5, 1, 3, 3, 1, 3, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 3, 1, 0, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 0, 1, 3, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 1, 3, 3, 1, 5, 5, 6, 1, 0],
    [0, 5, 6, 5, 5, 5, 3, 3, 4, 3, 3, 3, 3, 3, 1, 3, 3, 3, 4, 3, 3, 1, 0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 3, 3, 4, 3, 3, 3, 1, 3, 3, 3, 3, 3, 4, 3, 3, 5, 5, 5, 6, 5, 0],
    [1, 5, 0, 5, 0, 5, 3, 3, 4, 4, 4, 4, 4, 3, 1, 4, 4, 4, 3, 3, 3, 1, 0, 4, 4, 4, 1, 1, 1, 1, 4, 4, 4, 0, 1, 3, 3, 3, 4, 4, 4, 1, 3, 4, 4, 4, 4, 4, 3, 3, 5, 0, 5, 0, 5, 1],
    [1, 6, 6, 5, 5, 6, 5, 3, 4, 4, 4, 4, 4, 3, 1, 5, 3, 5, 3, 3, 3, 5, 0, 10, 1, 1, 10, 10, 10, 10, 1, 1, 10, 0, 5, 3, 3, 3, 5, 3, 5, 1, 3, 4, 4, 4, 4, 4, 3, 5, 6, 5, 5, 6, 6, 1],
    [6, 2, 6, 6, 5, 5, 6, 1, 3, 3, 3, 3, 4, 3, 3, 1, 4, 4, 4, 3, 1, 0, 0, 10, 4, 4, 1, 1, 1, 1, 4, 4, 10, 0, 0, 1, 3, 4, 4, 4, 1, 3, 3, 4, 3, 3, 3, 3, 1, 6, 5, 5, 6, 6, 2, 6],
    [6, 2, 6, 6, 5, 5, 6, 1, 4, 4, 4, 4, 3, 3, 3, 1, 1, 1, 1, 1, 5, 5, 1, 10, 1, 10, 10, 10, 10, 10, 10, 1, 10, 1, 5, 5, 1, 1, 1, 1, 1, 3, 3, 3, 4, 4, 4, 4, 1, 6, 5, 5, 6, 6, 2, 6],
    [6, 2, 6, 5, 5, 5, 6, 1, 4, 4, 4, 4, 4, 4, 3, 1, 5, 6, 5, 1, 0, 1, 1, 10, 10, 10, 9, 9, 9, 9, 10, 10, 10, 1, 1, 0, 1, 5, 6, 5, 1, 3, 4, 4, 4, 4, 4, 4, 1, 6, 5, 5, 5, 6, 2, 6],
    [6, 5, 6, 5, 5, 5, 6, 1, 4, 4, 4, 4, 4, 4, 3, 1, 2, 5, 5, 1, 0, 1, 4, 3, 10, 10, 9, 9, 9, 9, 10, 10, 3, 4, 1, 0, 1, 5, 5, 2, 1, 3, 4, 4, 4, 4, 4, 4, 1, 6, 5, 5, 5, 6, 5, 6],
    [1, 6, 5, 5, 5, 5, 6, 1, 4, 4, 4, 4, 4, 4, 3, 1, 2, 2, 5, 1, 5, 1, 4, 4, 10, 9, 9, 9, 9, 9, 9, 10, 4, 4, 1, 5, 1, 5, 2, 2, 1, 3, 4, 4, 4, 4, 4, 4, 1, 6, 5, 5, 5, 5, 6, 1],
    [1, 5, 5, 5, 5, 5, 5, 3, 3, 4, 4, 4, 4, 4, 3, 1, 2, 2, 5, 1, 0, 1, 4, 4, 10, 9, 9, 9, 9, 9, 9, 10, 4, 4, 1, 0, 1, 5, 2, 2, 1, 3, 4, 4, 4, 4, 4, 3, 3, 5, 5, 5, 5, 5, 5, 1],
    [0, 0, 5, 6, 1, 1, 3, 4, 4, 3, 3, 4, 4, 4, 4, 3, 2, 5, 5, 1, 5, 1, 4, 4, 10, 9, 9, 9, 9, 9, 9, 10, 4, 4, 1, 5, 1, 5, 5, 2, 3, 4, 4, 4, 4, 3, 3, 4, 4, 3, 1, 1, 6, 5, 0, 0],
    [0, 0, 5, 6, 5, 1, 1, 4, 4, 4, 3, 3, 3, 4, 4, 4, 5, 5, 1, 1, 5, 1, 4, 4, 10, 9, 9, 9, 9, 9, 9, 10, 4, 4, 1, 5, 1, 1, 5, 5, 4, 4, 4, 3, 3, 3, 4, 4, 4, 1, 1, 5, 6, 5, 0, 0],
    [0, 0, 5, 6, 5, 1, 0, 4, 4, 4, 4, 4, 4, 3, 4, 4, 1, 6, 5, 6, 1, 1, 3, 10, 10, 9, 9, 9, 9, 9, 9, 10, 10, 3, 1, 1, 6, 5, 6, 1, 4, 4, 3, 4, 4, 4, 4, 4, 4, 0, 1, 5, 6, 5, 0, 0],
    [0, 0, 5, 6, 5, 0, 0, 0, 3, 4, 4, 4, 4, 4, 3, 3, 1, 2, 2, 6, 1, 4, 3, 10, 10, 10, 9, 9, 9, 9, 10, 10, 10, 3, 4, 1, 6, 2, 2, 1, 3, 3, 4, 4, 4, 4, 4, 3, 0, 0, 0, 5, 6, 5, 0, 0],
    [0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 3, 1, 2, 2, 6, 0, 4, 4, 3, 10, 10, 9, 9, 9, 9, 10, 10, 3, 4, 4, 0, 6, 2, 2, 1, 3, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0],
    [0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 1, 2, 2, 6, 1, 4, 4, 3, 1, 10, 10, 10, 10, 10, 10, 1, 3, 4, 4, 1, 6, 2, 2, 1, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0],
    [0, 0, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 1, 6, 5, 6, 1, 4, 4, 4, 4, 4, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1, 6, 5, 6, 1, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 1, 1, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 1, 1, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 1, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 1, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 1, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 1, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 1, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 1, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 3, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 3, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 3, 1, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 1, 3, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 3, 3, 1, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 1, 3, 3, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 1, 4, 4, 3, 4, 4, 4, 4, 3, 4, 4, 1, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 4, 4, 4, 3, 3, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 3, 3, 4, 4, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 4, 4, 4, 3, 1, 4, 3, 3, 4, 4, 4, 4, 3, 3, 4, 1, 3, 4, 4, 4, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 4, 4, 4, 3, 1, 4, 3, 4, 4, 4, 4, 4, 4, 3, 4, 1, 3, 4, 4, 4, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 4, 4, 3, 1, 4, 3, 1, 1, 1, 1, 1, 1, 3, 4, 1, 3, 4, 4, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 4, 4, 4, 3, 1, 1, 5, 5, 2, 2, 2, 2, 5, 5, 1, 1, 3, 4, 4, 4, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 5, 3, 4, 4, 4, 3, 1, 1, 5, 5, 5, 5, 5, 5, 5, 5, 1, 1, 3, 4, 4, 4, 3, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 4, 4, 3, 1, 6, 5, 2, 0, 0, 0, 0, 2, 5, 6, 1, 3, 4, 4, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 3, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 3, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 3, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 3, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 3, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 3, 4, 3, 3, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 3, 3, 4, 3, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 3, 4, 3, 3, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 3, 3, 4, 3, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 3, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 3, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 3, 4, 3, 3, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 3, 3, 4, 3, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 3, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 3, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 6, 2, 2, 0, 0, 0, 0, 2, 2, 6, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 3, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 3, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 4, 4, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 4, 4, 4, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]
};
function drawJet(ctx, x, y, sc, t, moving) {
  drawFlames(ctx, x, y, sc, t, moving);
  drawSprite(ctx, JET_SPRITE, x, y, Math.max(1, 1.5 * sc));
}
function drawEnemy(ctx, x, y, t, sc) {
  const bob = Math.sin(t * 0.05 + x * 0.1) * 1.5 * sc;
  drawEnemyThrusters(ctx, x, y + bob, sc, t);
  drawSprite(ctx, ENEMY_SPRITE, x, y + bob, Math.max(0.5, 0.8 * sc));
}
const BOSS_PX = (sc) => Math.max(2, 3.6 * sc);
const BOSS_COLS = 56, BOSS_ROWS = 64;
const CORE_CHARGE = 55;
const BEAM_TIME = 120;
const INVULN = 60;
const BFLAME = { core: "#ffd27a", mid: "#ff9a2b", deep: "#ff6a1f" };
const BOSS_NOZZLES = [
  { cells: [10, 11, 12], top: 6 },
  // outer-left vent
  { cells: [17, 18, 19], top: 0 },
  // inner-left vent
  { cells: [36, 37, 38], top: 0 },
  // inner-right vent
  { cells: [43, 44, 45], top: 6 }
  // outer-right vent
];
function drawBossThrusters(ctx, x, y, t, sc) {
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
      const start = 3 - w >> 1;
      for (let k = 0; k < w; k++) {
        ctx.fillRect(ox + nz.cells[start + k] * bp, yy, ps, ps);
      }
    }
  });
}
function drawMothership(ctx, x, y, hp, maxHp, t, sc, charge) {
  const bp = BOSS_PX(sc);
  const bw = BOSS_COLS * bp, bh = BOSS_ROWS * bp;
  const shk = hp < maxHp * 0.3 ? Math.sin(t * 0.3) * 3 : 0;
  const coreY = y - 4 * bp;
  ctx.save();
  const ga = 0.32 + Math.sin(t * 0.12) * 0.16;
  const g = ctx.createRadialGradient(x, coreY, 1, x, coreY, 9 * bp);
  g.addColorStop(0, `rgba(150,60,220,${ga})`);
  g.addColorStop(1, "rgba(150,60,220,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, coreY, 9 * bp, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawBossThrusters(ctx, x + shk, y, t, sc);
  drawSprite(ctx, BOSS_SPRITE, x + shk, y, bp);
  if (charge > 0) {
    ctx.save();
    const rr = (1 - charge) * 13 * bp + 3 * bp;
    ctx.strokeStyle = `rgba(178,76,255,${0.35 + charge * 0.5})`;
    ctx.lineWidth = 2 + charge * 3;
    ctx.beginPath();
    ctx.arc(x + shk, coreY, rr, 0, Math.PI * 2);
    ctx.stroke();
    const fr = Math.max(1, charge * 7 * bp);
    const cg = ctx.createRadialGradient(x + shk, coreY, 1, x + shk, coreY, fr);
    cg.addColorStop(0, `rgba(225,150,255,${charge})`);
    cg.addColorStop(1, "rgba(178,76,255,0)");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x + shk, coreY, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  const barW = Math.min(bw * 0.9, 220 * sc), barTop = -bh / 2 - 16 * sc, barH = 9 * sc;
  ctx.fillStyle = "#23232c";
  ctx.fillRect(-barW / 2, barTop, barW, barH);
  ctx.fillStyle = hp > maxHp * 0.5 ? "#a23cdb" : hp > maxHp * 0.25 ? "#e0a020" : "#ff2e4d";
  ctx.fillRect(-barW / 2, barTop, barW * (hp / maxHp), barH);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-barW / 2, barTop, barW, barH);
  ctx.fillStyle = "#caa24a";
  ctx.font = `bold ${Math.round(11 * sc)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("FINAL BOSS", 0, barTop - 6 * sc);
  ctx.restore();
}
function bossPart(f) {
  return f > 0.5 ? { idx: 1, name: "SIDE CANNONS", sideCD: 32, beam: false, color: "#a23cdb" } : { idx: 2, name: "OVERDRIVE", sideCD: 22, beam: true, color: "#ff7a2b" };
}
function drawBeamTelegraph(ctx, cx, originY, H, sc, charge) {
  const w = (1.5 + charge * 5) * sc;
  ctx.save();
  ctx.fillStyle = `rgba(255,110,40,${0.12 + charge * 0.45})`;
  ctx.fillRect(cx - w, originY, w * 2, H - originY);
  const fr = Math.max(1, charge * 9 * sc);
  const g = ctx.createRadialGradient(cx, originY, 1, cx, originY, fr);
  g.addColorStop(0, `rgba(255,240,200,${charge})`);
  g.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, originY, fr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawBeam(ctx, cx, originY, H, sc, t, hw) {
  const halfW = hw;
  const fl = 1 + Math.sin(t * 0.9) * 0.08 + Math.sin(t * 2.3) * 0.04;
  ctx.save();
  ctx.fillStyle = "rgba(255,106,31,0.5)";
  ctx.fillRect(cx - halfW * fl, originY, halfW * 2 * fl, H - originY);
  ctx.fillStyle = "rgba(255,154,43,0.85)";
  ctx.fillRect(cx - halfW * 0.62, originY, halfW * 1.24, H - originY);
  ctx.fillStyle = "rgba(255,210,122,0.9)";
  ctx.fillRect(cx - halfW * 0.4, originY, halfW * 0.8, H - originY);
  ctx.fillStyle = "rgba(255,250,240,0.95)";
  ctx.fillRect(cx - halfW * 0.2, originY, halfW * 0.4, H - originY);
  const fr = halfW * 1.7;
  const g = ctx.createRadialGradient(cx, originY, 1, cx, originY, fr);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.45, "rgba(255,154,43,0.6)");
  g.addColorStop(1, "rgba(255,106,31,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, originY, fr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function makeWave(wave, W, H, sc, mobile) {
  const cols = Math.min(4 + wave, mobile ? 5 : 8);
  const rows = Math.min(1 + wave, 3);
  const spacingX = Math.min(62 * sc, (W - 80) / cols);
  const startX = (W - spacingX * (cols - 1)) / 2;
  const startY = mobile ? H * 0.12 : H * 0.22;
  return Array.from({ length: rows * cols }, (_, i) => ({
    x: startX + i % cols * spacingX,
    y: startY + Math.floor(i / cols) * 52 * sc,
    w: 28 * sc,
    h: 20 * sc,
    alive: true
  }));
}
function initGame(W, H, mobile, speed = SPEED, startLives = MAX_LIVES) {
  const sc = mobile ? W / 360 * 0.85 : Math.min(W / 900, H / 560);
  const playerY = mobile ? H * 0.78 : H * 0.88;
  return {
    t: 0,
    sc,
    mobile,
    W,
    H,
    player: { x: W / 2, y: playerY, w: 28 * sc, h: 28 * sc, vx: 0, hitT: 0 },
    bullets: [],
    enemyBullets: [],
    enemies: makeWave(1, W, H, sc, mobile),
    mothership: { x: W / 2, y: 150 * sc, w: BOSS_COLS * BOSS_PX(sc), h: BOSS_ROWS * BOSS_PX(sc), hp: 30, maxHp: 30, vx: 1.5 * sc * speed, sideCD: 0, coreCD: Math.floor(rand(5, 7) * 60), chargeT: 0, beamT: 0 },
    phase: "waves",
    wave: 1,
    score: 0,
    lives: startLives,
    maxLives: startLives,
    speed,
    enemyDir: 1,
    fireCD: 0,
    enemyFireCD: 60,
    bossFireCD: 90,
    introT: 180,
    particles: [],
    stars: Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, H), size: rand(1, 2.5), b: rand(0.3, 1) })),
    waveMsg: 0
  };
}
function Invaders(props) {
  const { speed = 1.5, startLives = 5, startOnBoss = false, style } = props;
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef(null);
  const animRef = useRef(0);
  const keysRef = useRef({});
  const touchState = useRef({ active: false, x: null });
  const [phase, setPhase] = useState("waves");
  const [dims, setDims] = useState({ W: 1200, H: 760, mobile: false });
  const propsRef = useRef({ speed, startLives, startOnBoss });
  propsRef.current = { speed, startLives, startOnBoss };
  const buildGame = useCallback((W, H, mobile) => {
    const p = propsRef.current;
    const g = initGame(W, H, mobile, p.speed, p.startLives);
    if (p.startOnBoss) {
      g.phase = "boss";
      g.enemies = [];
      g.introT = 40;
    }
    return g;
  }, []);
  const measureInit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    const mobile = W < 700 || isMobile();
    setDims({ W, H, mobile });
    stateRef.current = buildGame(W, H, mobile);
    setPhase(stateRef.current.phase);
  }, [buildGame]);
  const restart = useCallback(() => {
    measureInit();
  }, [measureInit]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measureInit();
    const ro = new ResizeObserver(() => measureInit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureInit]);
  useEffect(() => {
    measureInit();
  }, [speed, startLives, startOnBoss, measureInit]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "Space") e.preventDefault();
      keysRef.current[e.code] = e.type === "keydown";
    };
    // If focus leaves mid-hold (alt-tab, click outside the iframe) the matching
    // keyup never fires and the key stays stuck "down" forever — release all keys.
    const onBlur = () => { keysRef.current = {}; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onBlur);
    containerRef.current?.focus();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const onTouchStart = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      touchState.current = { active: true, x: (e.touches[0].clientX - rect.left) * (canvas.width / rect.width) };
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      touchState.current.x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      touchState.current.active = false;
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    function addParticles(x, y, color, n = 10) {
      const s = stateRef.current;
      if (!s) return;
      for (let i = 0; i < n; i++) s.particles.push({ x, y, vx: rand(-4, 4), vy: rand(-5, 1), life: 1, color, size: rand(3, 7) });
    }
    function loop() {
      const s = stateRef.current;
      if (!s) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const keys = keysRef.current;
      const { sc, mobile, W, H } = s;
      s.t++;
      if (s.phase === "dead" || s.phase === "won") {
        setPhase(s.phase);
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const inIntro = s.introT > 0 || VISUAL_PAUSE;
      if (s.introT > 0) {
        s.introT--;
      }
      const p = s.player;
      const spd = 5 * sc * s.speed;
      p.y = mobile ? H * 0.78 : H * 0.88;
      const prevX = p.x;
      if (touchState.current.active && touchState.current.x !== null) {
        const targetX = Math.max(p.w / 2, Math.min(W - p.w / 2, touchState.current.x));
        p.x += (targetX - p.x) * 0.3;
      }
      if (keys["ArrowLeft"] || keys["KeyA"]) p.x = Math.max(p.w / 2, p.x - spd);
      if (keys["ArrowRight"] || keys["KeyD"]) p.x = Math.min(W - p.w / 2, p.x + spd);
      s.fireCD--;
      if (s.fireCD <= 0 && !inIntro) {
        s.bullets.push({ x: p.x, y: p.y - 20 * sc, w: 4 * sc, h: 14 * sc });
        s.fireCD = Math.round(14 / s.speed);
      }
      const bspd = 9 * sc * s.speed, espd = 4 * sc * s.speed;
      s.bullets = s.bullets.filter((b) => {
        b.y -= bspd;
        return b.y > -20;
      });
      s.enemyBullets = s.enemyBullets.filter((b) => {
        b.x += b.vx || 0;
        b.y += b.vy != null ? b.vy : espd;
        return b.y < H + 40 && b.y > -40 && b.x > -40 && b.x < W + 40;
      });
      if (p.hitT > 0) p.hitT--;
      s.enemyBullets = s.enemyBullets.filter((b) => {
        const br = b.r || 3 * sc;
        if (overlap({ x: b.x - br, y: b.y - br, w: br * 2, h: br * 2 }, { x: p.x - 14 * sc, y: p.y - 14 * sc, w: 28 * sc, h: 28 * sc })) {
          if (p.hitT <= 0) {
            addParticles(p.x, p.y, "#00cfff", 12);
            s.lives--;
            p.hitT = INVULN;
            if (s.lives <= 0) s.phase = "dead";
          }
          return false;
        }
        return true;
      });
      if (!inIntro && s.phase === "waves") {
        s.enemyFireCD--;
        if (s.enemyFireCD <= 0) {
          const alive2 = s.enemies.filter((e) => e.alive);
          if (alive2.length) {
            const e = alive2[Math.floor(Math.random() * alive2.length)];
            s.enemyBullets.push({ x: e.x, y: e.y + 10 * sc, vx: rand(-0.5, 0.5) * sc });
          }
          s.enemyFireCD = Math.max(25, 60 - s.wave * 5);
        }
        const alive = s.enemies.filter((e) => e.alive);
        const stepX = (0.9 + s.wave * 0.15) * sc * (mobile ? 0.6 : 1) * s.speed;
        const descend = (0.24 + s.wave * 0.05) * sc * (mobile ? 0.85 : 1) * s.speed;
        alive.forEach((e) => {
          e.x += s.enemyDir * stepX;
          e.y += descend;
        });
        const hitWall = alive.some((e) => e.x > W - 40 || e.x < 40);
        if (hitWall) {
          s.enemyDir *= -1;
          alive.forEach((e) => {
            e.x += s.enemyDir * stepX * 2;
          });
        }
        if (alive.some((e) => e.y > p.y)) {
          s.lives = 0;
          s.phase = "dead";
        }
        if (alive.some((e) => overlap({ x: e.x - 11 * sc, y: e.y - 8 * sc, w: 22 * sc, h: 16 * sc }, { x: p.x - 14 * sc, y: p.y - 14 * sc, w: 28 * sc, h: 28 * sc }))) {
          s.lives = 0;
          s.phase = "dead";
        }
        s.bullets = s.bullets.filter((b) => {
          for (let e of s.enemies) {
            if (!e.alive) continue;
            if (overlap({ x: b.x - 2 * sc, y: b.y - 7 * sc, w: 4 * sc, h: 14 * sc }, { x: e.x - 11 * sc, y: e.y - 8 * sc, w: 22 * sc, h: 16 * sc })) {
              e.alive = false;
              addParticles(e.x, e.y, "#ff3366");
              s.score += 10;
              return false;
            }
          }
          return true;
        });
        if (s.enemies.every((e) => !e.alive)) {
          s.wave++;
          if (s.wave > 3) {
            s.phase = "boss";
            setPhase("boss");
            s.enemyBullets = [];
            s.introT = 120;
            s.mothership.sideCD = 30;
            s.mothership.coreCD = Math.floor(rand(5, 7) * 60);
            s.mothership.chargeT = 0;
            s.mothership.beamT = 0;
          } else {
            s.enemies = makeWave(s.wave, W, H, sc, mobile);
            s.enemyDir = 1;
            s.waveMsg = 90;
            s.introT = 90;
          }
        }
      }
      if (!inIntro && s.phase === "boss") {
        const m = s.mothership;
        const bp = BOSS_PX(sc);
        const margin = BOSS_COLS * bp * 0.5 + 6;
        if (m.beamT <= 0) {
          m.x += m.vx;
          if (m.x > W - margin || m.x < margin) m.vx *= -1;
        }
        const part = bossPart(m.hp / m.maxHp);
        const muzzleY = m.y + 14 * bp;
        const sidePod = 25 * bp, sideY = m.y - 4 * bp;
        m.sideCD--;
        if (m.beamT <= 0 && m.sideCD <= 0) {
          [-sidePod, sidePod].forEach((px) => {
            const ox = m.x + px, oy = sideY;
            const ang = Math.atan2(p.y - oy, p.x - ox);
            s.enemyBullets.push({ x: ox, y: oy, vx: Math.cos(ang) * espd * 0.9, vy: Math.max(1.2 * sc, Math.sin(ang) * espd * 0.9), r: 3 * sc, color: "#ff5a4a" });
          });
          m.sideCD = part.sideCD;
        }
        if (part.beam) {
          if (m.beamT > 0) {
            m.beamT--;
            const inC = Math.abs(p.x - m.x) < 3 * bp && p.y > muzzleY;
            const inL = Math.abs(p.x - (m.x - sidePod)) < 2 * bp && p.y > sideY;
            const inR = Math.abs(p.x - (m.x + sidePod)) < 2 * bp && p.y > sideY;
            if ((inC || inL || inR) && p.hitT <= 0) {
              addParticles(p.x, p.y, "#00cfff", 12);
              s.lives--;
              p.hitT = INVULN;
              if (s.lives <= 0) s.phase = "dead";
            }
            if (m.beamT <= 0) m.coreCD = Math.floor(rand(6, 9) * 60);
          } else if (m.chargeT > 0) {
            m.chargeT--;
            if (m.chargeT <= 0) {
              m.beamT = BEAM_TIME;
              addParticles(m.x, muzzleY, "#ff9a2b", 26);
            }
          } else {
            m.coreCD--;
            if (m.coreCD <= 0) m.chargeT = CORE_CHARGE;
          }
        } else {
          m.chargeT = 0;
          m.beamT = 0;
        }
        const hbW = 26 * bp, hbH = 54 * bp;
        s.bullets = s.bullets.filter((b) => {
          if (overlap({ x: b.x - 2 * sc, y: b.y - 7 * sc, w: 4 * sc, h: 14 * sc }, { x: m.x - hbW / 2, y: m.y - hbH / 2, w: hbW, h: hbH })) {
            m.hp--;
            addParticles(b.x, b.y, part.color, 5);
            s.score += 5;
            if (m.hp <= 0) {
              addParticles(m.x, m.y, "#ff7a2b", 30);
              addParticles(m.x - 40 * sc, m.y, "#caa24a", 18);
              addParticles(m.x + 40 * sc, m.y, "#ff2e4d", 18);
              s.phase = "won";
            }
            return false;
          }
          return true;
        });
      }
      s.particles = s.particles.filter((pt) => pt.life > 0);
      s.particles.forEach((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.2;
        pt.life -= 0.03;
      });
      if (s.waveMsg > 0) s.waveMsg--;
      ctx.fillStyle = "#050a1a";
      ctx.fillRect(0, 0, W, H);
      s.stars.forEach((st) => {
        ctx.globalAlpha = st.b;
        ctx.fillStyle = "#fff";
        ctx.fillRect(st.x, st.y, st.size, st.size);
      });
      ctx.globalAlpha = 1;
      if (s.phase === "waves") s.enemies.forEach((e) => {
        if (e.alive) drawEnemy(ctx, e.x, e.y, s.t, sc);
      });
      if ((s.phase === "boss" || s.phase === "won") && s.mothership.hp > 0) {
        const m = s.mothership, bp = BOSS_PX(sc);
        const muzzleY = m.y + 14 * bp, sidePod = 25 * bp, sideY = m.y - 4 * bp;
        drawMothership(ctx, m.x, m.y, m.hp, m.maxHp, s.t, sc, 0);
        if (m.chargeT > 0) {
          const tch = 1 - m.chargeT / CORE_CHARGE;
          drawBeamTelegraph(ctx, m.x, muzzleY, H, sc, tch);
          drawBeamTelegraph(ctx, m.x - sidePod, sideY, H, sc, tch);
          drawBeamTelegraph(ctx, m.x + sidePod, sideY, H, sc, tch);
        }
      }
      const isMoving = Math.abs(p.x - prevX) > 0.5;
      const blink = p.hitT > 0 && Math.floor(s.t / 3) % 2 === 0;
      if (s.lives > 0 && !blink) drawJet(ctx, p.x, p.y, sc, s.t, isMoving);
      if (s.phase === "boss" && s.mothership.beamT > 0) {
        const m = s.mothership, bp = BOSS_PX(sc);
        const muzzleY = m.y + 14 * bp, sidePod = 25 * bp, sideY = m.y - 4 * bp;
        drawBeam(ctx, m.x - sidePod, sideY, H, sc, s.t, 2 * bp);
        drawBeam(ctx, m.x + sidePod, sideY, H, sc, s.t, 2 * bp);
        drawBeam(ctx, m.x, muzzleY, H, sc, s.t, 3 * bp);
      }
      ctx.fillStyle = "#00ffcc";
      s.bullets.forEach((b) => {
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 8;
        ctx.fillRect(b.x - 2 * sc, b.y - 7 * sc, 4 * sc, 14 * sc);
      });
      s.enemyBullets.forEach((b) => {
        const col = b.color || "#ff4455", r = b.r || 3 * sc;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        if (b.big) {
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.shadowBlur = 6;
          ctx.fillRect(b.x - r, b.y - r * 2, r * 2, r * 4);
        }
      });
      ctx.shadowBlur = 0;
      s.particles.forEach((pt) => {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      });
      ctx.globalAlpha = 1;
      const pad = 12 * sc;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = "#5a6b88";
      ctx.font = `bold ${Math.round(10 * sc)}px ${FONT}`;
      ctx.fillText("SCORE:", pad, 8 * sc);
      ctx.fillStyle = "#9fb4d6";
      ctx.font = `bold ${Math.round(16 * sc)}px ${FONT}`;
      ctx.fillText(String(s.score).padStart(SCORE_DIGITS, "0"), pad, 20 * sc);
      ctx.textAlign = "center";
      ctx.fillStyle = "#5a6b88";
      ctx.font = `bold ${Math.round(11 * sc)}px ${FONT}`;
      ctx.fillText(s.phase === "boss" ? "BOSS" : `WAVE ${s.wave}`, W / 2, 8 * sc);
      ctx.textAlign = "right";
      ctx.fillStyle = "#5a6b88";
      ctx.font = `bold ${Math.round(10 * sc)}px ${FONT}`;
      ctx.fillText("LIVES", W - pad, 8 * sc);
      const hps = Math.max(1, Math.round(2 * sc));
      const hw = HEART[0].length * hps, hgap = Math.max(2, Math.round(4 * sc));
      const totalW = s.maxLives * hw + (s.maxLives - 1) * hgap;
      let hx = W - pad - totalW;
      for (let i = 0; i < s.maxLives; i++) {
        const filled = i >= s.maxLives - Math.max(0, s.lives);
        drawHeart(ctx, hx, 22 * sc, hps, filled ? "#ff3b56" : "#8a3a48", filled);
        hx += hw + hgap;
      }
      ctx.textBaseline = "alphabetic";
      if (s.introT > 0 && !VISUAL_PAUSE) {
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "center";
        ctx.fillStyle = "#e6ecff";
        ctx.font = `bold ${Math.round(28 * sc)}px ${FONT}`;
        ctx.fillText(s.phase === "boss" ? "FINAL BOSS" : `WAVE ${s.wave}`, W / 2, H * 0.4);
        ctx.fillStyle = "#8aa0c8";
        ctx.font = `bold ${Math.round(14 * sc)}px ${FONT}`;
        ctx.fillText("GET READY", W / 2, H * 0.4 + 26 * sc);
      }
      ctx.textBaseline = "alphabetic";
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onBlur);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [dims]);
  const navBtn = { pointerEvents: "auto", width: 46, height: 46, borderRadius: 10, border: "1px solid #3a4a6a", background: "rgba(16,26,46,0.9)", color: "#cdd9f0", fontSize: 18, cursor: "pointer" };
  const overlayStyle = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "rgba(5,10,26,0.82)" };
  const restartBtn = { padding: "12px 28px", borderRadius: 10, border: "1px solid #3a4a6a", background: "#101a2e", color: "#cdd9f0", fontSize: 16, fontWeight: "bold", letterSpacing: 1, cursor: "pointer" };
  return <div
    ref={containerRef}
    tabIndex={0}
    onPointerDown={() => containerRef.current?.focus()}
    style={{ position: "relative", width: "100%", height: "100%", background: "#050a1a", touchAction: "none", overflow: "hidden", fontFamily: FONT, outline: "none", ...style }}
  >
      <canvas ref={canvasRef} width={dims.W} height={dims.H} style={{ display: "block", width: "100%", height: "100%" }} />

      {(phase === "dead" || phase === "won") && <div style={overlayStyle}>
          <div style={{ color: phase === "won" ? "#a23cdb" : "#ff2e4d", fontSize: Math.round(30), fontWeight: "bold", letterSpacing: 2 }}>
            {phase === "won" ? "BOSS DESTROYED" : "GAME OVER"}
          </div>
          <button onClick={restart} style={restartBtn}>PLAY AGAIN</button>
        </div>}
    </div>;
}
addPropertyControls(Invaders, {
  speed: { type: ControlType.Number, title: "Speed", min: 0.5, max: 3, step: 0.1, defaultValue: 1.5, displayStepper: true },
  startLives: { type: ControlType.Number, title: "Lives", min: 1, max: 9, step: 1, defaultValue: 5, displayStepper: true },
  startOnBoss: { type: ControlType.Boolean, title: "Start on Boss", defaultValue: false }
});
export {
  Invaders as default
};
