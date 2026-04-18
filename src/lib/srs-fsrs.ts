/**
 * FSRS-6 scheduler (Free Spaced Repetition Scheduler).
 *
 * This is a pragmatic implementation of the FSRS-5/6 family of formulas used by
 * modern Anki, Flashka and similar apps. It tracks per-card `stability` (S) and
 * `difficulty` (D), predicts retrievability R over time, and schedules the next
 * review so that R meets a desired retention target (default 0.9).
 *
 * Design goals:
 * - No extra deps (runs in the browser, localStorage persistence).
 * - Backwards-compatible with legacy SM-2 cards: if a card has no `stability`
 *   we seed FSRS state from its SM-2 history (ease/reps/intervalDays/lapses).
 * - Keeps `state` and `dueAtMs` so the rest of the app (algoStats, dueQueue,
 *   buildStudyBucketsAnkiLike) keeps working unchanged.
 */

import type { SrsCard, SrsRating } from "@/lib/srs";

// --- FSRS-6 default weights (w0..w20) ---------------------------------------
// These are widely-used community defaults; the user can later tune them.
export const FSRS_DEFAULT_WEIGHTS: readonly number[] = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
  0.6567, 0.1542, 0.2,
];

export type FsrsParams = {
  w: readonly number[];
  /** Desired retention when scheduling next interval (0..1). */
  requestRetention: number;
  /** Maximum interval clamp, in days. */
  maximumInterval: number;
};

export function defaultFsrsParams(): FsrsParams {
  return {
    w: FSRS_DEFAULT_WEIGHTS,
    requestRetention: 0.9,
    maximumInterval: 36500, // ~100 years
  };
}

const RATING_TO_G: Record<SrsRating, 1 | 2 | 3 | 4> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // ≈ 19/81 makes R(9S)=0.9

// --- Core math --------------------------------------------------------------

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/** Retrievability R(t, S) with FSRS-6 power-law forgetting curve. */
export function forgettingCurve(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  const t = Math.max(0, elapsedDays);
  return Math.pow(1 + (FACTOR * t) / stability, DECAY);
}

/** Interval in days to reach desired retention DR given stability S. */
function nextIntervalDays(stability: number, requestRetention: number, maxDays: number): number {
  const s = Math.max(0.1, stability);
  const dr = clamp(requestRetention, 0.5, 0.99);
  const raw = (s / FACTOR) * (Math.pow(dr, 1 / DECAY) - 1);
  const rounded = Math.round(Math.max(1, raw));
  return Math.min(rounded, maxDays);
}

function initStability(w: readonly number[], g: 1 | 2 | 3 | 4): number {
  return Math.max(0.1, w[g - 1]);
}

function initDifficulty(w: readonly number[], g: 1 | 2 | 3 | 4): number {
  return clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);
}

function nextDifficulty(w: readonly number[], d: number, g: 1 | 2 | 3 | 4): number {
  const delta = -w[6] * (g - 3);
  const dPrime = d + delta;
  // Mean reversion toward the D for "Easy" on a fresh card.
  const dTarget = initDifficulty(w, 4);
  const dMean = w[7] * dTarget + (1 - w[7]) * dPrime;
  return clamp(dMean, 1, 10);
}

function nextStabilityOnSuccess(
  w: readonly number[],
  d: number,
  s: number,
  r: number,
  g: 2 | 3 | 4,
): number {
  const hardPenalty = g === 2 ? w[15] : 1;
  const easyBonus = g === 4 ? w[16] : 1;
  const factor =
    Math.exp(w[8]) *
    (11 - d) *
    Math.pow(s, -w[9]) *
    (Math.exp(w[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(0.1, s * (1 + factor));
}

function nextStabilityOnLapse(
  w: readonly number[],
  d: number,
  s: number,
  r: number,
): number {
  const sMin = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.max(0.1, Math.min(sMin, s));
}

// --- Migration from legacy SM-2 --------------------------------------------

/**
 * Seed FSRS-6 state (stability/difficulty) from legacy SM-2 fields the first
 * time a card is reviewed under the new scheduler. The mapping is intentionally
 * conservative so that users don't see huge interval jumps.
 */
function seedFromLegacy(card: SrsCard, w: readonly number[]): { stability: number; difficulty: number } {
  const reps = typeof card.reps === "number" && Number.isFinite(card.reps) ? card.reps : 0;
  const interval = typeof card.intervalDays === "number" && Number.isFinite(card.intervalDays) ? card.intervalDays : 0;
  const lapses = typeof card.lapses === "number" && Number.isFinite(card.lapses) ? card.lapses : 0;

  if (reps <= 0 && interval <= 0) {
    return { stability: initStability(w, 3), difficulty: initDifficulty(w, 3) };
  }

  // A SM-2 interval roughly corresponds to stability such that R(interval, S)=0.9.
  // Since 9*S*(DR^-1 -1) ≈ interval for DR=0.9 → S ≈ interval.
  const stability = Math.max(0.5, interval || 1);

  // Lapses raise difficulty; clamp 1..10.
  const difficulty = clamp(5 + Math.min(lapses, 5) * 0.5, 1, 10);
  return { stability, difficulty };
}

// --- Public API -------------------------------------------------------------

export type FsrsPatch = {
  stability: number;
  difficulty: number;
  lastReviewMs: number;
  scheduledDays: number;
  intervalDays: number;
  dueAtMs: number;
  state: "learning" | "due";
  reps: number;
  lapses: number;
};

/**
 * Apply an FSRS-6 review, returning the patch fields to merge into the card.
 * Also updates `reps`/`lapses`/`intervalDays` so legacy UI keeps working.
 */
export function applyFsrsReview(
  card: SrsCard,
  rating: SrsRating,
  now: number = Date.now(),
  params: FsrsParams = defaultFsrsParams(),
): FsrsPatch {
  const w = params.w;
  const g = RATING_TO_G[rating];

  // Determine prior FSRS state (seed from legacy if missing).
  let S: number;
  let D: number;
  const isFirstFsrsReview =
    typeof card.stability !== "number" || !Number.isFinite(card.stability) ||
    typeof card.difficulty !== "number" || !Number.isFinite(card.difficulty);

  if (isFirstFsrsReview) {
    if (!card.reps || card.reps <= 0) {
      // Truly new card — initialize from the rating itself.
      S = initStability(w, g);
      D = initDifficulty(w, g);
    } else {
      const seed = seedFromLegacy(card, w);
      S = seed.stability;
      D = seed.difficulty;
    }
  } else {
    S = card.stability as number;
    D = card.difficulty as number;
  }

  // Elapsed time since last review.
  const lastMs = typeof card.lastReviewMs === "number" && Number.isFinite(card.lastReviewMs)
    ? card.lastReviewMs
    : now;
  const elapsedDays = Math.max(0, (now - lastMs) / 86400000);
  const R = forgettingCurve(elapsedDays, S);

  // New difficulty.
  const newD = nextDifficulty(w, D, g);

  // New stability and scheduling.
  let newS: number;
  let nextState: "learning" | "due";
  let reps = (card.reps ?? 0);
  let lapses = (card.lapses ?? 0);
  let intervalDays: number;
  let dueAtMs: number;
  let scheduledDays: number;

  if (g === 1) {
    // Lapse — short learning step (10 min) + reduced stability.
    newS = nextStabilityOnLapse(w, D, S, R);
    lapses += 1;
    reps = 0;
    intervalDays = 0;
    scheduledDays = 0;
    dueAtMs = now + 10 * 60 * 1000;
    nextState = "learning";
  } else {
    newS = isFirstFsrsReview && (!card.reps || card.reps <= 0)
      ? S // on the very first review, keep the init stability as-is
      : nextStabilityOnSuccess(w, D, S, R, g);
    reps += 1;
    const days = nextIntervalDays(newS, params.requestRetention, params.maximumInterval);
    intervalDays = days;
    scheduledDays = days;
    dueAtMs = now + days * 86400000;
    nextState = "due";
  }

  return {
    stability: newS,
    difficulty: newD,
    lastReviewMs: now,
    scheduledDays,
    intervalDays,
    dueAtMs,
    state: nextState,
    reps,
    lapses,
  };
}

/**
 * Predict current retrievability (0..1) for a card. Useful for prioritising
 * the "Today plan" (Laxu-style): lowest retention first.
 */
export function predictRetention(card: SrsCard, now: number = Date.now()): number {
  const s = typeof card.stability === "number" && Number.isFinite(card.stability) ? card.stability : 0;
  if (s <= 0) {
    // New / unseen card — treat as maximally forgotten to prioritise it.
    return card.state === "new" ? 0 : 0.5;
  }
  const last = typeof card.lastReviewMs === "number" && Number.isFinite(card.lastReviewMs)
    ? card.lastReviewMs
    : now;
  const elapsedDays = Math.max(0, (now - last) / 86400000);
  return forgettingCurve(elapsedDays, s);
}
