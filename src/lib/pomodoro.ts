export type PomodoroPhase =
  | "idle"
  | "focus_1"
  | "break_1"
  | "focus_2"
  | "break_2"
  | "focus_3";

export type PomodoroState = {
  phase: PomodoroPhase;
  startedAtMs: number | null;
  durationSec: number;
};

export type PomodoroDurations = {
  focus1Min: number;
  focus2Min: number;
  focus3Min: number;
  breakMin: number;
};

const STORAGE_KEY = "somagnus:pomodoro:v1";

export const DEFAULT_STATE: PomodoroState = {
  phase: "idle",
  startedAtMs: null,
  durationSec: 0,
};

export function isBreakPhase(phase: PomodoroPhase) {
  return phase === "break_1" || phase === "break_2";
}

export function phaseLabel(phase: PomodoroPhase) {
  switch (phase) {
    case "idle":
      return "Listo";
    case "focus_1":
      return "Bloque 1";
    case "break_1":
      return "Descanso 1";
    case "focus_2":
      return "Bloque 2";
    case "break_2":
      return "Descanso 2";
    case "focus_3":
      return "Bloque 3";
  }
}

export function getPhaseDurationSec(phase: PomodoroPhase, breakMinutes = 20) {
  switch (phase) {
    case "focus_1":
      return 2 * 60 * 60;
    case "focus_2":
      return 2 * 60 * 60;
    case "focus_3":
      return 60 * 60;
    case "break_1":
    case "break_2":
      return breakMinutes * 60;
    case "idle":
      return 0;
  }
}

export function getPhaseDurationSecFromSettings(
  phase: PomodoroPhase,
  s: PomodoroDurations,
) {
  switch (phase) {
    case "focus_1":
      return s.focus1Min * 60;
    case "focus_2":
      return s.focus2Min * 60;
    case "focus_3":
      return s.focus3Min * 60;
    case "break_1":
    case "break_2":
      return s.breakMin * 60;
    case "idle":
      return 0;
  }
}

export function nextPhase(phase: PomodoroPhase): PomodoroPhase {
  switch (phase) {
    case "focus_1":
      return "break_1";
    case "break_1":
      return "focus_2";
    case "focus_2":
      return "break_2";
    case "break_2":
      return "focus_3";
    case "focus_3":
      return "idle";
    case "idle":
      return "focus_1";
  }
}

export function loadPomodoroState(): PomodoroState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as PomodoroState;
    if (!parsed || typeof parsed.phase !== "string") return DEFAULT_STATE;
    return {
      phase: (parsed.phase as PomodoroPhase) ?? "idle",
      startedAtMs: typeof parsed.startedAtMs === "number" ? parsed.startedAtMs : null,
      durationSec: typeof parsed.durationSec === "number" ? parsed.durationSec : 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePomodoroState(state: PomodoroState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function remainingSec(state: PomodoroState, nowMs: number) {
  if (!state.startedAtMs || state.durationSec <= 0) return 0;
  const elapsedSec = Math.floor((nowMs - state.startedAtMs) / 1000);
  return Math.max(0, state.durationSec - elapsedSec);
}

export function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  if (hh > 0) return `${hh}:${pad(mm)}:${pad(ss)}`;
  return `${mm}:${pad(ss)}`;
}
