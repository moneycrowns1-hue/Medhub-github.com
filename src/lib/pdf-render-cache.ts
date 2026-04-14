type PdfRenderCacheRow = {
  id: string;
  documentId: string;
  page: number;
  width: number;
  dprBucket: number;
  imageSrc: string;
  textLayer: string | null;
  updatedAtMs: number;
};

type Db = IDBDatabase;

const DB_NAME = "somagnus_pdf_render_cache";
const DB_VERSION = 1;
const STORE = "pages";
const MAX_CACHE_ROWS = 320;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
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
    req.onerror = () => reject(req.error ?? new Error("Failed to open render cache DB"));
  });
}

function buildId(documentId: string, page: number, width: number, dprBucket: number) {
  return `${documentId}:${page}:${width}:${dprBucket}`;
}

export async function getCachedRenderedPdfPage(input: {
  documentId: string;
  page: number;
  width: number;
  dprBucket: number;
}): Promise<{ imageSrc: string; textLayer: string | null } | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const row = await reqToPromise(
    tx.objectStore(STORE).get(buildId(input.documentId, input.page, input.width, input.dprBucket)),
  ) as PdfRenderCacheRow | undefined;
  await txDone(tx);
  if (!row?.imageSrc) return null;
  return {
    imageSrc: row.imageSrc,
    textLayer: row.textLayer ?? null,
  };
}

export async function putCachedRenderedPdfPage(input: {
  documentId: string;
  page: number;
  width: number;
  dprBucket: number;
  imageSrc: string;
  textLayer: string | null;
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  const row: PdfRenderCacheRow = {
    id: buildId(input.documentId, input.page, input.width, input.dprBucket),
    documentId: input.documentId,
    page: input.page,
    width: input.width,
    dprBucket: input.dprBucket,
    imageSrc: input.imageSrc,
    textLayer: input.textLayer,
    updatedAtMs: Date.now(),
  };

  store.put(row);

  const allRows = (await reqToPromise(store.getAll())) as PdfRenderCacheRow[];
  if (allRows.length > MAX_CACHE_ROWS) {
    const staleRows = allRows
      .sort((a, b) => a.updatedAtMs - b.updatedAtMs)
      .slice(0, allRows.length - MAX_CACHE_ROWS);
    for (const stale of staleRows) {
      store.delete(stale.id);
    }
  }

  await txDone(tx);
}
