import type { AiNoteDraft } from "@/lib/srs-storage";

export type ResourceFlashcardsArtifactPayload = {
  notes: AiNoteDraft[];
  topic?: string;
  maxCards: number;
  language: "es" | "en";
  subjectSlug: string;
};

export type ResourceFlashcardsArtifact = {
  id: string;
  documentId: string;
  type: "flashcards";
  pageStart: number;
  pageEnd: number;
  inputHash: string;
  payload: ResourceFlashcardsArtifactPayload;
  version: number;
  createdAtMs: number;
  updatedAtMs: number;
};

type ArtifactsStoreShape = {
  flashcardsByDocumentId: Record<string, ResourceFlashcardsArtifact[]>;
};

const STORAGE_KEY = "somagnus:resources:ai-artifacts:v1";
export const RESOURCES_AI_ARTIFACTS_UPDATED_EVENT = "somagnus:resources:ai-artifacts:updated";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function loadStore(): ArtifactsStoreShape {
  if (typeof window === "undefined") {
    return { flashcardsByDocumentId: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { flashcardsByDocumentId: {} };
    const parsed = JSON.parse(raw) as Partial<ArtifactsStoreShape>;
    return {
      flashcardsByDocumentId: parsed.flashcardsByDocumentId ?? {},
    };
  } catch {
    return { flashcardsByDocumentId: {} };
  }
}

function saveStore(store: ArtifactsStoreShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function emitUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESOURCES_AI_ARTIFACTS_UPDATED_EVENT));
}

export function hashFlashcardsArtifactInput(input: {
  documentId: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  topic?: string;
  maxCards: number;
  language: "es" | "en";
  subjectSlug: string;
}): string {
  const normalized = JSON.stringify({
    documentId: input.documentId,
    pageStart: Math.max(1, Math.floor(input.pageStart || 1)),
    pageEnd: Math.max(1, Math.floor(input.pageEnd || 1)),
    text: input.text.trim(),
    topic: (input.topic ?? "").trim(),
    maxCards: Math.max(1, Math.floor(input.maxCards || 1)),
    language: input.language,
    subjectSlug: input.subjectSlug,
  });

  let hash = 5381;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

export function listFlashcardsArtifactsForDocument(documentId: string): ResourceFlashcardsArtifact[] {
  const store = loadStore();
  return [...(store.flashcardsByDocumentId[documentId] ?? [])].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export function findFlashcardsArtifact(input: {
  documentId: string;
  pageStart: number;
  pageEnd: number;
  inputHash?: string;
}): ResourceFlashcardsArtifact | null {
  const pageStart = Math.max(1, Math.floor(input.pageStart || 1));
  const pageEnd = Math.max(pageStart, Math.floor(input.pageEnd || pageStart));
  const all = listFlashcardsArtifactsForDocument(input.documentId);

  const candidates = all.filter((artifact) => artifact.pageStart === pageStart && artifact.pageEnd === pageEnd);
  if (!candidates.length) return null;

  if (input.inputHash) {
    return candidates.find((artifact) => artifact.inputHash === input.inputHash) ?? null;
  }

  return candidates[0] ?? null;
}

export function upsertFlashcardsArtifact(input: {
  documentId: string;
  pageStart: number;
  pageEnd: number;
  inputHash: string;
  payload: ResourceFlashcardsArtifactPayload;
}): ResourceFlashcardsArtifact {
  const store = loadStore();
  const now = Date.now();
  const pageStart = Math.max(1, Math.floor(input.pageStart || 1));
  const pageEnd = Math.max(pageStart, Math.floor(input.pageEnd || pageStart));
  const list = [...(store.flashcardsByDocumentId[input.documentId] ?? [])];

  const existing = list.find(
    (artifact) =>
      artifact.type === "flashcards" &&
      artifact.pageStart === pageStart &&
      artifact.pageEnd === pageEnd &&
      artifact.inputHash === input.inputHash,
  );

  const next: ResourceFlashcardsArtifact = existing
    ? {
        ...existing,
        payload: input.payload,
        updatedAtMs: now,
      }
    : {
        id: uid("raf"),
        documentId: input.documentId,
        type: "flashcards",
        pageStart,
        pageEnd,
        inputHash: input.inputHash,
        payload: input.payload,
        version: 1,
        createdAtMs: now,
        updatedAtMs: now,
      };

  const withoutExisting = existing ? list.filter((artifact) => artifact.id !== existing.id) : list;
  store.flashcardsByDocumentId[input.documentId] = [next, ...withoutExisting]
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
    .slice(0, 60);
  saveStore(store);
  emitUpdated();
  return next;
}

export function getFlashcardsArtifactsStats(): {
  totalArtifacts: number;
  totalCards: number;
  totalDocuments: number;
} {
  const store = loadStore();
  const artifacts = Object.values(store.flashcardsByDocumentId).flat();
  const totalCards = artifacts.reduce((sum, artifact) => {
    const notes = Array.isArray(artifact.payload?.notes) ? artifact.payload.notes : [];
    const cardCount = notes.reduce((sub, note) => sub + (Array.isArray(note.cards) ? note.cards.length : 0), 0);
    return sum + cardCount;
  }, 0);

  return {
    totalArtifacts: artifacts.length,
    totalCards,
    totalDocuments: Object.keys(store.flashcardsByDocumentId).filter((id) => (store.flashcardsByDocumentId[id] ?? []).length > 0).length,
  };
}
