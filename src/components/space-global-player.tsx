"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Music2, Pause, Play, SlidersHorizontal, Volume2 } from "lucide-react";

import { getSpaceSharedAudio } from "@/lib/space-shared-audio";

type SpaceSessionMeta = {
  id: string;
  title: string;
  type: string;
  audioSrc: string;
};

const ACTIVE_SESSION_STORAGE_KEY = "somagnus:space:active-session:v1";
const VOLUME_STORAGE_KEY = "somagnus:space:volume:v1";
const PLAYBACK_RATE_STORAGE_KEY = "somagnus:space:rate:v1";

const sessionsMeta: SpaceSessionMeta[] = [
  { id: "reset-express", title: "Reset express", type: "Micro pausa", audioSrc: "/audio/space/reset-express.mp3" },
  { id: "foco-profundo", title: "Foco profundo", type: "Preparación", audioSrc: "/audio/space/foco-profundo.mp3" },
  {
    id: "dormir-mejor",
    title: "Dormir mejor",
    type: "Noche",
    audioSrc: "https://archive.org/download/entregate-al-sueno/Entregate%20al%20sue%C3%B1o.mp3",
  },
  { id: "aterriza-mente", title: "Aterriza tu mente", type: "Ansiedad", audioSrc: "/audio/space/aterriza-mente.mp3" },
  { id: "modo-examen", title: "Modo examen", type: "Pre estudio", audioSrc: "/audio/space/modo-examen.mp3" },
];

function withBasePath(path: string) {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const basePath = process.env.NODE_ENV === "production" ? "/Medhub-github.com" : "";
  return `${basePath}${path}`;
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

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveMetaByActiveId(activeId: string | null) {
  return sessionsMeta.find((session) => session.id === activeId) ?? null;
}

function resolveMetaByAudioSource(source: string) {
  return (
    sessionsMeta.find((session) => {
      const nextSrc = withBasePath(session.audioSrc);
      return sameAudioSource(source, nextSrc);
    }) ?? null
  );
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

export function SpaceGlobalPlayer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(getSpaceSharedAudio());
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(() => {
    const audio = getSpaceSharedAudio();
    if (!audio) return false;
    return !audio.paused || Math.floor(audio.currentTime || 0) > 0;
  });
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
    return audio && Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
  });
  const [volume, setVolume] = useState(() => loadInitialVolume());
  const [playbackRate, setPlaybackRate] = useState(() => loadInitialPlaybackRate());
  const [activeMeta, setActiveMeta] = useState<SpaceSessionMeta | null>(() => {
    if (typeof window === "undefined") return null;
    const fromStorage = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    return resolveMetaByActiveId(fromStorage);
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncMeta = () => {
      const fromSource = resolveMetaByAudioSource(audio.currentSrc || "");
      if (fromSource) {
        setActiveMeta(fromSource);
        return;
      }
      try {
        const fromStorage = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        setActiveMeta(resolveMetaByActiveId(fromStorage));
      } catch {
        setActiveMeta(null);
      }
    };

    const onLoadedMetadata = () => {
      const mediaDuration = Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
      setDurationSec(mediaDuration > 0 ? mediaDuration : 0);
      syncMeta();
    };

    const onTimeUpdate = () => {
      setElapsedSec(Math.floor(audio.currentTime || 0));
      syncMeta();
    };

    const onPlay = () => {
      setPlaying(true);
      setVisible(true);
      syncMeta();
    };

    const onPause = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
    } catch {
      return;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
    try {
      window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(playbackRate));
    } catch {
      return;
    }
  }, [playbackRate]);

  const progress = useMemo(() => {
    if (durationSec <= 0) return 0;
    return Math.min(100, Math.round((elapsedSec / durationSec) * 100));
  }, [durationSec, elapsedSec]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    await audio.play().catch(() => undefined);
  };

  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || durationSec <= 0) return;
    const nextTime = Math.max(0, Math.min(durationSec, Math.round(ratio * durationSec)));
    audio.currentTime = nextTime;
    setElapsedSec(nextTime);
  };

  if (pathname === "/space" || !visible) return null;

  return (
    <section className="fixed inset-x-0 bottom-0 z-50 px-3 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="relative overflow-hidden rounded-[28px] border border-cyan-100/20 bg-slate-950/80 shadow-[0_24px_90px_-42px_rgba(0,0,0,0.98)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full bg-cyan-200/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 right-8 h-28 w-28 rounded-full bg-indigo-200/10 blur-3xl" />

          <div className="px-4 pt-3 sm:px-6 sm:pt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-cyan-50/15">
              <div className="h-full rounded-full bg-cyan-50 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-3xl border border-cyan-100/20 bg-cyan-50/10 px-3 py-2 text-left transition"
            >
              <span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-100/20 bg-cyan-50/10">
                <span className={`absolute inset-0 bg-gradient-to-br from-cyan-300/35 via-indigo-300/20 to-transparent ${playing ? "animate-pulse" : ""}`} />
                <Music2 className="relative z-10 h-5 w-5 text-cyan-50" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-cyan-50 sm:text-base">{activeMeta?.title ?? "Space"}</span>
                <span className="block truncate text-xs text-cyan-50/75">{activeMeta?.type ?? "Audio en reproducción"}</span>
              </span>
              <span className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-50/10 text-cyan-50">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </span>
            </button>

            <button
              type="button"
              onClick={togglePlayback}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-50/40 bg-cyan-50 text-slate-950 transition hover:bg-cyan-100"
              aria-label={playing ? "Pausar" : "Reproducir"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          </div>

          <div
            className={`overflow-hidden border-t border-cyan-100/20 transition-all duration-300 ease-out ${
              expanded ? "max-h-[320px] translate-y-0 opacity-100" : "max-h-0 -translate-y-1 opacity-0"
            }`}
            aria-hidden={!expanded}
          >
            <div className="space-y-4 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
              <label className="block space-y-1">
                <span className="sr-only">Progreso</span>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={durationSec > 0 ? Math.round((elapsedSec / durationSec) * 1000) : 0}
                  onChange={(event) => seekToRatio(Number(event.target.value) / 1000)}
                  className="w-full"
                />
              </label>

              <div className="flex items-center justify-between text-xs text-cyan-50/75">
                <span>{fmt(elapsedSec)}</span>
                <span>{fmt(durationSec)}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                <label className="space-y-1 rounded-2xl border border-cyan-100/20 bg-cyan-50/10 px-3 py-2.5 text-xs text-cyan-50/80">
                  <span className="inline-flex items-center gap-1">
                    <Volume2 className="h-3.5 w-3.5" />
                    Volumen ({Math.round(volume * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(volume * 100)}
                    onChange={(event) => setVolume(Number(event.target.value) / 100)}
                    className="w-full"
                  />
                </label>

                <label className="space-y-1 rounded-2xl border border-cyan-100/20 bg-cyan-50/10 px-3 py-2.5 text-xs text-cyan-50/80">
                  <span className="inline-flex items-center gap-1">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Velocidad
                  </span>
                  <select
                    value={String(playbackRate)}
                    onChange={(event) => setPlaybackRate(Number(event.target.value))}
                    className="w-full rounded-xl bg-cyan-50/10 px-3 py-2 text-xs text-cyan-50 outline-none"
                  >
                    <option value="0.8">0.8x</option>
                    <option value="1">1.0x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
