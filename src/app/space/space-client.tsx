"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Outfit } from "next/font/google";
import { ArrowLeft, ChevronDown, ChevronUp, Headphones, Heart, Menu, Music2, Pause, Play, Search, SkipBack, SkipForward, Sparkles, Volume2, X } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
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
const DAILY_MASCOT_GUIDE_STORAGE_KEY = "somagnus:space:mascot-daily-checkin:v1";
const ACTIVE_SESSION_STORAGE_KEY = "somagnus:space:active-session:v1";
const VOLUME_STORAGE_KEY = "somagnus:space:volume:v1";
const PLAYBACK_RATE_STORAGE_KEY = "somagnus:space:rate:v1";
const AUTO_ADVANCE_STORAGE_KEY = "somagnus:space:auto-advance:v1";
const SPACE_ARCHIVE_SESSION_ID = "dormir-mejor";
const SPACE_ARCHIVE_STREAM_URL = "https://archive.org/download/entregate-al-sueno/Entregate%20al%20sue%C3%B1o.mp3";
const SPACE_ARCHIVE_EMBED_URL = "https://archive.org/embed/entregate-al-sueno";
const SPACE_ARCHIVE_EXTERNAL_URL = "https://archive.org/details/entregate-al-sueno";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const cinzelDisplay = "[font-family:var(--font-display),'Cinzel_Decorative',serif]";

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
    preferEmbed: false,
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

function coverGradientForMood(moodId?: string) {
  if (moodId === "respira") return "from-emerald-300/40 via-cyan-300/25 to-transparent";
  if (moodId === "enfocate") return "from-indigo-300/40 via-blue-300/25 to-transparent";
  if (moodId === "descarga") return "from-fuchsia-300/35 via-violet-300/20 to-transparent";
  return "from-cyan-200/40 via-slate-200/20 to-transparent";
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

function probeAudioMetadata(src: string, timeoutMs = 4000): Promise<{ ok: boolean; durationSec: number }> {
  return new Promise((resolve) => {
    const probe = new Audio();
    let settled = false;

    const finish = (ok: boolean, durationSec = 0) => {
      if (settled) return;
      settled = true;
      resolve({ ok, durationSec });
    };

    const onReady = () => {
      const mediaDuration = Number.isFinite(probe.duration) ? Math.floor(probe.duration) : 0;
      finish(true, mediaDuration > 0 ? mediaDuration : 0);
    };

    const timeoutId = window.setTimeout(() => {
      finish(false, 0);
    }, timeoutMs);

    const wrappedFinish = (ok: boolean) => {
      window.clearTimeout(timeoutId);
      if (!ok) {
        finish(false, 0);
        return;
      }
      onReady();
    };

    probe.addEventListener("loadedmetadata", () => wrappedFinish(true), { once: true });
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
  const [sessionQuery, setSessionQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
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
  const [parallaxY, setParallaxY] = useState<number>(() => getScrollY());
  const [playPulseToken, setPlayPulseToken] = useState(0);
  const [dailyMascotCheckinDone, setDailyMascotCheckinDone] = useState<boolean>(() => loadDailyMascotCheckinDone());
  const sessionProgressRef = useRef<Record<string, number>>(sessionProgress);
  const [realDurationBySession, setRealDurationBySession] = useState<Record<string, number>>({});
  const [availableSessionIds, setAvailableSessionIds] = useState<Set<string>>(new Set([SPACE_ARCHIVE_SESSION_ID]));
  const [volume, setVolume] = useState(() => loadInitialVolume());
  const [playbackRate, setPlaybackRate] = useState(() => loadInitialPlaybackRate());
  const [autoAdvance, setAutoAdvance] = useState(() => loadInitialAutoAdvance());
  const [dockVisible, setDockVisible] = useState(() => {
    const audio = getSpaceSharedAudio();
    if (!audio) return false;
    return !audio.paused || Math.floor(audio.currentTime || 0) > 0;
  });
  const [playerExpanded, setPlayerExpanded] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const menuCardRef = useRef<HTMLDivElement | null>(null);
  const menuItemsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!headerMenuOpen) return;
    const card = menuCardRef.current;
    const items = menuItemsRef.current.filter(Boolean) as HTMLButtonElement[];
    if (!card) return;
    const tl = gsap.timeline();
    tl.fromTo(
      card,
      { y: -10, scale: 0.9, opacity: 0, transformOrigin: "top right" },
      { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: "back.out(1.7)" },
    );
    if (items.length) {
      tl.fromTo(
        items,
        { x: 18, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.28,
          stagger: 0.05,
          ease: "power2.out",
        },
        "-=0.18",
      );
    }
    return () => {
      tl.kill();
    };
  }, [headerMenuOpen]);

  const SPACE_SECTIONS: { id: string; label: string }[] = useMemo(
    () => [
      { id: "space-top", label: "Inicio" },
      { id: "space-mood", label: "Moods" },
      { id: "space-recientes", label: "Recientes" },
      { id: "space-sesiones", label: "Todas las sesiones" },
    ],
    [],
  );

  const scrollToSection = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
    setHeaderMenuOpen(false);
  };

  // Cielo Calma — paleta única (baja saturación, azul cielo + salvia + lavanda + durazno)
  // ink #1B2B44, ink-soft #5B6B86, sage #6FB08A, lavender #8B82C9, peach #E8A583
  const modeStyle = useMemo(
    () => ({
      pageText: "text-[#1B2B44]",
      pageGlow: "",
      heroBg: "",
      heroShadow: "shadow-[0_18px_40px_-24px_rgba(27,43,68,0.18)]",
      surface: "bg-white/70",
      softSurface: "bg-white/55",
      softSurfaceAlt: "bg-white/65",
      border: "border-white/60",
      borderStrong: "border-[#8B82C9]/50",
      textMuted: "text-[#1B2B44]/80",
      textSoft: "text-[#5B6B86]",
      primaryButton:
        "border-transparent bg-[#6FB08A] text-white hover:bg-[#5FA079] shadow-[0_6px_18px_-8px_rgba(111,176,138,0.6)]",
      secondaryButton:
        "border-white/70 bg-white/55 text-[#1B2B44] hover:bg-white/75",
      progressTrack: "bg-[#1B2B44]/15",
      progressFill: "bg-[#6FB08A]",
    }),
    [],
  );

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
    if (typeof window === "undefined") return;

    const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const ua = window.navigator.userAgent;
    const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && "ontouchend" in window);
    const shouldSkipParallax = shouldReduceMotion || isCoarsePointer || isIpad;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (!shouldSkipParallax) {
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
          const result = await probeAudioMetadata(withBasePath(session.audioSrc!));
          return [session.id, result] as const;
        }),
      );
      if (canceled) return;

      const nextAvailable = new Set<string>([SPACE_ARCHIVE_SESSION_ID]);
      const detectedDurations: Record<string, number> = {};
      checks.forEach(([id, result]) => {
        if (result.ok) {
          nextAvailable.add(id);
        }
        if (result.durationSec > 0) {
          detectedDurations[id] = result.durationSec;
        }
      });
      sessions.forEach((session) => {
        if (session.embedSrc) nextAvailable.add(session.id);
      });

      if (Object.keys(detectedDurations).length > 0) {
        setRealDurationBySession((prev) => ({ ...prev, ...detectedDurations }));
      }

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
      setDockVisible(true);
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

  const isSessionAvailable = (sessionId: string) => availableSessionIds.has(sessionId);

  const progress = durationSec > 0 ? Math.min(100, Math.round((elapsedSec / durationSec) * 100)) : 0;
  const showDockPlayer = false && dockVisible && Boolean(activeSession);
  const availablePlaylist = playlist.filter((session) => isSessionAvailable(session.id));
  const currentPlaylistIndex = availablePlaylist.findIndex((session) => session.id === activeSession?.id);
  const canPlayPrev = currentPlaylistIndex > 0;
  const canPlayNext = currentPlaylistIndex >= 0 && currentPlaylistIndex < availablePlaylist.length - 1;

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

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

  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || durationSec <= 0) return;
    const nextTime = Math.max(0, Math.min(durationSec, Math.round(ratio * durationSec)));
    audio.currentTime = nextTime;
    setElapsedSec(nextTime);
  };

  const visibleSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase();
    return filteredSessions.filter((session) => {
      if (favoritesOnly && !favoriteIds.includes(session.id)) return false;
      if (!query) return true;
      return `${session.title} ${session.type} ${session.desc}`.toLowerCase().includes(query);
    });
  }, [favoriteIds, favoritesOnly, filteredSessions, sessionQuery]);
  const recentSessions = useMemo(() => {
    return sessions
      .filter((session) => session.id === activeId || (sessionProgress[session.id] ?? 0) > 0)
      .sort((a, b) => (sessionProgress[b.id] ?? 0) - (sessionProgress[a.id] ?? 0))
      .slice(0, 7);
  }, [activeId, sessionProgress]);
  const groupedVisibleSessions = useMemo(() => {
    const groups = moods.map((mood) => ({
      id: mood.id,
      title: mood.title,
      items: visibleSessions.filter((session) => session.moodId === mood.id),
    })).filter((group) => group.items.length > 0);

    if (selectedMood !== "all") {
      const one = groups.find((group) => group.id === selectedMood);
      return one ? [one] : [];
    }
    return groups;
  }, [selectedMood, visibleSessions]);
  const activeCoverTone = coverGradientForMood(activeSession?.moodId);
  const stickyHeaderSolid = parallaxY > 24;

  const revealClass = (id: string) => {
    return revealedSections[id]
      ? "translate-y-0 scale-100 opacity-100 blur-0"
      : "translate-y-6 scale-[0.985] opacity-0 blur-[2px]";
  };

  return (
    <div
      className={`${outfit.className} relative isolate space-y-10 overflow-x-hidden pb-44 md:pb-52 ${modeStyle.pageText}`}
    >
      <BreathIntro />
      {/* Decorative clouds over the shared sky bg (rendered by AppShell) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-40">
        <Cloud className="absolute left-[4%] top-[90px]" size={140} opacity={0.85} />
        <Cloud className="absolute right-[6%] top-[140px]" size={170} opacity={0.85} />
        <Cloud className="absolute left-[42%] top-[220px]" size={90} opacity={0.55} />
        <Cloud className="absolute right-[30%] top-[380px]" size={110} opacity={0.6} />
      </div>
      <div className="fixed left-1/2 top-3 z-30 w-[min(96vw,1200px)] -translate-x-1/2">
        <div
          className={`flex items-center justify-between gap-3 rounded-full px-3 py-2 transition-all duration-300 sm:px-4 ${
            stickyHeaderSolid
              ? "border border-white/70 bg-white/75 shadow-[0_10px_30px_-18px_rgba(27,43,68,0.35)] backdrop-blur-md"
              : "border border-white/50 bg-white/50 backdrop-blur-md"
          }`}
        >
          <Link
            href="/"
            aria-label="Volver a inicio"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/70 text-[#1B2B44] transition hover:border-[#8B82C9]/50 hover:bg-white/90"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 text-base font-semibold tracking-tight text-[#1B2B44] sm:text-lg md:text-xl">
            <Sparkles className="hidden h-4 w-4 text-[#8B82C9] sm:inline-block" />
            <span className="truncate">
              Entra en{" "}
              <span className={`${cinzelDisplay} font-bold tracking-[0.08em] text-[#6FB08A]`}>
                FLOW
              </span>
            </span>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              aria-expanded={headerMenuOpen}
              aria-haspopup="menu"
              aria-label="Secciones"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95 ${
                headerMenuOpen
                  ? "border-white/90 bg-white text-[#1B2B44] shadow-[0_6px_18px_-8px_rgba(27,43,68,0.35)]"
                  : "border-white/70 bg-white/75 text-[#1B2B44] hover:border-white/90 hover:bg-white"
              }`}
            >
              {headerMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {headerMenuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  onClick={() => setHeaderMenuOpen(false)}
                  className="fixed inset-0 -z-10 cursor-default"
                />
                <div
                  ref={menuCardRef}
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-3 w-[min(92vw,320px)] overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-3 shadow-[0_28px_70px_-22px_rgba(27,43,68,0.45)]"
                >
                  {/* decorative gradient orb */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-[#CFE6FF] to-[#C8E6D2] opacity-70 blur-2xl"
                  />
                  <div className="relative flex items-center justify-between px-2 pb-2 pt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5B6B86]">
                      Navega
                    </span>
                    <span className="inline-flex h-6 items-center rounded-full bg-[#6FB08A]/15 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#3F8A60]">
                      {SPACE_SECTIONS.length}
                    </span>
                  </div>
                  <ul className="relative space-y-1.5">
                    {SPACE_SECTIONS.map((s, idx) => (
                      <li key={s.id}>
                        <button
                          ref={(el) => {
                            menuItemsRef.current[idx] = el;
                          }}
                          type="button"
                          role="menuitem"
                          onClick={() => scrollToSection(s.id)}
                          className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-white/60 px-3 py-3 text-left text-base font-medium text-[#1B2B44] transition hover:-translate-y-0.5 hover:border-white/80 hover:bg-white hover:shadow-[0_10px_24px_-14px_rgba(27,43,68,0.35)]"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#EAF4FF] text-[#1B2B44] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-white/80">
                            <span className="text-xs font-bold tracking-widest text-[#5B6B86]">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          </span>
                          <span className="flex-1 truncate">{s.label}</span>
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF4FF] text-[#5B6B86] transition group-hover:bg-[#6FB08A] group-hover:text-white">
                            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Minimal spacer so search sits right under the floating header */}
      <div id="space-top" data-reveal-id="hero" className="h-12 md:h-14" />

      <section
        id="space-mood"
        data-reveal-id="mood"
        className={`scroll-mt-24 space-y-4 transition-all duration-700 ease-out ${revealClass("mood")}`}
        style={{ transitionDelay: "70ms" }}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_220px_170px]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/65 px-4 py-3 backdrop-blur-md">
            <Search className="h-4 w-4 text-[#5B6B86]" />
            <input
              value={sessionQuery}
              onChange={(event) => setSessionQuery(event.target.value)}
              placeholder="Buscar sesión..."
              className="w-full bg-transparent text-base text-[#1B2B44] outline-none placeholder:text-[#5B6B86]/70"
            />
          </label>
          <select
            value={selectedMood}
            onChange={(event) => setSelectedMood(event.target.value)}
            className="rounded-2xl border border-white/60 bg-white/65 px-4 py-3 text-base text-[#1B2B44] outline-none backdrop-blur-md"
          >
            <option value="all">Todos</option>
            {moods.map((mood) => (
              <option key={mood.id} value={mood.id}>{mood.title}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-base font-semibold backdrop-blur-md transition ${
              favoritesOnly
                ? "border-[#E8A583]/60 bg-[#F7D9C4]/60 text-[#8C4A2A]"
                : "border-white/60 bg-white/55 text-[#1B2B44] hover:bg-white/70"
            }`}
          >
            <Heart className={`h-4 w-4 ${favoritesOnly ? "fill-[#E8A583] text-[#E8A583]" : ""}`} />
            Favoritos
          </button>
        </div>
        <div className="flex items-center gap-2 text-2xl font-semibold text-white drop-shadow-[0_2px_12px_rgba(10,30,70,0.35)] sm:text-3xl">
          <Sparkles className="h-5 w-5 text-white" />
          Elige cómo te sientes hoy
        </div>
        <MoodAuroraGrid selectedMood={selectedMood} setSelectedMood={setSelectedMood} />
      </section>

      <section
        id="space-recientes"
        data-reveal-id="favorites"
        className={`scroll-mt-24 space-y-3 transition-all duration-700 ease-out ${revealClass("favorites")}`}
        style={{ transitionDelay: "95ms" }}
      >
        <h3 className="text-2xl font-semibold text-white drop-shadow-[0_2px_12px_rgba(10,30,70,0.35)] sm:text-3xl">Recientes</h3>
        {recentSessions.length === 0 ? (
          <div className="rounded-2xl border border-white/40 bg-white/15 px-4 py-3 text-sm text-white/85 backdrop-blur-md">
            Todavía no hay sesiones recientes.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => startSession(session.id, { autoplay: true })}
                className="group min-w-[88px] text-center"
              >
                <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/70 bg-white/65 text-[#5B6B86] backdrop-blur-md transition group-hover:border-[#6FB08A]/60 group-hover:text-[#6FB08A]">
                  <Music2 className="h-6 w-6" />
                </span>
                <span className="mt-2 line-clamp-2 block text-xs leading-tight text-white drop-shadow-[0_1px_6px_rgba(10,30,70,0.45)]">{session.title}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section
        id="space-sesiones"
        data-reveal-id="carousel"
        className={`scroll-mt-24 space-y-4 transition-all duration-700 ease-out ${revealClass("carousel")}`}
        style={{ transitionDelay: "120ms" }}
      >
        {groupedVisibleSessions.length === 0 ? (
          <div className="rounded-2xl border border-white/40 bg-white/15 px-4 py-4 text-sm text-white/85 backdrop-blur-md">
            No hay sesiones que coincidan con tu búsqueda/filtro.
          </div>
        ) : null}
        <div className="space-y-6">
          {groupedVisibleSessions.map((group) => (
            <div key={group.id} className="space-y-3">
              <h3 className="text-3xl font-semibold text-white drop-shadow-[0_2px_12px_rgba(10,30,70,0.35)] sm:text-4xl">{group.title}</h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {group.items.map((session) => {
                  const isFav = favoriteIds.includes(session.id);
                  const isAvailable = isSessionAvailable(session.id);

                  return (
                    <article
                      key={session.id}
                      className="relative min-w-[240px] overflow-hidden rounded-2xl border border-white/60 bg-white/65 shadow-[0_14px_40px_-26px_rgba(27,43,68,0.35)] backdrop-blur-md"
                    >
                      <div className="absolute inset-x-0 top-0 h-[90px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(159,211,255,0.55),transparent_70%)]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Music2 className="h-16 w-16 text-[#1B2B44]/10" />
                      </div>

                      <div className="relative z-10 flex items-start justify-between p-3">
                        <div className="flex items-center gap-2">
                          {isAvailable ? (
                            <button
                              type="button"
                              onClick={() => startSession(session.id, { autoplay: true })}
                              className="inline-flex items-center gap-1 rounded-full bg-[#6FB08A] px-3 py-1 text-[11px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(111,176,138,0.7)] transition hover:bg-[#5FA079]"
                            >
                              <Play className="h-3 w-3" />
                              Play
                            </button>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-white/70 bg-white/60 px-2.5 py-1 text-[10px] font-semibold text-[#5B6B86]">
                              Próximamente
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(session.id)}
                          className={`rounded-full border p-2 transition ${
                            isFav
                              ? "border-[#E8A583]/60 bg-[#F7D9C4]/60 text-[#8C4A2A]"
                              : "border-white/70 bg-white/55 text-[#5B6B86] hover:bg-white/75"
                          }`}
                          aria-label="Favorito"
                        >
                          <Heart className={`h-4 w-4 ${isFav ? "fill-[#E8A583] text-[#E8A583]" : ""}`} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => startSession(session.id)}
                        disabled={!isAvailable}
                        className="absolute inset-0 z-[5]"
                        aria-label={`Seleccionar ${session.title}`}
                      />

                      <div className="relative z-10 mt-24 border-t border-white/60 bg-white/70 p-4 backdrop-blur-md">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[#5B6B86]">{session.type}</div>
                        <div className="mt-1 text-lg font-semibold leading-tight text-[#1B2B44]">{session.title}</div>
                        <div className="mt-1 text-xs text-[#5B6B86]">{displayDurationForSession(session)}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      {showDockPlayer ? (
        <section className="fixed inset-x-0 bottom-0 z-40 px-3 pb-4 sm:px-6 sm:pb-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className={`relative isolate overflow-hidden rounded-[28px] border shadow-[0_20px_60px_-28px_rgba(27,43,68,0.35)] backdrop-blur-md ${modeStyle.border} ${modeStyle.surface}`}>
              <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-[#C8E6D2]/50 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 right-8 h-32 w-32 rounded-full bg-[#D9D4F2]/50 blur-3xl" />
              {playing ? (
                <div key={playPulseToken} className="pointer-events-none absolute inset-0 rounded-[28px] border border-[#6FB08A]/45 animate-[ping_900ms_ease-out_1]" />
              ) : null}

              <div className="px-4 pt-3 sm:px-6 sm:pt-4">
                <div className={`h-1.5 overflow-hidden rounded-full ${modeStyle.progressTrack}`}>
                  <div className={`h-full rounded-full transition-all ${modeStyle.progressFill}`} style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
                <button
                  type="button"
                  onClick={() => setPlayerExpanded((prev) => !prev)}
                  aria-expanded={playerExpanded}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-3xl border px-3 py-2 text-left transition ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}
                >
                  <span className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
                    <span className={`absolute inset-0 bg-gradient-to-br ${activeCoverTone} ${playing ? "animate-pulse" : ""}`} />
                    <Music2 className="relative z-10 h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold sm:text-base">{activeSession?.title ?? "Sin sesión"}</span>
                    <span className={`inline-flex items-center gap-2 truncate text-xs ${modeStyle.textSoft}`}>
                      {activeSession?.type}
                      <span className="inline-flex items-end gap-0.5">
                        <span
                          className={`w-0.5 rounded-full bg-[#6FB08A] ${playing ? "animate-pulse" : "opacity-40"}`}
                          style={{ height: "8px", animationDelay: "0ms" }}
                        />
                        <span
                          className={`w-0.5 rounded-full bg-[#6FB08A] ${playing ? "animate-pulse" : "opacity-40"}`}
                          style={{ height: "11px", animationDelay: "140ms" }}
                        />
                        <span
                          className={`w-0.5 rounded-full bg-[#6FB08A] ${playing ? "animate-pulse" : "opacity-40"}`}
                          style={{ height: "7px", animationDelay: "260ms" }}
                        />
                      </span>
                    </span>
                  </span>
                  <span className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
                    {playerExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={playPrev}
                    disabled={!canPlayPrev}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${modeStyle.secondaryButton}`}
                    aria-label="Anterior"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlayback}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${modeStyle.primaryButton}`}
                    aria-label={playing ? "Pausar" : "Reproducir"}
                  >
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    type="button"
                    onClick={playNext}
                    disabled={!canPlayNext}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${modeStyle.secondaryButton}`}
                    aria-label="Siguiente"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className={`overflow-hidden border-t transition-all duration-300 ease-out ${modeStyle.border} ${
                  playerExpanded ? "max-h-[560px] translate-y-0 opacity-100" : "max-h-0 -translate-y-1 opacity-0"
                }`}
                aria-hidden={!playerExpanded}
              >
                <div className="space-y-4 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
                  <div className={`relative overflow-hidden rounded-2xl border p-4 ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeCoverTone}`} />
                    <div className="relative z-10 flex items-center gap-3">
                      <span className={`inline-flex h-14 w-14 items-center justify-center rounded-xl border ${modeStyle.border} ${modeStyle.softSurface}`}>
                        <Music2 className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold sm:text-base">{activeSession?.title ?? "Sin sesión"}</div>
                        <div className={`truncate text-xs ${modeStyle.textSoft}`}>{activeSession?.desc}</div>
                      </div>
                    </div>
                  </div>

                  <label className="block space-y-1">
                    <span className="sr-only">Progreso</span>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      value={durationSec > 0 ? Math.round((elapsedSec / durationSec) * 1000) : 0}
                      onChange={(event) => {
                        seekToRatio(Number(event.target.value) / 1000);
                      }}
                      className="w-full"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-3">
                    <div className={`text-xs ${modeStyle.textSoft}`}>{fmt(elapsedSec)} / {fmt(durationSec)}</div>
                    {activeUsesArchiveSource ? (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`}>
                        <Headphones className="h-3 w-3" />
                        Source: Archive
                      </span>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
                    <label className={`space-y-1 rounded-2xl border px-3 py-2.5 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textSoft}`}>
                      <span className="inline-flex items-center gap-1">
                        <Volume2 className="h-3.5 w-3.5" />
                        Volumen ({Math.round(volume * 100)}%)
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(volume * 100)}
                        onChange={(event) => {
                          setVolume(Number(event.target.value) / 100);
                        }}
                        className="w-full"
                      />
                    </label>

                    <label className={`space-y-1 rounded-2xl border px-3 py-2.5 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textSoft}`}>
                      <span>Velocidad</span>
                      <select
                        value={String(playbackRate)}
                        onChange={(event) => {
                          setPlaybackRate(Number(event.target.value));
                        }}
                        className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${modeStyle.softSurfaceAlt}`}
                      >
                        <option value="0.8">0.8x</option>
                        <option value="1">1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                      </select>
                    </label>

                    <label className={`inline-flex items-center gap-2 self-end rounded-2xl border px-3 py-2.5 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={(event) => {
                          setAutoAdvance(event.target.checked);
                        }}
                      />
                      Auto-avance
                    </label>
                  </div>

                  {playerExpanded && playbackError ? (
                    <div className="space-y-2">
                      <div className="text-xs text-[#B4590F]">{playbackError}</div>
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
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

    </div>
  );
}

/* ──────────────────────────── Mood selector (aurora cards) ──────────────────────────── */

type MoodTheme = {
  id: string;
  title: string;
  subtitle: string;
  iconPath: string;
  aurora: string;
  ringFrom: string;
  ringTo: string;
};

const MOOD_THEMES: MoodTheme[] = [
  {
    id: "all",
    title: "Todo",
    subtitle: "Todas las sesiones",
    iconPath: "M12 3v3M12 18v3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M3 12h3M18 12h3M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12",
    aurora:
      "bg-[radial-gradient(ellipse_at_30%_20%,rgba(207,230,255,0.9),transparent_60%),radial-gradient(ellipse_at_70%_80%,rgba(251,248,243,0.9),transparent_60%),linear-gradient(135deg,#EAF4FF,#FBF8F3)]",
    ringFrom: "from-[#CFE6FF]",
    ringTo: "to-[#FBF8F3]",
  },
  {
    id: "respira",
    title: "Respira",
    subtitle: "2 min para volver al centro",
    iconPath: "M12 2v20M2 12h20M4 12a8 8 0 0 1 16 0M4 12a8 8 0 0 0 16 0",
    aurora:
      "bg-[radial-gradient(ellipse_at_30%_20%,rgba(200,230,210,0.95),transparent_60%),radial-gradient(ellipse_at_75%_85%,rgba(234,244,255,0.9),transparent_60%),linear-gradient(135deg,#EAF4FF,#C8E6D2)]",
    ringFrom: "from-[#C8E6D2]",
    ringTo: "to-[#EAF4FF]",
  },
  {
    id: "enfocate",
    title: "Enfócate",
    subtitle: "Prep mental antes de estudiar",
    iconPath: "M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4zM9 12l2 2 4-4",
    aurora:
      "bg-[radial-gradient(ellipse_at_20%_80%,rgba(217,212,242,0.95),transparent_60%),radial-gradient(ellipse_at_80%_20%,rgba(207,230,255,0.85),transparent_60%),linear-gradient(135deg,#CFE6FF,#D9D4F2)]",
    ringFrom: "from-[#D9D4F2]",
    ringTo: "to-[#CFE6FF]",
  },
  {
    id: "descarga",
    title: "Descarga",
    subtitle: "Cerrar el día sin ruido mental",
    iconPath: "M12 3a6 6 0 0 0-6 6c0 2 1 3 1 5h10c0-2 1-3 1-5a6 6 0 0 0-6-6zM9 18h6M10 21h4",
    aurora:
      "bg-[radial-gradient(ellipse_at_30%_30%,rgba(247,217,196,0.95),transparent_60%),radial-gradient(ellipse_at_70%_70%,rgba(251,248,243,0.9),transparent_60%),linear-gradient(135deg,#FBF8F3,#F7D9C4)]",
    ringFrom: "from-[#F7D9C4]",
    ringTo: "to-[#FBF8F3]",
  },
];

function MoodAuroraGrid({
  selectedMood,
  setSelectedMood,
}: {
  selectedMood: string;
  setSelectedMood: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {MOOD_THEMES.map((m) => {
        const active = selectedMood === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedMood(m.id)}
            aria-pressed={active}
            className={`group relative isolate overflow-hidden rounded-3xl p-6 text-left transition-all duration-300 ${
              active
                ? "ring-2 ring-[#8B82C9]/60 shadow-[0_18px_50px_-24px_rgba(139,130,201,0.35)]"
                : "ring-1 ring-white/50 hover:ring-[#8B82C9]/40"
            }`}
            style={{ minHeight: 180 }}
          >
            {/* Watercolor layer */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 -z-10 ${m.aurora}`}
            />
            {/* Soft orb */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute -right-10 -bottom-10 -z-10 h-32 w-32 rounded-full bg-gradient-to-br ${m.ringFrom} ${m.ringTo} blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-90`}
            />

            {/* Content */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-[#1B2B44] ring-1 ring-white/60">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d={m.iconPath} />
                </svg>
              </div>
              {active ? (
                <span className="inline-flex h-6 items-center rounded-full bg-white/70 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#1B2B44] ring-1 ring-white/60">
                  En foco
                </span>
              ) : null}
            </div>

            <div className="mt-10">
              <div className="text-2xl font-semibold leading-tight text-[#1B2B44] sm:text-[26px]">
                {m.title}
              </div>
              <div className="mt-1 text-sm text-[#5B6B86] sm:text-[15px]">{m.subtitle}</div>
            </div>
          </button>
        );
      })}
      <style jsx>{`
        @keyframes auroraShift {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-6%, 3%, 0) scale(1.12); }
          100% { transform: translate3d(4%, -4%, 0) scale(1.08); }
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────── Sunrise breath intro ──────────────────────────── */

const BREATH_INTRO_SESSION_KEY = "somagnus:space:breath-intro:v1";

function Cloud({
  className = "",
  size = 100,
  opacity = 1,
}: {
  className?: string;
  size?: number;
  opacity?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size * 0.62}
      viewBox="0 0 160 100"
      fill="none"
      style={{ opacity, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.05))" }}
    >
      <path
        d="M40 80 Q10 80 14 58 Q8 38 34 36 Q40 16 62 22 Q74 6 96 16 Q120 10 126 36 Q150 38 148 60 Q154 82 124 80 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function BreathIntro() {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const sunRef = useRef<HTMLDivElement | null>(null);
  const inhaleRef = useRef<HTMLDivElement | null>(null);
  const holdRef = useRef<HTMLDivElement | null>(null);
  const exhaleRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      if (window.sessionStorage.getItem(BREATH_INTRO_SESSION_KEY) === "done") return false;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    } catch {
      // ignore
    }
    return true;
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(BREATH_INTRO_SESSION_KEY, "done");
    } catch {
      // ignore
    }
    const overlay = overlayRef.current;
    if (!overlay) {
      setVisible(false);
      return;
    }
    timelineRef.current?.kill();
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => setVisible(false),
    });
  };

  useEffect(() => {
    if (!visible || !mounted) return;
    const overlay = overlayRef.current;
    const sun = sunRef.current;
    const inhale = inhaleRef.current;
    const hold = holdRef.current;
    const exhale = exhaleRef.current;
    if (!overlay || !sun || !inhale || !hold || !exhale) return;

    gsap.set(overlay, { opacity: 0 });
    gsap.set(sun, { scale: 0.97, y: 0, transformOrigin: "50% 100%" });
    gsap.set([inhale, hold, exhale], { opacity: 0, y: 8 });

    const tl = gsap.timeline({
      defaults: { ease: "sine.inOut" },
      onComplete: () => {
        try {
          window.sessionStorage.setItem(BREATH_INTRO_SESSION_KEY, "done");
        } catch {
          // ignore
        }
        gsap.to(overlay, {
          opacity: 0,
          duration: 1,
          ease: "power2.out",
          onComplete: () => setVisible(false),
        });
      },
    });
    timelineRef.current = tl;

    tl
      // Fade in
      .to(overlay, { opacity: 1, duration: 0.8, ease: "power2.out" })

      // Inhale (4s) — sun grows
      .to(inhale, { opacity: 1, y: 0, duration: 0.5 }, "+=0.2")
      .to(sun, { scale: 1.06, duration: 4 }, "<")
      .to(inhale, { opacity: 0, y: -8, duration: 0.5 })

      // Hold (1.5s)
      .to(hold, { opacity: 1, y: 0, duration: 0.4 }, "-=0.2")
      .to({}, { duration: 1 })
      .to(hold, { opacity: 0, y: -8, duration: 0.4 })

      // Exhale (5s) — sun shrinks
      .to(exhale, { opacity: 1, y: 0, duration: 0.5 })
      .to(sun, { scale: 0.97, duration: 5 }, "<")
      .to(exhale, { opacity: 0, y: -8, duration: 0.5 });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted]);

  if (!visible || !mounted || typeof document === "undefined") return null;

  const labelClass =
    "absolute whitespace-nowrap uppercase tracking-[0.22em] text-white text-5xl sm:text-7xl md:text-8xl lg:text-9xl";
  const labelStyle: React.CSSProperties = {
    opacity: 0,
    fontFamily:
      'var(--font-display), "Cinzel Decorative", serif',
    fontWeight: 700,
    letterSpacing: "0.22em",
    textShadow: "0 6px 24px rgba(10,30,70,0.35)",
  };

  const scene = (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        opacity: 0,
        width: "100vw",
        height: "100vh",
        background:
          "linear-gradient(180deg, #9FD3FF 0%, #4DA8F0 40%, #1E73D9 78%, #0E3B8C 100%)",
      }}
    >
      {/* TOP HALF — breath label (white over sky) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 flex items-center justify-center">
        <div ref={inhaleRef} className={labelClass} style={labelStyle}>
          Inhala
        </div>
        <div ref={holdRef} className={labelClass} style={labelStyle}>
          Sostén
        </div>
        <div ref={exhaleRef} className={labelClass} style={labelStyle}>
          Exhala
        </div>
      </div>

      {/* Small drifting clouds across the sky */}
      <Cloud className="absolute left-[4%] top-[12%]" size={140} opacity={0.95} />
      <Cloud className="absolute right-[-2%] top-[8%]" size={170} opacity={0.95} />
      <Cloud className="absolute left-[38%] top-[6%]" size={60} opacity={0.55} />
      <Cloud className="absolute right-[34%] top-[18%]" size={50} opacity={0.45} />
      <Cloud className="absolute left-[18%] top-[28%]" size={45} opacity={0.4} />
      <Cloud className="absolute right-[14%] top-[36%]" size={70} opacity={0.55} />

      {/* BOTTOM HALF — orange sun dome (breathing) with face */}
      <div
        ref={sunRef}
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{
          transformOrigin: "50% 100%",
          transform: "scale(0.97)",
          willChange: "transform",
        }}
      >
        {/* Warm halo around the dome peak */}
        <div
          className="absolute inset-x-0"
          style={{
            top: "-60px",
            height: "120px",
            background:
              "radial-gradient(ellipse 60% 100% at 50% 100%, rgba(255,180,90,0.5) 0%, rgba(255,180,90,0) 70%)",
            pointerEvents: "none",
          }}
        />
        {/* Sun dome anchored to bottom edge */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 90% at 50% 100%, #FFD28A 0%, #FFB266 40%, #FF8A3D 75%, #F97316 100%)",
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
            boxShadow: "0 -20px 60px rgba(249,115,22,0.35)",
          }}
        />
        {/* Face near the dome peak */}
        <svg
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: "18%", width: "min(42vw, 420px)", height: "auto", overflow: "visible" }}
          viewBox="0 0 400 140"
          fill="none"
        >
          <path
            d="M70 50 Q110 18 150 50"
            stroke="#2B1810"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M250 50 Q290 18 330 50"
            stroke="#2B1810"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M150 95 Q200 130 250 95"
            stroke="#2B1810"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Foreground clouds flanking the horizon (like reference) */}
      <div className="pointer-events-none absolute inset-x-0" style={{ bottom: "46%" }}>
        <Cloud className="absolute left-[-3%] bottom-0" size={220} opacity={1} />
        <Cloud className="absolute right-[-4%] bottom-0" size={240} opacity={1} />
      </div>
    </div>
  );

  return createPortal(scene, document.body);
}
