import type { SrsCard, SrsRating } from "@/lib/srs";

export type SrsAlgoStats = {
  total: number;
  dueToday: number;
  learning: number;
  newCount: number;
};

export type SrsDailyLimits = {
  newLimit: number;
  reviewLimit: number;
  learningLimit: number;
};

export type SrsStudyBuckets = {
  learning: SrsCard[];
  review: SrsCard[];
  newCards: SrsCard[];
};

function startOfTodayMs(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfTodayMs(now = Date.now()) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function normalizeCardForAlgo(c: SrsCard, now = Date.now()): SrsCard {
  const ease = typeof c.ease === "number" && Number.isFinite(c.ease) ? c.ease : 2.5;
  const reps = typeof c.reps === "number" && Number.isFinite(c.reps) ? c.reps : 0;
  const lapses = typeof c.lapses === "number" && Number.isFinite(c.lapses) ? c.lapses : 0;
  const intervalDays =
    typeof c.intervalDays === "number" && Number.isFinite(c.intervalDays) ? c.intervalDays : 0;

  const dueAtMs =
    typeof c.dueAtMs === "number" && Number.isFinite(c.dueAtMs) ? c.dueAtMs : now;

  const state = c.state ?? "new";

  return {
    ...c,
    ease,
    reps,
    lapses,
    intervalDays,
    dueAtMs,
    state,
  };
}

export function algoStats(cards: SrsCard[], now = Date.now()): SrsAlgoStats {
  const s = startOfTodayMs(now);
  const e = endOfTodayMs(now);
  let dueToday = 0;
  let learning = 0;
  let newCount = 0;

  for (const raw of cards) {
    const c = normalizeCardForAlgo(raw, now);
    if (c.state === "new") newCount++;
    if (c.state === "learning") learning++;
    if (c.dueAtMs !== undefined && c.dueAtMs >= s && c.dueAtMs <= e) dueToday++;
  }

  return { total: cards.length, dueToday, learning, newCount };
}

export function dueQueue(cards: SrsCard[], now = Date.now()): SrsCard[] {
  const e = endOfTodayMs(now);
  return cards
    .map((c) => normalizeCardForAlgo(c, now))
    .filter((c) => (c.dueAtMs ?? now) <= e)
    .sort((a, b) => (a.dueAtMs ?? now) - (b.dueAtMs ?? now));
}

function clampLimit(n: number, fallback: number) {
  const x = Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(0, Math.min(9999, x));
}

export function normalizeDailyLimits(input?: Partial<SrsDailyLimits>): SrsDailyLimits {
  return {
    newLimit: clampLimit(input?.newLimit ?? 20, 20),
    reviewLimit: clampLimit(input?.reviewLimit ?? 200, 200),
    learningLimit: clampLimit(input?.learningLimit ?? 100, 100),
  };
}

export function burySiblingsByNoteId(cards: SrsCard[]): SrsCard[] {
  const seen = new Set<string>();
  const out: SrsCard[] = [];
  for (const c of cards) {
    const key = c.noteId ?? `note_${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export function buildStudyBucketsAnkiLike(
  cards: SrsCard[],
  limits?: Partial<SrsDailyLimits>,
  now = Date.now(),
): SrsStudyBuckets {
  const l = normalizeDailyLimits(limits);
  const eod = endOfTodayMs(now);

  const normalized = cards.map((c) => normalizeCardForAlgo(c, now));

  const learningAll = normalized
    .filter((c) => c.state === "learning" && (c.dueAtMs ?? now) <= now)
    .sort((a, b) => (a.dueAtMs ?? now) - (b.dueAtMs ?? now));

  const reviewAll = normalized
    .filter((c) => c.state === "due" && (c.dueAtMs ?? now) <= eod)
    .sort((a, b) => (a.dueAtMs ?? now) - (b.dueAtMs ?? now));

  const newAll = normalized.filter((c) => c.state === "new");

  const learning = learningAll.slice(0, l.learningLimit);
  const review = reviewAll.slice(0, l.reviewLimit);
  const newCards = newAll.slice(0, l.newLimit);

  return {
    learning: burySiblingsByNoteId(learning),
    review: burySiblingsByNoteId(review),
    newCards: burySiblingsByNoteId(newCards),
  };
}

export function buildStudyQueueAnkiLike(
  cards: SrsCard[],
  limits?: Partial<SrsDailyLimits>,
  now = Date.now(),
): SrsCard[] {
  const b = buildStudyBucketsAnkiLike(cards, limits, now);
  return burySiblingsByNoteId([...b.learning, ...b.review, ...b.newCards]);
}

export function applySm2Review(
  raw: SrsCard,
  rating: SrsRating,
  now = Date.now(),
): SrsCard {
  const c = normalizeCardForAlgo(raw, now);

  const quality: Record<SrsRating, number> = {
    again: 0,
    hard: 3,
    good: 4,
    easy: 5,
  };

  const q = quality[rating];
  let ease = c.ease ?? 2.5;
  let reps = c.reps ?? 0;
  let lapses = c.lapses ?? 0;
  let intervalDays = c.intervalDays ?? 0;

  if (q < 3) {
    reps = 0;
    lapses += 1;
    intervalDays = 0;
    return {
      ...c,
      state: "learning",
      reps,
      lapses,
      ease: Math.max(1.3, ease - 0.2),
      intervalDays,
      dueAtMs: now + 10 * 60 * 1000,
    };
  }

  reps += 1;

  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (reps === 1) intervalDays = 1;
  else if (reps === 2) intervalDays = 6;
  else intervalDays = Math.round(Math.max(1, intervalDays * ease));

  const extra = rating === "easy" ? 1 : rating === "hard" ? -1 : 0;
  intervalDays = Math.max(1, intervalDays + extra);

  const dueAtMs = now + intervalDays * 24 * 60 * 60 * 1000;

  return {
    ...c,
    state: "due",
    reps,
    ease,
    intervalDays,
    dueAtMs,
  };
}
