"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatTime,
  isBreakPhase,
  loadPomodoroState,
  phaseLabel,
  remainingSec,
  type PomodoroState,
} from "@/lib/pomodoro";

export function PomodoroOverlay() {
  const [state, setState] = useState<PomodoroState>(() => loadPomodoroState());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const onStorage = () => setState(loadPomodoroState());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      setState(loadPomodoroState());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useMemo(() => remainingSec(state, nowMs), [state, nowMs]);
  const activeBreak = isBreakPhase(state.phase) && remaining > 0;

  if (!activeBreak) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/90 px-6 text-white">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="text-sm uppercase tracking-widest text-white/70">
          Descanso obligatorio
        </div>
        <div className="text-2xl font-semibold">{phaseLabel(state.phase)}</div>
        <div className="text-6xl font-bold tabular-nums">
          {formatTime(remaining)}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-white/70">
            <div>Progreso</div>
            <div className="tabular-nums">
              {Math.round(
                state.durationSec > 0
                  ? ((state.durationSec - remaining) / state.durationSec) * 100
                  : 0,
              )}
              %
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-white"
              style={{
                width: `${
                  state.durationSec > 0
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          ((state.durationSec - remaining) / state.durationSec) * 100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="text-sm text-white/70">
          No podés estudiar dentro de la app hasta que termine el descanso.
        </div>
      </div>
    </div>
  );
}
