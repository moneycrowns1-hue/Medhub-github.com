import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  // Next/Vite/Webpack friendly: bundle worker and reference via URL.
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
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
