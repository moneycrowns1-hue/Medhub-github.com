export type PdfResource = {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  version: number;
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

export type PdfResourceBackupItem = {
  id: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  version: number;
  pageStart: number;
  pageEnd: number;
  sizeBytes: number;
  subjectSlug?: string;
  blobBase64: string;
  blobType: string;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function normalizeMeta(rec: PdfResourceRecord): PdfResource {
  const createdAtMs = Number.isFinite(rec.createdAtMs) ? Math.floor(rec.createdAtMs) : Date.now();
  const updatedAtMs = Number.isFinite((rec as { updatedAtMs?: number }).updatedAtMs)
    ? Math.max(createdAtMs, Math.floor((rec as { updatedAtMs: number }).updatedAtMs))
    : createdAtMs;
  const versionRaw = Number.isFinite((rec as { version?: number }).version)
    ? Math.floor((rec as { version: number }).version)
    : 1;
  const version = Math.max(1, versionRaw);

  return {
    id: rec.id,
    title: rec.title,
    createdAtMs,
    updatedAtMs,
    version,
    pageStart: Math.max(1, Math.floor(rec.pageStart || 1)),
    pageEnd: Math.max(1, Math.floor(rec.pageEnd || 1)),
    sizeBytes: Math.max(0, Math.floor(rec.sizeBytes || 0)),
    subjectSlug: rec.subjectSlug,
  };
}

function isIncomingNewer(local: PdfResource, incoming: PdfResource): boolean {
  if (incoming.updatedAtMs !== local.updatedAtMs) {
    return incoming.updatedAtMs > local.updatedAtMs;
  }
  return incoming.version > local.version;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
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
    .map((row) => normalizeMeta(row))
    .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
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
    updatedAtMs: Date.now(),
    version: 1,
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
  return normalizeMeta(rec);
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
    updatedAtMs: Date.now(),
    version: Math.max(1, Math.floor(Number((rec as { version?: number }).version ?? 1))) + 1,
  };
  if (next.pageEnd < next.pageStart) next.pageEnd = next.pageStart;

  store.put(next);
  await txDone(tx);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RESOURCES_UPDATED_EVENT));
  }
}

export async function exportPdfResourcesBackup(): Promise<PdfResourceBackupItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const recs = (await reqToPromise(store.getAll())) as PdfResourceRecord[];
  await txDone(tx);

  const out: PdfResourceBackupItem[] = [];
  for (const rec of recs) {
    const meta = normalizeMeta(rec);
    const ab = await rec.blob.arrayBuffer();
    out.push({
      ...meta,
      blobBase64: bytesToBase64(new Uint8Array(ab)),
      blobType: rec.blob.type || "application/pdf",
    });
  }
  return out.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function importPdfResourcesBackup(input: { items: PdfResourceBackupItem[] }): Promise<{ imported: number; skipped: number }> {
  const rows = Array.isArray(input.items) ? input.items : [];
  if (!rows.length) return { imported: 0, skipped: 0 };

  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row?.id || typeof row.title !== "string" || typeof row.blobBase64 !== "string") {
      skipped += 1;
      continue;
    }

    const incomingBytes = base64ToBytes(row.blobBase64);
    const incomingBuffer = new ArrayBuffer(incomingBytes.byteLength);
    new Uint8Array(incomingBuffer).set(incomingBytes);
    const incomingBlob = new Blob([incomingBuffer], { type: row.blobType || "application/pdf" });
    const incomingRecord: PdfResourceRecord = {
      id: row.id,
      title: row.title,
      createdAtMs: Math.max(1, Math.floor(row.createdAtMs || Date.now())),
      updatedAtMs: Math.max(1, Math.floor(row.updatedAtMs || row.createdAtMs || Date.now())),
      version: Math.max(1, Math.floor(row.version || 1)),
      pageStart: Math.max(1, Math.floor(row.pageStart || 1)),
      pageEnd: Math.max(1, Math.floor(row.pageEnd || row.pageStart || 1)),
      sizeBytes: Math.max(0, Math.floor(row.sizeBytes || incomingBlob.size)),
      subjectSlug: row.subjectSlug,
      blob: incomingBlob,
    };
    if (incomingRecord.pageEnd < incomingRecord.pageStart) incomingRecord.pageEnd = incomingRecord.pageStart;

    const local = (await reqToPromise(store.get(row.id))) as PdfResourceRecord | undefined;
    if (local) {
      const localMeta = normalizeMeta(local);
      const incomingMeta = normalizeMeta(incomingRecord);
      if (!isIncomingNewer(localMeta, incomingMeta)) {
        skipped += 1;
        continue;
      }
    }

    store.put(incomingRecord);
    imported += 1;
  }

  await txDone(tx);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(RESOURCES_UPDATED_EVENT));
  }
  return { imported, skipped };
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
