"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Outfit, Pixelify_Sans } from "next/font/google";
import { ArrowLeft, ArrowRight, Headphones, Heart, Pause, Play, SkipBack, SkipForward, Sparkles, Waves } from "lucide-react";
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
  audioSrc: string;
};

const FAVORITES_STORAGE_KEY = "somagnus:space:favorites:v1";
const PROGRESS_STORAGE_KEY = "somagnus:space:progress:v1";
const VISUAL_MODE_STORAGE_KEY = "somagnus:space:visual-mode:v1";
const DAILY_MASCOT_GUIDE_STORAGE_KEY = "somagnus:space:mascot-daily-checkin:v1";
const ACTIVE_SESSION_STORAGE_KEY = "somagnus:space:active-session:v1";
const SPACE_ARCHIVE_SESSION_ID = "dormir-mejor";
const SPACE_ARCHIVE_STREAM_URL = "https://archive.org/download/entregate-al-sueno/Entregate%20al%20sue%C3%B1o.mp3";
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

const revealIds = ["hero", "mood", "carousel", "favorites", "upcoming", "mascot", "tip"] as const;

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

const mascotGuideSteps = [
  {
    id: "start",
    title: "Inicio rápido",
    text: "El conejo te sugiere 3 min de reset para entrar suave al estudio.",
    cta: "Pulsa Reproducir en el player principal.",
  },
  {
    id: "mood",
    title: "Foco por mood",
    text: "Si eliges un mood, el conejo te recuerda una sesión ideal para ese estado.",
    cta: "Prueba Respira o Enfócate en los chips.",
  },
  {
    id: "streak",
    title: "Mini reto",
    text: "Haz 1 sesión diaria y desbloquea una racha simbólica de la mascota.",
    cta: "Empieza con una sesión corta hoy.",
  },
  {
    id: "close",
    title: "Cierre tranquilo",
    text: "Al terminar, te invita a una pausa breve para bajar revoluciones.",
    cta: "Cierra con Dormir mejor o Descarga.",
  },
] as const;

type MascotGuideStepId = (typeof mascotGuideSteps)[number]["id"];

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
  return sessions.find((session) => sameAudioSource(source, withBasePath(session.audioSrc)))?.id;
}

function loadInitialActiveSessionId() {
  if (typeof window === "undefined") return sessions[0]?.id ?? "";
  const fromAudio = resolveSessionIdFromSource(getSpaceSharedAudio()?.currentSrc ?? "");
  if (fromAudio) return fromAudio;
  try {
    const saved = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    return sessions.some((session) => session.id === saved) ? (saved as string) : (sessions[0]?.id ?? "");
  } catch {
    return sessions[0]?.id ?? "";
  }
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
  const [guideStep, setGuideStep] = useState(0);
  const [dailyMascotCheckinDone, setDailyMascotCheckinDone] = useState<boolean>(() => loadDailyMascotCheckinDone());
  const sessionProgressRef = useRef<Record<string, number>>(sessionProgress);

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

  const playlist = useMemo(() => {
    if (filteredSessions.length === 0) return sessions;
    return filteredSessions;
  }, [filteredSessions]);

  const activeIndex = useMemo(() => {
    return playlist.findIndex((s) => s.id === activeSession?.id);
  }, [playlist, activeSession?.id]);

  const guideProgress = useMemo<Record<MascotGuideStepId, boolean>>(() => {
    const closeProgress = activeSession ? sessionProgress[activeSession.id] ?? 0 : 0;
    return {
      start: playing || elapsedSec > 0,
      mood: selectedMood !== "all",
      streak: dailyMascotCheckinDone,
      close: activeSession?.moodId === "descarga" && closeProgress > 0,
    };
  }, [activeSession, dailyMascotCheckinDone, elapsedSec, playing, selectedMood, sessionProgress]);

  const mascotContextMessage = useMemo(() => {
    if (playing && activeSession) {
      return `Buenísimo. Mantén el ritmo con \"${activeSession.title}\".`;
    }
    if (selectedMood === "respira") {
      return "Mood Respira activo: ideal para aterrizar antes de estudiar.";
    }
    if (selectedMood === "enfocate") {
      return "Mood Enfócate activo: usa una sesión corta y entra en flow.";
    }
    if (selectedMood === "descarga") {
      return "Mood Descarga activo: perfecto para cerrar el día con calma.";
    }
    return "Tip del conejo: elige un mood y pulsa reproducir para completar la guía rápida.";
  }, [activeSession, playing, selectedMood]);

  useEffect(() => {
    sessionProgressRef.current = sessionProgress;
  }, [sessionProgress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const mediaDuration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
      setDurationSec(mediaDuration > 0 ? mediaDuration : activeSession?.approxLengthSec ?? 0);
      const linkedSessionId = resolveSessionIdFromSource(audio.currentSrc) ?? activeSession?.id;
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
  }, [activeSession, activeUsesArchiveSource, dailyMascotCheckinDone]);

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

  const progress = durationSec > 0 ? Math.min(100, Math.round((elapsedSec / durationSec) * 100)) : 0;

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const ensureAudioSourceForSession = (sessionId: string) => {
    const audio = audioRef.current;
    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!audio || !targetSession) return null;

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
    if (activeIndex <= 0) return;
    const prev = playlist[activeIndex - 1];
    if (!prev) return;
    startSession(prev.id, { autoplay: true });
  };

  const playNext = () => {
    if (activeIndex < 0 || activeIndex >= playlist.length - 1) return;
    const next = playlist[activeIndex + 1];
    if (!next) return;
    startSession(next.id, { autoplay: true });
  };

  const favoriteSessions = sessions.filter((s) => favoriteIds.includes(s.id));
  const stickyHeaderSolid = parallaxY > 24;
  const currentGuide = mascotGuideSteps[guideStep];
  const currentGuideDone = guideProgress[currentGuide.id];

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
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={playPrev}
            disabled={activeIndex <= 0}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${modeStyle.secondaryButton}`}
          >
            <SkipBack className="h-3.5 w-3.5" />
            Anterior
          </button>
          <button
            type="button"
            onClick={playNext}
            disabled={activeIndex < 0 || activeIndex >= playlist.length - 1}
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
                    <div className={`text-xs ${modeStyle.textSoft}`}>{session.type} · {fmt(session.approxLengthSec)} · {session.moodId}</div>
                  </div>
                  <div className="flex items-center gap-2">
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
                  <span className={`text-xs ${modeStyle.textSoft}`}>{fmt(session.approxLengthSec)}</span>
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
              El reproductor ya está conectado a archivos reales. Solo coloca tus audios en <code>public/audio/space</code> con estos nombres:
              <br />
              <span className={modeStyle.textMuted}>reset-express.mp3, foco-profundo.mp3, dormir-mejor.mp3, aterriza-mente.mp3, modo-examen.mp3</span>
            </p>
            <div className={`rounded-2xl border border-dashed p-4 text-xs ${modeStyle.border} ${modeStyle.surface} ${modeStyle.textSoft}`}>
              Próximo ajuste recomendado: volumen, velocidad y auto-avance para hacerlo aún más simple de usar.
            </div>
          </div>
        </article>
      </section>

      <section
        data-reveal-id="mascot"
        className={`rounded-3xl border p-5 backdrop-blur-xl transition-all duration-700 ease-out ${modeStyle.border} ${modeStyle.softSurface} ${revealClass("mascot")}`}
        style={{ transitionDelay: "250ms" }}
      >
        <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-100/30 bg-cyan-100/10 shadow-[0_10px_30px_-18px_rgba(155,245,255,0.8)]">
            <canvas ref={rabbitCardCanvasRef} className="rabbit-card-canvas" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Mascota Space: conejito pixel</h3>
            <p className={`mt-1 text-sm ${modeStyle.textSoft}`}>Podemos usarlo como guía rápida para que la sección sea más clara y entretenida.</p>
            <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
              {mascotContextMessage}
            </div>
            <div className={`mt-3 rounded-2xl border p-4 ${modeStyle.border} ${modeStyle.surface}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-cyan-100/90">Guía rápida</div>
                <div className={`text-xs ${modeStyle.textSoft}`}>
                  Paso {guideStep + 1}/{mascotGuideSteps.length}
                </div>
              </div>
              <h4 className="mt-2 text-sm font-semibold">{currentGuide.title}</h4>
              <p className={`mt-1 text-xs ${modeStyle.textSoft}`}>{currentGuide.text}</p>
              <div className={`mt-2 rounded-xl border px-3 py-2 text-xs ${modeStyle.border} ${modeStyle.softSurfaceAlt}`}>
                {currentGuide.cta}
              </div>
              <div className={`mt-2 text-xs font-medium ${currentGuideDone ? "text-emerald-200" : modeStyle.textSoft}`}>
                {currentGuideDone ? "Completado automáticamente" : "Pendiente"}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setGuideStep((prev) => (prev === 0 ? mascotGuideSteps.length - 1 : prev - 1))}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${modeStyle.secondaryButton}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setGuideStep((prev) => (prev + 1) % mascotGuideSteps.length)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${modeStyle.primaryButton}`}
                >
                  Siguiente
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .rabbit-card-canvas {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          transform: scale(0.62);
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.2));
        }
      `}</style>
    </div>
  );
}
