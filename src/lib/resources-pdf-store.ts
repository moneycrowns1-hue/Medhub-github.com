export type PdfResource = {
  id: string;
  title: string;
  createdAtMs: number;
  pageStart: number;
  pageEnd: number;
  sizeBytes: number;
  subjectSlug?: string;
};

type PdfResourceRecord = PdfResource & { blob: Blob };

type Db = IDBDatabase;

const DB_NAME = "somagnus_resources";
const DB_VERSION = 1;
const STORE = "pdfs";
export const RESOURCES_UPDATED_EVENT = "somagnus:resources:updated";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDb(): Promise<Db> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function listPdfResources(): Promise<PdfResource[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const req = store.getAll();
  const all = (await reqToPromise(req)) as PdfResourceRecord[];
  await txDone(tx);
  return all
    .map(({ blob: _blob, ...meta }) => meta)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function putPdfResource(input: {
  title: string;
  blob: Blob;
  pageStart?: number;
  pageEnd?: number;
  subjectSlug?: string;
}): Promise<PdfResource> {
  const db = await openDb();
  const id = uid("pdf");

  const pageStart = Math.max(1, Math.floor(input.pageStart ?? 1));
  const pageEnd = Math.max(pageStart, Math.floor(input.pageEnd ?? pageStart));

  const rec: PdfResourceRecord = {
    id,
    title: input.title,
    createdAtMs: Date.now(),
    pageStart,
    pageEnd,
    sizeBytes: input.blob.size,
    subjectSlug: input.subjectSlug,
    blob: input.blob,
  };

  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(rec);
  await txDone(tx);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RESOURCES_UPDATED_EVENT));
  }
  return {
    id: rec.id,
    title: rec.title,
    createdAtMs: rec.createdAtMs,
    pageStart: rec.pageStart,
    pageEnd: rec.pageEnd,
    sizeBytes: rec.sizeBytes,
    subjectSlug: rec.subjectSlug,
  };
}

export async function getPdfResourceBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const rec = (await reqToPromise(store.get(id))) as PdfResourceRecord | undefined;
  await txDone(tx);
  return rec?.blob ?? null;
}

export async function updatePdfResourceMeta(
  id: string,
  patch: Partial<Pick<PdfResource, "title" | "pageStart" | "pageEnd" | "subjectSlug">>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const rec = (await reqToPromise(store.get(id))) as PdfResourceRecord | undefined;
  if (!rec) {
    await txDone(tx);
    return;
  }

  const next: PdfResourceRecord = {
    ...rec,
    title: typeof patch.title === "string" ? patch.title : rec.title,
    subjectSlug: typeof patch.subjectSlug === "string" ? patch.subjectSlug : rec.subjectSlug,
    pageStart:
      typeof patch.pageStart === "number" && Number.isFinite(patch.pageStart)
        ? Math.max(1, Math.floor(patch.pageStart))
        : rec.pageStart,
    pageEnd:
      typeof patch.pageEnd === "number" && Number.isFinite(patch.pageEnd)
        ? Math.max(1, Math.floor(patch.pageEnd))
        : rec.pageEnd,
  };
  if (next.pageEnd < next.pageStart) next.pageEnd = next.pageStart;

  store.put(next);
  await txDone(tx);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RESOURCES_UPDATED_EVENT));
  }
}

export async function deletePdfResource(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RESOURCES_UPDATED_EVENT));
  }
}
