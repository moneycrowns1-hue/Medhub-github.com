import type { SrsCard, SrsRating } from "@/lib/srs";

export type SrsSessionState = {
  deckId: string;
  queue: SrsCard[];
  currentIndex: number;
  revealed: boolean;
  clozeIndex?: number;
  counts: Record<SrsRating, number>;
  done: boolean;
  startedAtMs: number;
};

const STORAGE_KEY = "somagnus:srs:session:v2";

export function freshSession(deckId: string, queue: SrsCard[]): SrsSessionState {
  return {
    deckId,
    queue,
    currentIndex: 0,
    revealed: false,
    clozeIndex: 1,
    counts: { again: 0, hard: 0, good: 0, easy: 0 },
    done: queue.length === 0,
    startedAtMs: Date.now(),
  };
}

export function loadSession(): SrsSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SrsSessionState;
    if (!parsed || !Array.isArray(parsed.queue)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(s: SrsSessionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
