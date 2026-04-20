import {
  SPACE_THEME_STORAGE_KEY,
  type SpaceMode,
  type SpacePreference,
} from "./space-theme-tokens";

const NIGHT_START_HOUR = 19; // 19:00
const NIGHT_END_HOUR = 7; // 07:00

export function isNightHour(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export function readSpacePreference(): SpacePreference {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(SPACE_THEME_STORAGE_KEY);
    if (raw === "day" || raw === "night" || raw === "auto") return raw;
    return "auto";
  } catch {
    return "auto";
  }
}

export function writeSpacePreference(pref: SpacePreference): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPACE_THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function resolveSpaceMode(pref: SpacePreference, now: Date = new Date()): SpaceMode {
  if (pref === "day") return "day";
  if (pref === "night") return "night";
  return isNightHour(now.getHours()) ? "night" : "day";
}
