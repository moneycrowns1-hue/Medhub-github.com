import { inferCardType, normalizeIo, type SrsCard, type SrsDeck, type SrsLibrary } from "@/lib/srs";
import { applySm2Review } from "@/lib/srs-algo";

const STORAGE_KEY = "somagnus:srs:library:v1";
export const SRS_UPDATED_EVENT = "somagnus:srs:updated";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export type AiFlashcardDraft = {
  type: "basic" | "cloze";
  front: string;
  back: string;
  tags?: string[];
};

export type AiNoteDraft = {
  title?: string;
  tags?: string[];
  cards: AiFlashcardDraft[];
};

function normalizeSubjectSlug(slug: string): string {
  if (slug === "histology") return "histologia";
  if (slug === "anatomy") return "anatomia";
  if (slug === "cell-biology") return "biologia-celular";
  return slug;
}

function migrateCard(c: SrsCard): SrsCard {
  const noteId = c.noteId && c.noteId.trim() ? c.noteId : `note_${c.id}`;
  const templateKey = c.templateKey && c.templateKey.trim() ? c.templateKey : c.type;
  return { ...c, noteId, templateKey, subjectSlug: normalizeSubjectSlug(c.subjectSlug) };
}

function migrateDeck(d: SrsDeck): SrsDeck {
  return { ...d, subjectSlug: normalizeSubjectSlug(d.subjectSlug) };
}

export function addDeck(
  lib: SrsLibrary,
  input: { name: string; subjectSlug: string; description?: string },
): SrsLibrary {
  const deck: SrsDeck = {
    id: uid("deck"),
    name: input.name,
    subjectSlug: input.subjectSlug,
    description: input.description,
  };
  return { ...lib, decks: [deck, ...lib.decks] };
}

export function updateDeck(
  lib: SrsLibrary,
  deckId: string,
  patch: Partial<Omit<SrsDeck, "id">>,
): SrsLibrary {
  return {
    ...lib,
    decks: lib.decks.map((d) => (d.id === deckId ? { ...d, ...patch } : d)),
  };
}

export function deleteDeck(lib: SrsLibrary, deckId: string): SrsLibrary {
  return {
    ...lib,
    decks: lib.decks.filter((d) => d.id !== deckId),
    cards: lib.cards.filter((c) => c.deckId !== deckId),
  };
}

export function addBasicOrClozeCard(
  lib: SrsLibrary,
  input: {
    deckId: string;
    subjectSlug: string;
    front: string;
    back: string;
    tags?: string[];
  },
): SrsLibrary {
  const type = inferCardType(input.front, input.back, false);
  const noteId = uid("note");
  const card: SrsCard = {
    id: uid("card"),
    noteId,
    templateKey: type,
    type,
    deckId: input.deckId,
    subjectSlug: input.subjectSlug,
    front: input.front,
    back: input.back,
    tags: input.tags,
  };
  return { ...lib, cards: [card, ...lib.cards] };
}

export function updateCard(
  lib: SrsLibrary,
  cardId: string,
  patch: Partial<Omit<SrsCard, "id">>,
): SrsLibrary {
  return {
    ...lib,
    cards: lib.cards.map((c) => (c.id === cardId ? ({ ...c, ...patch } as SrsCard) : c)),
  };
}

export function deleteCard(lib: SrsLibrary, cardId: string): SrsLibrary {
  return { ...lib, cards: lib.cards.filter((c) => c.id !== cardId) };
}

export function applyReview(
  lib: SrsLibrary,
  cardId: string,
  rating: "again" | "hard" | "good" | "easy",
): SrsLibrary {
  const target = lib.cards.find((c) => c.id === cardId);
  if (!target) return lib;
  const updated = applySm2Review(target, rating);
  return updateCard(lib, cardId, updated);
}

export function defaultSrsLibrary(): SrsLibrary {
  const decks: SrsDeck[] = [
    {
      id: "deck-histo",
      name: "Histología — Básico",
      subjectSlug: "histologia",
      description: "Tejidos + definiciones",
    },
    {
      id: "deck-anato",
      name: "Anatomía — Básico",
      subjectSlug: "anatomia",
      description: "Estructuras + función",
    },
    {
      id: "deck-biocel",
      name: "Biología Celular — Básico",
      subjectSlug: "biologia-celular",
      description: "Conceptos esenciales",
    },
    {
      id: "deck-io",
      name: "Image Occlusion — MVP",
      subjectSlug: "histologia",
      description: "Tarjetas con máscara sobre imagen",
    },
  ];

  const cards: SrsCard[] = [
    {
      id: "histo-1",
      noteId: "note_histo-1",
      templateKey: "basic",
      type: "basic",
      subjectSlug: "histologia",
      deckId: "deck-histo",
      front: "¿Qué es el epitelio simple plano?",
      back: "Una sola capa de células planas; facilita difusión/filtración.",
      tags: ["Histología"],
    },
    {
      id: "histo-cloze-1",
      noteId: "note_histo-cloze-1",
      templateKey: "cloze",
      type: "cloze",
      subjectSlug: "histologia",
      deckId: "deck-histo",
      front: "El tejido conectivo tiene {{c1::matriz extracelular}} abundante.",
      back: "Claves: fibras (colágeno/elásticas/reticulares) + sustancia fundamental.",
      tags: ["Histología", "Cloze"],
    },
    {
      id: "anato-1",
      noteId: "note_anato-1",
      templateKey: "basic",
      type: "basic",
      subjectSlug: "anatomia",
      deckId: "deck-anato",
      front: "¿Función principal del ligamento cruzado anterior (LCA)?",
      back: "Evita el desplazamiento anterior de la tibia y controla rotación.",
      tags: ["Anatomía"],
    },
    {
      id: "bio-1",
      noteId: "note_bio-1",
      templateKey: "basic",
      type: "basic",
      subjectSlug: "biologia-celular",
      deckId: "deck-biocel",
      front: "¿Qué hace la bomba Na+/K+ ATPasa?",
      back: "3 Na+ salen y 2 K+ entran por ATP; mantiene potencial de membrana.",
      tags: ["Biocel"],
    },
    {
      id: "io-1",
      noteId: "note_io-1",
      templateKey: "image_occlusion",
      type: "image_occlusion",
      subjectSlug: "histologia",
      deckId: "deck-io",
      front: "Identificá la estructura marcada.",
      back: "Respuesta: epitelio (ejemplo)",
      tags: ["IO", "Histología"],
      io: {
        imageUrl:
          "https://images.unsplash.com/photo-1582719478185-2a67a89b07c8?auto=format&fit=crop&w=1200&q=60",
        box: { x: 35, y: 32, w: 24, h: 18 },
      },
    },
  ];

  return { decks, cards };
}

export function loadSrsLibrary(): SrsLibrary {
  if (typeof window === "undefined") return defaultSrsLibrary();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSrsLibrary();
    const parsed = JSON.parse(raw) as SrsLibrary;
    if (!parsed || !Array.isArray(parsed.decks) || !Array.isArray(parsed.cards)) {
      return defaultSrsLibrary();
    }
    return {
      ...parsed,
      decks: parsed.decks.map(migrateDeck),
      cards: parsed.cards.map(migrateCard),
    };
  } catch {
    return defaultSrsLibrary();
  }
}

export function saveSrsLibrary(lib: SrsLibrary) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
  window.dispatchEvent(new Event(SRS_UPDATED_EVENT));
}

export function addImageOcclusionCard(
  lib: SrsLibrary,
  input: {
    deckId: string;
    subjectSlug: string;
    front: string;
    back: string;
    imageUrl: string;
    box: { x: number; y: number; w: number; h: number };
    tags?: string[];
  },
): SrsLibrary {
  const noteId = uid("note");
  const card: SrsCard = {
    id: uid("io"),
    noteId,
    templateKey: "image_occlusion",
    type: inferCardType(input.front, input.back, true),
    deckId: input.deckId,
    subjectSlug: input.subjectSlug,
    front: input.front,
    back: input.back,
    tags: input.tags,
    io: normalizeIo({ imageUrl: input.imageUrl, box: input.box }),
  };

  return {
    ...lib,
    cards: [card, ...lib.cards],
  };
}

export function importAiNotesToDeck(
  lib: SrsLibrary,
  input: {
    deckId: string;
    subjectSlug: string;
    notes: AiNoteDraft[];
    defaultTags?: string[];
  },
): SrsLibrary {
  const deckExists = lib.decks.some((d) => d.id === input.deckId);
  if (!deckExists) return lib;

  const defaultTags = (input.defaultTags ?? []).filter((t) => typeof t === "string" && t.trim());

  const nextCards: SrsCard[] = [];

  for (const n of input.notes) {
    const noteId = uid("note");
    const noteTags = Array.isArray(n.tags) ? n.tags.filter((t) => typeof t === "string" && t.trim()) : [];

    for (const c of n.cards ?? []) {
      const front = typeof c.front === "string" ? c.front.trim() : "";
      const back = typeof c.back === "string" ? c.back.trim() : "";
      if (!front || !back) continue;

      const type = c.type === "cloze" ? "cloze" : inferCardType(front, back, false);
      const templateKey = c.type === "cloze" ? "cloze" : "basic";
      const tags = [...defaultTags, ...noteTags, ...(Array.isArray(c.tags) ? c.tags : [])]
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);

      nextCards.push({
        id: uid("card"),
        noteId,
        templateKey,
        type,
        deckId: input.deckId,
        subjectSlug: input.subjectSlug,
        front,
        back,
        tags: tags.length ? Array.from(new Set(tags)) : undefined,
      });
    }
  }

  if (!nextCards.length) return lib;
  return { ...lib, cards: [...nextCards, ...lib.cards] };
}
