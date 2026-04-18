export type SrsRating = "again" | "hard" | "good" | "easy";

export type SrsCardType = "basic" | "cloze" | "image_occlusion";

export type SrsCardState = "new" | "learning" | "due";

export type SrsIoBox = { x: number; y: number; w: number; h: number };

export type SrsImageOcclusion = {
  imageUrl: string;
  /** Legacy single-box occlusion. New cards should use `boxes`. */
  box: SrsIoBox;
  /** Multi-box occlusion (Flashmed-style). Optional to preserve backward compat. */
  boxes?: SrsIoBox[];
};

export type SrsConfidence = 1 | 2 | 3 | 4 | 5;

export type SrsSource = {
  kind: "ai" | "manual" | "import";
  prompt?: string;
};

export type SrsCard = {
  id: string;
  noteId?: string;
  templateKey?: string;
  type: SrsCardType;
  subjectSlug: string;
  deckId: string;
  front: string;
  back: string;
  tags?: string[];
  io?: SrsImageOcclusion;
  state?: SrsCardState;
  dueAtMs?: number;
  // --- Legacy SM-2 fields (kept for migration) ---
  intervalDays?: number;
  ease?: number;
  reps?: number;
  lapses?: number;
  // --- FSRS-6 fields ---
  stability?: number;
  difficulty?: number;
  lastReviewMs?: number;
  scheduledDays?: number;
  // --- Brainscape confidence ---
  confidence?: SrsConfidence;
  // --- Provenance ---
  source?: SrsSource;
};

export type SrsDeck = {
  id: string;
  name: string;
  subjectSlug: string;
  description?: string;
};

export type SrsLibrary = {
  decks: SrsDeck[];
  cards: SrsCard[];
};

export function clampPct(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, x));
}

function clampBox(b: SrsIoBox): SrsIoBox {
  return { x: clampPct(b.x), y: clampPct(b.y), w: clampPct(b.w), h: clampPct(b.h) };
}

export function normalizeIo(io: SrsImageOcclusion): SrsImageOcclusion {
  const out: SrsImageOcclusion = {
    imageUrl: io.imageUrl,
    box: clampBox(io.box),
  };
  if (Array.isArray(io.boxes) && io.boxes.length) {
    out.boxes = io.boxes.map(clampBox);
  }
  return out;
}

export function isCloze(text: string) {
  return /\{\{c\d+::/.test(text);
}

export function inferCardType(front: string, back: string, hasIo: boolean): SrsCardType {
  if (hasIo) return "image_occlusion";
  if (isCloze(front) || isCloze(back)) return "cloze";
  return "basic";
}
