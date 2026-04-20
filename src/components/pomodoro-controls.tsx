"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Maximize2, Play, RotateCcw, SkipForward, Timer as TimerIcon } from "lucide-react";

import {
  DEFAULT_STATE,
  formatTime,
  getPhaseDurationSecFromSettings,
  isBreakPhase,
  loadPomodoroState,
  nextPhase,
  phaseLabel,
  remainingSec,
  savePomodoroState,
  type PomodoroPhase,
  type PomodoroState,
} from "@/lib/pomodoro";
import {
  loadPomodoroSettings,
  POMODORO_SETTINGS_UPDATED_EVENT,
  type PomodoroSettings,
} from "@/lib/pomodoro-settings";
import { incrementStat } from "@/lib/stats-store";
import { markPomodoroStarted } from "@/lib/rabbit-guide";

function startPhase(phase: PomodoroPhase, settings: PomodoroSettings): PomodoroState {
  const durationSec = getPhaseDurationSecFromSettings(phase, settings);
  return {
    phase,
    startedAtMs: Date.now(),
    durationSec,
  };
}

export function PomodoroControls() {
  const [state, setState] = useState<PomodoroState>(() => loadPomodoroState());
  const [settings, setSettings] = useState<PomodoroSettings>(() => loadPomodoroSettings());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastCompletedKeyRef = useRef<string | null>(null);

  function setAndSave(next: PomodoroState) {
    savePomodoroState(next);
    setState(next);
  }

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onStorage = () => setState(loadPomodoroState());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const syncSettings = () => setSettings(loadPomodoroSettings());
    window.addEventListener("storage", syncSettings);
    window.addEventListener(POMODORO_SETTINGS_UPDATED_EVENT, syncSettings);
    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener(POMODORO_SETTINGS_UPDATED_EVENT, syncSettings);
    };
  }, []);

  const remaining = useMemo(() => remainingSec(state, nowMs), [state, nowMs]);
  const running = state.phase !== "idle" && remaining > 0;

  const playChime = async () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.4);
      window.setTimeout(() => {
        try {
          void ctx.close();
        } catch {
          // ignore
        }
      }, 700);
    } catch {
      // ignore
    }
  };

  const notifyPhaseComplete = async (phase: PomodoroPhase) => {
    try {
      if (typeof window === "undefined") return;
      if ("Notification" in window && Notification.permission === "granted") {
        const title = isBreakPhase(phase) ? "Break terminado" : "Bloque completado";
        const body = isBreakPhase(phase) ? "Volvé al enfoque." : "Buen trabajo. Pasá al descanso.";
        new Notification(title, { body });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!running && state.phase !== "idle" && state.startedAtMs) {
      const completedKey = `${state.phase}:${state.startedAtMs}`;
      if (lastCompletedKeyRef.current !== completedKey) {
        lastCompletedKeyRef.current = completedKey;
        const durationMin = Math.max(1, Math.round(state.durationSec / 60));
        if (!isBreakPhase(state.phase)) {
          incrementStat("focusMinutes", durationMin);
          incrementStat("blocksCompleted", 1);
        }
        void notifyPhaseComplete(state.phase);
        void playChime();
      }
      const np = nextPhase(state.phase);
      const next = startPhase(np, settings);
      window.setTimeout(() => {
        setAndSave(next);
      }, 0);
    }
  }, [running, state, settings]);

  const handleStart = () => {
    markPomodoroStarted();
    setAndSave(startPhase(nextPhase("idle"), settings));
  };

  const handleSkip = () => {
    if (state.phase === "idle") return;
    setAndSave(startPhase(nextPhase(state.phase), settings));
  };

  const handleReset = () => {
    savePomodoroState(DEFAULT_STATE);
    setState(DEFAULT_STATE);
  };

  const handleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const pct =
    state.durationSec > 0
      ? Math.min(100, Math.max(0, ((state.durationSec - remaining) / state.durationSec) * 100))
      : 0;

  const isBreak = isBreakPhase(state.phase);
  const phaseTone = state.phase === "idle"
    ? "bg-white/[0.06] text-white/80"
    : isBreak
      ? "bg-emerald-500/15 text-emerald-300"
      : "bg-rose-500/15 text-rose-300";

  return (
    <div className="overflow-hidden rounded-2xl bg-white/[0.04] text-white">
      {/* Header: phase + timer */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${phaseTone}`}>
          <TimerIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-widest text-white/50">Pomodoro</div>
          <div className="truncate text-sm font-semibold text-white/90">{phaseLabel(state.phase)}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-3xl font-bold leading-none tabular-nums text-white">
            {running ? formatTime(remaining) : "--:--"}
          </div>
        </div>
      </div>

      {/* Progress */}
      {state.phase !== "idle" ? (
        <div className="px-5 pb-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/45">
            <span>Progreso</span>
            <span className="tabular-nums text-white/70">{Math.round(pct)}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isBreak ? "bg-emerald-400/80" : "bg-rose-400/80"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1.5 px-5 pb-4 sm:grid-cols-4">
        <button
          type="button"
          onClick={handleStart}
          disabled={state.phase !== "idle"}
          className="group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[12px] font-semibold text-black transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white sm:col-span-2"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Iniciar
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={state.phase === "idle"}
          title="Saltar a la siguiente fase"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12px] font-medium text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.06]"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Siguiente
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reiniciar"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12px] font-medium text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={handleFullscreen}
          title="Pantalla completa"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12px] font-medium text-white/85 transition-colors hover:bg-white/[0.12] hover:text-white sm:col-span-2"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Fullscreen
        </button>
      </div>

      {/* Footer: settings preview */}
      <div className="border-t border-white/[0.06] px-5 py-2.5 text-center text-[10px] tabular-nums text-white/45">
        F1 {settings.focus1Min}m · F2 {settings.focus2Min}m · F3 {settings.focus3Min}m · Break {settings.breakMin}m
      </div>
    </div>
  );
}
