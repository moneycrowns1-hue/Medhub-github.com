"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
import { Button } from "@/components/ui/button";
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

  return (
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/8 text-white backdrop-blur-xl">
      <div className="relative px-6 py-5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-white/60">Pomodoro</div>
            <div className="text-base font-bold text-white">{phaseLabel(state.phase)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-3xl font-bold tabular-nums text-white">
              {running ? formatTime(remaining) : "--:--"}
            </div>
          </div>
        </div>
      </div>

      {state.phase !== "idle" ? (
        <div className="px-6 pb-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/60">
            <span>Progreso</span>
            <span className="tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-gradient-to-r from-white to-white/70 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 px-6 py-4">
        <Button size="sm" className="bg-white text-black hover:bg-white/90" onClick={handleStart} disabled={state.phase !== "idle"}>
          Iniciar
        </Button>
        <Button size="sm" variant="secondary" className="border border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={handleSkip} disabled={state.phase === "idle"}>
          Siguiente
        </Button>
        <Button size="sm" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={handleReset}>
          Reset
        </Button>
        <Button size="sm" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={handleFullscreen}>
          Fullscreen
        </Button>
      </div>

      <div className="border-t border-white/20 px-6 py-3 text-[10px] text-white/60">
        F1 {settings.focus1Min}m · F2 {settings.focus2Min}m · F3 {settings.focus3Min}m · Break {settings.breakMin}m
      </div>
    </div>
  );
}
