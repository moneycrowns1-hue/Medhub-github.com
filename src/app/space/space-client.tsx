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

    const onPlay = () => setPlaying(true);
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

  return (
    <div className="space-y-8 pb-6 text-white">
      <audio ref={audioRef} preload="metadata" className="hidden" src={activeSession?.audioSrc} />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(160deg,#1b4f63_0%,#222252_58%,#18172a_100%)] p-6 shadow-[0_30px_80px_-40px_rgba(117,208,255,0.55)] md:p-10">
        <div className="pointer-events-none absolute -top-24 right-[-30px] h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-55px] left-[-30px] h-52 w-52 rounded-full bg-indigo-300/20 blur-3xl" />

        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/85">
              <MoonStar className="h-3.5 w-3.5" />
              Space
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">Tu espacio mental para estudiar con más calma.</h1>
            <p className="text-sm text-white/75 md:text-base">
              Reproductor ligero + sesiones guiadas + favoritos persistentes. Listo para conectar tus audios cuando los subas.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={togglePlayback}
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pausar sesión" : "Empezar sesión"}
              </button>
              <Link
                href="/day"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/15"
              >
                Conectar con mi plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <article className="rounded-3xl border border-white/20 bg-black/25 p-5 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-widest text-white/65">Reproduciendo</div>
            <div className="mt-2 text-lg font-semibold">{activeSession?.title ?? "Sin sesión"}</div>
            <div className="text-xs text-white/65">{activeSession?.type}</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              <span>{fmt(elapsedSec)}</span>
              <span>{fmt(durationSec)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={playPrev}
                disabled={activeIndex <= 0}
                className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SkipBack className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={playNext}
                disabled={activeIndex < 0 || activeIndex >= playlist.length - 1}
                className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>
            {playbackError ? <div className="mt-3 text-xs text-amber-200/90">{playbackError}</div> : null}
          </article>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Sparkles className="h-4 w-4" />
          Elige cómo te sientes hoy
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setSelectedMood("all")}
            className={`rounded-2xl border p-4 text-left transition ${
              selectedMood === "all" ? "border-white/45 bg-white/20" : "border-white/20 bg-white/10 hover:border-white/35"
            }`}
          >
            <div className="text-sm font-semibold">Todo</div>
            <div className="text-xs text-white/70">Todas las sesiones</div>
          </button>
          {moods.map((mood) => (
            <button
              key={mood.id}
              type="button"
              onClick={() => setSelectedMood(mood.id)}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                selectedMood === mood.id ? "border-white/45 bg-white/20" : "border-white/20 bg-white/10 hover:border-white/35"
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 ${mood.tone}`} />
              <div className="relative z-10 space-y-1">
                <div className="text-sm font-semibold">{mood.title}</div>
                <div className="text-xs text-white/70">{mood.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
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
                  isActive ? "border-white/40 bg-white/20" : "border-white/20 bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">{session.title}</div>
                    <div className="text-xs text-white/65">{session.type} · {fmt(session.approxLengthSec)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(session.id)}
                    className={`rounded-full border p-2 transition ${
                      isFav ? "border-rose-300/60 bg-rose-300/20 text-rose-100" : "border-white/20 bg-white/10 text-white/80 hover:border-white/35"
                    }`}
                    aria-label="Favorito"
                  >
                    <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                  </button>
                </div>
                <p className="mt-3 text-sm text-white/75">{session.desc}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startSession(session.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Seleccionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      startSession(session.id, { autoplay: true });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-medium text-white/85 transition hover:bg-white/15"
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
        <article className="rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-xl">
          <div className="text-xs uppercase tracking-widest text-white/65">Tus favoritos</div>
          {favoriteSessions.length === 0 ? (
            <p className="mt-3 text-sm text-white/70">
              Todavía no tienes sesiones favoritas. Marca con corazón las que quieras tener siempre a mano.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {favoriteSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => startSession(session.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-left transition hover:border-white/30"
                >
                  <div>
                    <div className="text-sm font-semibold">{session.title}</div>
                    <div className="text-xs text-white/65">{session.type}</div>
                  </div>
                  <span className="text-xs text-white/75">{fmt(session.approxLengthSec)}</span>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="relative overflow-hidden rounded-3xl border border-white/20 bg-[linear-gradient(170deg,rgba(73,171,201,0.25),rgba(64,92,196,0.15),rgba(15,17,36,0.5))] p-6 backdrop-blur-xl">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-200/20 blur-2xl" />
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Waves className="h-3.5 w-3.5" />
              Próximamente
            </div>
            <h3 className="text-xl font-semibold">Biblioteca de audios personalizados</h3>
            <p className="text-sm text-white/75">
              El reproductor ya está conectado a archivos reales. Solo coloca tus audios en <code>public/audio/space</code> con estos nombres:
              <br />
              <span className="text-white/90">reset-express.mp3, foco-profundo.mp3, dormir-mejor.mp3, aterriza-mente.mp3, modo-examen.mp3</span>
            </p>
            <div className="rounded-2xl border border-dashed border-white/30 bg-white/5 p-4 text-xs text-white/70">
              Siguiente paso técnico: si quieres, agrego volumen, velocidad y auto-advance de playlist al terminar cada sesión.
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-white/20 bg-white/5 p-4 text-xs text-white/70 backdrop-blur-xl">
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
