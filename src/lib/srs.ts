export type SrsRating = "again" | "hard" | "good" | "easy";

export type SrsCardType = "basic" | "cloze" | "image_occlusion";

export type SrsCardState = "new" | "learning" | "due";

export type SrsImageOcclusion = {
  imageUrl: string;
  box: { x: number; y: number; w: number; h: number }; // percentages 0-100
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
  intervalDays?: number;
  ease?: number;
  reps?: number;
  lapses?: number;
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

export function normalizeIo(io: SrsImageOcclusion): SrsImageOcclusion {
  return {
    imageUrl: io.imageUrl,
    box: {
      x: clampPct(io.box.x),
      y: clampPct(io.box.y),
      w: clampPct(io.box.w),
      h: clampPct(io.box.h),
    },
  };
}

export function isCloze(text: string) {
  return /\{\{c\d+::/.test(text);
}

export function inferCardType(front: string, back: string, hasIo: boolean): SrsCardType {
  if (hasIo) return "image_occlusion";
  if (isCloze(front) || isCloze(back)) return "cloze";
  return "basic";
}
