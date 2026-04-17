import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  if (typeof window !== "undefined") {
    const nextData = (window as Window & { __NEXT_DATA__?: { assetPrefix?: string } }).__NEXT_DATA__;
    let assetPrefix = typeof nextData?.assetPrefix === "string" ? nextData.assetPrefix : "";
    if (!assetPrefix) {
      const nextScript = document.querySelector<HTMLScriptElement>('script[src*="/_next/"]');
      const src = nextScript?.src;
      if (src) {
        try {
          const parsed = new URL(src, window.location.href);
          const marker = "/_next/";
          const idx = parsed.pathname.indexOf(marker);
          if (idx > 0) assetPrefix = parsed.pathname.slice(0, idx);
        } catch {
          // ignore
        }
      }
    }
    if (!assetPrefix && window.location.hostname.endsWith("github.io")) {
      const [first] = window.location.pathname.split("/").filter(Boolean);
      if (first) assetPrefix = `/${first}`;
    }
    const normalizedPrefix = assetPrefix.endsWith("/") ? assetPrefix.slice(0, -1) : assetPrefix;
    GlobalWorkerOptions.workerSrc = `${normalizedPrefix}/pdf.worker.min.js`;
  } else {
    GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  }
  workerConfigured = true;
}

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

export type PdfIndex = {
  documentId: string;
  pageCount: number;
  pages: string[]; // pages[i] = text of page (i+1)
  outline: PdfTocNode[];
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

async function extractPageText(pdf: { getPage: (n: number) => Promise<unknown> }, pageNum: number): Promise<string> {
  try {
    const page = await pdf.getPage(pageNum);
    const content = await (page as { getTextContent: () => Promise<unknown> }).getTextContent();
    const items = Array.isArray((content as { items?: unknown }).items)
      ? ((content as { items: unknown[] }).items as unknown[])
      : [];
    return items
      .map((it) => {
        const s = (it as { str?: string }).str;
        return typeof s === "string" ? s : "";
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

export async function buildPdfIndexFromBlob(documentId: string, blob: Blob): Promise<PdfIndex> {
  const cached = indexCache.get(documentId);
  if (cached) return cached;
  const running = inflight.get(documentId);
  if (running) return running;

  const promise = (async () => {
    ensureWorker();
    const ab = await blob.arrayBuffer();
    const pdf = await getDocument({ data: ab }).promise;

    const pageCount = pdf.numPages;
    const pages: string[] = new Array(pageCount).fill("");

    // Parallel extraction with modest concurrency to avoid blocking
    const concurrency = 4;
    let next = 0;
    async function worker() {
      while (true) {
        const current = next++;
        if (current >= pageCount) return;
        pages[current] = await extractPageText(pdf as unknown as { getPage: (n: number) => Promise<unknown> }, current + 1);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const rawOutline = (await (pdf as unknown as { getOutline: () => Promise<PdfJsOutlineItem[] | null> }).getOutline()) ?? [];
    const outline = await buildOutlineTree(
      pdf as unknown as { getDestination: (name: string) => Promise<unknown>; getPageIndex: (ref: unknown) => Promise<number> },
      rawOutline,
    );

    try {
      await (pdf as unknown as { destroy: () => Promise<void> }).destroy();
    } catch {
      // ignore
    }

    const result: PdfIndex = { documentId, pageCount, pages, outline };
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
