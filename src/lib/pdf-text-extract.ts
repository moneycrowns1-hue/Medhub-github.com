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

export async function extractPdfTextFromBlob(input: {
  blob: Blob;
  pageStart: number;
  pageEnd: number;
}): Promise<{ text: string; pageCount: number }> {
  ensureWorker();

  const ab = await input.blob.arrayBuffer();
  const loadingTask = getDocument({ data: ab });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  const start = Math.max(1, Math.min(pageCount, Math.floor(input.pageStart)));
  const end = Math.max(start, Math.min(pageCount, Math.floor(input.pageEnd)));

  const chunks: string[] = [];
  for (let p = start; p <= end; p += 1) {
    try {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = Array.isArray((content as { items?: unknown }).items)
        ? (content as { items: unknown[] }).items
        : [];

      const pageText = items
        .map((it) => {
          const anyIt = it as unknown as { str?: string };
          return typeof anyIt.str === "string" ? anyIt.str : "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (pageText) {
        chunks.push(`\n\n[Page ${p}]\n${pageText}`);
      } else {
        chunks.push(`\n\n[Page ${p}]\n`);
      }
    } catch {
      chunks.push(`\n\n[Page ${p}]\n`);
    }
  }

  try {
    await pdf.destroy();
  } catch {
    // ignore
  }

  return { text: chunks.join("").trim(), pageCount };
}
