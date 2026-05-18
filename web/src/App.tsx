import { useEffect, useRef, useState, useCallback } from "react";
import { GameShell, GameTopbar, GameAuth, GameButton } from "@freegamestore/games";
import { useHighScore } from "./hooks/useHighScore";

const COLS = 9;
const ROWS = 5;
const ALIEN_W = 28;
const ALIEN_H = 20;
const ALIEN_GAP = 12;
const PLAYER_W = 36;
const PLAYER_H = 16;
const BULLET_SPEED = 0.55; // px/ms
const BOMB_SPEED = 0.22;
const PLAYER_SPEED = 0.4;
const ROW_SCORES = [40, 30, 20, 10, 10];

interface Alien { col: number; row: number; alive: boolean; }
interface Bullet { x: number; y: number; }
interface Bomb { x: number; y: number; }

interface GameState {
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

function freshState(canvasWidth: number): GameState {
  return {
    aliens: freshAliens(),
    bullet: null,
    bombs: [],
    playerX: canvasWidth / 2,
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
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const sizeRef = useRef({ w: 360, h: 480 });
  const keysRef = useRef<{ left: boolean; right: boolean; fire: boolean }>({ left: false, right: false, fire: false });
  const dragRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const [score, setScore] = useState(0);
  const [livesUI, setLivesUI] = useState(3);
  const [waveUI, setWaveUI] = useState(1);
  const [phase, setPhase] = useState<"intro" | "playing" | "over">("intro");
  const [_, force] = useState(0);
  const [bestScore, updateHighScore] = useHighScore("spaceinvaders-best");
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const startNewGame = useCallback(() => {
    const { w } = sizeRef.current;
    stateRef.current = freshState(w);
    setScore(0);
    setLivesUI(3);
    setWaveUI(1);
    setPhase("playing");
    force((x) => x + 1);
  }, []);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const maxW = parent.clientWidth;
      const maxH = parent.clientHeight;
      const aspect = 3 / 4;
      let cssW = maxW;
      let cssH = cssW / aspect;
      if (cssH > maxH) { cssH = maxH; cssW = cssH * aspect; }
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w: cssW, h: cssH };
      // Reposition player if game in progress
      if (stateRef.current && phase === "playing") {
        stateRef.current.playerX = Math.min(stateRef.current.playerX, cssW - PLAYER_W / 2);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [phase]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = true;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { keysRef.current.fire = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = false;
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") keysRef.current.fire = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      if (phase === "playing" && stateRef.current) step(stateRef.current, dt, now);
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function step(s: GameState, dt: number, now: number) {
    const { w, h } = sizeRef.current;

    // Player movement
    let vx = 0;
    if (keysRef.current.left) vx -= 1;
    if (keysRef.current.right) vx += 1;
    s.playerX += vx * PLAYER_SPEED * dt;
    if (s.playerX < PLAYER_W / 2) s.playerX = PLAYER_W / 2;
    if (s.playerX > w - PLAYER_W / 2) s.playerX = w - PLAYER_W / 2;

    // Fire
    s.fireCooldown -= dt;
    if (keysRef.current.fire && !s.bullet && s.fireCooldown <= 0) {
      s.bullet = { x: s.playerX, y: h - PLAYER_H - 12 };
      s.fireCooldown = 280;
    }

    // Bullet
    if (s.bullet) {
      s.bullet.y -= BULLET_SPEED * dt;
      if (s.bullet.y < 0) s.bullet = null;
    }

    // Bombs
    for (const b of s.bombs) b.y += BOMB_SPEED * dt;
    s.bombs = s.bombs.filter((b) => b.y < h);

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
      if (minX < 8 || maxX > w - 8) {
        bounce = true;
        s.alienDx = -s.alienDx;
        nx = s.alienOffsetX; // don't shift this tick — drop instead
        s.alienOffsetY += ALIEN_H / 2;
      }
      s.alienOffsetX = nx;
      s.blink = (s.blink + 1) % 2;

      // Speed up as aliens die
      const alive = s.aliens.filter((a) => a.alive).length;
      s.alienStepMs = Math.max(80, 600 - (ROWS * COLS - alive) * 12);

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
          const gained = ROW_SCORES[a.row] ?? 10;
          setScore((sc) => {
            const ns = sc + gained;
            updateHighScore(ns);
            return ns;
          });
          break;
        }
      }
    }

    // Bombs vs player
    const py = h - PLAYER_H - 6;
    for (let i = 0; i < s.bombs.length; i++) {
      const b = s.bombs[i]!;
      if (
        b.x >= s.playerX - PLAYER_W / 2 &&
        b.x <= s.playerX + PLAYER_W / 2 &&
        b.y >= py &&
        b.y <= py + PLAYER_H
      ) {
        s.bombs.splice(i, 1);
        s.lives -= 1;
        setLivesUI(s.lives);
        if (s.lives <= 0) {
          setPhase("over");
          return;
        }
        // Brief reset of player position
        s.playerX = w / 2;
        break;
      }
    }

    // Aliens reached bottom
    const lowest = s.aliens.filter((a) => a.alive).reduce((m, a) => Math.max(m, a.row), 0);
    if (s.alienOffsetY + lowest * (ALIEN_H + ALIEN_GAP) + ALIEN_H >= py) {
      setPhase("over");
      return;
    }

    // Wave clear
    if (s.aliens.every((a) => !a.alive)) {
      s.wave += 1;
      setWaveUI(s.wave);
      s.aliens = freshAliens();
      s.alienOffsetX = 30;
      s.alienOffsetY = 40 + (s.wave - 1) * 12;
      s.alienStepMs = Math.max(120, 500 - s.wave * 60);
      s.bombs = [];
    }
  }

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);

    // Bottom line
    ctx.strokeStyle = "rgba(16,185,129,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - PLAYER_H - 8);
    ctx.lineTo(w, h - PLAYER_H - 8);
    ctx.stroke();

    const s = stateRef.current;
    if (!s) return;

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

    // Player
    drawPlayer(ctx, s.playerX, h - PLAYER_H - 6);
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

  // Pointer controls — drag to move, tap to fire
  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase !== "playing") return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const s = stateRef.current!;
    s.playerX = Math.max(PLAYER_W / 2, Math.min(sizeRef.current.w - PLAYER_W / 2, x));
    dragRef.current.active = true;
    dragRef.current.lastX = x;
    keysRef.current.fire = true;
    // single-shot fire
    requestAnimationFrame(() => { keysRef.current.fire = false; });
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active || phase !== "playing") return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const s = stateRef.current!;
    s.playerX = Math.max(PLAYER_W / 2, Math.min(sizeRef.current.w - PLAYER_W / 2, x));
  }
  function pointerUp() {
    dragRef.current.active = false;
  }

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Space Invaders"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Lives", value: livesUI },
            { label: "Wave", value: waveUI },
            { label: "Best", value: bestScore },
          ]}
          rules={
            <div>
              <h3 style={{ marginBottom: "0.5rem", fontWeight: 700 }}>Space Invaders</h3>
              <p>Shoot the alien formation before it reaches your base.</p>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Controls</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Tap / drag — move ship; tap also fires</li>
                <li>Desktop: ← → or A/D to move, Space / ↑ to fire</li>
              </ul>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Rules</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Top rows score more</li>
                <li>Aliens speed up as their numbers thin</li>
                <li>3 lives. Bomb hits cost a life</li>
                <li>Clear a wave — the next one starts lower and faster</li>
              </ul>
            </div>
          }
          actions={<GameAuth />}
        />
      }
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0.5rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            style={{
              touchAction: "none",
              background: "#0a0a0a",
              borderRadius: "0.4rem",
              border: "1px solid var(--line)",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
          />
          {phase === "intro" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "1rem",
                background: "rgba(10,10,10,0.7)",
                borderRadius: "0.4rem",
              }}
            >
              <div style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: "1.5rem", color: "#f8fafc" }}>
                Defend the base
              </div>
              <GameButton size="md" variant="primary" onClick={startNewGame}>Start</GameButton>
            </div>
          )}
          {phase === "over" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "1rem",
                background: "rgba(10,10,10,0.78)",
                borderRadius: "0.4rem",
              }}
            >
              <div style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: "1.5rem", color: "#ef4444" }}>
                Game Over
              </div>
              <div style={{ color: "#f8fafc" }}>Score: {score}</div>
              <GameButton size="md" variant="primary" onClick={startNewGame}>Play Again</GameButton>
            </div>
          )}
        </div>
        <a
          href="https://freegamestore.online"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--muted)", fontSize: "0.7rem", textDecoration: "none", marginTop: "0.4rem" }}
        >
          Part of FreeGameStore — free forever
        </a>
      </div>
    </GameShell>
  );
}
