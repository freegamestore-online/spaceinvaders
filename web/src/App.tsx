import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { GameShell, GameTopbar, GameAuth, GameButton, useGameSounds } from "@freegamestore/games";
import { useHighScore } from "./hooks/useHighScore";
import { useKeys } from "./hooks/useKeys";
import { drawScene } from "./lib/draw";
import { freshState, step, PLAYER_W, W, type GameEvent, type GameState } from "./lib/game";

// useGameSounds reads SoundContext which GameShell provides INTERNALLY.
// Calling it directly above <GameShell> would get a disconnected default;
// AudioBridge is a tiny no-render child of GameShell that exposes the
// real sounds API via ref to the App scope.
type SoundsApi = ReturnType<typeof useGameSounds>;

function AudioBridge({ apiRef }: { apiRef: React.MutableRefObject<SoundsApi | null> }) {
  const sounds = useGameSounds();
  apiRef.current = sounds;
  return null;
}

/** A dark panel over the canvas for the start, pause and game-over screens. */
function Overlay({ dim, passThrough = false, children }: { dim: number; passThrough?: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "1rem",
        background: `rgba(10,10,10,${dim})`,
        borderRadius: "0.4rem",
        pointerEvents: passThrough ? "none" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Title({ color = "#f8fafc", children }: { color?: string; children: ReactNode }) {
  return <div style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: "1.5rem", color }}>{children}</div>;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const scaleRef = useRef(1);
  const keysRef = useKeys();
  const dragRef = useRef<{ id: number | null; lastX: number }>({ id: null, lastX: 0 });
  const audioRef = useRef<SoundsApi | null>(null);
  const [score, setScore] = useState(0);
  const [livesUI, setLivesUI] = useState(3);
  const [waveUI, setWaveUI] = useState(1);
  const [phase, setPhase] = useState<"intro" | "playing" | "over">("intro");
  const [paused, setPaused] = useState(false);
  const [bestScore, updateHighScore] = useHighScore("spaceinvaders-best");

  const startNewGame = useCallback(() => {
    stateRef.current = freshState();
    dragRef.current.id = null;
    setPaused(false);
    setScore(0);
    setLivesUI(3);
    setWaveUI(1);
    setPhase("playing");
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
      const k = cssW / W;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      scaleRef.current = k;
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [phase]);

  // Animation loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      const s = stateRef.current;
      if (phase === "playing" && !paused && s) {
        const keys = keysRef.current;
        handle(s, step(s, dt, now, { left: keys.left, right: keys.right, fire: keys.fire || dragRef.current.id !== null }));
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused]);

  function draw() {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawScene(ctx, stateRef.current);
  }

  /** Sounds and topbar figures for what happened in a frame. */
  function handle(s: GameState, events: GameEvent[]) {
    const sounds = audioRef.current;
    for (const e of events) {
      if (e === "fire") sounds?.playMove();
      if (e === "kill") sounds?.playClear();
      if (e === "saucer") sounds?.playLevelUp();
      if (e === "hit") {
        setLivesUI(s.lives);
        sounds?.playError();
      }
      if (e === "over") {
        sounds?.playGameOver();
        setPhase("over");
      }
      if (e === "wave") {
        setWaveUI(s.wave);
        sounds?.playLevelUp();
      }
    }
    if (events.includes("kill") || events.includes("saucer")) {
      setScore(s.score);
      updateHighScore(s.score);
    }
  }

  // Pointer controls — drag to move (relative, no teleport), hold to fire
  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase !== "playing" || paused || dragRef.current.id !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current.id = e.pointerId;
    dragRef.current.lastX = e.clientX;
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current.id !== e.pointerId || phase !== "playing" || paused) return;
    const s = stateRef.current!;
    const dx = (e.clientX - dragRef.current.lastX) / scaleRef.current;
    dragRef.current.lastX = e.clientX;
    s.playerX = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, s.playerX + dx));
  }
  function pointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current.id === e.pointerId) dragRef.current.id = null;
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
                <li>Touch / mouse — drag to move, hold to keep firing</li>
                <li>Desktop: ← → or A/D to move, Space / ↑ to fire</li>
              </ul>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>Rules</h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Top rows score more</li>
                <li>Aliens speed up as their numbers thin</li>
                <li>3 lives. Bomb hits cost a life, then a moment of invulnerability</li>
                <li>Shields absorb shots from both sides and wear away</li>
                <li>Hit the bonus ship crossing the top for extra points</li>
                <li>Clear a wave — the next one starts lower and faster</li>
              </ul>
            </div>
          }
          onPlayPause={phase === "playing" ? () => setPaused((p) => !p) : undefined}
          paused={paused}
          onRestart={startNewGame}
          actions={<GameAuth />}
        />
      }
    >
      <AudioBridge apiRef={audioRef} />
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
            <Overlay dim={0.7}>
              <Title>Defend the base</Title>
              <GameButton size="md" variant="primary" onClick={startNewGame}>Start</GameButton>
            </Overlay>
          )}
          {phase === "playing" && paused && (
            <Overlay dim={0.6} passThrough>
              <Title>Paused</Title>
            </Overlay>
          )}
          {phase === "over" && (
            <Overlay dim={0.78}>
              <Title color="#ef4444">Game Over</Title>
              <div style={{ color: "#f8fafc" }}>Score: {score}</div>
              <GameButton size="md" variant="primary" onClick={startNewGame}>Play Again</GameButton>
            </Overlay>
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
