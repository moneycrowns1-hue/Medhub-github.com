"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Headphones, Heart, MoonStar, Pause, Play, SkipBack, SkipForward, Sparkles, Waves } from "lucide-react";

type Mood = {
  id: string;
  title: string;
  subtitle: string;
  tone: string;
};

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

const revealIds = ["hero", "mood", "carousel", "favorites", "upcoming", "tip"] as const;

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

function getScrollMetrics() {
  if (typeof window === "undefined") return { progress: 0, y: 0 };
  const y = window.scrollY || window.pageYOffset || 0;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return { progress: Math.min(100, Math.max(0, Math.round((y / max) * 100))), y };
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
    audioSrc: "/audio/space/dormir-mejor.mp3",
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

export function SpaceClient() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [activeId, setActiveId] = useState<string>(sessions[0]?.id ?? "");
  const [playing, setPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(sessions[0]?.approxLengthSec ?? 0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [autoplayRequested, setAutoplayRequested] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavorites());
  const [sessionProgress, setSessionProgress] = useState<Record<string, number>>(() => loadProgress());
  const [revealedSections, setRevealedSections] = useState<Record<string, boolean>>(() => loadInitialRevealState());
  const [visualMode, setVisualMode] = useState<VisualModeId>(() => loadVisualMode());
  const [scrollProgress, setScrollProgress] = useState<number>(() => getScrollMetrics().progress);
  const [parallaxY, setParallaxY] = useState<number>(() => getScrollMetrics().y);
  const [playPulseToken, setPlayPulseToken] = useState(0);

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
        const next = getScrollMetrics();
        setScrollProgress(next.progress);
        if (!shouldReduceMotion) {
          setParallaxY(next.y);
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

  const playlist = useMemo(() => {
    if (filteredSessions.length === 0) return sessions;
    return filteredSessions;
  }, [filteredSessions]);

  const activeIndex = useMemo(() => {
    return playlist.findIndex((s) => s.id === activeSession?.id);
  }, [playlist, activeSession?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const mediaDuration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
      setDurationSec(mediaDuration > 0 ? mediaDuration : activeSession?.approxLengthSec ?? 0);
      const saved = activeSession ? sessionProgress[activeSession.id] ?? 0 : 0;
      if (saved > 0 && saved < audio.duration) {
        audio.currentTime = saved;
      }
      if (autoplayRequested) {
        void audio.play().then(() => {
          setPlaying(true);
          setAutoplayRequested(false);
        }).catch(() => {
          setPlaying(false);
          setAutoplayRequested(false);
          setPlaybackError("No se pudo iniciar el audio automáticamente. Presiona reproducir manualmente.");
        });
      }
    };

    const onTimeUpdate = () => {
      const nextElapsed = Math.floor(audio.currentTime);
      setElapsedSec(nextElapsed);
      if (activeSession) {
        setSessionProgress((prev) => {
          if (prev[activeSession.id] === nextElapsed) return prev;
          return { ...prev, [activeSession.id]: nextElapsed };
        });
      }
    };

    const onPlay = () => {
      setPlaying(true);
      setPlayPulseToken((prev) => prev + 1);
    };
    const onPause = () => setPlaying(false);

    const onEnded = () => {
      setPlaying(false);
      if (activeSession) {
        setSessionProgress((prev) => ({ ...prev, [activeSession.id]: 0 }));
      }
    };

    const onError = () => {
      setPlaying(false);
      setPlaybackError(
        "No se encontró el archivo de audio para esta sesión. Sube el archivo en public/audio/space con el nombre esperado.",
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
  }, [activeSession, autoplayRequested, sessionProgress]);

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

  const progress = durationSec > 0 ? Math.min(100, Math.round((elapsedSec / durationSec) * 100)) : 0;

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const startSession = (sessionId: string, options?: { autoplay?: boolean }) => {
    const shouldAutoplay = options?.autoplay ?? false;
    const audio = audioRef.current;
    audio?.pause();
    const next = sessions.find((s) => s.id === sessionId);
    setActiveId(sessionId);
    setElapsedSec(sessionProgress[sessionId] ?? 0);
    setDurationSec(next?.approxLengthSec ?? 0);
    setPlaybackError(null);
    setAutoplayRequested(shouldAutoplay);
    if (!shouldAutoplay) setPlaying(false);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

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
      setPlaybackError("No se pudo reproducir este audio. Verifica que el archivo exista y el navegador lo soporte.");
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

  const revealClass = (id: string) => {
    return revealedSections[id]
      ? "translate-y-0 scale-100 opacity-100 blur-0"
      : "translate-y-6 scale-[0.985] opacity-0 blur-[2px]";
  };

  return (
    <div className={`relative space-y-10 pb-8 ${modeStyle.pageText}`}>
      <div className="sticky top-0 z-40 h-1 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full bg-[linear-gradient(90deg,rgba(167,243,255,0.85),rgba(255,255,255,0.95))] transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 -top-16 z-0 h-[24rem] transition-transform duration-300 ease-out ${modeStyle.pageGlow}`}
        style={{ transform: `translate3d(0, ${Math.round(parallaxY * 0.14)}px, 0)` }}
      />
      <div
        className="pointer-events-none absolute inset-x-[-20%] top-56 z-0 h-[18rem] bg-[radial-gradient(circle_at_50%_50%,rgba(176,248,255,0.12),transparent_58%)] blur-2xl"
        style={{ transform: `translate3d(0, ${Math.round(parallaxY * 0.08)}px, 0)` }}
      />
      <audio ref={audioRef} preload="metadata" className="hidden" src={activeSession?.audioSrc} />

      <section
        data-reveal-id="hero"
        className={`relative z-10 overflow-hidden rounded-[2rem] border p-6 transition-all duration-700 ease-out md:p-10 ${modeStyle.border} ${modeStyle.heroBg} ${modeStyle.heroShadow} ${revealClass("hero")}`}
      >
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15 mix-blend-screen"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          src="/video/space/cascade-loop.mp4"
        />
        <div
          className="pointer-events-none absolute -top-24 right-[-30px] h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl"
          style={{ transform: `translate3d(0, ${Math.round(parallaxY * 0.1)}px, 0)` }}
        />
        <div
          className="pointer-events-none absolute bottom-[-55px] left-[-30px] h-52 w-52 rounded-full bg-sky-200/15 blur-3xl"
          style={{ transform: `translate3d(0, ${Math.round(parallaxY * -0.06)}px, 0)` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(255,255,255,0.2),transparent_45%)]" />

        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-5">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`}>
              <MoonStar className="h-3.5 w-3.5" />
              Space
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">Tu espacio mental para estudiar con más calma.</h1>
            <p className={`text-sm md:text-base ${modeStyle.textSoft}`}>
              Respiración, foco y descanso en una sola vista. Navega suave, guarda tus favoritas y vuelve a tu ritmo cuando quieras.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {visualModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setVisualMode(mode.id)}
                  className={`rounded-2xl border px-3 py-2 text-left transition ${
                    visualMode === mode.id ? `${modeStyle.borderStrong} ${modeStyle.softSurfaceAlt}` : `${modeStyle.border} ${modeStyle.softSurface}`
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wider">{mode.label}</div>
                  <div className={`mt-1 text-[11px] ${modeStyle.textSoft}`}>{mode.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={togglePlayback}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${modeStyle.primaryButton}`}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pausar sesión" : "Empezar sesión"}
              </button>
              <Link
                href="/day"
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition ${modeStyle.secondaryButton}`}
              >
                Conectar con mi plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <article className={`relative rounded-3xl border p-5 backdrop-blur-xl ${modeStyle.border} ${modeStyle.surface}`}>
            {playing ? (
              <div key={playPulseToken} className="pointer-events-none absolute inset-0 rounded-3xl border border-cyan-200/35 animate-[ping_850ms_ease-out_1]" />
            ) : null}
            <div className={`text-xs uppercase tracking-widest ${modeStyle.textSoft}`}>Reproduciendo</div>
            <div className="mt-2 text-lg font-semibold">{activeSession?.title ?? "Sin sesión"}</div>
            <div className={`text-xs ${modeStyle.textSoft}`}>{activeSession?.type}</div>
            <div className={`mt-4 h-2 overflow-hidden rounded-full ${modeStyle.progressTrack}`}>
              <div className={`h-full rounded-full transition-all ${modeStyle.progressFill}`} style={{ width: `${progress}%` }} />
            </div>
            <div className={`mt-2 flex items-center justify-between text-xs ${modeStyle.textSoft}`}>
              <span>{fmt(elapsedSec)}</span>
              <span>{fmt(durationSec)}</span>
            </div>
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
            {playbackError ? <div className="mt-3 text-xs text-amber-200/90">{playbackError}</div> : null}
          </article>
        </div>
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
          Carrusel de sesiones
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filteredSessions.map((session) => {
            const isFav = favoriteIds.includes(session.id);
            const isActive = activeSession?.id === session.id;
            return (
              <article
                key={session.id}
                className={`min-w-[260px] snap-start rounded-3xl border p-5 backdrop-blur-xl transition md:min-w-[300px] ${
                  isActive ? `${modeStyle.borderStrong} ${modeStyle.softSurfaceAlt}` : `${modeStyle.border} ${modeStyle.softSurface}`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">{session.title}</div>
                    <div className={`text-xs ${modeStyle.textSoft}`}>{session.type} · {fmt(session.approxLengthSec)}</div>
                  </div>
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
                </div>
                <p className={`mt-3 text-sm ${modeStyle.textSoft}`}>{session.desc}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startSession(session.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${modeStyle.primaryButton}`}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Seleccionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      startSession(session.id, { autoplay: true });
                    }}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition ${modeStyle.secondaryButton}`}
                  >
                    Reproducir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article
          data-reveal-id="favorites"
          className={`rounded-3xl border p-6 backdrop-blur-xl transition-all duration-700 ease-out ${modeStyle.border} ${modeStyle.softSurface} ${revealClass("favorites")}`}
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
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${modeStyle.border} ${modeStyle.surface}`}
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
          className={`relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl transition-all duration-700 ease-out ${modeStyle.border} ${modeStyle.heroBg} ${revealClass("upcoming")}`}
          style={{ transitionDelay: "220ms" }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-200/20 blur-2xl" />
          <div className="relative z-10 space-y-4">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${modeStyle.border} ${modeStyle.softSurfaceAlt} ${modeStyle.textMuted}`}>
              <Waves className="h-3.5 w-3.5" />
              Próximamente
            </div>
            <h3 className="text-xl font-semibold">Biblioteca de audios personalizados</h3>
            <p className={`text-sm ${modeStyle.textSoft}`}>
              El reproductor ya está conectado a archivos reales. Solo coloca tus audios en <code>public/audio/space</code> con estos nombres:
              <br />
              <span className={modeStyle.textMuted}>reset-express.mp3, foco-profundo.mp3, dormir-mejor.mp3, aterriza-mente.mp3, modo-examen.mp3</span>
            </p>
            <div className={`rounded-2xl border border-dashed p-4 text-xs ${modeStyle.border} ${modeStyle.softSurface} ${modeStyle.textSoft}`}>
              Siguiente paso técnico: si quieres, agrego volumen, velocidad y auto-advance de playlist al terminar cada sesión.
            </div>
          </div>
        </article>
      </section>

      <section
        data-reveal-id="tip"
        className={`rounded-2xl border p-4 text-xs backdrop-blur-xl transition-all duration-700 ease-out ${modeStyle.border} ${modeStyle.softSurface} ${modeStyle.textSoft} ${revealClass("tip")}`}
        style={{ transitionDelay: "260ms" }}
      >
        <div className="flex items-start gap-2">
          <ArrowLeft className="mt-0.5 h-3.5 w-3.5 rotate-180" />
          <div>
            Tip: si acabas de subir audios y no reproducen en Pages, haz recarga fuerte (<code>Ctrl+F5</code>) para limpiar caché del navegador.
          </div>
        </div>
      </section>
    </div>
  );
}
