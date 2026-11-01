import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Volume2, VolumeX, RotateCcw, Play } from "lucide-react";
import "./style.css";

const W = 420;
const H = 640;
const BIRD_X = 105;
const BIRD_R = 16;
const GRAVITY = 0.34;
const FLAP = -6.3;
const GAP = 176;
const PIPE_W = 66;

function App() {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    mode: "ready",
    birdY: H * 0.46,
    velocity: 0,
    pipes: [],
    score: 0,
    frame: 0,
    clouds: [{ x: 35, y: 95, s: 1 }, { x: 255, y: 160, s: 0.8 }, { x: 350, y: 55, s: 1.15 }],
    groundOffset: 0,
    soundOn: true,
  });
  const [mode, setMode] = useState("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("flyingChiruBest") || 0));
  const [soundOn, setSoundOn] = useState(true);

  const sync = () => {
    const s = stateRef.current;
    setMode(s.mode);
    setScore(s.score);
  };

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.mode = "playing";
    s.birdY = H * 0.46;
    s.velocity = FLAP;
    s.pipes = [];
    s.score = 0;
    s.frame = 0;
    s.groundOffset = 0;
    sync();
  }, []);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (s.mode !== "playing") return;
    s.mode = "over";
    sync();
    if (s.soundOn && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s.mode === "ready" || s.mode === "over") {
      startGame();
      return;
    }
    if (s.mode === "playing") s.velocity = FLAP;
  }, [startGame]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
      if (e.code === "Escape" && stateRef.current.mode === "playing") {
        stateRef.current.mode = "paused";
        sync();
      } else if (e.code === "Escape" && stateRef.current.mode === "paused") {
        stateRef.current.mode = "playing";
        sync();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let last = 0;

    const roundedRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };

    const drawCloud = (x, y, scale) => {
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.beginPath();
      ctx.ellipse(x, y, 27 * scale, 13 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 18 * scale, y - 7 * scale, 19 * scale, 17 * scale, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 37 * scale, y, 25 * scale, 12 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBird = (y, velocity, frame) => {
      ctx.save();
      ctx.translate(BIRD_X, y);
      ctx.rotate(Math.max(-0.45, Math.min(0.65, velocity * 0.055)));
      // Character: warm yellow bird with orange beak and tiny crest.
      ctx.fillStyle = "#f8c94f";
      ctx.strokeStyle = "#b87921";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "#f3a72f";
      ctx.beginPath();
      ctx.ellipse(-8, -13, 5, 8, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef8434";
      ctx.beginPath();
      ctx.moveTo(15, -2); ctx.lineTo(31, 3); ctx.lineTo(15, 8); ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(8, -6, 6.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#26354a";
      ctx.beginPath(); ctx.arc(10, -6, 3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#eaa92e";
      ctx.save();
      ctx.translate(-3, 3);
      ctx.rotate(Math.sin(frame * 0.25) * 0.45);
      ctx.beginPath();
      ctx.ellipse(-2, 5, 10, 5, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    };

    const drawPipe = (pipe) => {
      const bottomY = pipe.top + GAP;
      const gradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_W, 0);
      gradient.addColorStop(0, "#1f9d62");
      gradient.addColorStop(0.48, "#45c879");
      gradient.addColorStop(1, "#168a55");
      ctx.fillStyle = gradient;
      ctx.strokeStyle = "#126d47";
      ctx.lineWidth = 3;
      ctx.fillRect(pipe.x, 0, PIPE_W, pipe.top);
      ctx.strokeRect(pipe.x, -2, PIPE_W, pipe.top + 2);
      ctx.fillRect(pipe.x - 7, pipe.top - 24, PIPE_W + 14, 24);
      ctx.strokeRect(pipe.x - 7, pipe.top - 24, PIPE_W + 14, 24);

      ctx.fillRect(pipe.x, bottomY, PIPE_W, H - bottomY);
      ctx.strokeRect(pipe.x, bottomY, PIPE_W, H - bottomY);
      ctx.fillRect(pipe.x - 7, bottomY, PIPE_W + 14, 24);
      ctx.strokeRect(pipe.x - 7, bottomY, PIPE_W + 14, 24);
    };

    const draw = (timestamp) => {
      const s = stateRef.current;
      const dt = Math.min((timestamp - (last || timestamp)) / 16.67, 2);
      last = timestamp;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#76d4ff");
      sky.addColorStop(1, "#d7f5ff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      s.clouds.forEach((cloud) => {
        drawCloud(cloud.x, cloud.y, cloud.s);
        if (s.mode === "playing") {
          cloud.x -= 0.35 * dt;
          if (cloud.x < -65) cloud.x = W + 50;
        }
      });

      // distant hills
      ctx.fillStyle = "#a6e7a3";
      ctx.beginPath();
      ctx.moveTo(0, H - 82);
      ctx.quadraticCurveTo(100, H - 155, 205, H - 82);
      ctx.quadraticCurveTo(310, H - 145, W, H - 80);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();

      if (s.mode === "playing") {
        s.frame += dt;
        s.velocity += GRAVITY * dt;
        s.birdY += s.velocity * dt;
        s.groundOffset = (s.groundOffset + 2.8 * dt) % 28;

        if (s.frame % 95 < dt) {
          const top = 90 + Math.random() * 260;
          s.pipes.push({ x: W + 8, top, passed: false });
        }
        s.pipes.forEach((p) => {
          p.x -= (2.7 + Math.min(s.score * 0.035, 1.6)) * dt;
          if (!p.passed && p.x + PIPE_W < BIRD_X) {
            p.passed = true;
            s.score += 1;
            setScore(s.score);
            if (s.score > best) {
              setBest(s.score);
              localStorage.setItem("flyingChiruBest", String(s.score));
            }
          }
        });
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 20);

        const birdBox = { left: BIRD_X - 14, right: BIRD_X + 15, top: s.birdY - 12, bottom: s.birdY + 12 };
        const hitGround = s.birdY + BIRD_R >= H - 42;
        const hitCeiling = s.birdY - BIRD_R <= 0;
        const hitPipe = s.pipes.some((p) => {
          const overlapsX = birdBox.right > p.x - 6 && birdBox.left < p.x + PIPE_W + 6;
          return overlapsX && (birdBox.top < p.top || birdBox.bottom > p.top + GAP);
        });
        if (hitGround || hitCeiling || hitPipe) endGame();
      }

      s.pipes.forEach(drawPipe);

      // Ground strip
      ctx.fillStyle = "#e7c77c";
      ctx.fillRect(0, H - 42, W, 42);
      ctx.fillStyle = "#79c85b";
      ctx.fillRect(0, H - 42, W, 9);
      ctx.fillStyle = "#c5a45b";
      for (let x = -s.groundOffset; x < W + 30; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, H - 25); ctx.lineTo(x + 12, H - 25); ctx.lineTo(x + 6, H - 19); ctx.fill();
      }

      drawBird(s.birdY, s.velocity, s.frame);

      if (s.mode !== "playing") {
        ctx.fillStyle = "rgba(15, 42, 66, .18)";
        ctx.fillRect(0, 0, W, H);
        if (s.mode === "ready") {
          ctx.fillStyle = "#fff";
          ctx.font = "900 34px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.shadowColor = "rgba(0,0,0,.22)";
          ctx.shadowBlur = 5;
          ctx.fillText("FLYING CHIRU", W / 2, 220);
          ctx.shadowBlur = 0;
          ctx.font = "600 17px system-ui, sans-serif";
          ctx.fillText("Tap or press SPACE to fly", W / 2, 260);
          ctx.font = "14px system-ui, sans-serif";
          ctx.fillText("Dodge the pipes and keep going!", W / 2, 286);
        } else if (s.mode === "over") {
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.font = "900 36px system-ui, sans-serif";
          ctx.fillText("GAME OVER", W / 2, 230);
          ctx.font = "700 22px system-ui, sans-serif";
          ctx.fillText(`Score: ${s.score}`, W / 2, 272);
          ctx.font = "600 16px system-ui, sans-serif";
          ctx.fillText("Tap or press SPACE to try again", W / 2, 310);
        } else if (s.mode === "paused") {
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.font = "900 36px system-ui, sans-serif";
          ctx.fillText("PAUSED", W / 2, 250);
          ctx.font = "600 16px system-ui, sans-serif";
          ctx.fillText("Press ESC to resume", W / 2, 290);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [best, endGame]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    stateRef.current.soundOn = next;
  };

  return (
    <main className="page">
      <div className="topline">
        <div className="brand"><span className="brandbird">✦</span> FLYING CHIRU</div>
        <button className="soundbtn" onClick={toggleSound} aria-label={soundOn ? "Mute sound" : "Enable sound"}>
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span>{soundOn ? "Sound on" : "Sound off"}</span>
        </button>
      </div>
      <section className="gameShell">
        <div className="scorebar">
          <div><span className="scorelabel">SCORE</span><strong>{score}</strong></div>
          <div className="best"><span className="scorelabel">BEST</span><strong>{best}</strong></div>
        </div>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={(e) => { e.preventDefault(); flap(); }}
          aria-label="Flying Chiru game. Tap to flap and avoid obstacles."
        />
        <div className="gameFooter">
          <span>Tap / Space: Fly</span>
          <span>Esc: Pause</span>
        </div>
      </section>
      <p className="hint">Fly through the gaps. Every pipe passed adds one point.</p>
      <audio ref={audioRef} src="/game-over.mp3" preload="auto" />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
