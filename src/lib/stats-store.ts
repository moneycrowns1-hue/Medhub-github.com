/**
 * Study statistics store using localStorage.
 * Tracks daily study sessions, SRS reviews, and streaks.
 */

import { isoDate } from "@/lib/dates";

const STORAGE_KEY = "somagnus:stats:v1";
export const STATS_UPDATED_EVENT = "somagnus:stats:updated";

export type DailyStats = {
  date: string; // ISO YYYY-MM-DD
  focusMinutes: number;
  srsReviewed: number;
  srsCorrect: number;
  srsNew: number;
  pdfPages: number;
  routineCompleted: boolean;
  blocksCompleted: number;
};

type StatsStore = {
  days: Record<string, DailyStats>;
};

function load(): StatsStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { days: {} };
    return JSON.parse(raw) as StatsStore;
  } catch {
    return { days: {} };
  }
}

function save(store: StatsStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(STATS_UPDATED_EVENT));
  } catch {
    // quota
  }
}

function emptyDay(date: string): DailyStats {
  return {
    date,
    focusMinutes: 0,
    srsReviewed: 0,
    srsCorrect: 0,
    srsNew: 0,
    pdfPages: 0,
    routineCompleted: false,
    blocksCompleted: 0,
  };
}

export function getTodayStats(): DailyStats {
  const store = load();
  const today = isoDate(new Date());
  return store.days[today] ?? emptyDay(today);
}

export function updateTodayStats(patch: Partial<Omit<DailyStats, "date">>): DailyStats {
  const store = load();
  const today = isoDate(new Date());
  const current = store.days[today] ?? emptyDay(today);
  const updated = { ...current, ...patch };
  store.days[today] = updated;
  save(store);
  return updated;
}

export function incrementStat(key: "focusMinutes" | "srsReviewed" | "srsCorrect" | "srsNew" | "pdfPages" | "blocksCompleted", amount = 1): void {
  const store = load();
  const today = isoDate(new Date());
  const current = store.days[today] ?? emptyDay(today);
  (current[key] as number) += amount;
  store.days[today] = current;
  save(store);
}

export function getAllDailyStats(): DailyStats[] {
  const store = load();
  return Object.values(store.days).sort((a, b) => a.date.localeCompare(b.date));
}

export function getLast30Days(): DailyStats[] {
  const store = load();
  const result: DailyStats[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    result.push(store.days[key] ?? emptyDay(key));
  }
  return result;
}

export function getCurrentStreak(): number {
  const store = load();
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    const day = store.days[key];
    if (day && (day.focusMinutes > 0 || day.srsReviewed > 0 || day.routineCompleted)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export function getWeeklyAverage(): { focusMin: number; srsCards: number } {
  const store = load();
  let totalFocus = 0;
  let totalSrs = 0;
  let count = 0;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    const day = store.days[key];
    if (day) {
      totalFocus += day.focusMinutes;
      totalSrs += day.srsReviewed;
      count++;
    }
  }
  return {
    focusMin: count > 0 ? Math.round(totalFocus / count) : 0,
    srsCards: count > 0 ? Math.round(totalSrs / count) : 0,
  };
}

export function getCalendarData(year: number, month: number): { date: string; level: number }[] {
  const store = load();
  const result: { date: string; level: number }[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const day = store.days[dateStr];
    let level = 0;
    if (day) {
      const score = day.focusMinutes + day.srsReviewed * 2;
      if (score > 120) level = 4;
      else if (score > 60) level = 3;
      else if (score > 20) level = 2;
      else if (score > 0) level = 1;
    }
    result.push({ date: dateStr, level });
  }
  return result;
}
