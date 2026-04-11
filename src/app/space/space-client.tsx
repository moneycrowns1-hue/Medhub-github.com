"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Outfit, Pixelify_Sans } from "next/font/google";
import { ArrowRight, Headphones, Heart, Pause, Play, SkipBack, SkipForward, Sparkles, Waves } from "lucide-react";
import { getSpaceSharedAudio } from "@/lib/space-shared-audio";

type Mood = {
  id: string;
  title: string;
  subtitle: string;
  tone: string;
};

type RabbitFrame = number[][];

type SpaceSession = {
  id: string;
  title: string;
  type: string;
  approxLengthSec: number;
  desc: string;
  moodId: string;
  audioSrc?: string;
  embedSrc?: string;
  externalHref?: string;
  preferEmbed?: boolean;
};

const FAVORITES_STORAGE_KEY = "somagnus:space:favorites:v1";
const PROGRESS_STORAGE_KEY = "somagnus:space:progress:v1";
const VISUAL_MODE_STORAGE_KEY = "somagnus:space:visual-mode:v1";
const DAILY_MASCOT_GUIDE_STORAGE_KEY = "somagnus:space:mascot-daily-checkin:v1";
const ACTIVE_SESSION_STORAGE_KEY = "somagnus:space:active-session:v1";
const VOLUME_STORAGE_KEY = "somagnus:space:volume:v1";
const PLAYBACK_RATE_STORAGE_KEY = "somagnus:space:rate:v1";
const AUTO_ADVANCE_STORAGE_KEY = "somagnus:space:auto-advance:v1";
const SPACE_ARCHIVE_SESSION_ID = "dormir-mejor";
const SPACE_ARCHIVE_STREAM_URL = "https://archive.org/download/entregate-al-sueno/Entregate%20al%20sue%C3%B1o.mp3";
const SPACE_ARCHIVE_EMBED_URL = "https://archive.org/embed/entregate-al-sueno";
const SPACE_ARCHIVE_EXTERNAL_URL = "https://archive.org/details/entregate-al-sueno";

type VisualModeId = "aurora" | "deep-night" | "soft-glass";

type VisualMode = {
  id: VisualModeId;
  label: string;
  desc: string;
};

const visualModes: VisualMode[] = [
  { id: "aurora", label: "Aurora minimal", desc: "Limpio + menos saturación" },
  { id: "deep-night", label: "Deep night", desc: "Oscuro inmersivo + brillo sutil" },
  { id: "soft-glass", label: "Soft glass", desc: "Translúcido premium bienestar" },
];

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const pixelify = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "700"] });

const HERO_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4";

const moods: Mood[] = [
  {
    id: "respira",
    title: "Respira",
    subtitle: "2 min para volver al centro",
    tone: "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_45%)]",
  },
  {
    id: "enfocate",
    title: "Enfócate",
    subtitle: "Prep mental antes de estudiar",
    tone: "bg-[radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_45%)]",
  },
  {
    id: "descarga",
    title: "Descarga",
    subtitle: "Cerrar el día sin ruido mental",
    tone: "bg-[radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.2),transparent_45%)]",
  },
];

const revealIds = ["hero", "mood", "carousel", "favorites", "upcoming"] as const;

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
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 2, 2, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 0, 2, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0],
  ],
];

function drawRabbitFrame(
  ctx: CanvasRenderingContext2D,
  frame: RabbitFrame,
  direction: 1 | -1,
  breatheOffsetY: number,
  pixelSize: number,
) {
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
      ctx.fillRect(x * pixelSize, y * pixelSize + breatheOffsetY, pixelSize, pixelSize);
    });
  });
  ctx.restore();
}

function loadInitialRevealState() {
  if (typeof window === "undefined") return {} as Record<string, boolean>;
  const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!shouldReduceMotion) return {} as Record<string, boolean>;
  return Object.fromEntries(revealIds.map((id) => [id, true])) as Record<string, boolean>;
}

function loadVisualMode() {
  if (typeof window === "undefined") return "aurora" as VisualModeId;
  try {
    const raw = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    return visualModes.some((mode) => mode.id === raw) ? (raw as VisualModeId) : "aurora";
  } catch {
    return "aurora" as VisualModeId;
  }
}

function getScrollY() {
  if (typeof window === "undefined") return 0;
  return window.scrollY || window.pageYOffset || 0;
}

function withBasePath(path: string) {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const basePath = process.env.NODE_ENV === "production" ? "/Medhub-github.com" : "";
  return `${basePath}${path}`;
}

const sessions: SpaceSession[] = [
  {
    id: "reset-express",
    title: "Reset express",
    type: "Micro pausa",
    approxLengthSec: 180,
    desc: "Baja tensión y arranca con claridad.",
    moodId: "respira",
    audioSrc: "/audio/space/reset-express.mp3",
  },
  {
    id: "foco-profundo",
    title: "Foco profundo",
    type: "Preparación",
    approxLengthSec: 480,
    desc: "Ritual mental antes de un bloque largo.",
    moodId: "enfocate",
    audioSrc: "/audio/space/foco-profundo.mp3",
  },
  {
    id: "dormir-mejor",
    title: "Dormir mejor",
    type: "Noche",
    approxLengthSec: 600,
    desc: "Transición suave para descansar de verdad.",
    moodId: "descarga",
    audioSrc: SPACE_ARCHIVE_STREAM_URL,
    embedSrc: SPACE_ARCHIVE_EMBED_URL,
    externalHref: SPACE_ARCHIVE_EXTERNAL_URL,
    preferEmbed: true,
  },
  {
    id: "aterriza-mente",
    title: "Aterriza tu mente",
    type: "Ansiedad",
    approxLengthSec: 300,
    desc: "Respiración guiada para recuperar presencia.",
    moodId: "respira",
    audioSrc: "/audio/space/aterriza-mente.mp3",
  },
  {
    id: "modo-examen",
    title: "Modo examen",
    type: "Pre estudio",
    approxLengthSec: 420,
    desc: "Enfoca tu energía antes de una sesión intensa.",
    moodId: "enfocate",
    audioSrc: "/audio/space/modo-examen.mp3",
  },
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function loadFavorites() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadProgress() {
  if (typeof window === "undefined") return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function getTodayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyMascotCheckinDone() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DAILY_MASCOT_GUIDE_STORAGE_KEY);
    return raw === getTodayStamp();
  } catch {
    return false;
  }
}

function normalizeAudioUrl(url: string) {
  try {
    const origin = typeof window === "undefined" ? "https://localhost" : window.location.origin;
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

function sameAudioSource(currentSrc: string, nextSrc: string) {
  return normalizeAudioUrl(currentSrc) === normalizeAudioUrl(nextSrc);
}

function resolveSessionIdFromSource(source: string) {
  return sessions.find((session) => {
    if (!session.audioSrc) return false;
    return sameAudioSource(source, withBasePath(session.audioSrc));
  })?.id;
}

function loadInitialActiveSessionId() {
  if (typeof window === "undefined") return sessions[0]?.id ?? "";
  const fromAudio = resolveSessionIdFromSource(getSpaceSharedAudio()?.currentSrc ?? "");
  if (fromAudio) return fromAudio;
  try {
    const saved = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    return sessions.some((session) => session.id === saved) ? (saved as string) : SPACE_ARCHIVE_SESSION_ID;
  } catch {
    return SPACE_ARCHIVE_SESSION_ID;
  }
}

function loadInitialVolume() {
  if (typeof window === "undefined") return 0.9;
  try {
    const raw = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
    if (!Number.isFinite(raw)) return 0.9;
    return Math.min(1, Math.max(0, raw));
  } catch {
    return 0.9;
  }
}

function loadInitialPlaybackRate() {
  if (typeof window === "undefined") return 1;
  try {
    const raw = Number(window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY));
    if (!Number.isFinite(raw)) return 1;
    return Math.min(1.5, Math.max(0.75, raw));
  } catch {
    return 1;
  }
}

function loadInitialAutoAdvance() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function probeAudioSource(src: string, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new Audio();
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      probe.removeEventListener("loadedmetadata", onReady);
      probe.removeEventListener("canplay", onReady);
      probe.removeEventListener("error", onError);
      resolve(ok);
    };

    const onReady = () => finish(true);
    const onError = () => finish(false);

    const timeoutId = window.setTimeout(() => {
      finish(false);
    }, timeoutMs);

    const wrappedFinish = (ok: boolean) => {
      window.clearTimeout(timeoutId);
      finish(ok);
    };

    probe.addEventListener("loadedmetadata", () => wrappedFinish(true), { once: true });
    probe.addEventListener("canplay", () => wrappedFinish(true), { once: true });
    probe.addEventListener("error", () => wrappedFinish(false), { once: true });
    probe.preload = "metadata";
    probe.src = src;
    probe.load();
  });
}

export function SpaceClient() {
  const audioRef = useRef<HTMLAudioElement | null>(getSpaceSharedAudio());
  const rabbitCardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [activeId, setActiveId] = useState<string>(() => loadInitialActiveSessionId());
  const [playing, setPlaying] = useState(() => {
    const audio = getSpaceSharedAudio();
    return Boolean(audio && !audio.paused && !audio.ended);
  });
  const [elapsedSec, setElapsedSec] = useState(() => {
    const audio = getSpaceSharedAudio();
    return audio ? Math.floor(audio.currentTime || 0) : 0;
  });
  const [durationSec, setDurationSec] = useState(() => {
    const audio = getSpaceSharedAudio();
    const mediaDuration = audio && Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
    return mediaDuration > 0 ? mediaDuration : (sessions[0]?.approxLengthSec ?? 0);
  });
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());
  const [sessionProgress, setSessionProgress] = useState<Record<string, number>>(() => loadProgress());
  const [revealedSections, setRevealedSections] = useState<Record<string, boolean>>(() => loadInitialRevealState());
  const [visualMode] = useState<VisualModeId>(() => loadVisualMode());
  const [parallaxY, setParallaxY] = useState<number>(() => getScrollY());
  const [playPulseToken, setPlayPulseToken] = useState(0);
  const [dailyMascotCheckinDone, setDailyMascotCheckinDone] = useState<boolean>(() => loadDailyMascotCheckinDone());
  const sessionProgressRef = useRef<Record<string, number>>(sessionProgress);
  const [realDurationBySession, setRealDurationBySession] = useState<Record<string, number>>({});
  const [availableSessionIds, setAvailableSessionIds] = useState<Set<string>>(new Set([SPACE_ARCHIVE_SESSION_ID]));
  const [volume, setVolume] = useState(() => loadInitialVolume());
  const [playbackRate, setPlaybackRate] = useState(() => loadInitialPlaybackRate());
  const [autoAdvance, setAutoAdvance] = useState(() => loadInitialAutoAdvance());

  const modeStyle = useMemo(() => {
    if (visualMode === "deep-night") {
      return {
        pageText: "text-slate-100",
        pageGlow: "bg-[radial-gradient(circle_at_22%_20%,rgba(113,130,255,0.2),transparent_48%),radial-gradient(circle_at_82%_14%,rgba(70,204,255,0.12),transparent_52%)]",
        heroBg: "bg-[linear-gradient(160deg,#080d1f_0%,#111834_45%,#05070f_100%)]",
        heroShadow: "shadow-[0_35px_80px_-45px_rgba(74,136,255,0.35)]",
        surface: "bg-slate-950/45",
        softSurface: "bg-slate-900/45",
        softSurfaceAlt: "bg-slate-900/35",
        border: "border-indigo-100/20",
        borderStrong: "border-indigo-100/35",
        textMuted: "text-slate-300/80",
        textSoft: "text-slate-200/70",
        primaryButton: "border-indigo-50/40 bg-indigo-100 text-slate-950 hover:bg-indigo-50",
        secondaryButton: "border-indigo-100/30 bg-indigo-100/10 text-slate-100 hover:bg-indigo-100/15",
        progressTrack: "bg-indigo-100/20",
        progressFill: "bg-indigo-100",
      };
    }

    if (visualMode === "soft-glass") {
      return {
        pageText: "text-slate-100",
        pageGlow: "bg-[radial-gradient(circle_at_20%_18%,rgba(184,244,255,0.28),transparent_48%),radial-gradient(circle_at_82%_12%,rgba(195,218,255,0.24),transparent_54%)]",
        heroBg: "bg-[linear-gradient(160deg,rgba(17,63,92,0.72)_0%,rgba(41,72,122,0.58)_48%,rgba(30,42,71,0.78)_100%)]",
        heroShadow: "shadow-[0_35px_80px_-45px_rgba(156,217,255,0.52)]",
        surface: "bg-white/12",
        softSurface: "bg-white/10",
        softSurfaceAlt: "bg-white/8",
        border: "border-cyan-50/30",
        borderStrong: "border-cyan-50/45",
        textMuted: "text-cyan-50/90",
        textSoft: "text-cyan-50/75",
        primaryButton: "border-cyan-50/40 bg-cyan-50 text-slate-950 hover:bg-cyan-100",
        secondaryButton: "border-cyan-50/30 bg-cyan-50/15 text-cyan-50 hover:bg-cyan-50/20",
        progressTrack: "bg-cyan-50/20",
        progressFill: "bg-cyan-50",
      };
    }

    return {
      pageText: "text-slate-100",
      pageGlow: "bg-[radial-gradient(circle_at_25%_20%,rgba(154,229,255,0.2),transparent_46%),radial-gradient(circle_at_80%_15%,rgba(180,195,255,0.16),transparent_50%)]",
      heroBg: "bg-[linear-gradient(155deg,#0b3444_0%,#162847_44%,#12152a_100%)]",
      heroShadow: "shadow-[0_35px_80px_-45px_rgba(125,212,255,0.55)]",
      surface: "bg-slate-950/30",
      softSurface: "bg-cyan-50/5",
      softSurfaceAlt: "bg-cyan-50/10",
      border: "border-cyan-100/20",
      borderStrong: "border-cyan-100/45",
      textMuted: "text-cyan-50/90",
      textSoft: "text-cyan-50/75",
      primaryButton: "border-cyan-50/40 bg-cyan-50 text-slate-950 hover:bg-cyan-100",
      secondaryButton: "border-cyan-100/25 bg-cyan-50/10 text-cyan-50/90 hover:bg-cyan-50/15",
      progressTrack: "bg-cyan-50/15",
      progressFill: "bg-cyan-50",
    };
  }, [visualMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (shouldReduceMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute("data-reveal-id");
          if (!id) return;
          setRevealedSections((prev) => {
            if (prev[id]) return prev;
            return { ...prev, [id]: true };
          });
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -12% 0px",
      },
    );

    const nodes = document.querySelectorAll<HTMLElement>("[data-reveal-id]");
    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = rabbitCardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pixelSize = 3;
    const cols = rabbitFrames[0][0].length;
    const rows = rabbitFrames[0].length;
    canvas.width = cols * pixelSize;
    canvas.height = rows * pixelSize;

    let tick = 0;
    const intervalId = window.setInterval(() => {
      tick += 1;
      const breathe = Math.round(Math.sin(tick * 0.14) * 1.8);
      drawRabbitFrame(ctx, rabbitFrames[4], 1, breathe, pixelSize);
    }, 40);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, visualMode);
    } catch {
      return;
    }
  }, [visualMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (!shouldReduceMotion) {
          setParallaxY(getScrollY());
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    return selectedMood === "all" ? sessions : sessions.filter((s) => s.moodId === selectedMood);
  }, [selectedMood]);

  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeId) ?? filteredSessions[0] ?? sessions[0];
  }, [activeId, filteredSessions]);
  const activeUsesArchiveSource = activeSession?.id === SPACE_ARCHIVE_SESSION_ID;
  const activeUsesEmbed = Boolean(activeSession?.embedSrc && activeSession.preferEmbed);

  const playlist = useMemo(() => {
    if (filteredSessions.length === 0) return sessions;
    return filteredSessions;
  }, [filteredSessions]);

  useEffect(() => {
    sessionProgressRef.current = sessionProgress;
  }, [sessionProgress]);

  useEffect(() => {
    let canceled = false;
    const localSessions = sessions.filter((session) => session.audioSrc && !session.audioSrc.startsWith("http"));

    const detectAvailability = async () => {
      const checks = await Promise.all(
        localSessions.map(async (session) => {
          const ok = await probeAudioSource(withBasePath(session.audioSrc!));
          return [session.id, ok] as const;
        }),
      );
      if (canceled) return;

      const nextAvailable = new Set<string>([SPACE_ARCHIVE_SESSION_ID]);
      checks.forEach(([id, ok]) => {
        if (ok) nextAvailable.add(id);
      });
      sessions.forEach((session) => {
        if (session.embedSrc) nextAvailable.add(session.id);
      });

      setAvailableSessionIds((prev) => (setsEqual(prev, nextAvailable) ? prev : nextAvailable));
      setActiveId((prev) => {
        if (nextAvailable.has(prev)) return prev;
        const fromAudio = resolveSessionIdFromSource(audioRef.current?.currentSrc ?? "");
        if (fromAudio && nextAvailable.has(fromAudio)) return fromAudio;
        if (nextAvailable.has(SPACE_ARCHIVE_SESSION_ID)) return SPACE_ARCHIVE_SESSION_ID;
        return sessions[0]?.id ?? prev;
      });
    };

    void detectAvailability();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const mediaDuration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
      setDurationSec(mediaDuration > 0 ? mediaDuration : activeSession?.approxLengthSec ?? 0);
      const linkedSessionId = resolveSessionIdFromSource(audio.currentSrc) ?? activeSession?.id;
      if (linkedSessionId && mediaDuration > 0) {
        setRealDurationBySession((prev) => (prev[linkedSessionId] === mediaDuration ? prev : { ...prev, [linkedSessionId]: mediaDuration }));
      }
      const saved = linkedSessionId ? sessionProgressRef.current[linkedSessionId] ?? 0 : 0;
      if (saved > 0 && saved < audio.duration) {
        audio.currentTime = saved;
      }
    };

    const onTimeUpdate = () => {
      const nextElapsed = Math.floor(audio.currentTime);
      setElapsedSec(nextElapsed);
      const linkedSessionId = resolveSessionIdFromSource(audio.currentSrc) ?? activeSession?.id;
      if (linkedSessionId) {
        setSessionProgress((prev) => {
          if (prev[linkedSessionId] === nextElapsed) return prev;
          return { ...prev, [linkedSessionId]: nextElapsed };
        });
        setActiveId((prev) => (prev === linkedSessionId ? prev : linkedSessionId));
      }
    };

    const onPlay = () => {
      setPlaying(true);
      setPlayPulseToken((prev) => prev + 1);
      if (!dailyMascotCheckinDone) {
        setDailyMascotCheckinDone(true);
        try {
          window.localStorage.setItem(DAILY_MASCOT_GUIDE_STORAGE_KEY, getTodayStamp());
        } catch {
          return;
        }
      }
    };
    const onPause = () => setPlaying(false);

    const onEnded = () => {
      setPlaying(false);
      const linkedSessionId = resolveSessionIdFromSource(audio.currentSrc) ?? activeSession?.id;
      if (linkedSessionId) {
        setSessionProgress((prev) => ({ ...prev, [linkedSessionId]: 0 }));
        if (autoAdvance) {
          const availablePlaylist = playlist.filter((session) => availableSessionIds.has(session.id));
          const currentIndex = availablePlaylist.findIndex((session) => session.id === linkedSessionId);
          if (currentIndex >= 0 && currentIndex < availablePlaylist.length - 1) {
            const next = availablePlaylist[currentIndex + 1];
            if (next?.audioSrc) {
              setActiveId(next.id);
              setPlaybackError(null);
              const nextSrc = withBasePath(next.audioSrc);
              if (!sameAudioSource(audio.currentSrc, nextSrc)) {
                audio.src = nextSrc;
                audio.load();
                setElapsedSec(sessionProgressRef.current[next.id] ?? 0);
                setDurationSec(next.approxLengthSec);
              }
              void audio.play().then(() => {
                setPlaying(true);
              }).catch(() => {
                setPlaying(false);
                setPlaybackError("No se pudo iniciar el auto-avance. Puedes continuar manualmente.");
              });
            }
          }
        }
      }
    };

    const onError = () => {
      setPlaying(false);
      setPlaybackError(
        activeUsesArchiveSource
          ? "No se pudo cargar el streaming externo de Archive. Usa el botón 'Abrir fuente' o inténtalo de nuevo."
          : "No se encontró el archivo de audio para esta sesión. Sube el archivo en public/audio/space con el nombre esperado.",
      );
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [activeSession, activeUsesArchiveSource, autoAdvance, availableSessionIds, dailyMascotCheckinDone, playlist]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch {
      return;
    }
  }, [favoriteIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(sessionProgress));
    } catch {
      return;
    }
  }, [sessionProgress]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeId);
    } catch {
      return;
    }
  }, [activeId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      return;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
    try {
      window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(playbackRate));
    } catch {
      return;
    }
  }, [playbackRate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, autoAdvance ? "1" : "0");
    } catch {
      return;
    }
  }, [autoAdvance]);

  const progress = durationSec > 0 ? Math.min(100, Math.round((elapsedSec / durationSec) * 100)) : 0;

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const isSessionAvailable = (sessionId: string) => availableSessionIds.has(sessionId);

  const displayDurationForSession = (session: SpaceSession) => {
    if (!isSessionAvailable(session.id)) return "Sin audio aún";
    const realDuration = realDurationBySession[session.id];
    return fmt(realDuration ?? session.approxLengthSec);
  };

  const ensureAudioSourceForSession = (sessionId: string) => {
    const audio = audioRef.current;
    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!audio || !targetSession || !targetSession.audioSrc) return null;

    const nextSrc = withBasePath(targetSession.audioSrc);
    if (!sameAudioSource(audio.currentSrc, nextSrc)) {
      audio.src = nextSrc;
      audio.load();
      setElapsedSec(sessionProgressRef.current[sessionId] ?? 0);
      setDurationSec(targetSession.approxLengthSec);
    }

    return { audio, targetSession };
  };

  const startSession = (sessionId: string, options?: { autoplay?: boolean }) => {
    if (!isSessionAvailable(sessionId)) {
      setActiveId(sessionId);
      setPlaying(false);
      setPlaybackError("Esta sesión estará disponible cuando cargues su audio en la biblioteca personalizada.");
      return;
    }

    const shouldAutoplay = options?.autoplay ?? false;
    setActiveId(sessionId);
    setPlaybackError(null);

    const targetSession = sessions.find((session) => session.id === sessionId);
    if (targetSession?.embedSrc && targetSession.preferEmbed) {
      const audio = audioRef.current;
      audio?.pause();
      setPlaying(false);
      setElapsedSec(0);
      setDurationSec(targetSession.approxLengthSec);
      if (shouldAutoplay) {
        setPlaybackError("Esta sesión usa reproductor embebido. Presiona play dentro del iframe.");
      }
      return;
    }

    const prepared = ensureAudioSourceForSession(sessionId);
    if (!prepared) return;

    if (!shouldAutoplay) {
      prepared.audio.pause();
      setPlaying(false);
      return;
    }

    void prepared.audio.play().then(() => {
      setPlaying(true);
    }).catch(() => {
      setPlaying(false);
      setPlaybackError(
        sessionId === SPACE_ARCHIVE_SESSION_ID
          ? "No se pudo iniciar rápido el streaming de Archive. Usa 'Abrir fuente' como respaldo."
          : "No se pudo iniciar este audio. Intenta nuevamente.",
      );
    });
  };

  const togglePlayback = async () => {
    if (!activeSession) return;
    if (activeUsesEmbed) {
      setPlaybackError("Esta sesión usa reproductor embebido. Presiona play dentro del iframe.");
      return;
    }
    const prepared = ensureAudioSourceForSession(activeSession.id);
    if (!prepared) return;
    const { audio } = prepared;

    setPlaybackError(null);
    if (playing) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setPlaybackError(
        activeUsesArchiveSource
          ? "No se pudo reproducir el streaming de Archive en el player integrado. Usa 'Abrir fuente' como respaldo."
          : "No se pudo reproducir este audio. Verifica que el archivo exista y el navegador lo soporte.",
      );
    }
  };

  const playPrev = () => {
    const availablePlaylist = playlist.filter((session) => isSessionAvailable(session.id));
    const currentIndex = availablePlaylist.findIndex((session) => session.id === activeSession?.id);
    if (currentIndex <= 0) return;
    const prev = availablePlaylist[currentIndex - 1];
    if (!prev) return;
    startSession(prev.id, { autoplay: true });
  };

  const playNext = () => {
    const availablePlaylist = playlist.filter((session) => isSessionAvailable(session.id));
    const currentIndex = availablePlaylist.findIndex((session) => session.id === activeSession?.id);
    if (currentIndex < 0 || currentIndex >= availablePlaylist.length - 1) return;
    const next = availablePlaylist[currentIndex + 1];
    if (!next) return;
    startSession(next.id, { autoplay: true });
  };

  const favoriteSessions = sessions.filter((s) => favoriteIds.includes(s.id));
  const stickyHeaderSolid = parallaxY > 24;

  const revealClass = (id: string) => {
    return revealedSections[id]
      ? "translate-y-0 scale-100 opacity-100 blur-0"
      : "translate-y-6 scale-[0.985] opacity-0 blur-[2px]";
  };

  return (
    <div className={`${outfit.className} relative space-y-10 overflow-x-hidden pb-8 ${modeStyle.pageText}`}>
      <div className="fixed left-1/2 top-3 z-30 w-[min(96vw,1200px)] -translate-x-1/2">
        <div
          className={`space-y-2 rounded-3xl p-4 transition-all duration-300 ${
            stickyHeaderSolid
              ? "border border-white/20 bg-slate-950/70 shadow-[0_14px_40px_-24px_rgba(0,0,0,0.8)] backdrop-blur-xl"
              : "border border-transparent bg-transparent"
          }`}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Hoy en Space
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Sigue al conejo blanco</h1>
              <p className="text-xs text-foreground/75 sm:text-sm">Respira, entra en foco y reproduce en un toque.</p>
            </div>
            <div className={`text-xs ${pixelify.className} text-cyan-100`}>MODO FLOW</div>
          </div>
        </div>
      </div>

      <section
        data-reveal-id="hero"
        className={`relative left-1/2 z-10 w-screen -translate-x-1/2 overflow-hidden transition-all duration-700 ease-out ${modeStyle.heroShadow} ${revealClass("hero")}`}
      >
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,11,20,0.12)_0%,rgba(4,11,20,0.55)_62%,rgba(4,11,20,0.8)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 -bottom-1 h-28 bg-[linear-gradient(180deg,rgba(5,10,18,0)_0%,rgba(5,10,18,0.58)_52%,rgba(5,10,18,0.98)_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[500px] w-full max-w-6xl flex-col justify-end gap-6 px-6 pb-10 pt-24 md:min-h-[680px] md:px-10 md:pb-14 md:pt-28">

          <div className="max-w-4xl space-y-2">
            <div className="text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-5xl md:text-6xl">
              Entra en
              <span className={`${pixelify.className} ml-3 text-cyan-100`}>MODO FLOW</span>
            </div>
            <p className="max-w-2xl text-sm text-cyan-50/85 md:text-base">Video ambiente + audio guiado para arrancar estudio sin saturarte.</p>
          </div>
        </div>
      </section>

      <section className={`relative z-20 -mt-8 rounded-[28px] border p-6 backdrop-blur-xl shadow-[0_24px_60px_-38px_rgba(0,0,0,0.85)] ${modeStyle.border} ${modeStyle.surface}`}>
        {playing ? (
          <div key={playPulseToken} className="pointer-events-none absolute inset-0 rounded-3xl border border-cyan-200/35 animate-[ping_850ms_ease-out_1]" />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className={`text-xs uppercase tracking-widest ${modeStyle.textSoft}`}>Reproduciendo</div>
            <div className="mt-1 text-lg font-semibold">{activeSession?.title ?? "Sin sesión"}</div>
            <div className={`text-xs ${modeStyle.textSoft}`}>{activeSession?.type}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${modeStyle.primaryButton}`}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pausar" : "Reproducir"}
            </button>
            {activeUsesArchiveSource ? (
              <>
                <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`}>
                  <Headphones className="h-3.5 w-3.5" />
                  Fuente: Archive
                </span>
                <button
                  type="button"
                  onClick={() => {
                    window.open(SPACE_ARCHIVE_EXTERNAL_URL, "_blank", "noopener,noreferrer");
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${modeStyle.secondaryButton}`}
                >
                  Abrir fuente
                </button>
              </>
            ) : null}
            <Link
              href="/day"
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition ${modeStyle.secondaryButton}`}
            >
              Conectar con mi plan
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <>
          <div className={`mt-4 h-2 overflow-hidden rounded-full ${modeStyle.progressTrack}`}>
            <div className={`h-full rounded-full transition-all ${modeStyle.progressFill}`} style={{ width: `${progress}%` }} />
          </div>
          <div className={`mt-2 flex items-center justify-between text-xs ${modeStyle.textSoft}`}>
            <span>{fmt(elapsedSec)}</span>
            <span>{fmt(durationSec)}</span>
          </div>
        </>
        {activeUsesEmbed ? (
          <div className={`mt-4 rounded-2xl border p-3 ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
            <div className={`mb-2 text-[11px] ${modeStyle.textSoft}`}>
              Reproductor embebido para audio pesado. El audio se sirve desde fuente externa.
            </div>
            <div className="overflow-hidden rounded-xl border border-white/15 bg-black/25">
              <iframe
                src={activeSession?.embedSrc}
                width="100%"
                height="90"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                title={`Embed ${activeSession?.title ?? "audio"}`}
              />
            </div>
            {activeSession?.externalHref ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.open(activeSession.externalHref, "_blank", "noopener,noreferrer");
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${modeStyle.secondaryButton}`}
                >
                  Abrir fuente externa
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className={`space-y-1 text-xs ${modeStyle.textSoft}`}>
            <span>Volumen ({Math.round(volume * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              disabled={activeUsesEmbed}
              onChange={(event) => {
                setVolume(Number(event.target.value) / 100);
              }}
              className="w-full"
            />
          </label>
          <label className={`space-y-1 text-xs ${modeStyle.textSoft}`}>
            <span>Velocidad</span>
            <select
              value={String(playbackRate)}
              disabled={activeUsesEmbed}
              onChange={(event) => {
                setPlaybackRate(Number(event.target.value));
              }}
              className={`w-full rounded-xl border px-3 py-2 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}
            >
              <option value="0.8">0.8x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>
          </label>
          <label className={`inline-flex items-center gap-2 self-end rounded-xl border px-3 py-2 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
            <input
              type="checkbox"
              checked={autoAdvance}
              disabled={activeUsesEmbed}
              onChange={(event) => {
                setAutoAdvance(event.target.checked);
              }}
            />
            Auto-avance
          </label>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={playPrev}
            disabled={playlist.filter((session) => isSessionAvailable(session.id)).findIndex((session) => session.id === activeSession?.id) <= 0}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${modeStyle.secondaryButton}`}
          >
            <SkipBack className="h-3.5 w-3.5" />
            Anterior
          </button>
          <button
            type="button"
            onClick={playNext}
            disabled={(() => {
              const availablePlaylist = playlist.filter((session) => isSessionAvailable(session.id));
              const index = availablePlaylist.findIndex((session) => session.id === activeSession?.id);
              return index < 0 || index >= availablePlaylist.length - 1;
            })()}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${modeStyle.secondaryButton}`}
          >
            Siguiente
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>
        {playbackError ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-amber-200/90">{playbackError}</div>
            {activeUsesArchiveSource ? (
              <button
                type="button"
                onClick={() => {
                  window.open(SPACE_ARCHIVE_EXTERNAL_URL, "_blank", "noopener,noreferrer");
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${modeStyle.secondaryButton}`}
              >
                Abrir fuente en Archive
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        data-reveal-id="mood"
        className={`space-y-4 transition-all duration-700 ease-out ${revealClass("mood")}`}
        style={{ transitionDelay: "70ms" }}
      >
        <div className={`flex items-center gap-2 text-sm font-medium ${modeStyle.textMuted}`}>
          <Sparkles className="h-4 w-4" />
          Elige cómo te sientes hoy
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setSelectedMood("all")}
            className={`rounded-2xl border p-4 text-left transition ${
              selectedMood === "all" ? `${modeStyle.borderStrong} ${modeStyle.softSurfaceAlt}` : `${modeStyle.border} ${modeStyle.softSurface}`
            }`}
          >
            <div className="text-sm font-semibold">Todo</div>
            <div className={`text-xs ${modeStyle.textSoft}`}>Todas las sesiones</div>
          </button>
          {moods.map((mood) => (
            <button
              key={mood.id}
              type="button"
              onClick={() => setSelectedMood(mood.id)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                selectedMood === mood.id ? `${modeStyle.borderStrong} ${modeStyle.softSurfaceAlt}` : `${modeStyle.border} ${modeStyle.softSurface}`
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 ${mood.tone}`} />
              <div className="relative z-10 space-y-1">
                <div className="text-sm font-semibold">{mood.title}</div>
                <div className={`text-xs ${modeStyle.textSoft}`}>{mood.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section
        data-reveal-id="carousel"
        className={`space-y-4 transition-all duration-700 ease-out ${revealClass("carousel")}`}
        style={{ transitionDelay: "120ms" }}
      >
        <div className={`mb-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`}>
          <Headphones className="h-3.5 w-3.5" />
          Sesiones disponibles
        </div>
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const isFav = favoriteIds.includes(session.id);
            const isActive = activeSession?.id === session.id;
            const isAvailable = isSessionAvailable(session.id);
            return (
              <article
                key={session.id}
                className={`rounded-2xl border px-4 py-4 backdrop-blur-xl transition ${
                  isActive ? `${modeStyle.borderStrong} ${modeStyle.softSurfaceAlt}` : `${modeStyle.border} ${modeStyle.softSurface}`
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold sm:text-base">{session.title}</div>
                    <div className={`text-xs ${modeStyle.textSoft}`}>{session.type} · {displayDurationForSession(session)} · {session.moodId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isAvailable ? (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textSoft}`}>
                        Próximamente
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(session.id)}
                      className={`rounded-full border p-2 transition ${
                        isFav ? "border-rose-300/60 bg-rose-300/20 text-rose-100" : `${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`
                      }`}
                      aria-label="Favorito"
                    >
                      <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        startSession(session.id, { autoplay: true });
                      }}
                      disabled={!isAvailable}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${modeStyle.primaryButton}`}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Play
                    </button>
                  </div>
                </div>
                <p className={`mt-2 text-sm ${modeStyle.textSoft}`}>{session.desc}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startSession(session.id)}
                    disabled={!isAvailable}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${modeStyle.primaryButton}`}
                  >
                    Seleccionar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(session.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${modeStyle.secondaryButton}`}
                  >
                    {isFav ? "Quitar favorito" : "Guardar favorito"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article
          data-reveal-id="favorites"
          className={`rounded-3xl border p-5 backdrop-blur-xl transition-all duration-700 ease-out ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${revealClass("favorites")}`}
          style={{ transitionDelay: "160ms" }}
        >
          <div className={`text-xs uppercase tracking-widest ${modeStyle.textSoft}`}>Tus favoritos</div>
          {favoriteSessions.length === 0 ? (
            <p className={`mt-3 text-sm ${modeStyle.textSoft}`}>
              Todavía no tienes sesiones favoritas. Marca con corazón las que quieras tener siempre a mano.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {favoriteSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => startSession(session.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${modeStyle.border} ${modeStyle.surface}`}
                >
                  <div>
                    <div className="text-sm font-semibold">{session.title}</div>
                    <div className={`text-xs ${modeStyle.textSoft}`}>{session.type}</div>
                  </div>
                  <span className={`text-xs ${modeStyle.textSoft}`}>{displayDurationForSession(session)}</span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article
          data-reveal-id="upcoming"
          className={`relative overflow-hidden rounded-3xl border p-5 backdrop-blur-xl transition-all duration-700 ease-out ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${revealClass("upcoming")}`}
          style={{ transitionDelay: "220ms" }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-200/20 blur-2xl" />
          <div className="relative z-10 space-y-4">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`}>
              <Waves className="h-3.5 w-3.5" />
              Próximamente
            </div>
            <h3 className="text-xl font-semibold">Biblioteca de audios personalizada</h3>
            <p className={`text-sm ${modeStyle.textSoft}`}>
              Se detectan automáticamente los audios locales en <code>public/audio/space</code> y se activan en sesiones disponibles.
              <br />
              <span className={modeStyle.textMuted}>reset-express.mp3, foco-profundo.mp3, dormir-mejor.mp3, aterriza-mente.mp3, modo-examen.mp3</span>
            </p>
            <div className={`rounded-2xl border border-dashed p-4 text-xs ${modeStyle.border} ${modeStyle.surface} ${modeStyle.textSoft}`}>
              Sesiones activas ahora: <span className="font-semibold">{availableSessionIds.size}</span>. También puedes usar volumen, velocidad y auto-avance desde el player principal.
            </div>
          </div>
        </article>
      </section>

    </div>
  );
}
