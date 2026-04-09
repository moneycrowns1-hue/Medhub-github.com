"use client";

import { useEffect, useRef } from "react";
import {
  loadRabbitPersonality,
  RABBIT_PERSONALITY_UPDATED_EVENT,
  type RabbitPersonality,
} from "@/lib/rabbit-personality";

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
  edgeS?: number;
};

type RabbitMode = "IDLE" | "RUN" | "JUMP";

type PersonalityProfile = {
  idleMinMs: number;
  idleRangeMs: number;
  runMinMs: number;
  runRangeMs: number;
  jumpMinMs: number;
  jumpRangeMs: number;
  runSpeed: number;
  jumpSpeed: number;
  jumpLift: number;
  detourChance: number;
  detourCooldownMin: number;
  detourCooldownRange: number;
  fromIdleJumpChance: number;
  fromRunIdleChance: number;
  fromJumpRunChance: number;
};

const personalityProfiles: Record<RabbitPersonality, PersonalityProfile> = {
  balanced: {
    idleMinMs: 900,
    idleRangeMs: 1700,
    runMinMs: 1800,
    runRangeMs: 2600,
    jumpMinMs: 700,
    jumpRangeMs: 450,
    runSpeed: 56,
    jumpSpeed: 72,
    jumpLift: 16,
    detourChance: 0.0022,
    detourCooldownMin: 5,
    detourCooldownRange: 4,
    fromIdleJumpChance: 0.22,
    fromRunIdleChance: 0.42,
    fromJumpRunChance: 0.55,
  },
  calm: {
    idleMinMs: 1500,
    idleRangeMs: 2400,
    runMinMs: 1300,
    runRangeMs: 1800,
    jumpMinMs: 560,
    jumpRangeMs: 260,
    runSpeed: 42,
    jumpSpeed: 58,
    jumpLift: 12,
    detourChance: 0.0009,
    detourCooldownMin: 7,
    detourCooldownRange: 5,
    fromIdleJumpChance: 0.12,
    fromRunIdleChance: 0.58,
    fromJumpRunChance: 0.45,
  },
  active: {
    idleMinMs: 500,
    idleRangeMs: 700,
    runMinMs: 2200,
    runRangeMs: 3000,
    jumpMinMs: 820,
    jumpRangeMs: 400,
    runSpeed: 70,
    jumpSpeed: 92,
    jumpLift: 20,
    detourChance: 0.0034,
    detourCooldownMin: 3,
    detourCooldownRange: 3,
    fromIdleJumpChance: 0.35,
    fromRunIdleChance: 0.26,
    fromJumpRunChance: 0.72,
  },
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

    const perimeter = () => {
      const w = Math.max(1, maxX() - minX());
      const h = Math.max(1, maxY() - minY());
      return 2 * (w + h);
    };

    const pointOnEdge = (edgeS: number): Point => {
      const w = Math.max(1, maxX() - minX());
      const h = Math.max(1, maxY() - minY());
      const p = perimeter();
      let s = edgeS % p;
      if (s < 0) s += p;

      if (s <= w) {
        return { x: minX() + s, y: minY() };
      }
      if (s <= w + h) {
        return { x: maxX(), y: minY() + (s - w) };
      }
      if (s <= 2 * w + h) {
        return { x: maxX() - (s - (w + h)), y: maxY() };
      }
      return { x: minX(), y: maxY() - (s - (2 * w + h)) };
    };

    const tangentOnEdge = (edgeS: number, sign: 1 | -1) => {
      const w = Math.max(1, maxX() - minX());
      const h = Math.max(1, maxY() - minY());
      const p = perimeter();
      let s = edgeS % p;
      if (s < 0) s += p;

      let tx = 1;
      let ty = 0;
      if (s > w && s <= w + h) {
        tx = 0;
        ty = 1;
      } else if (s > w + h && s <= 2 * w + h) {
        tx = -1;
        ty = 0;
      } else if (s > 2 * w + h) {
        tx = 0;
        ty = -1;
      }

      return { tx: tx * sign, ty: ty * sign };
    };

    const nearestEdgeS = (p: Point) => {
      const w = Math.max(1, maxX() - minX());
      const h = Math.max(1, maxY() - minY());
      const topX = Math.max(minX(), Math.min(maxX(), p.x));
      const rightY = Math.max(minY(), Math.min(maxY(), p.y));
      const bottomX = Math.max(minX(), Math.min(maxX(), p.x));
      const leftY = Math.max(minY(), Math.min(maxY(), p.y));

      const candidates = [
        { s: topX - minX(), d: Math.hypot(p.x - topX, p.y - minY()) },
        { s: w + (rightY - minY()), d: Math.hypot(p.x - maxX(), p.y - rightY) },
        { s: w + h + (maxX() - bottomX), d: Math.hypot(p.x - bottomX, p.y - maxY()) },
        { s: 2 * w + h + (maxY() - leftY), d: Math.hypot(p.x - minX(), p.y - leftY) },
      ];

      candidates.sort((a, b) => a.d - b.d);
      return candidates[0]?.s ?? 0;
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
    let personality = loadRabbitPersonality();
    let direction: 1 | -1 = initialSaved?.direction ?? (Math.random() < 0.5 ? -1 : 1);
    let edgeS = initialSaved?.edgeS ?? nearestEdgeS(initialSaved ? { x: initialSaved.x, y: initialSaved.y } : randomEdgePoint());
    let current = pointOnEdge(edgeS);
    let angle = initialSaved?.angle ?? 0;
    let mode: RabbitMode = "IDLE";
    let modeDuration = 1200;
    let modeElapsed = 0;
    let jumpLift = 0;
    let detourActive = false;
    let detourTarget: Point | null = null;
    let detourCooldown = 0;
    let breathingTick = 0;
    let frameTick = 0;
    let lastTs = performance.now();
    let lastPersistTs = 0;

    if (shouldReduceMotion) {
      drawRabbitFrame(ctx, rabbitFrames[0], direction, pixelSize, 0);
      root.style.transform = `translate3d(${Math.round(current.x)}px, ${Math.round(current.y)}px, 0)`;
      return;
    }

    const pickCenterDetour = () => {
      const profile = personalityProfiles[personality];
      const padX = (maxX() - minX()) * 0.22;
      const padY = (maxY() - minY()) * 0.24;
      detourTarget = {
        x: minX() + padX + Math.random() * Math.max(1, maxX() - minX() - padX * 2),
        y: minY() + padY + Math.random() * Math.max(1, maxY() - minY() - padY * 2),
      };
      detourActive = true;
      detourCooldown = profile.detourCooldownMin + Math.floor(Math.random() * profile.detourCooldownRange);
    };

    const setMode = (next: RabbitMode) => {
      const profile = personalityProfiles[personality];
      mode = next;
      modeElapsed = 0;
      if (next === "IDLE") {
        modeDuration = profile.idleMinMs + Math.random() * profile.idleRangeMs;
      } else if (next === "RUN") {
        modeDuration = profile.runMinMs + Math.random() * profile.runRangeMs;
      } else {
        modeDuration = profile.jumpMinMs + Math.random() * profile.jumpRangeMs;
      }
    };

    const smoothAngle = (from: number, to: number, factor: number) => {
      let delta = to - from;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return from + delta * factor;
    };

    setMode("IDLE");

    let rafId = 0;
    const step = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      modeElapsed += dt * 1000;

      if (modeElapsed >= modeDuration) {
        const profile = personalityProfiles[personality];
        if (mode === "IDLE") {
          setMode(Math.random() < profile.fromIdleJumpChance ? "JUMP" : "RUN");
        } else if (mode === "RUN") {
          setMode(Math.random() < profile.fromRunIdleChance ? "IDLE" : "JUMP");
        } else {
          setMode(Math.random() < profile.fromJumpRunChance ? "RUN" : "IDLE");
        }
      }

      let vx = 0;
      let vy = 0;

      if (mode !== "IDLE") {
        const profile = personalityProfiles[personality];
        const speed = mode === "JUMP" ? profile.jumpSpeed : profile.runSpeed;

        if (!detourActive && detourCooldown <= 0 && mode === "RUN" && Math.random() < profile.detourChance) {
          pickCenterDetour();
        }

        if (detourActive && detourTarget) {
          const dx = detourTarget.x - current.x;
          const dy = detourTarget.y - current.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 10) {
            detourActive = false;
            detourTarget = null;
            edgeS = nearestEdgeS(current);
          } else {
            vx = dx / Math.max(0.001, dist);
            vy = dy / Math.max(0.001, dist);
            current = clampPoint({
              x: current.x + vx * speed * dt,
              y: current.y + vy * speed * dt,
            });
          }
        }

        if (!detourActive) {
          edgeS += direction * speed * dt;
          current = pointOnEdge(edgeS);
          const tangent = tangentOnEdge(edgeS, direction);
          vx = tangent.tx;
          vy = tangent.ty;
          if (Math.abs(vx) > 0.05) {
            direction = vx > 0 ? 1 : -1;
          }
        }

        if (detourCooldown > 0 && modeElapsed > modeDuration * 0.8) {
          detourCooldown -= 1;
        }
      }

      const targetAngle =
        Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001
          ? (Math.atan2(vy, vx) * 180) / Math.PI
          : angle;
      angle = smoothAngle(angle, targetAngle, 0.14);

      if (mode === "JUMP") {
        const profile = personalityProfiles[personality];
        const jumpN = Math.min(1, modeElapsed / Math.max(1, modeDuration));
        jumpLift = Math.sin(jumpN * Math.PI) * profile.jumpLift;
      } else {
        jumpLift = 0;
      }

      breathingTick += dt * (mode === "IDLE" ? 3.6 : 2.2);
      frameTick += dt * (mode === "RUN" ? 7.2 : 4.2);

      const breatheY = Math.round(Math.sin(breathingTick) * (mode === "IDLE" ? 2.2 : 1.1));
      const frameIndex = mode === "IDLE" ? 0 : mode === "JUMP" ? 2 : Math.floor(frameTick) % rabbitFrames.length;

      drawRabbitFrame(ctx, rabbitFrames[frameIndex], direction, pixelSize, breatheY);
      root.style.transform = `translate3d(${Math.round(current.x)}px, ${Math.round(current.y - jumpLift)}px, 0) rotate(${angle.toFixed(1)}deg)`;

      if (ts - lastPersistTs > 220) {
        lastPersistTs = ts;
        saveState({ x: current.x, y: current.y, angle, direction, edgeS });
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    const onResize = () => {
      current = clampPoint(current);
      edgeS = nearestEdgeS(current);
      if (detourTarget) {
        detourTarget = clampPoint(detourTarget);
      }
    };

    const onPersonalityChange = () => {
      personality = loadRabbitPersonality();
      setMode("IDLE");
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("storage", onPersonalityChange);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, onPersonalityChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("storage", onPersonalityChange);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, onPersonalityChange);
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
