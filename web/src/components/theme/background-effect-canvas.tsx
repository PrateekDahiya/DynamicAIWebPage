"use client";

import { useEffect, useRef } from "react";
import { useThemeStore } from "@/stores/theme-store";

type Particle = {
  x: number;
  y: number;
  r: number;
  speedY: number;
  color: string;
  twinkle?: number;
  len?: number;
};

function makeParticles(canvas: HTMLCanvasElement, effect: string, intensity: number): Particle[] {
  const count = Math.round(80 * intensity);
  const configs: Record<string, () => Omit<Particle, "x" | "y">> = {
    particles: () => ({ r: Math.random() * 2 + 1, speedY: Math.random() * 0.5 + 0.1, color: "rgba(200,200,255,0.6)" }),
    snow: () => ({ r: Math.random() * 3 + 1, speedY: Math.random() * 1 + 0.5, color: "rgba(255,255,255,0.8)" }),
    stars: () => ({ r: Math.random() * 1.5 + 0.3, speedY: 0, color: "rgba(255,255,255,0.9)", twinkle: Math.random() * Math.PI * 2 }),
    rain: () => ({ r: 1, speedY: Math.random() * 6 + 8, color: "rgba(150,180,255,0.5)", len: Math.random() * 10 + 8 }),
  };
  const factory = configs[effect];
  if (!factory) return [];
  return Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    ...factory(),
  }));
}

// Ported from the original vanilla app's public/js/actions/theme.js particle/gradient engine,
// essentially unchanged — imperative canvas code has nothing to gain from React re-renders, so
// it just lives inside a ref-managed effect instead, driven by the theme store's `animation` state.
export function BackgroundEffectCanvas() {
  const animation = useThemeStore((s) => s.animation);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const effect = animation?.effect ?? "none";
    if (effect === "none") {
      particlesRef.current = [];
      return;
    }

    particlesRef.current = effect === "gradient-shift" ? [] : makeParticles(canvas, effect, animation?.intensity ?? 1);

    function tick() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (effect === "gradient-shift") {
        const t = Date.now() / 3000;
        const hue1 = (Math.sin(t) * 60 + 220) % 360;
        const hue2 = (Math.cos(t) * 60 + 280) % 360;
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, `hsl(${hue1}, 60%, 20%)`);
        grad.addColorStop(1, `hsl(${hue2}, 60%, 15%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        for (const p of particlesRef.current) {
          ctx.beginPath();
          ctx.fillStyle = p.color;
          if (effect === "rain") {
            ctx.strokeStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x, p.y + (p.len ?? 0));
            ctx.stroke();
          } else if (effect === "stars") {
            p.twinkle = (p.twinkle ?? 0) + 0.02;
            const alpha = 0.5 + Math.sin(p.twinkle) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
          }

          p.y += p.speedY;
          if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animation]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
    />
  );
}
