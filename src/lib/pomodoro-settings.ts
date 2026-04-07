export type PomodoroSettings = {
  focus1Min: number;
  focus2Min: number;
  focus3Min: number;
  breakMin: number;
};

const STORAGE_KEY = "somagnus:pomodoro_settings:v1";
export const POMODORO_SETTINGS_UPDATED_EVENT = "somagnus:pomodoro_settings:updated";

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focus1Min: 120,
  focus2Min: 120,
  focus3Min: 60,
  breakMin: 20,
};

export function clampInt(n: number, min: number, max: number) {
  const x = Math.floor(Number.isFinite(n) ? n : min);
  return Math.max(min, Math.min(max, x));
}

export function sanitizePomodoroSettings(s: PomodoroSettings): PomodoroSettings {
  return {
    focus1Min: clampInt(s.focus1Min, 15, 240),
    focus2Min: clampInt(s.focus2Min, 15, 240),
    focus3Min: clampInt(s.focus3Min, 15, 240),
    breakMin: clampInt(s.breakMin, 5, 60),
  };
}

export function loadPomodoroSettings(): PomodoroSettings {
  if (typeof window === "undefined") return DEFAULT_POMODORO_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POMODORO_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PomodoroSettings>;
    const merged: PomodoroSettings = {
      ...DEFAULT_POMODORO_SETTINGS,
      ...parsed,
    };
    return sanitizePomodoroSettings(merged);
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

export function savePomodoroSettings(s: PomodoroSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizePomodoroSettings(s)));
  window.dispatchEvent(new Event(POMODORO_SETTINGS_UPDATED_EVENT));
}

export function resetPomodoroSettings() {
  savePomodoroSettings(DEFAULT_POMODORO_SETTINGS);
}
