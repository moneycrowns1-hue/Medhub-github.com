"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadRabbitPersonality,
  RABBIT_PERSONALITY_UPDATED_EVENT,
  type RabbitPersonality,
} from "@/lib/rabbit-personality";
import {
  RABBIT_GUIDE_PROMPT_EVENT,
  RABBIT_GUIDE_SPEAK_EVENT,
  type RabbitGuideSpeechPayload,
} from "@/lib/rabbit-guide";

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
  edge: Edge;
};

type Edge = "top" | "right" | "bottom" | "left";
type RabbitMode = "IDLE" | "RUN" | "JUMP";

type PersonalityProfile = {
  runSpeed: number;
  jumpLift: number;
  cornerPauseMs: number;
  jumpDurationMs: number;
  jumpChancePerSecond: number;
};

const personalityProfiles: Record<RabbitPersonality, PersonalityProfile> = {
  balanced: {
    runSpeed: 56,
    jumpLift: 16,
    cornerPauseMs: 900,
    jumpDurationMs: 520,
    jumpChancePerSecond: 0.28,
  },
  calm: {
    runSpeed: 42,
    jumpLift: 12,
    cornerPauseMs: 1200,
    jumpDurationMs: 560,
    jumpChancePerSecond: 0.18,
  },
  active: {
    runSpeed: 70,
    jumpLift: 20,
    cornerPauseMs: 650,
    jumpDurationMs: 460,
    jumpChancePerSecond: 0.38,
  },
};

type SpeechBubbleState = {
  title: string;
  message: string;
  status?: string;
  actions?: { href: string; label: string; primary?: boolean }[];
};

export function GlobalRabbitMascot() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [speech, setSpeech] = useState<SpeechBubbleState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = rootRef.current;
    const sprite = spriteRef.current;
    const canvas = canvasRef.current;
    if (!root || !sprite || !canvas) return;

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
    const headerLineY = 64;

    const minX = () => margin;
    const maxX = () => Math.max(minX(), window.innerWidth - spriteWidth - margin);
    const minY = () => Math.max(headerLineY, margin);
    const maxY = () => Math.max(minY(), window.innerHeight - margin);

    const clampFeetPoint = (p: Point): Point => ({
      x: Math.max(minX(), Math.min(maxX(), p.x)),
      y: Math.max(minY(), Math.min(maxY(), p.y)),
    });

    const snapToNearestEdge = (p: Point): { edge: Edge; point: Point } => {
      const clamped = clampFeetPoint(p);
      const dTop = Math.abs(clamped.y - minY());
      const dRight = Math.abs(clamped.x - maxX());
      const dBottom = Math.abs(clamped.y - maxY());
      const dLeft = Math.abs(clamped.x - minX());
      const nearest = [
        { edge: "top" as const, d: dTop },
        { edge: "right" as const, d: dRight },
        { edge: "bottom" as const, d: dBottom },
        { edge: "left" as const, d: dLeft },
      ].sort((a, b) => a.d - b.d)[0]?.edge;

      if (nearest === "top") return { edge: "top", point: { x: clamped.x, y: minY() } };
      if (nearest === "right") return { edge: "right", point: { x: maxX(), y: clamped.y } };
      if (nearest === "bottom") return { edge: "bottom", point: { x: clamped.x, y: maxY() } };
      return { edge: "left", point: { x: minX(), y: clamped.y } };
    };

    const loadState = (): PersistedState | null => {
      try {
        const raw = window.localStorage.getItem(MASCOT_POSITION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedState;
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
        if (parsed.edge !== "top" && parsed.edge !== "right" && parsed.edge !== "bottom" && parsed.edge !== "left") return null;
        return {
          x: parsed.x,
          y: parsed.y,
          edge: parsed.edge,
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
    const seeded = initialSaved ?? { x: minX(), y: minY(), edge: "top" as Edge };
    const snapped = snapToNearestEdge({ x: seeded.x, y: seeded.y });
    let current = snapped.point;
    let edge: Edge = initialSaved?.edge ?? snapped.edge;
    let direction: 1 | -1 = 1;
    let angle = 0;
    let mode: RabbitMode = "RUN";
    let jumpLift = 0;
    let jumpRemainingMs = 0;
    let breathingTick = 0;
    let frameTick = 0;
    let lastTs = performance.now();
    let lastPersistTs = 0;
    let cornerPauseRemainingMs = 0;
    let speakUntilTs = 0;
    let speechVisible = false;

    if (shouldReduceMotion) {
      drawRabbitFrame(ctx, rabbitFrames[Math.max(0, rabbitFrames.length - 1)], 1, pixelSize, 0);
      root.style.transform = `translate3d(${Math.round(current.x)}px, ${Math.round(current.y - spriteHeight)}px, 0)`;
      return;
    }

    const orientationForEdge = (edgeValue: Edge): { direction: 1 | -1; angle: number } => {
      if (edgeValue === "top") return { direction: 1, angle: 0 };
      if (edgeValue === "right") return { direction: 1, angle: 90 };
      if (edgeValue === "bottom") return { direction: -1, angle: 0 };
      return { direction: 1, angle: -90 };
    };

    const updateOrientation = () => {
      const o = orientationForEdge(edge);
      direction = o.direction;
      angle = o.angle;
    };

    const goNextEdge = () => {
      if (edge === "top") {
        current.x = maxX();
        current.y = minY();
        edge = "right";
      } else if (edge === "right") {
        current.x = maxX();
        current.y = maxY();
        edge = "bottom";
      } else if (edge === "bottom") {
        current.x = minX();
        current.y = maxY();
        edge = "left";
      } else {
        current.x = minX();
        current.y = minY();
        edge = "top";
      }
      cornerPauseRemainingMs = personalityProfiles[personality].cornerPauseMs;
      updateOrientation();
    };

    updateOrientation();

    let rafId = 0;
    const step = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;

      const profile = personalityProfiles[personality];
      const isSpeaking = ts < speakUntilTs;
      const isPausedOnCorner = cornerPauseRemainingMs > 0;

      if (!isSpeaking && speechVisible) {
        speechVisible = false;
        setSpeech(null);
      }

      if (isPausedOnCorner) {
        cornerPauseRemainingMs = Math.max(0, cornerPauseRemainingMs - dt * 1000);
      }

      if (!isSpeaking && cornerPauseRemainingMs <= 0) {
        const distance = profile.runSpeed * dt;
        if (edge === "top") {
          current.x += distance;
          if (current.x >= maxX()) goNextEdge();
        } else if (edge === "right") {
          current.y += distance;
          if (current.y >= maxY()) goNextEdge();
        } else if (edge === "bottom") {
          current.x -= distance;
          if (current.x <= minX()) goNextEdge();
        } else {
          current.y -= distance;
          if (current.y <= minY()) goNextEdge();
        }
      }

      if (isSpeaking || cornerPauseRemainingMs > 0) {
        mode = "IDLE";
        jumpRemainingMs = 0;
      } else if (jumpRemainingMs > 0) {
        mode = "JUMP";
        jumpRemainingMs = Math.max(0, jumpRemainingMs - dt * 1000);
      } else {
        mode = "RUN";
        if (Math.random() < profile.jumpChancePerSecond * dt) {
          jumpRemainingMs = profile.jumpDurationMs;
          mode = "JUMP";
        }
      }

      if (mode === "JUMP") {
        const jumpN = 1 - jumpRemainingMs / Math.max(1, profile.jumpDurationMs);
        jumpLift = Math.sin(Math.max(0, Math.min(1, jumpN)) * Math.PI) * profile.jumpLift;
      } else {
        jumpLift = 0;
      }

      breathingTick += dt * (mode === "IDLE" ? 3.6 : 2.2);
      frameTick += dt * (mode === "RUN" ? 7.2 : 4.2);

      const breatheY = Math.round(Math.sin(breathingTick) * (mode === "IDLE" ? 2.2 : 1.1));
      const idleFrameIndex = Math.max(0, rabbitFrames.length - 1);
      const jumpFrameIndex = Math.min(2, Math.max(0, rabbitFrames.length - 1));
      const runFrameIndex = rabbitFrames.length > 1 ? Math.floor(frameTick) % (rabbitFrames.length - 1) : 0;
      const frameIndex = mode === "IDLE" ? idleFrameIndex : mode === "JUMP" ? jumpFrameIndex : runFrameIndex;

      drawRabbitFrame(ctx, rabbitFrames[frameIndex], direction, pixelSize, breatheY);
      root.style.transform = `translate3d(${Math.round(current.x)}px, ${Math.round(current.y - spriteHeight - jumpLift)}px, 0)`;
      sprite.style.transform = `rotate(${angle.toFixed(1)}deg)`;

      if (ts - lastPersistTs > 220) {
        lastPersistTs = ts;
        saveState({ x: current.x, y: current.y, edge });
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);

    const onResize = () => {
      const snappedResize = snapToNearestEdge(current);
      current = snappedResize.point;
      edge = snappedResize.edge;
      updateOrientation();
    };

    const onPersonalityChange = () => {
      personality = loadRabbitPersonality();
      cornerPauseRemainingMs = personalityProfiles[personality].cornerPauseMs;
    };

    const onGuidePrompt = () => {
      cornerPauseRemainingMs = Math.max(cornerPauseRemainingMs, 420);
    };

    const onGuideSpeak = (event: Event) => {
      const custom = event as CustomEvent<RabbitGuideSpeechPayload>;
      const detail = custom.detail;
      if (!detail || typeof detail !== "object") return;

      speechVisible = true;
      setSpeech({
        title: detail.title,
        message: detail.message,
        status: detail.status,
        actions: detail.actions,
      });
      speakUntilTs = performance.now() + Math.max(1400, detail.durationMs ?? 4800);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("storage", onPersonalityChange);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, onPersonalityChange);
    window.addEventListener(RABBIT_GUIDE_PROMPT_EVENT, onGuidePrompt);
    window.addEventListener(RABBIT_GUIDE_SPEAK_EVENT, onGuideSpeak as EventListener);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("storage", onPersonalityChange);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, onPersonalityChange);
      window.removeEventListener(RABBIT_GUIDE_PROMPT_EVENT, onGuidePrompt);
      window.removeEventListener(RABBIT_GUIDE_SPEAK_EVENT, onGuideSpeak as EventListener);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed left-0 top-0 z-50"
      style={{ willChange: "transform" }}
    >
      <div ref={spriteRef} className="pointer-events-none" style={{ transformOrigin: "center bottom" }}>
        <canvas
          ref={canvasRef}
          style={{
            imageRendering: "pixelated",
            filter: "drop-shadow(0 0 8px rgba(255,255,255,0.22))",
          }}
        />
      </div>

      {speech ? (
        <div className="pointer-events-auto absolute bottom-[calc(100%+8px)] left-1/2 w-[min(280px,78vw)] -translate-x-1/2 rounded-xl border border-white/30 bg-slate-950/92 px-3 py-2 text-white shadow-xl backdrop-blur">
          <div className="text-[11px] leading-tight [font-family:var(--font-heading)]">{speech.title}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/85">{speech.message}</p>
          {speech.status ? <div className="mt-1 text-[10px] text-white/60">{speech.status}</div> : null}
          {speech.actions?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {speech.actions.slice(0, 2).map((action) => (
                <a
                  key={action.href + action.label}
                  href={action.href}
                  className={
                    action.primary
                      ? "rounded-md border border-white/30 bg-white px-2 py-1 text-[10px] font-semibold text-black"
                      : "rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[10px] text-white"
                  }
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
