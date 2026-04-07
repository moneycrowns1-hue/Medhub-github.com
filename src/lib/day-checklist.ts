/**
 * Persistent daily routine checklist.
 * Stores checked step IDs per ISO date in localStorage.
 */

import { isoDate } from "@/lib/dates";

const STORAGE_KEY = "somagnus:day-checklist:v1";

export type RoutineStep = {
  id: string;
  label: string;
  time: string;
  icon?: string;
};

export const ROUTINE_STEPS: RoutineStep[] = [
  { id: "srs", label: "Flashcards (SRS)", time: "20 min" },
  { id: "focus1", label: "Bloque 1 — enfoque profundo", time: "2 h" },
  { id: "break1", label: "Descanso activo", time: "15 min" },
  { id: "focus2", label: "Bloque 2 — enfoque profundo", time: "2 h" },
  { id: "break2", label: "Descanso activo", time: "15 min" },
  { id: "focus3", label: "Bloque 3 — repaso activo / espaciado", time: "1 h" },
  { id: "exercise", label: "Entrenamiento / trote", time: "45 min" },
  { id: "reading", label: "Lectura enfocada", time: "30 min" },
  { id: "wind-down", label: "Repaso suave + dormir", time: "" },
];

type Store = Record<string, string[]>; // date -> checked step ids

function loadStore(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function saveStore(store: Store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded - ignore
  }
}

export function getCheckedSteps(date: Date = new Date()): Set<string> {
  const store = loadStore();
  const key = isoDate(date);
  return new Set(store[key] ?? []);
}

export function toggleStep(stepId: string, date: Date = new Date()): Set<string> {
  const store = loadStore();
  const key = isoDate(date);
  const current = new Set(store[key] ?? []);
  if (current.has(stepId)) {
    current.delete(stepId);
  } else {
    current.add(stepId);
  }
  store[key] = [...current];
  saveStore(store);
  return current;
}

export function isRoutineComplete(checked: Set<string>): boolean {
  return ROUTINE_STEPS.every((s) => checked.has(s.id));
}

export function routineProgress(checked: Set<string>): { done: number; total: number; pct: number } {
  const total = ROUTINE_STEPS.length;
  const done = ROUTINE_STEPS.filter((s) => checked.has(s.id)).length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}
