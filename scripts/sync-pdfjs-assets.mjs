#!/usr/bin/env node
// Sync pdfjs-dist cmaps + standard fonts into public/pdfjs so the bundled
// viewer can decode PDFs that rely on non-embedded Adobe standard / CJK fonts.
// Without these, pdfjs.getTextContent() returns empty strings for those PDFs.

import { mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const pdfjsRoot = resolve(projectRoot, "node_modules", "pdfjs-dist");
const publicRoot = resolve(projectRoot, "public", "pdfjs");

const pairs = [
  ["cmaps", "cmaps"],
  ["standard_fonts", "standard_fonts"],
];

if (!existsSync(pdfjsRoot)) {
  console.warn("[sync-pdfjs-assets] pdfjs-dist not installed yet, skipping.");
  process.exit(0);
}

mkdirSync(publicRoot, { recursive: true });

for (const [srcDir, destDir] of pairs) {
  const src = join(pdfjsRoot, srcDir);
  const dest = join(publicRoot, destDir);
  if (!existsSync(src)) {
    console.warn(`[sync-pdfjs-assets] missing ${src}, skipping.`);
    continue;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
  const count = readdirSync(dest).length;
  console.log(`[sync-pdfjs-assets] ${srcDir}: ${count} files → public/pdfjs/${destDir}`);
}
