import type { ResourceAnnotation, ResourceBookmark } from "@/lib/resources-domain";

export type ResourceReaderNote = ResourceAnnotation & {
  type: "note";
  payload: { text: string };
};

export type ResourceReaderArtifactsExport = {
  version: 1;
  documentId: string;
  exportedAtMs: number;
  bookmarks: Array<{ page: number; label?: string }>;
  notes: Array<{ page: number; text: string }>;
};

type ReaderStoreShape = {
  bookmarks: Record<string, ResourceBookmark[]>;
  notes: Record<string, ResourceReaderNote[]>;
};

const STORAGE_KEY = "somagnus:resources:reader:v1";
export const RESOURCES_READER_UPDATED_EVENT = "somagnus:resources:reader:updated";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function emitUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESOURCES_READER_UPDATED_EVENT));
}

function loadStore(): ReaderStoreShape {
  if (typeof window === "undefined") {
    return { bookmarks: {}, notes: {} };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bookmarks: {}, notes: {} };
    const parsed = JSON.parse(raw) as Partial<ReaderStoreShape>;
    return {
      bookmarks: parsed.bookmarks ?? {},
      notes: parsed.notes ?? {},
    };
  } catch {
    return { bookmarks: {}, notes: {} };
  }
}

function saveStore(store: ReaderStoreShape) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function listReaderBookmarks(documentId: string): ResourceBookmark[] {
  const store = loadStore();
  return [...(store.bookmarks[documentId] ?? [])].sort((a, b) => a.page - b.page);
}

export function addReaderBookmark(input: { documentId: string; page: number; label?: string }): ResourceBookmark {
  const store = loadStore();
  const page = Math.max(1, Math.floor(input.page));
  const now = Date.now();
  const list = [...(store.bookmarks[input.documentId] ?? [])];

  const existing = list.find((b) => b.page === page);
  if (existing) {
    const next: ResourceBookmark = {
      ...existing,
      label: input.label === undefined ? existing.label : input.label.trim() || undefined,
      updatedAtMs: now,
    };
    store.bookmarks[input.documentId] = list.map((b) => (b.id === existing.id ? next : b));
    saveStore(store);
    emitUpdated();
    return next;
  }

  const created: ResourceBookmark = {
    id: uid("rbm"),
    documentId: input.documentId,
    page,
    label: input.label?.trim() || undefined,
    createdAtMs: now,
    updatedAtMs: now,
  };

  store.bookmarks[input.documentId] = [...list, created];
  saveStore(store);
  emitUpdated();
  return created;
}

export function deleteReaderBookmark(documentId: string, bookmarkId: string) {
  const store = loadStore();
  const list = store.bookmarks[documentId] ?? [];
  const next = list.filter((b) => b.id !== bookmarkId);
  store.bookmarks[documentId] = next;
  saveStore(store);
  emitUpdated();
}

export function updateReaderBookmarkLabel(input: { documentId: string; bookmarkId: string; label: string }): ResourceBookmark | null {
  const store = loadStore();
  const list = store.bookmarks[input.documentId] ?? [];
  const target = list.find((b) => b.id === input.bookmarkId);
  if (!target) return null;

  const next: ResourceBookmark = {
    ...target,
    label: input.label.trim() || undefined,
    updatedAtMs: Date.now(),
  };

  store.bookmarks[input.documentId] = list.map((b) => (b.id === input.bookmarkId ? next : b));
  saveStore(store);
  emitUpdated();
  return next;
}

export function listReaderNotes(documentId: string): ResourceReaderNote[] {
  const store = loadStore();
  return [...(store.notes[documentId] ?? [])].sort((a, b) => a.page - b.page);
}

export function upsertReaderNote(input: { documentId: string; page: number; text: string }): ResourceReaderNote {
  const store = loadStore();
  const now = Date.now();
  const page = Math.max(1, Math.floor(input.page));
  const text = input.text.trim();
  const list = [...(store.notes[input.documentId] ?? [])];

  const existing = list.find((n) => n.page === page);
  if (existing) {
    const next: ResourceReaderNote = {
      ...existing,
      payload: { text },
      updatedAtMs: now,
    };
    store.notes[input.documentId] = list.map((n) => (n.id === existing.id ? next : n));
    saveStore(store);
    emitUpdated();
    return next;
  }

  const created: ResourceReaderNote = {
    id: uid("rnt"),
    documentId: input.documentId,
    page,
    type: "note",
    payload: { text },
    createdAtMs: now,
    updatedAtMs: now,
  };

  store.notes[input.documentId] = [...list, created];
  saveStore(store);
  emitUpdated();
  return created;
}

export function deleteReaderNote(documentId: string, noteId: string) {
  const store = loadStore();
  const list = store.notes[documentId] ?? [];
  const next = list.filter((n) => n.id !== noteId);
  store.notes[documentId] = next;
  saveStore(store);
  emitUpdated();
}

export function exportReaderArtifacts(documentId: string): ResourceReaderArtifactsExport {
  const bookmarks = listReaderBookmarks(documentId);
  const notes = listReaderNotes(documentId);
  return {
    version: 1,
    documentId,
    exportedAtMs: Date.now(),
    bookmarks: bookmarks.map((b) => ({ page: b.page, label: b.label })),
    notes: notes.map((n) => ({ page: n.page, text: n.payload.text })),
  };
}

export function importReaderArtifacts(input: {
  documentId: string;
  data: unknown;
  mode?: "merge" | "replace";
}): { bookmarks: number; notes: number } {
  const mode = input.mode ?? "merge";
  const source = input.data as Partial<ResourceReaderArtifactsExport>;
  const bookmarkRows = Array.isArray(source?.bookmarks) ? source.bookmarks : [];
  const noteRows = Array.isArray(source?.notes) ? source.notes : [];

  const bookmarks = bookmarkRows
    .map((row) => ({
      page: Math.max(1, Math.floor(Number((row as { page?: unknown }).page ?? 1))),
      label: typeof (row as { label?: unknown }).label === "string" ? (row as { label: string }).label.trim() || undefined : undefined,
    }))
    .filter((row) => Number.isFinite(row.page));

  const notes = noteRows
    .map((row) => ({
      page: Math.max(1, Math.floor(Number((row as { page?: unknown }).page ?? 1))),
      text: typeof (row as { text?: unknown }).text === "string" ? (row as { text: string }).text.trim() : "",
    }))
    .filter((row) => Number.isFinite(row.page) && row.text.length > 0);

  const store = loadStore();
  const now = Date.now();
  const currentBookmarks = mode === "replace" ? [] : [...(store.bookmarks[input.documentId] ?? [])];
  const currentNotes = mode === "replace" ? [] : [...(store.notes[input.documentId] ?? [])];

  const bookmarkByPage = new Map<number, ResourceBookmark>();
  for (const b of currentBookmarks) bookmarkByPage.set(b.page, b);
  for (const row of bookmarks) {
    const prev = bookmarkByPage.get(row.page);
    bookmarkByPage.set(row.page, {
      id: prev?.id ?? uid("rbm"),
      documentId: input.documentId,
      page: row.page,
      label: row.label,
      createdAtMs: prev?.createdAtMs ?? now,
      updatedAtMs: now,
    });
  }

  const noteByPage = new Map<number, ResourceReaderNote>();
  for (const n of currentNotes) noteByPage.set(n.page, n);
  for (const row of notes) {
    const prev = noteByPage.get(row.page);
    noteByPage.set(row.page, {
      id: prev?.id ?? uid("rnt"),
      documentId: input.documentId,
      page: row.page,
      type: "note",
      payload: { text: row.text },
      createdAtMs: prev?.createdAtMs ?? now,
      updatedAtMs: now,
    });
  }

  store.bookmarks[input.documentId] = [...bookmarkByPage.values()].sort((a, b) => a.page - b.page);
  store.notes[input.documentId] = [...noteByPage.values()].sort((a, b) => a.page - b.page);
  saveStore(store);
  emitUpdated();

  return {
    bookmarks: store.bookmarks[input.documentId].length,
    notes: store.notes[input.documentId].length,
  };
}
