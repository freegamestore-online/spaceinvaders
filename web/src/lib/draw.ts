import {
  ALIEN_GAP, ALIEN_H, ALIEN_W, H, PLAYER_H, PLAYER_W, PLAYER_Y, SAUCER_H, SAUCER_W, SAUCER_Y, SHIELD_CELL, W,
  type GameState,
} from "./game";

/** Draw one frame in world units; the canvas transform scales it to the screen. */
export function drawScene(ctx: CanvasRenderingContext2D, s: GameState | null) {
  ctx.clearRect(0, 0, W, H);

  // Bottom line
  ctx.strokeStyle = "rgba(16,185,129,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H - PLAYER_H - 8);
  ctx.lineTo(W, H - PLAYER_H - 8);
  ctx.stroke();

  if (!s) return;

  // Shields
  ctx.fillStyle = "rgba(16,185,129,0.7)";
  for (const c of s.shields) {
    if (c.alive) ctx.fillRect(c.x, c.y, SHIELD_CELL, SHIELD_CELL);
  }

  // Bonus saucer
  if (s.saucer) {
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.ellipse(s.saucer.x, SAUCER_Y + SAUCER_H * 0.65, SAUCER_W / 2, SAUCER_H * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s.saucer.x, SAUCER_Y + SAUCER_H * 0.35, SAUCER_W / 5, SAUCER_H * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aliens
  for (const a of s.aliens) {
    if (!a.alive) continue;
    const x = s.alienOffsetX + a.col * (ALIEN_W + ALIEN_GAP);
    const y = s.alienOffsetY + a.row * (ALIEN_H + ALIEN_GAP);
    drawAlien(ctx, x, y, a.row, s.blink);
  }

  // Bombs
  ctx.fillStyle = "#f43f5e";
  for (const b of s.bombs) {
    ctx.fillRect(b.x - 2, b.y - 5, 4, 10);
  }

  // Bullet
  if (s.bullet) {
    ctx.fillStyle = "#10b981";
    ctx.fillRect(s.bullet.x - 1.5, s.bullet.y - 8, 3, 12);
  }

  // Player (blinks while invulnerable)
  if (s.invuln <= 0 || Math.floor(s.invuln / 100) % 2 === 0) drawPlayer(ctx, s.playerX, PLAYER_Y);
}

function drawAlien(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, blink: number) {
  const colors = ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
  ctx.fillStyle = colors[row] ?? "#10b981";
  const px = 4;
  const w = ALIEN_W, h = ALIEN_H;
  // Body
  ctx.fillRect(x + px, y + px, w - px * 2, h - px * 2);
  // Antennae / legs alternate by blink
  if (blink === 0) {
    ctx.fillRect(x, y + px, px, px);
    ctx.fillRect(x + w - px, y + px, px, px);
  } else {
    ctx.fillRect(x, y + h - px * 2, px, px);
    ctx.fillRect(x + w - px, y + h - px * 2, px, px);
  }
  // Eyes
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(x + px + 4, y + px + 4, 4, 4);
  ctx.fillRect(x + w - px - 8, y + px + 4, 4, 4);
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#10b981";
  // Hull
  ctx.fillRect(x - PLAYER_W / 2, y + PLAYER_H - 6, PLAYER_W, 6);
  // Mid body
  ctx.fillRect(x - 10, y + 4, 20, PLAYER_H - 6);
  // Cannon
  ctx.fillRect(x - 2, y, 4, 6);
}
