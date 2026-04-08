"use client";

import { useEffect, useRef } from "react";

type RabbitFrame = number[][];

const MASCOT_POSITION_KEY = "somagnus:mascot:position:v1";

const rabbitFrames: RabbitFrame[] = [
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 0, 2, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 2, 1, 2, 2, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 2, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 2, 2, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 2, 2, 0, 0, 0, 2, 2, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 2, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 2, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 2, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 1, 1, 2, 2, 1, 1, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 2, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
];

function drawRabbitFrame(ctx: CanvasRenderingContext2D, frame: RabbitFrame, direction: 1 | -1, pixelSize: number, breatheY: number) {
  const width = frame[0].length * pixelSize;
  const height = frame.length * pixelSize;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (direction === -1) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  frame.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === 0) return;
      ctx.fillStyle = cell === 1 ? "#ffffff" : "#000000";
      ctx.fillRect(x * pixelSize, y * pixelSize + breatheY, pixelSize, pixelSize);
    });
  });
  ctx.restore();
}

type Point = { x: number; y: number };

type PersistedState = {
  x: number;
  y: number;
  angle: number;
  direction: 1 | -1;
};

export function GlobalRabbitMascot() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pixelSize = 3;
    const cols = rabbitFrames[0][0].length;
    const rows = rabbitFrames[0].length;
    const spriteWidth = cols * pixelSize;
    const spriteHeight = rows * pixelSize;

    canvas.width = spriteWidth;
    canvas.height = spriteHeight;

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const margin = 10;
    const headerSafeY = 72;

    const minX = () => margin;
    const maxX = () => Math.max(minX(), window.innerWidth - spriteWidth - margin);
    const minY = () => Math.max(headerSafeY, margin);
    const maxY = () => Math.max(minY(), window.innerHeight - spriteHeight - margin);

    const clampPoint = (p: Point): Point => ({
      x: Math.max(minX(), Math.min(maxX(), p.x)),
      y: Math.max(minY(), Math.min(maxY(), p.y)),
    });

    const randomEdgePoint = (): Point => {
      const edge = ["left", "right", "top", "bottom", "left", "right", "top", "bottom"][Math.floor(Math.random() * 8)];
      if (edge === "left") return { x: minX(), y: minY() + Math.random() * Math.max(1, maxY() - minY()) };
      if (edge === "right") return { x: maxX(), y: minY() + Math.random() * Math.max(1, maxY() - minY()) };
      if (edge === "top") return { x: minX() + Math.random() * Math.max(1, maxX() - minX()), y: minY() };
      return { x: minX() + Math.random() * Math.max(1, maxX() - minX()), y: maxY() };
    };

    const loadState = (): PersistedState | null => {
      try {
        const raw = window.localStorage.getItem(MASCOT_POSITION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedState;
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.x !== "number" || typeof parsed.y !== "number" || typeof parsed.angle !== "number") return null;
        return {
          x: parsed.x,
          y: parsed.y,
          angle: parsed.angle,
          direction: parsed.direction === -1 ? -1 : 1,
        };
      } catch {
        return null;
      }
    };

    const saveState = (state: PersistedState) => {
      try {
        window.localStorage.setItem(MASCOT_POSITION_KEY, JSON.stringify(state));
      } catch {
        return;
      }
    };

    const initialSaved = loadState();
    let current = clampPoint(initialSaved ? { x: initialSaved.x, y: initialSaved.y } : randomEdgePoint());
    let target = randomEdgePoint();
    let direction: 1 | -1 = initialSaved?.direction ?? 1;
    let angle = initialSaved?.angle ?? 0;
    let breathingTick = 0;
    let frameTick = 0;
    let lastTs = performance.now();
    let lastPersistTs = 0;

    if (shouldReduceMotion) {
      drawRabbitFrame(ctx, rabbitFrames[0], direction, pixelSize, 0);
      root.style.transform = `translate3d(${Math.round(current.x)}px, ${Math.round(current.y)}px, 0)`;
      return;
    }

    const pickNextTarget = () => {
      let next = randomEdgePoint();
      let attempts = 0;
      while (Math.hypot(next.x - current.x, next.y - current.y) < 80 && attempts < 4) {
        next = randomEdgePoint();
        attempts += 1;
      }
      target = next;
    };

    const smoothAngle = (from: number, to: number, factor: number) => {
      let delta = to - from;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return from + delta * factor;
    };

    pickNextTarget();

    let rafId = 0;
    const step = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 10) {
        pickNextTarget();
      }

      const vx = distance > 0.001 ? dx / distance : 0;
      const vy = distance > 0.001 ? dy / distance : 0;
      const speed = 120;
      current = clampPoint({
        x: current.x + vx * speed * dt,
        y: current.y + vy * speed * dt,
      });

      if (Math.abs(vx) > 0.05) {
        direction = vx >= 0 ? 1 : -1;
      }

      const targetAngle = (Math.atan2(vy, vx) * 180) / Math.PI;
      angle = smoothAngle(angle, targetAngle, 0.18);

      frameTick += dt * 8;
      breathingTick += dt * 4;
      const breatheY = Math.round(Math.sin(breathingTick) * 1.8);
      const frameIndex = Math.floor(frameTick) % rabbitFrames.length;

      drawRabbitFrame(ctx, rabbitFrames[frameIndex], direction, pixelSize, breatheY);
      root.style.transform = `translate3d(${Math.round(current.x)}px, ${Math.round(current.y)}px, 0) rotate(${angle.toFixed(1)}deg)`;

      if (ts - lastPersistTs > 220) {
        lastPersistTs = ts;
        saveState({ x: current.x, y: current.y, angle, direction });
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    const onResize = () => {
      current = clampPoint(current);
      target = clampPoint(target);
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50"
      style={{ willChange: "transform" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          imageRendering: "pixelated",
          filter: "drop-shadow(0 0 8px rgba(255,255,255,0.22))",
        }}
      />
    </div>
  );
}
