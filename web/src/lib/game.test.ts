import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALIEN_GAP, ALIEN_H, ALIEN_W, COLS, INVULN_MS, PLAYER_W, PLAYER_Y, ROWS, ROW_SCORES, W,
  alienStepMs, freshState, hitShield, step, type GameState,
} from "./game";

const idle = { left: false, right: false, fire: false };

/** Where an alien of the formation is, in world units. */
const alienAt = (s: GameState, col: number, row: number) => ({
  x: s.alienOffsetX + col * (ALIEN_W + ALIEN_GAP),
  y: s.alienOffsetY + row * (ALIEN_H + ALIEN_GAP),
});

beforeEach(() => {
  // No bombs and no saucer unless a test sets them up.
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("freshState", () => {
  it("starts a full formation, four shields and three lives", () => {
    const s = freshState();
    expect(s.aliens).toHaveLength(ROWS * COLS);
    expect(s.shields).toHaveLength(4 * 6 * 4);
    expect(s).toMatchObject({ lives: 3, wave: 1, score: 0, bullet: null, playerX: W / 2 });
  });
});

describe("step", () => {
  it("moves the ship with the held keys and stops it at the edge", () => {
    const s = freshState();
    step(s, 10, 0, { ...idle, left: true });
    expect(s.playerX).toBeLessThan(W / 2);
    for (let i = 0; i < 200; i++) step(s, 10, 0, { ...idle, left: true });
    expect(s.playerX).toBe(PLAYER_W / 2);
  });

  it("fires one shot at a time", () => {
    const s = freshState();
    expect(step(s, 10, 0, { ...idle, fire: true })).toContain("fire");
    expect(s.bullet).not.toBeNull();
    expect(step(s, 10, 0, { ...idle, fire: true })).not.toContain("fire");
  });

  it("scores by row when a shot hits an alien", () => {
    const s = freshState();
    const { x, y } = alienAt(s, 3, 0);
    s.bullet = { x: x + ALIEN_W / 2, y: y + ALIEN_H };
    const events = step(s, 1, 0, idle);
    expect(events).toContain("kill");
    expect(s.score).toBe(ROW_SCORES[0]);
    expect(s.aliens.find((a) => a.col === 3 && a.row === 0)!.alive).toBe(false);
    expect(s.bullet).toBeNull();
  });

  it("costs a life on a bomb hit, then gives a moment of invulnerability", () => {
    const s = freshState();
    s.bombs = [{ x: s.playerX, y: PLAYER_Y + 1 }];
    expect(step(s, 1, 0, idle)).toEqual(["hit"]);
    expect(s.lives).toBe(2);
    expect(s.invuln).toBe(INVULN_MS);
    s.bombs = [{ x: s.playerX, y: PLAYER_Y + 1 }];
    expect(step(s, 1, 0, idle)).not.toContain("hit");
  });

  it("ends the game when the last life goes", () => {
    const s = freshState();
    s.lives = 1;
    s.bombs = [{ x: s.playerX, y: PLAYER_Y + 1 }];
    expect(step(s, 1, 0, idle)).toEqual(["hit", "over"]);
    expect(s.lives).toBe(0);
  });

  it("ends the game when the formation reaches the base", () => {
    const s = freshState();
    s.alienOffsetY = PLAYER_Y;
    expect(step(s, 1, 0, idle)).toContain("over");
  });

  it("starts a lower, faster wave once every alien is down", () => {
    const s = freshState();
    s.aliens.forEach((a) => (a.alive = false));
    expect(step(s, 1, 0, idle)).toContain("wave");
    expect(s.wave).toBe(2);
    expect(s.aliens.every((a) => a.alive)).toBe(true);
    expect(s.alienOffsetY).toBe(40 + 12);
    expect(s.alienStepMs).toBe(alienStepMs(2, 0));
  });
});

describe("alienStepMs", () => {
  it("gets faster with each kill and each wave, with a floor", () => {
    expect(alienStepMs(1, 10)).toBeLessThan(alienStepMs(1, 0));
    expect(alienStepMs(3, 0)).toBeLessThan(alienStepMs(2, 0));
    expect(alienStepMs(20, 45)).toBe(80);
  });
});

describe("hitShield", () => {
  it("knocks out the shield cell that was hit, once", () => {
    const s = freshState();
    const cell = s.shields[0]!;
    expect(hitShield(s.shields, cell.x + 1, cell.y + 1)).toBe(true);
    expect(cell.alive).toBe(false);
    expect(hitShield(s.shields, cell.x + 1, cell.y + 1)).toBe(false);
  });
});
