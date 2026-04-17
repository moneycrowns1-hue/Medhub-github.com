import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { getPdfDocumentOptions } from "@/lib/pdfjs-runtime";

export type PdfTocNode = {
  id: string;
  title: string;
  page: number | null; // 1-indexed; null if unresolved
  children: PdfTocNode[];
};

export type PdfSearchMatch = {
  page: number; // 1-indexed
  snippet: string; // surrounding text snippet
  matchStart: number; // index of query in snippet
  matchEnd: number;
};

export type PdfIndexDiagnostics = {
  pagesWithText: number; // pages that returned at least 1 char
  pagesWithItemsButNoStrings: number; // pages with text operators but empty str (cmap/font issue)
  pagesWithoutAnyItems: number; // pages with 0 text items and no error (likely scanned image)
  pagesWithError: number; // pages where getTextContent threw (worker crash, memory, etc.)
  totalCharacters: number;
  averageCharsPerPage: number;
  // true only when nothing resembles a text layer across the whole doc
  likelyScanned: boolean;
  // true when text ops exist but decoding produced empty strings
  likelyFontOrCmapIssue: boolean;
  // true when most pages failed with errors (memory / worker crash)
  likelyExtractionFailure: boolean;
  // last non-fatal error surfaced during indexing (if any)
  lastError: string | null;
};

export type PdfIndex = {
  documentId: string;
  pageCount: number;
  pages: string[]; // pages[i] = text of page (i+1)
  outline: PdfTocNode[];
  diagnostics: PdfIndexDiagnostics;
};

const SNIPPET_RADIUS = 60;
const MAX_RESULTS = 60;

const indexCache = new Map<string, PdfIndex>();
const inflight = new Map<string, Promise<PdfIndex>>();

type PdfJsOutlineItem = {
  title?: string;
  dest?: unknown;
  url?: string;
  items?: PdfJsOutlineItem[];
};

async function resolveOutlinePage(
  pdf: { getDestination: (name: string) => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number> },
  dest: unknown,
): Promise<number | null> {
  try {
    let resolved: unknown = dest;
    if (typeof dest === "string") {
      resolved = await pdf.getDestination(dest);
    }
    if (!Array.isArray(resolved)) return null;
    const ref = resolved[0];
    if (!ref) return null;
    const idx = await pdf.getPageIndex(ref);
    if (!Number.isFinite(idx)) return null;
    return idx + 1;
  } catch {
    return null;
  }
}

async function buildOutlineTree(
  pdf: { getDestination: (name: string) => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number> },
  items: PdfJsOutlineItem[] | null | undefined,
  prefix = "toc",
): Promise<PdfTocNode[]> {
  if (!items || !items.length) return [];
  const nodes: PdfTocNode[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const id = `${prefix}-${i}`;
    const page = await resolveOutlinePage(pdf, item.dest);
    const children = await buildOutlineTree(pdf, item.items, id);
    nodes.push({
      id,
      title: (typeof item.title === "string" ? item.title : "").trim() || "Sin título",
      page,
      children,
    });
  }
  return nodes;
}

type PageExtractionResult = {
  text: string;
  itemCount: number;
  error: string | null;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function extractPageText(
  pdf: { getPage: (n: number) => Promise<unknown> },
  pageNum: number,
  timeoutMs: number,
): Promise<PageExtractionResult> {
  try {
    const page = await withTimeout(pdf.getPage(pageNum), timeoutMs, `getPage(${pageNum})`);
    const content = await withTimeout(
      (page as { getTextContent: () => Promise<unknown> }).getTextContent(),
      timeoutMs,
      `getTextContent(${pageNum})`,
    );
    const items = Array.isArray((content as { items?: unknown }).items)
      ? ((content as { items: unknown[] }).items as unknown[])
      : [];
    const text = items
      .map((it) => {
        const s = (it as { str?: string }).str;
        return typeof s === "string" ? s : "";
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return { text, itemCount: items.length, error: null };
  } catch (err) {
    return {
      text: "",
      itemCount: 0,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

export type PdfIndexProgress = {
  processed: number;
  total: number;
};

export async function buildPdfIndexFromBlob(
  documentId: string,
  blob: Blob,
  onProgress?: (p: PdfIndexProgress) => void,
): Promise<PdfIndex> {
  const cached = indexCache.get(documentId);
  if (cached) return cached;
  const running = inflight.get(documentId);
  if (running) return running;

  const promise = (async () => {
    const ab = await blob.arrayBuffer();
    const pdf = await getDocument({ data: ab, ...getPdfDocumentOptions() }).promise;

    const pageCount = pdf.numPages;
    const pages: string[] = new Array(pageCount).fill("");
    const itemCounts: number[] = new Array(pageCount).fill(0);
    const pageErrors: (string | null)[] = new Array(pageCount).fill(null);
    let lastError: string | null = null;

    // Low concurrency: pdfjs workers can die on large textbooks when the
    // extraction pipeline holds too many pages alive at once.
    // iOS/iPadOS Safari is especially fragile → run strictly sequentially.
    const isIOS = typeof navigator !== "undefined" &&
      (/iP(hone|od|ad)/.test(navigator.platform) ||
        (navigator.userAgent.includes("Mac") && "ontouchend" in document));
    const concurrency = isIOS ? 1 : 2;
    const PAGE_TIMEOUT_MS = 12_000;
    let processed = 0;
    const reportProgress = () => {
      if (onProgress) onProgress({ processed, total: pageCount });
    };
    reportProgress();

    let next = 0;
    async function worker() {
      while (true) {
        const current = next++;
        if (current >= pageCount) return;
        const r = await extractPageText(
          pdf as unknown as { getPage: (n: number) => Promise<unknown> },
          current + 1,
          PAGE_TIMEOUT_MS,
        );
        pages[current] = r.text;
        itemCounts[current] = r.itemCount;
        pageErrors[current] = r.error;
        if (r.error) lastError = r.error;
        processed += 1;
        reportProgress();
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    // Retry pages that errored, once, strictly sequentially. On iOS Safari
    // the pdfjs worker sometimes throws transient memory errors that recover
    // after other pages finish.
    for (let i = 0; i < pageCount; i += 1) {
      if (pageErrors[i] && !pages[i]) {
        const r = await extractPageText(
          pdf as unknown as { getPage: (n: number) => Promise<unknown> },
          i + 1,
          PAGE_TIMEOUT_MS,
        );
        pages[i] = r.text;
        itemCounts[i] = r.itemCount;
        pageErrors[i] = r.error;
        if (r.error) lastError = r.error;
      }
    }

    let rawOutline: PdfJsOutlineItem[] = [];
    try {
      rawOutline =
        (await withTimeout(
          (pdf as unknown as { getOutline: () => Promise<PdfJsOutlineItem[] | null> }).getOutline(),
          10_000,
          "getOutline",
        )) ?? [];
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }
    const outline = await buildOutlineTree(
      pdf as unknown as { getDestination: (name: string) => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number> },
      rawOutline,
    );

    try {
      await (pdf as unknown as { destroy: () => Promise<void> }).destroy();
    } catch {
      // ignore
    }

    let pagesWithText = 0;
    let pagesWithItemsButNoStrings = 0;
    let pagesWithoutAnyItems = 0;
    let pagesWithError = 0;
    let totalCharacters = 0;
    for (let i = 0; i < pageCount; i += 1) {
      const text = pages[i];
      const items = itemCounts[i];
      const err = pageErrors[i];
      if (text) {
        pagesWithText += 1;
        totalCharacters += text.length;
      } else if (err) {
        pagesWithError += 1;
      } else if (items > 0) {
        pagesWithItemsButNoStrings += 1;
      } else {
        pagesWithoutAnyItems += 1;
      }
    }
    const averageCharsPerPage = pageCount > 0 ? totalCharacters / pageCount : 0;

    // Most pages errored → memory / worker failure, NOT a scanned PDF.
    const likelyExtractionFailure =
      pagesWithError >= Math.max(1, Math.ceil(pageCount * 0.5)) &&
      pagesWithText === 0;

    // Scanned = practically no text items anywhere, AND no errors disturbed
    // the extraction. Require it across the whole document.
    const likelyScanned =
      !likelyExtractionFailure &&
      totalCharacters === 0 &&
      pagesWithItemsButNoStrings === 0 &&
      pagesWithError === 0 &&
      pagesWithoutAnyItems >= Math.max(1, Math.ceil(pageCount * 0.9));

    // Text operators exist but pdfjs couldn't decode them → cmap/font issue.
    const likelyFontOrCmapIssue =
      !likelyExtractionFailure &&
      pagesWithItemsButNoStrings > 0 &&
      pagesWithText === 0;

    const diagnostics: PdfIndexDiagnostics = {
      pagesWithText,
      pagesWithItemsButNoStrings,
      pagesWithoutAnyItems,
      pagesWithError,
      totalCharacters,
      averageCharsPerPage,
      likelyScanned,
      likelyFontOrCmapIssue,
      likelyExtractionFailure,
      lastError,
    };

    const result: PdfIndex = { documentId, pageCount, pages, outline, diagnostics };
    indexCache.set(documentId, result);
    return result;
  })();

  inflight.set(documentId, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    inflight.delete(documentId);
  }
}

export function clearPdfIndexCache(documentId?: string) {
  if (documentId) indexCache.delete(documentId);
  else indexCache.clear();
}

export function getCachedPdfIndex(documentId: string): PdfIndex | null {
  return indexCache.get(documentId) ?? null;
}

export function searchPdfIndex(index: PdfIndex, query: string, maxResults: number = MAX_RESULTS): PdfSearchMatch[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const needle = q.toLowerCase();
  const out: PdfSearchMatch[] = [];

  for (let i = 0; i < index.pages.length; i += 1) {
    const text = index.pages[i];
    if (!text) continue;
    const lower = text.toLowerCase();
    let fromIdx = 0;
    while (out.length < maxResults) {
      const found = lower.indexOf(needle, fromIdx);
      if (found < 0) break;
      const start = Math.max(0, found - SNIPPET_RADIUS);
      const end = Math.min(text.length, found + needle.length + SNIPPET_RADIUS);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < text.length ? "…" : "";
      const snippet = `${prefix}${text.slice(start, end)}${suffix}`;
      const matchStart = prefix.length + (found - start);
      out.push({
        page: i + 1,
        snippet,
        matchStart,
        matchEnd: matchStart + needle.length,
      });
      fromIdx = found + needle.length;
      if (out.length >= maxResults) break;
    }
    if (out.length >= maxResults) break;
  }
  return out;
}
