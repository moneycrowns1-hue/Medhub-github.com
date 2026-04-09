"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  loadRabbitPersonality,
  RABBIT_PERSONALITY_UPDATED_EVENT,
  type RabbitPersonality,
} from "@/lib/rabbit-personality";
import {
  RABBIT_ASSISTANT_CONTROL_EVENT,
  RABBIT_GUIDE_PROMPT_EVENT,
  RABBIT_GUIDE_SPEAK_EVENT,
  type RabbitAssistantControlPayload,
  type RabbitBehaviorMode,
  type RabbitVisualState,
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
type RabbitMode = "IDLE" | "RUN" | "JUMP" | "SLEEP";

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

type BubbleSide = "top" | "right" | "bottom" | "left";

type BubbleLayout = {
  left: number;
  top: number;
  side: BubbleSide;
  arrowOffset: number;
};

type EdgeVisualConfig = {
  supportX: number;
  supportY: number;
  contactOffsetX: number;
  contactOffsetY: number;
  bubbleInset: number;
  bubbleClearance: number;
};

function isBehaviorMode(value: unknown): value is RabbitBehaviorMode {
  return value === "patrol" || value === "guide" || value === "waiting" || value === "resting" || value === "summary";
}

function isVisualState(value: unknown): value is RabbitVisualState {
  return value === "run" || value === "jump" || value === "idle" || value === "sleep";
}

export function GlobalRabbitMascot() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speechRef = useRef<HTMLDivElement | null>(null);
  const [speech, setSpeech] = useState<SpeechBubbleState | null>(null);
  const [bubbleLayout, setBubbleLayout] = useState<BubbleLayout>({
    left: 20,
    top: 20,
    side: "top",
    arrowOffset: 28,
  });

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
    const baseSupportX = spriteWidth * 0.5;
    const baseSupportY = spriteHeight - 1;

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
    let behaviorMode: RabbitBehaviorMode = "patrol";
    let commandedVisualState: RabbitVisualState | null = null;
    let controlPauseUntilTs = 0;
    let lastBubbleLayout: BubbleLayout | null = null;
    let currentVisual: EdgeVisualConfig = {
      supportX: baseSupportX,
      supportY: baseSupportY,
      contactOffsetX: 0,
      contactOffsetY: 0,
      bubbleInset: Math.max(16, spriteHeight * 0.42),
      bubbleClearance: Math.max(30, Math.max(spriteWidth, spriteHeight) * 0.56),
    };

    if (shouldReduceMotion) {
      drawRabbitFrame(ctx, rabbitFrames[Math.max(0, rabbitFrames.length - 1)], 1, pixelSize, 0);
      root.style.transform = `translate3d(${Math.round(current.x - currentVisual.supportX)}px, ${Math.round(current.y - currentVisual.supportY)}px, 0)`;
      return;
    }

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const normalForEdge = (edgeValue: Edge): Point => {
      if (edgeValue === "top") return { x: 0, y: 1 };
      if (edgeValue === "right") return { x: -1, y: 0 };
      if (edgeValue === "bottom") return { x: 0, y: -1 };
      return { x: 1, y: 0 };
    };

    const bubblePriorityForAnchor = (anchorX: number, anchorY: number): BubbleSide[] => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let preferred: BubbleSide = "top";

      if (anchorY < vh * 0.24) preferred = "bottom";
      else if (anchorY > vh * 0.76) preferred = "top";
      else if (anchorX < vw * 0.28) preferred = "right";
      else if (anchorX > vw * 0.72) preferred = "left";

      const order: BubbleSide[] = [preferred, "top", "bottom", "right", "left"];
      return order.filter((value, index) => order.indexOf(value) === index);
    };

    const updateSpeechBubbleLayout = (anchorX: number, anchorY: number, mascotClearance: number) => {
      if (!speechVisible) return;
      const bubbleEl = speechRef.current;
      if (!bubbleEl) return;

      const rect = bubbleEl.getBoundingClientRect();
      const bubbleWidth = Math.max(220, rect.width || 320);
      const bubbleHeight = Math.max(120, rect.height || 160);
      const gap = 14;
      const pad = 10;

      const candidates = bubblePriorityForAnchor(anchorX, anchorY).map((side) => {
        let baseLeft = anchorX - bubbleWidth / 2;
        let baseTop = anchorY - mascotClearance - bubbleHeight - gap;

        if (side === "bottom") {
          baseTop = anchorY + mascotClearance + gap;
        } else if (side === "left") {
          baseLeft = anchorX - mascotClearance - bubbleWidth - gap;
          baseTop = anchorY - bubbleHeight / 2;
        } else if (side === "right") {
          baseLeft = anchorX + mascotClearance + gap;
          baseTop = anchorY - bubbleHeight / 2;
        }

        const overflow =
          Math.max(0, pad - baseLeft) +
          Math.max(0, pad - baseTop) +
          Math.max(0, baseLeft + bubbleWidth + pad - window.innerWidth) +
          Math.max(0, baseTop + bubbleHeight + pad - window.innerHeight);

        const left = clamp(baseLeft, pad, Math.max(pad, window.innerWidth - bubbleWidth - pad));
        const top = clamp(baseTop, pad, Math.max(pad, window.innerHeight - bubbleHeight - pad));

        const arrowOffset =
          side === "top" || side === "bottom"
            ? clamp(anchorX - left, 18, Math.max(18, bubbleWidth - 18))
            : clamp(anchorY - top, 18, Math.max(18, bubbleHeight - 18));

        return { side, left, top, overflow, arrowOffset };
      });

      const best = candidates.sort((a, b) => a.overflow - b.overflow)[0];
      if (!best) return;

      const nextLayout: BubbleLayout = {
        left: best.left,
        top: best.top,
        side: best.side,
        arrowOffset: best.arrowOffset,
      };

      const prev = lastBubbleLayout;
      const unchanged =
        prev &&
        prev.side === nextLayout.side &&
        Math.abs(prev.left - nextLayout.left) < 1 &&
        Math.abs(prev.top - nextLayout.top) < 1 &&
        Math.abs(prev.arrowOffset - nextLayout.arrowOffset) < 1;

      if (unchanged) return;
      lastBubbleLayout = nextLayout;
      setBubbleLayout(nextLayout);
    };

    const visualForEdge = (edgeValue: Edge): EdgeVisualConfig => {
      if (edgeValue === "top") {
        return {
          supportX: spriteWidth * 0.52,
          supportY: spriteHeight - 1,
          contactOffsetX: 0,
          contactOffsetY: 1,
          bubbleInset: Math.max(16, spriteHeight * 0.44),
          bubbleClearance: Math.max(30, spriteHeight * 0.72),
        };
      }
      if (edgeValue === "right") {
        return {
          supportX: spriteWidth * 0.4,
          supportY: spriteHeight - 1,
          contactOffsetX: 1,
          contactOffsetY: 3,
          bubbleInset: Math.max(16, spriteHeight * 0.42),
          bubbleClearance: Math.max(30, spriteWidth * 0.78),
        };
      }
      if (edgeValue === "bottom") {
        return {
          supportX: spriteWidth * 0.48,
          supportY: spriteHeight - 1,
          contactOffsetX: 0,
          contactOffsetY: 0,
          bubbleInset: Math.max(16, spriteHeight * 0.44),
          bubbleClearance: Math.max(30, spriteHeight * 0.72),
        };
      }
      return {
        supportX: spriteWidth * 0.5,
        supportY: spriteHeight - 1,
        contactOffsetX: -1,
        contactOffsetY: 2,
        bubbleInset: Math.max(16, spriteHeight * 0.42),
        bubbleClearance: Math.max(30, spriteWidth * 0.78),
      };
    };

    const orientationForEdge = (edgeValue: Edge): { direction: 1 | -1; angle: number } => {
      if (edgeValue === "top") return { direction: -1, angle: 180 };
      if (edgeValue === "right") return { direction: 1, angle: 90 };
      if (edgeValue === "bottom") return { direction: -1, angle: 0 };
      return { direction: -1, angle: -90 };
    };

    const updateOrientation = () => {
      currentVisual = visualForEdge(edge);
      sprite.style.transformOrigin = `${currentVisual.supportX}px ${currentVisual.supportY}px`;
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
      const isControlPaused = ts < controlPauseUntilTs;

      if (!isSpeaking && speechVisible) {
        speechVisible = false;
        setSpeech(null);
      }

      if (isPausedOnCorner) {
        cornerPauseRemainingMs = Math.max(0, cornerPauseRemainingMs - dt * 1000);
      }

      const canPatrol = behaviorMode === "patrol" || behaviorMode === "guide";

      if (!isSpeaking && !isControlPaused && canPatrol && cornerPauseRemainingMs <= 0) {
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

      if (isSpeaking || commandedVisualState === "idle" || isControlPaused || cornerPauseRemainingMs > 0) {
        mode = "IDLE";
        jumpRemainingMs = 0;
      } else if (commandedVisualState === "sleep" || behaviorMode === "resting") {
        mode = "SLEEP";
        jumpRemainingMs = 0;
      } else if (commandedVisualState === "jump") {
        if (jumpRemainingMs <= 0) jumpRemainingMs = profile.jumpDurationMs;
        mode = "JUMP";
        jumpRemainingMs = Math.max(0, jumpRemainingMs - dt * 1000);
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

      breathingTick += dt * (mode === "IDLE" || mode === "SLEEP" ? 2.2 : 3.2);
      frameTick += dt * (mode === "RUN" ? 7.2 : 4.2);

      const breatheY = Math.round(Math.sin(breathingTick) * (mode === "SLEEP" ? 1 : mode === "IDLE" ? 2.2 : 1.1));
      const idleFrameIndex = Math.max(0, rabbitFrames.length - 1);
      const jumpFrameIndex = Math.min(2, Math.max(0, rabbitFrames.length - 1));
      const runFrameIndex = rabbitFrames.length > 1 ? Math.floor(frameTick) % (rabbitFrames.length - 1) : 0;
      const frameIndex = mode === "RUN" ? runFrameIndex : mode === "JUMP" ? jumpFrameIndex : idleFrameIndex;

      drawRabbitFrame(ctx, rabbitFrames[frameIndex], direction, pixelSize, breatheY);
      const normal = normalForEdge(edge);
      const footX = current.x + normal.x * jumpLift + currentVisual.contactOffsetX;
      const footY = current.y + normal.y * jumpLift + currentVisual.contactOffsetY;
      root.style.transform = `translate3d(${Math.round(footX - currentVisual.supportX)}px, ${Math.round(footY - currentVisual.supportY)}px, 0)`;
      sprite.style.transform = `rotate(${angle.toFixed(1)}deg)`;
      const bubbleAnchorX = footX + normal.x * currentVisual.bubbleInset;
      const bubbleAnchorY = footY + normal.y * currentVisual.bubbleInset;
      updateSpeechBubbleLayout(bubbleAnchorX, bubbleAnchorY, currentVisual.bubbleClearance);

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
      const normal = normalForEdge(edge);
      const bubbleAnchorX = current.x + normal.x * currentVisual.bubbleInset;
      const bubbleAnchorY = current.y + normal.y * currentVisual.bubbleInset;
      updateSpeechBubbleLayout(bubbleAnchorX, bubbleAnchorY, currentVisual.bubbleClearance);
    };

    const onPersonalityChange = () => {
      personality = loadRabbitPersonality();
      cornerPauseRemainingMs = personalityProfiles[personality].cornerPauseMs;
    };

    const onGuidePrompt = () => {
      cornerPauseRemainingMs = Math.max(cornerPauseRemainingMs, 420);
    };

    const onAssistantControl = (event: Event) => {
      const custom = event as CustomEvent<RabbitAssistantControlPayload>;
      const detail = custom.detail;
      if (!detail || typeof detail !== "object") return;
      if (!isBehaviorMode(detail.behaviorMode) || !isVisualState(detail.visualState)) return;

      behaviorMode = detail.behaviorMode;
      commandedVisualState = detail.visualState;

      if (typeof detail.pauseMs === "number" && detail.pauseMs > 0) {
        controlPauseUntilTs = Math.max(controlPauseUntilTs, performance.now() + detail.pauseMs);
      }
      if (detail.visualState === "jump" && jumpRemainingMs <= 0) {
        jumpRemainingMs = personalityProfiles[personality].jumpDurationMs;
      }
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
      const normal = normalForEdge(edge);
      const bubbleAnchorX = current.x + normal.x * currentVisual.bubbleInset;
      const bubbleAnchorY = current.y + normal.y * currentVisual.bubbleInset;
      updateSpeechBubbleLayout(bubbleAnchorX, bubbleAnchorY, currentVisual.bubbleClearance);
      speakUntilTs = performance.now() + Math.max(1400, detail.durationMs ?? 4800);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("storage", onPersonalityChange);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, onPersonalityChange);
    window.addEventListener(RABBIT_GUIDE_PROMPT_EVENT, onGuidePrompt);
    window.addEventListener(RABBIT_ASSISTANT_CONTROL_EVENT, onAssistantControl as EventListener);
    window.addEventListener(RABBIT_GUIDE_SPEAK_EVENT, onGuideSpeak as EventListener);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("storage", onPersonalityChange);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, onPersonalityChange);
      window.removeEventListener(RABBIT_GUIDE_PROMPT_EVENT, onGuidePrompt);
      window.removeEventListener(RABBIT_ASSISTANT_CONTROL_EVENT, onAssistantControl as EventListener);
      window.removeEventListener(RABBIT_GUIDE_SPEAK_EVENT, onGuideSpeak as EventListener);
    };
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        className="fixed left-0 top-0 z-50"
        style={{ willChange: "transform" }}
      >
        <div ref={spriteRef} className="pointer-events-none">
          <canvas
            ref={canvasRef}
            style={{
              imageRendering: "pixelated",
              filter: "drop-shadow(0 0 8px rgba(255,255,255,0.22))",
            }}
          />
        </div>
      </div>

      {speech ? (
        <div
          ref={speechRef}
          className="pointer-events-auto fixed z-[55] w-[min(360px,88vw)] rounded-[26px] border border-white/25 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl"
          style={{ left: bubbleLayout.left, top: bubbleLayout.top }}
        >
          <div className="text-sm leading-tight [font-family:var(--font-heading)]">{speech.title}</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">{speech.message}</p>
          {speech.status ? <div className="mt-1.5 text-[11px] text-white/65">{speech.status}</div> : null}
          {speech.actions?.length ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {speech.actions.slice(0, 2).map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className={
                    action.primary
                      ? "rounded-lg border border-white/30 bg-white px-2.5 py-1 text-[11px] font-semibold text-black"
                      : "rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] text-white"
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}

          <div
            className="absolute h-3 w-3 rotate-45 border border-white/25 bg-slate-950/95"
            style={
              bubbleLayout.side === "top"
                ? { left: bubbleLayout.arrowOffset - 6, bottom: -6, borderLeftWidth: 0, borderTopWidth: 0 }
                : bubbleLayout.side === "bottom"
                  ? { left: bubbleLayout.arrowOffset - 6, top: -6, borderRightWidth: 0, borderBottomWidth: 0 }
                  : bubbleLayout.side === "left"
                    ? { right: -6, top: bubbleLayout.arrowOffset - 6, borderLeftWidth: 0, borderBottomWidth: 0 }
                    : { left: -6, top: bubbleLayout.arrowOffset - 6, borderTopWidth: 0, borderRightWidth: 0 }
            }
          />
          <div
            className="absolute h-2.5 w-2.5 rounded-full bg-slate-900/95"
            style={
              bubbleLayout.side === "top"
                ? { left: bubbleLayout.arrowOffset - 4, bottom: -15 }
                : bubbleLayout.side === "bottom"
                  ? { left: bubbleLayout.arrowOffset - 4, top: -15 }
                  : bubbleLayout.side === "left"
                    ? { right: -15, top: bubbleLayout.arrowOffset - 4 }
                    : { left: -15, top: bubbleLayout.arrowOffset - 4 }
            }
          />
        </div>
      ) : null}
    </>
  );
}
