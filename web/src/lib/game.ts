// Logical world size. All game state lives in these units; the canvas
// transform scales it to whatever size the canvas is fitted to (3:4).
export const W = 480;
export const H = 640;
export const COLS = 9;
export const ROWS = 5;
export const ALIEN_W = 28;
export const ALIEN_H = 20;
export const ALIEN_GAP = 12;
export const PLAYER_W = 36;
export const PLAYER_H = 16;
const BULLET_SPEED = 0.55; // px/ms
const BOMB_SPEED = 0.22;
const PLAYER_SPEED = 0.4;
export const ROW_SCORES = [40, 30, 20, 10, 10];
export const PLAYER_Y = H - PLAYER_H - 6;
export const INVULN_MS = 1500;
export const SHIELD_CELL = 8;
const SHIELD_COLS = 6;
const SHIELD_ROWS = 4;
export const SHIELD_Y = PLAYER_Y - 88;
export const SAUCER_W = 40;
export const SAUCER_H = 14;
export const SAUCER_Y = 14;
const SAUCER_SPEED = 0.12;
export const SAUCER_SCORES = [50, 100, 150];

interface Alien { col: number; row: number; alive: boolean; }
interface Bullet { x: number; y: number; }
interface Bomb { x: number; y: number; }
interface ShieldCell { x: number; y: number; alive: boolean; }
interface Saucer { x: number; dir: number; }

export interface GameState {
  score: number;
  aliens: Alien[];
  bullet: Bullet | null;
  bombs: Bomb[];
  playerX: number;
  playerVx: number;
  alienDx: number;
  alienDy: number;
  alienOffsetX: number;
  alienOffsetY: number;
  alienStepMs: number;
  lastStep: number;
  lastBomb: number;
  fireCooldown: number;
  lives: number;
  wave: number;
  blink: number;
  invuln: number;
  shields: ShieldCell[];
  saucer: Saucer | null;
  saucerTimer: number;
}

function freshAliens(): Alien[] {
  const list: Alien[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      list.push({ col: c, row: r, alive: true });
    }
  }
  return list;
}

function freshShields(): ShieldCell[] {
  const list: ShieldCell[] = [];
  for (let i = 1; i <= 4; i++) {
    const left = (W * i) / 5 - (SHIELD_COLS * SHIELD_CELL) / 2;
    for (let r = 0; r < SHIELD_ROWS; r++) {
      for (let c = 0; c < SHIELD_COLS; c++) {
        list.push({ x: left + c * SHIELD_CELL, y: SHIELD_Y + r * SHIELD_CELL, alive: true });
      }
    }
  }
  return list;
}

function saucerDelay(): number {
  return 15000 + Math.random() * 10000;
}

// Wave sets the base step interval; kills within the wave shave it further.
export function alienStepMs(wave: number, killed: number): number {
  const base = wave <= 1 ? 600 : Math.max(120, 500 - wave * 60);
  return Math.max(80, base - killed * 12);
}

export function hitShield(shields: ShieldCell[], x: number, y: number): boolean {
  for (const c of shields) {
    if (c.alive && x >= c.x && x <= c.x + SHIELD_CELL && y >= c.y && y <= c.y + SHIELD_CELL) {
      c.alive = false;
      return true;
    }
  }
  return false;
}

export function freshState(): GameState {
  return {
    score: 0,
    aliens: freshAliens(),
    bullet: null,
    bombs: [],
    playerX: W / 2,
    playerVx: 0,
    alienDx: 0.5,
    alienDy: 0,
    alienOffsetX: 30,
    alienOffsetY: 40,
    alienStepMs: 600,
    lastStep: 0,
    lastBomb: 0,
    fireCooldown: 0,
    lives: 3,
    wave: 1,
    blink: 0,
    invuln: 0,
    shields: freshShields(),
    saucer: null,
    saucerTimer: saucerDelay(),
  };
}

/** Held controls for one frame. `fire` is the fire key or a held pointer. */
export interface Input {
  left: boolean;
  right: boolean;
  fire: boolean;
}

/** fire: a shot left the cannon; kill / saucer: something was hit (score is in the state); hit: a life was lost; over: game over; wave: a new wave began. */
export type GameEvent = "fire" | "kill" | "saucer" | "hit" | "over" | "wave";

/**
 * Advance the game by `dt` ms at time `now`. Mutates `s` in place and returns what
 * happened this frame, in order, for sounds and the UI.
 */
export function step(s: GameState, dt: number, now: number, input: Input): GameEvent[] {
  const events: GameEvent[] = [];
  // Player movement
  let vx = 0;
  if (input.left) vx -= 1;
  if (input.right) vx += 1;
  s.playerX += vx * PLAYER_SPEED * dt;
  if (s.playerX < PLAYER_W / 2) s.playerX = PLAYER_W / 2;
  if (s.playerX > W - PLAYER_W / 2) s.playerX = W - PLAYER_W / 2;

  // Fire (keyboard, or while a pointer is held down)
  s.fireCooldown -= dt;
  s.invuln = Math.max(0, s.invuln - dt);
  const firing = input.fire;
  if (firing && !s.bullet && s.fireCooldown <= 0) {
    s.bullet = { x: s.playerX, y: H - PLAYER_H - 12 };
    s.fireCooldown = 280;
    events.push("fire");
  }

  // Bullet
  if (s.bullet) {
    s.bullet.y -= BULLET_SPEED * dt;
    if (s.bullet.y < 0 || hitShield(s.shields, s.bullet.x, s.bullet.y)) s.bullet = null;
  }

  // Bombs
  for (const b of s.bombs) b.y += BOMB_SPEED * dt;
  s.bombs = s.bombs.filter((b) => b.y < H && !hitShield(s.shields, b.x, b.y + 5));

  // Bonus saucer crosses the top now and then
  if (s.saucer) {
    s.saucer.x += s.saucer.dir * SAUCER_SPEED * dt;
    if (s.saucer.x < -SAUCER_W || s.saucer.x > W + SAUCER_W) {
      s.saucer = null;
      s.saucerTimer = saucerDelay();
    }
  } else {
    s.saucerTimer -= dt;
    if (s.saucerTimer <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      s.saucer = { x: dir === 1 ? -SAUCER_W / 2 : W + SAUCER_W / 2, dir };
    }
  }

  // Alien step (entire formation moves on tick interval)
  s.lastStep += dt;
  if (s.lastStep >= s.alienStepMs) {
    s.lastStep = 0;
    // Tentative move
    let nx = s.alienOffsetX + s.alienDx * 14;
    let bounce = false;
    let minX = Infinity, maxX = -Infinity;
    for (const a of s.aliens) {
      if (!a.alive) continue;
      const x = nx + a.col * (ALIEN_W + ALIEN_GAP);
      if (x < minX) minX = x;
      if (x + ALIEN_W > maxX) maxX = x + ALIEN_W;
    }
    if (minX < 8 || maxX > W - 8) {
      bounce = true;
      s.alienDx = -s.alienDx;
      nx = s.alienOffsetX; // don't shift this tick — drop instead
      s.alienOffsetY += ALIEN_H / 2;
    }
    s.alienOffsetX = nx;
    s.blink = (s.blink + 1) % 2;

    // Speed up as aliens die, on top of the wave's base speed
    const alive = s.aliens.filter((a) => a.alive).length;
    s.alienStepMs = alienStepMs(s.wave, ROWS * COLS - alive);

    // Aliens crush any shield cells they overlap
    for (const a of s.aliens) {
      if (!a.alive) continue;
      const ax = s.alienOffsetX + a.col * (ALIEN_W + ALIEN_GAP);
      const ay = s.alienOffsetY + a.row * (ALIEN_H + ALIEN_GAP);
      if (ay + ALIEN_H < SHIELD_Y) continue;
      for (const c of s.shields) {
        if (c.alive && c.x < ax + ALIEN_W && c.x + SHIELD_CELL > ax && c.y < ay + ALIEN_H && c.y + SHIELD_CELL > ay) {
          c.alive = false;
        }
      }
    }

    // Random bomb from a random column's lowest live alien
    if (!bounce && now - s.lastBomb > 700 && s.bombs.length < 3 && Math.random() < 0.4) {
      const cols = new Set<number>();
      for (const a of s.aliens) if (a.alive) cols.add(a.col);
      const colArr = Array.from(cols);
      if (colArr.length) {
        const c = colArr[Math.floor(Math.random() * colArr.length)]!;
        let shooter: Alien | null = null;
        for (const a of s.aliens) {
          if (a.alive && a.col === c && (!shooter || a.row > shooter.row)) shooter = a;
        }
        if (shooter) {
          const x = s.alienOffsetX + shooter.col * (ALIEN_W + ALIEN_GAP) + ALIEN_W / 2;
          const y = s.alienOffsetY + shooter.row * (ALIEN_H + ALIEN_GAP) + ALIEN_H;
          s.bombs.push({ x, y });
          s.lastBomb = now;
        }
      }
    }
  }

  // Bullet vs aliens
  if (s.bullet) {
    for (const a of s.aliens) {
      if (!a.alive) continue;
      const ax = s.alienOffsetX + a.col * (ALIEN_W + ALIEN_GAP);
      const ay = s.alienOffsetY + a.row * (ALIEN_H + ALIEN_GAP);
      if (s.bullet.x >= ax && s.bullet.x <= ax + ALIEN_W && s.bullet.y >= ay && s.bullet.y <= ay + ALIEN_H) {
        a.alive = false;
        s.bullet = null;
        s.score += ROW_SCORES[a.row] ?? 10;
        events.push("kill");
        break;
      }
    }
  }

  // Bullet vs saucer
  if (s.bullet && s.saucer && Math.abs(s.bullet.x - s.saucer.x) <= SAUCER_W / 2 &&
      s.bullet.y >= SAUCER_Y && s.bullet.y <= SAUCER_Y + SAUCER_H) {
    s.bullet = null;
    s.saucer = null;
    s.saucerTimer = saucerDelay();
    s.score += SAUCER_SCORES[Math.floor(Math.random() * SAUCER_SCORES.length)]!;
    events.push("saucer");
  }

  // Bombs vs player (skipped while invulnerable after a hit)
  const py = PLAYER_Y;
  for (let i = 0; s.invuln <= 0 && i < s.bombs.length; i++) {
    const b = s.bombs[i]!;
    if (
      b.x >= s.playerX - PLAYER_W / 2 &&
      b.x <= s.playerX + PLAYER_W / 2 &&
      b.y >= py &&
      b.y <= py + PLAYER_H
    ) {
      s.bombs.splice(i, 1);
      s.lives -= 1;
      events.push("hit");
      if (s.lives <= 0) {
        events.push("over");
        return events;
      }
      // Brief reset of player position, with a short grace period
      s.playerX = W / 2;
      s.invuln = INVULN_MS;
      break;
    }
  }

  // Aliens reached bottom
  const lowest = s.aliens.filter((a) => a.alive).reduce((m, a) => Math.max(m, a.row), 0);
  if (s.alienOffsetY + lowest * (ALIEN_H + ALIEN_GAP) + ALIEN_H >= py) {
    events.push("over");
    return events;
  }

  // Wave clear
  if (s.aliens.every((a) => !a.alive)) {
    s.wave += 1;
    events.push("wave");
    s.aliens = freshAliens();
    s.alienOffsetX = 30;
    s.alienOffsetY = 40 + (s.wave - 1) * 12;
    s.alienStepMs = alienStepMs(s.wave, 0);
    s.bombs = [];
  }
  return events;
}
