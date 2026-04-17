import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Centralised runtime configuration for pdfjs-dist.
 *
 * Many PDFs (especially Spanish medical textbooks) reference Adobe standard
 * or CJK fonts that are NOT embedded in the file. Without pointing pdfjs to
 * the CMap and standard font packages shipped by `pdfjs-dist`, the library
 * cannot decode character codes → unicode, and `getTextContent()` returns
 * empty `str` values even though the PDF renders fine visually.
 *
 * This module wires up:
 *  - `GlobalWorkerOptions.workerSrc` → `/pdf.worker.min.js`
 *  - `cMapUrl` / `cMapPacked` → `/pdfjs/cmaps/` (copied from node_modules via
 *    `scripts/sync-pdfjs-assets.mjs`)
 *  - `standardFontDataUrl` → `/pdfjs/standard_fonts/`
 *  - `useSystemFonts: true` so missing system fonts fall back gracefully
 *
 * All call sites that create a pdfjs document should spread
 * `getPdfDocumentOptions()` into their `getDocument({...})` params.
 */

let workerConfigured = false;

function resolveAssetPrefix(): string {
  if (typeof window === "undefined") return "";
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
  return assetPrefix.endsWith("/") ? assetPrefix.slice(0, -1) : assetPrefix;
}

let assetSelfTestStarted = false;

function startAssetSelfTestOnce(assets: PdfDocumentAssetOptions): void {
  if (assetSelfTestStarted) return;
  assetSelfTestStarted = true;
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  // Try to HEAD a representative CMap file and a standard font.
  // Results are logged to the console so it's trivial to spot 404s in dev.
  const cmapProbe = `${assets.cMapUrl}Adobe-Japan1-UCS2.bcmap`;
  const fontProbe = `${assets.standardFontDataUrl}FoxitSerif.pfb`;
  void (async () => {
    try {
      const [cmapRes, fontRes] = await Promise.all([
        fetch(cmapProbe, { method: "HEAD" }).catch(() => null),
        fetch(fontProbe, { method: "HEAD" }).catch(() => null),
      ]);
      const cmapOk = !!cmapRes && cmapRes.ok;
      const fontOk = !!fontRes && fontRes.ok;
      console.info(
        `[pdfjs-runtime] assets self-test: cmap=${cmapOk ? "ok" : "FAIL"} (${cmapProbe})  fonts=${
          fontOk ? "ok" : "FAIL"
        } (${fontProbe})`,
      );
      if (!cmapOk || !fontOk) {
        console.warn(
          "[pdfjs-runtime] CMaps/standard fonts not reachable — PDFs with non-embedded fonts will return empty text. Run `npm run sync:pdfjs-assets` and reload.",
        );
      }
    } catch {
      // ignore
    }
  })();
}

export function ensurePdfJsWorker(): void {
  if (workerConfigured) return;
  const prefix = resolveAssetPrefix();
  GlobalWorkerOptions.workerSrc = `${prefix}/pdf.worker.min.js`;
  workerConfigured = true;
  if (typeof window !== "undefined") {
    console.info(`[pdfjs-runtime] workerSrc=${GlobalWorkerOptions.workerSrc}`);
    startAssetSelfTestOnce(getPdfAssetUrls());
  }
}

export type PdfDocumentAssetOptions = {
  cMapUrl: string;
  cMapPacked: true;
  standardFontDataUrl: string;
  useSystemFonts: true;
};

export function getPdfAssetUrls(): PdfDocumentAssetOptions {
  const prefix = resolveAssetPrefix();
  return {
    cMapUrl: `${prefix}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${prefix}/pdfjs/standard_fonts/`,
    useSystemFonts: true,
  };
}

/**
 * Convenience: common options to spread into `getDocument({...})`.
 * Callers should also set `data` or `url` themselves.
 */
export function getPdfDocumentOptions(): PdfDocumentAssetOptions {
  ensurePdfJsWorker();
  return getPdfAssetUrls();
}
