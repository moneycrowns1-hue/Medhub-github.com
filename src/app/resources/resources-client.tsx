"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import QuickPinchZoom from "react-quick-pinch-zoom";

import { ArrowLeft, Bookmark, ChevronLeft, ChevronRight, FileText, Filter, Info, Loader2, PanelRight, Save, Search, Sparkles, Star, StickyNote, Trash2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckSelect } from "@/components/deck-select";
import { SubjectSelect } from "@/components/subject-select";
import {
  deletePdfResource,
  exportResourcesLibraryBackup,
  getPdfResourceBlob,
  importResourcesLibraryBackup,
  listPdfResources,
  putPdfResource,
  type PdfResource,
  updatePdfResourceMeta,
} from "@/lib/resources-service";
import { extractPdfTextFromBlob } from "@/lib/pdf-text-extract";
import {
  importAiNotesToDeck,
  loadSrsLibrary,
  saveSrsLibrary,
  type AiNoteDraft,
} from "@/lib/srs-storage";
import {
  getPdfResumeForResource,
  markPdfProgress,
  RABBIT_ASSISTANT_CONTROL_EVENT,
  RABBIT_GUIDE_SPEAK_EVENT,
  type RabbitAssistantControlPayload,
  type RabbitGuideSpeechPayload,
} from "@/lib/rabbit-guide";
import {
  addReaderBookmark,
  exportReaderArtifacts,
  importReaderArtifacts,
  deleteReaderBookmark,
  deleteReaderNote,
  listReaderBookmarks,
  listReaderNotes,
  RESOURCES_READER_UPDATED_EVENT,
  updateReaderBookmarkLabel,
  upsertReaderNote,
  type ResourceReaderNote,
} from "@/lib/resources-reader-store";
import {
  findFlashcardsArtifact,
  hashFlashcardsArtifactInput,
  upsertFlashcardsArtifact,
} from "@/lib/resources-ai-artifacts-store";
import {
  createHttpResourcesSyncAdapter,
  loadResourcesSyncCursor,
  saveResourcesSyncCursor,
  syncResourcesLocalFirst,
} from "@/lib/resources-sync-adapter";
import { getCachedRenderedPdfPage, putCachedRenderedPdfPage } from "@/lib/pdf-render-cache";
import type { SrsLibrary } from "@/lib/srs";

type InAppNotice = {
  id: string;
  title: string;
  body: string;
};

type ReaderShortcutAction = "save" | "bookmark" | "note" | "nextBookmark" | "prevBookmark";
type ReaderShortcutConfig = Record<ReaderShortcutAction, string>;
type ReaderShortcutScope = "global" | "subject";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseTagInput(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const next = part.trim().toLowerCase();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

async function readPdfFileWithProgress(file: File, onProgress: (ratio: number) => void): Promise<Blob> {
  const total = Math.max(1, file.size || 1);
  if (!file.stream) {
    onProgress(1);
    return file;
  }

  const reader = file.stream().getReader();
  const parts: BlobPart[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    parts.push(value.slice().buffer);
    received += value.byteLength;
    onProgress(clamp(received / total, 0, 1));
  }

  onProgress(1);
  return new Blob(parts, { type: file.type || "application/pdf" });
}

type PdfPreviewCacheEntry = {
  objectUrl: string;
  sourceData: Uint8Array | null;
  remoteUrl: string | null;
  pages: Array<string | null>;
  textLayers: Array<string | null>;
  pageCount: number;
};

type PageRenderFailureReason =
  | "worker"
  | "data-clone"
  | "pdf-open"
  | "page-load"
  | "canvas-context"
  | "render"
  | "empty-image"
  | "cache-lookup"
  | "cache-miss"
  | "unknown";

type RenderPdfPageAssetResult = {
  imageSrc: string;
  textLayer: string;
  failureReason: PageRenderFailureReason | null;
  failureDetail: string;
};

const READER_SHORTCUTS_STORAGE_KEY = "somagnus:resources:reader:shortcuts:v2";
const DEFAULT_READER_SHORTCUTS: ReaderShortcutConfig = {
  save: "ctrl+s",
  bookmark: "ctrl+b",
  note: "ctrl+enter",
  nextBookmark: "alt+arrowdown",
  prevBookmark: "alt+arrowup",
};
const READER_SHORTCUT_ACTIONS: ReaderShortcutAction[] = ["save", "bookmark", "note", "prevBookmark", "nextBookmark"];
const READER_SHORTCUT_ACTION_LABELS: Record<ReaderShortcutAction, string> = {
  save: "Guardar progreso",
  bookmark: "Marcar/Quitar marcador",
  note: "Guardar nota",
  prevBookmark: "Marcador anterior",
  nextBookmark: "Marcador siguiente",
};
const READER_GESTURE_ACTIVE_ZOOM = 1.01;
const PDF_RENDER_MAX_PIXELS_TOUCH = 8_500_000;
const PDF_RENDER_MAX_PIXELS_DESKTOP = 12_000_000;
const LARGE_PDF_COMPATIBILITY_BYTES_TOUCH = 90 * 1024 * 1024;
const LARGE_PDF_COMPATIBILITY_BYTES_DESKTOP = 140 * 1024 * 1024;
const LARGE_PDF_REMOTE_URL_STORAGE_KEY = "somagnus:resources:large-pdf-remote-url-by-id:v1";
const LARGE_PDF_REMOTE_URL_BY_TITLE_FALLBACK: Record<string, string> = {
  "biologia-celular-karp-8a-edicion.pdf": "https://pub-57389a5b13254711a5cf7f7bb285a332.r2.dev/biologia-celular-karp-8a-edicion.pdf",
};

function normalizePdfTitleKey(title: string) {
  return title.trim().toLowerCase();
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function renderPdfPageAssetFromRemoteUrl(remoteUrl: string, pageNumber: number): Promise<RenderPdfPageAssetResult> {
  ensurePdfWorker();
  const task = getDocument({
    url: remoteUrl,
    disableStream: false,
    disableAutoFetch: false,
    disableRange: false,
    rangeChunkSize: 262144,
  });
  let pdf: Awaited<typeof task.promise> | null = null;
  try {
    pdf = await task.promise;
    const safePage = clamp(Math.floor(pageNumber || 1), 1, Math.max(1, pdf.numPages));
    const page = await pdf.getPage(safePage);
    const firstViewport = page.getViewport({ scale: 1 });
    const { targetWidth, devicePixelRatio, lightProfile } = resolvePdfRenderProfile();
    const attempts = [
      { targetWidth, devicePixelRatio },
      {
        targetWidth: Math.max(620, Math.floor(targetWidth * 0.84)),
        devicePixelRatio: Math.min(devicePixelRatio, 1.8),
      },
      {
        targetWidth: Math.max(520, Math.floor(targetWidth * 0.72)),
        devicePixelRatio: 1,
      },
    ];

    let imageSrc = "";
    let failureReason: PageRenderFailureReason | null = null;
    let failureDetail = "";
    const maxPixels = lightProfile ? PDF_RENDER_MAX_PIXELS_TOUCH : PDF_RENDER_MAX_PIXELS_DESKTOP;
    for (const attempt of attempts) {
      const scale = attempt.targetWidth / firstViewport.width;
      const viewport = page.getViewport({ scale });
      const dprByPixels = Math.sqrt(maxPixels / Math.max(1, viewport.width * viewport.height));
      const effectiveDpr = clamp(attempt.devicePixelRatio, 1, Math.max(1, dprByPixels));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width * effectiveDpr));
      canvas.height = Math.max(1, Math.floor(viewport.height * effectiveDpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        failureReason = "canvas-context";
        failureDetail = "ctx-null";
        continue;
      }

      try {
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          transform: [effectiveDpr, 0, 0, effectiveDpr, 0, 0],
        }).promise;
        imageSrc = canvas.toDataURL("image/jpeg", 0.93);
        if (imageSrc) break;
      } catch (error) {
        imageSrc = "";
        failureReason = classifyPageRenderFailure(error);
        failureDetail = normalizeErrorMessage(error);
      }
    }

    if (!imageSrc) {
      return {
        imageSrc: "",
        textLayer: "",
        failureReason: failureReason ?? "empty-image",
        failureDetail: failureDetail || "canvas-vacio",
      };
    }

    let textLayer = "";
    try {
      const textContent = await page.getTextContent();
      textLayer = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      textLayer = "";
    }

    return {
      imageSrc,
      textLayer,
      failureReason: null,
      failureDetail: "",
    };
  } catch (error) {
    return {
      imageSrc: "",
      textLayer: "",
      failureReason: classifyPageRenderFailure(error),
      failureDetail: normalizeErrorMessage(error),
    };
  } finally {
    try {
      await pdf?.destroy();
    } catch {
      // ignore
    }
  }
}

function classifyRemotePdfLoadError(error: unknown) {
  const detail = normalizeErrorMessage(error);
  const lower = detail.toLowerCase();
  if (lower.includes("cors") || lower.includes("failed to fetch") || lower.includes("network") || lower.includes("load")) {
    return "No se pudo leer el PDF remoto (R2). Verifica CORS del bucket y que la URL pública sea accesible.";
  }
  return detail;
}

function loadLargePdfRemoteUrlById(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LARGE_PDF_REMOTE_URL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key !== "string" || typeof value !== "string") continue;
      const normalized = value.trim();
      if (!normalized || !isValidHttpUrl(normalized)) continue;
      out[key] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}

function persistLargePdfRemoteUrlById(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LARGE_PDF_REMOTE_URL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function resolveLargePdfRemoteUrl(resource: Pick<PdfResource, "id" | "title"> | null, byId: Record<string, string>): string | null {
  if (!resource) return null;
  const byResourceId = byId[resource.id]?.trim();
  if (byResourceId && isValidHttpUrl(byResourceId)) return byResourceId;

  const exact = LARGE_PDF_REMOTE_URL_BY_TITLE_FALLBACK[normalizePdfTitleKey(resource.title)];
  if (exact) return exact;

  const withExt = `${normalizePdfTitleKey(resource.title)}.pdf`;
  return LARGE_PDF_REMOTE_URL_BY_TITLE_FALLBACK[withExt] ?? null;
}

function normalizeShortcutToken(raw: string) {
  const token = raw.trim().toLowerCase();
  if (!token) return "";
  if (token === "cmd" || token === "command") return "meta";
  if (token === "option") return "alt";
  if (token === "return") return "enter";
  if (token === "left") return "arrowleft";
  if (token === "right") return "arrowright";
  if (token === "up") return "arrowup";
  if (token === "down") return "arrowdown";
  return token;
}

function normalizeShortcutBinding(raw: string) {
  const pieces = raw
    .split("+")
    .map((chunk) => normalizeShortcutToken(chunk))
    .filter(Boolean);
  if (!pieces.length) return "";

  const modifierOrder = ["ctrl", "meta", "alt", "shift"] as const;
  const modifiers = modifierOrder.filter((m) => pieces.includes(m));
  const key = pieces.find((piece) => !modifierOrder.includes(piece as (typeof modifierOrder)[number])) ?? "";
  if (!key) return modifiers.join("+");
  return [...modifiers, key].join("+");
}

function keyboardEventToShortcut(event: KeyboardEvent) {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.metaKey) parts.push("meta");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  const key = normalizeShortcutToken(event.key);
  if (!key || key === "control" || key === "meta" || key === "alt" || key === "shift") {
    return parts.join("+");
  }
  return [...parts, key].join("+");
}

const PDF_PREVIEW_CACHE = new Map<string, PdfPreviewCacheEntry>();
let pdfWorkerConfigured = false;
let previewCacheCleanupBound = false;

function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
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
  pdfWorkerConfigured = true;
}

function bindPreviewCacheCleanup() {
  if (previewCacheCleanupBound || typeof window === "undefined") return;
  previewCacheCleanupBound = true;
  window.addEventListener("beforeunload", () => {
    for (const entry of PDF_PREVIEW_CACHE.values()) {
      URL.revokeObjectURL(entry.objectUrl);
    }
    PDF_PREVIEW_CACHE.clear();
  });
}

function prefersLightPdfRenderProfile() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && "ontouchend" in window);
  const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const lowDeviceMemory = typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
    ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4
    : false;
  return isIpad || isCoarsePointer || lowDeviceMemory;
}

async function renderPdfPages(blob: Blob): Promise<{ pages: Array<string | null>; pageCount: number; sourceData: Uint8Array }> {
  ensurePdfWorker();
  const sourceData = new Uint8Array(await blob.arrayBuffer());
  const openData = sourceData.slice();
  const task = getDocument({
    data: openData,
    disableStream: false,
    disableAutoFetch: false,
    disableRange: false,
    rangeChunkSize: 262144,
  });
  const pdf = await task.promise;
  const totalPages = pdf.numPages;
  try {
    await pdf.destroy();
  } catch {
    // ignore
  }
  return { pages: Array(totalPages).fill(null), pageCount: totalPages, sourceData };
}

async function renderPdfPagesFromRemoteUrl(remoteUrl: string): Promise<{ pages: Array<string | null>; pageCount: number }> {
  ensurePdfWorker();
  const task = getDocument({
    url: remoteUrl,
    disableStream: false,
    disableAutoFetch: false,
    disableRange: false,
    rangeChunkSize: 262144,
  });
  const pdf = await task.promise;
  const totalPages = pdf.numPages;
  try {
    await pdf.destroy();
  } catch {
    // ignore
  }
  return { pages: Array(totalPages).fill(null), pageCount: totalPages };
}

function resolvePdfTargetWidth() {
  const lightProfile = prefersLightPdfRenderProfile();
  const viewportWidth = typeof window === "undefined" ? 1200 : Math.max(360, window.innerWidth);
  const maxWidth = lightProfile ? 980 : 1280;
  const minWidth = lightProfile ? 680 : 860;
  return Math.min(maxWidth, Math.max(minWidth, Math.floor(viewportWidth * 0.9)));
}

function resolvePdfRenderProfile() {
  const lightProfile = prefersLightPdfRenderProfile();
  const targetWidth = resolvePdfTargetWidth();
  const baseRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const devicePixelRatio = clamp(baseRatio, 1, lightProfile ? 2.4 : 3);
  const dprBucket = Math.round(devicePixelRatio * 100);
  return { lightProfile, targetWidth, devicePixelRatio, dprBucket };
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "error-desconocido";
}

function classifyPageRenderFailure(error: unknown): PageRenderFailureReason {
  const message = normalizeErrorMessage(error).toLowerCase();
  if (message.includes("clone") || message.includes("clon")) return "data-clone";
  if (message.includes("worker")) return "worker";
  if (message.includes("getpage")) return "page-load";
  if (message.includes("canvas") || message.includes("context")) return "canvas-context";
  if (message.includes("render")) return "render";
  if (message.includes("pdf") || message.includes("document")) return "pdf-open";
  return "unknown";
}

function renderFailureReasonLabel(reason: PageRenderFailureReason, detail: string) {
  const base =
    reason === "worker"
      ? "Worker PDF"
      : reason === "data-clone"
        ? "Transferencia datos"
      : reason === "pdf-open"
        ? "Apertura PDF"
        : reason === "page-load"
          ? "Carga de página"
          : reason === "canvas-context"
            ? "Canvas"
            : reason === "render"
              ? "Render"
              : reason === "empty-image"
                ? "Imagen vacía"
                : reason === "cache-lookup"
                  ? "Cache local"
                  : reason === "cache-miss"
                    ? "Cache memoria"
                    : "Desconocido";
  return detail ? `${base}: ${detail}` : base;
}

function formatPdfSizeLabel(sizeBytes: number) {
  const mb = sizeBytes / (1024 * 1024);
  if (!Number.isFinite(mb) || mb <= 0) return "0 MB";
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

async function renderPdfPageAsset(sourceData: Uint8Array, pageNumber: number): Promise<RenderPdfPageAssetResult> {
  ensurePdfWorker();
  const openData = sourceData.slice();
  const task = getDocument({
    data: openData,
    disableStream: false,
    disableAutoFetch: false,
    disableRange: false,
    rangeChunkSize: 262144,
  });
  let pdf: Awaited<typeof task.promise> | null = null;
  try {
    pdf = await task.promise;
    const safePage = clamp(Math.floor(pageNumber || 1), 1, Math.max(1, pdf.numPages));
    const page = await pdf.getPage(safePage);
    const firstViewport = page.getViewport({ scale: 1 });
    const { targetWidth, devicePixelRatio, lightProfile } = resolvePdfRenderProfile();
    const attempts = [
      { targetWidth, devicePixelRatio },
      {
        targetWidth: Math.max(620, Math.floor(targetWidth * 0.84)),
        devicePixelRatio: Math.min(devicePixelRatio, 1.8),
      },
      {
        targetWidth: Math.max(520, Math.floor(targetWidth * 0.72)),
        devicePixelRatio: 1,
      },
    ];

    let imageSrc = "";
    let failureReason: PageRenderFailureReason | null = null;
    let failureDetail = "";
    const maxPixels = lightProfile ? PDF_RENDER_MAX_PIXELS_TOUCH : PDF_RENDER_MAX_PIXELS_DESKTOP;
    for (const attempt of attempts) {
      const scale = attempt.targetWidth / firstViewport.width;
      const viewport = page.getViewport({ scale });
      const dprByPixels = Math.sqrt(maxPixels / Math.max(1, viewport.width * viewport.height));
      const effectiveDpr = clamp(attempt.devicePixelRatio, 1, Math.max(1, dprByPixels));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width * effectiveDpr));
      canvas.height = Math.max(1, Math.floor(viewport.height * effectiveDpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        failureReason = "canvas-context";
        failureDetail = "ctx-null";
        continue;
      }

      try {
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas,
          transform: [effectiveDpr, 0, 0, effectiveDpr, 0, 0],
        }).promise;
        imageSrc = canvas.toDataURL("image/jpeg", 0.93);
        if (imageSrc) break;
      } catch (error) {
        imageSrc = "";
        failureReason = classifyPageRenderFailure(error);
        failureDetail = normalizeErrorMessage(error);
      }
    }

    if (!imageSrc) {
      return {
        imageSrc: "",
        textLayer: "",
        failureReason: failureReason ?? "empty-image",
        failureDetail: failureDetail || "canvas-vacio",
      };
    }

    let textLayer = "";
    try {
      const textContent = await page.getTextContent();
      textLayer = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      textLayer = "";
    }

    return {
      imageSrc,
      textLayer,
      failureReason: null,
      failureDetail: "",
    };
  } catch (error) {
    return {
      imageSrc: "",
      textLayer: "",
      failureReason: classifyPageRenderFailure(error),
      failureDetail: normalizeErrorMessage(error),
    };
  } finally {
    try {
      await pdf?.destroy();
    } catch {
      // ignore
    }
  }
}

type ResourcesClientProps = {
  initialSelectedId?: string;
  initialWorkspaceMode?: "gestion" | "inmersion";
  hideLibraryPane?: boolean;
};

export function ResourcesClient(props: ResourcesClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openQueryPdfId = searchParams.get("openPdf");
  const [loading, setLoading] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState<"gestion" | "inmersion">(props.initialWorkspaceMode ?? "gestion");
  const [readerToolMode, setReaderToolMode] = useState<"lectura" | "generador">("lectura");
  const [readerSidebarOpen, setReaderSidebarOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [filterFolder, setFilterFolder] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "title" | "size">("recent");
  const [listMode, setListMode] = useState<"flat" | "folder">("flat");
  const [libraryVisualMode, setLibraryVisualMode] = useState<"list" | "grid">("grid");
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(() => new Set());
  const [bulkFolderInput, setBulkFolderInput] = useState("");
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [largePdfRemoteUrlById, setLargePdfRemoteUrlById] = useState<Record<string, string>>({});
  const [remotePdfUrlInput, setRemotePdfUrlInput] = useState("");
  const [items, setItems] = useState<PdfResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStalled, setPreviewStalled] = useState(false);
  const [previewPages, setPreviewPages] = useState<Array<string | null>>([]);
  const [previewTextLayers, setPreviewTextLayers] = useState<Array<string | null>>([]);
  const [renderingPreviewPages, setRenderingPreviewPages] = useState<Set<number>>(() => new Set());
  const [failedPreviewPages, setFailedPreviewPages] = useState<Set<number>>(() => new Set());
  const [previewPageFailures, setPreviewPageFailures] = useState<Record<number, string>>({});
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [maxCards, setMaxCards] = useState<number>(25);
  const [topic, setTopic] = useState<string>("");
  const [chunks, setChunks] = useState<string[]>([]);
  const [selectedChunkIdxs, setSelectedChunkIdxs] = useState<Set<number>>(() => new Set());
  const [aiNotes, setAiNotes] = useState<AiNoteDraft[] | null>(null);
  const [srsLib, setSrsLib] = useState<SrsLibrary | null>(null);
  const [subject, setSubject] = useState<string>("histologia");
  const [deckId, setDeckId] = useState<string>("deck-histo");
  const [readerPage, setReaderPage] = useState<number>(1);
  const [committedReaderPage, setCommittedReaderPage] = useState<number>(1);
  const [readerZoom, setReaderZoom] = useState<number>(1);
  const [readerMinZoom, setReaderMinZoom] = useState<number>(0.55);
  const [readerFitMode, setReaderFitMode] = useState<"reading" | "full">("reading");
  const [readerRecoverNonce, setReaderRecoverNonce] = useState(0);
  const [readerSafeMode, setReaderSafeMode] = useState(false);
  const [readerGesturesEnabled, setReaderGesturesEnabled] = useState(false);
  const [readerGestureZoom, setReaderGestureZoom] = useState<number>(1);
  const [readerPan, setReaderPan] = useState({ x: 0, y: 0 });
  const [readerPageInfoOpen, setReaderPageInfoOpen] = useState(false);
  const [readerPageDialogInput, setReaderPageDialogInput] = useState("1");
  const [readerBookmarks, setReaderBookmarks] = useState<Array<{ id: string; page: number; label?: string }>>([]);
  const [readerNotes, setReaderNotes] = useState<ResourceReaderNote[]>([]);
  const [bookmarkLabelInput, setBookmarkLabelInput] = useState("");
  const [bookmarkFilterQuery, setBookmarkFilterQuery] = useState("");
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editingBookmarkLabel, setEditingBookmarkLabel] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [readerImportMode, setReaderImportMode] = useState<"merge" | "replace">("merge");
  const [readerShortcutEditorOpen, setReaderShortcutEditorOpen] = useState(false);
  const [readerShortcutScope, setReaderShortcutScope] = useState<ReaderShortcutScope>("global");
  const [shortcutCaptureAction, setShortcutCaptureAction] = useState<ReaderShortcutAction | null>(null);
  const [readerShortcuts, setReaderShortcuts] = useState<ReaderShortcutConfig>(DEFAULT_READER_SHORTCUTS);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [notices, setNotices] = useState<InAppNotice[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const libraryBackupImportRef = useRef<HTMLInputElement | null>(null);
  const readerImportRef = useRef<HTMLInputElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const initialPageAlignRef = useRef<number | null>(null);
  const shortcutConflictNoticeAtRef = useRef(0);
  const previewRenderInFlightRef = useRef<Set<number>>(new Set());
  const previewRenderQueuedRef = useRef<Set<number>>(new Set());
  const previewRenderRetryCountRef = useRef<Map<number, number>>(new Map());
  const previewRenderRetryTimerRef = useRef<Map<number, number>>(new Map());
  const previewPagesRef = useRef<Array<string | null>>([]);
  const readerPageRef = useRef(1);
  const readerEffectiveZoomRef = useRef(1);
  const readerFitZoomAppliedRef = useRef(false);
  const readerScrollSyncPauseUntilRef = useRef(0);
  const readerViewportMissCountRef = useRef(0);
  const readerLastRecoverAtRef = useRef(0);
  const readerRecoveryBurstRef = useRef<number[]>([]);
  const currentSelectedSubjectSlug = useMemo(() => {
    const selected = items.find((i) => i.id === selectedId);
    return selected?.subjectSlug === "anatomia" ||
      selected?.subjectSlug === "histologia" ||
      selected?.subjectSlug === "embriologia" ||
      selected?.subjectSlug === "biologia-celular" ||
      selected?.subjectSlug === "ingles" ||
      selected?.subjectSlug === "trabajo-online"
      ? (selected.subjectSlug as SubjectSlug)
      : null;
  }, [items, selectedId]);
  const showLibraryPane = !props.hideLibraryPane;
  const workspaceModeLocked = Boolean(props.initialWorkspaceMode);
  const immersiveMode = workspaceMode === "inmersion";
  const selectedSubjectSlug = currentSelectedSubjectSlug;
  const effectiveShortcutScope = readerShortcutScope === "subject" && selectedSubjectSlug ? "subject" : "global";
  const shortcutStorageKey = useMemo(() => {
    if (effectiveShortcutScope === "subject" && selectedSubjectSlug) {
      return `${READER_SHORTCUTS_STORAGE_KEY}:${selectedSubjectSlug}`;
    }
    return `${READER_SHORTCUTS_STORAGE_KEY}:global`;
  }, [effectiveShortcutScope, selectedSubjectSlug]);
  const loadingShortcutsRef = useRef(false);
  const isTouchInputDevice = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
    return window.navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  }, []);
  const readerEffectiveZoom = readerZoom * readerGestureZoom;
  const readerMinGestureScale = 1;
  const readerGestureActive = readerEffectiveZoom > READER_GESTURE_ACTIVE_ZOOM;
  const stableReaderWidth = useMemo(() => {
    const vw = Math.max(56, Number((92 * readerZoom).toFixed(2)));
    const px = Math.max(560, Math.round(980 * readerZoom));
    return `min(${vw}vw, ${px}px)`;
  }, [readerZoom]);

  const pushNotice = useCallback((title: string, body: string) => {
    const id = `res_notice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setNotices((prev) => [...prev, { id, title, body }]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }, 3800);
  }, [props.initialSelectedId, openQueryPdfId]);

  useEffect(() => {
    if (!props.initialSelectedId) return;
    if (!items.some((item) => item.id === props.initialSelectedId)) return;
    setSelectedId(props.initialSelectedId);
  }, [items, props.initialSelectedId]);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await listPdfResources();
        setItems(all);
        setSelectedId((prev) => prev ?? props.initialSelectedId ?? openQueryPdfId ?? (all[0]?.id ?? null));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [props.initialSelectedId, openQueryPdfId]);

  useEffect(() => {
    setLargePdfRemoteUrlById(loadLargePdfRemoteUrlById());
  }, []);

  useEffect(() => {
    persistLargePdfRemoteUrlById(largePdfRemoteUrlById);
  }, [largePdfRemoteUrlById]);

  useEffect(() => {
    setSrsLib(loadSrsLibrary());
  }, []);

  useEffect(() => {
    if (readerShortcutScope === "subject" && !currentSelectedSubjectSlug) {
      setReaderShortcutScope("global");
    }
  }, [readerShortcutScope, currentSelectedSubjectSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    loadingShortcutsRef.current = true;
    try {
      const raw = window.localStorage.getItem(shortcutStorageKey);
      if (!raw) {
        setReaderShortcuts(DEFAULT_READER_SHORTCUTS);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<ReaderShortcutConfig>;
      setReaderShortcuts({
        save: normalizeShortcutBinding(parsed.save ?? DEFAULT_READER_SHORTCUTS.save) || DEFAULT_READER_SHORTCUTS.save,
        bookmark: normalizeShortcutBinding(parsed.bookmark ?? DEFAULT_READER_SHORTCUTS.bookmark) || DEFAULT_READER_SHORTCUTS.bookmark,
        note: normalizeShortcutBinding(parsed.note ?? DEFAULT_READER_SHORTCUTS.note) || DEFAULT_READER_SHORTCUTS.note,
        nextBookmark: normalizeShortcutBinding(parsed.nextBookmark ?? DEFAULT_READER_SHORTCUTS.nextBookmark) || DEFAULT_READER_SHORTCUTS.nextBookmark,
        prevBookmark: normalizeShortcutBinding(parsed.prevBookmark ?? DEFAULT_READER_SHORTCUTS.prevBookmark) || DEFAULT_READER_SHORTCUTS.prevBookmark,
      });
    } catch {
      setReaderShortcuts(DEFAULT_READER_SHORTCUTS);
    } finally {
      loadingShortcutsRef.current = false;
    }
  }, [shortcutStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadingShortcutsRef.current) return;
    try {
      window.localStorage.setItem(shortcutStorageKey, JSON.stringify(readerShortcuts));
    } catch {
      // ignore
    }
  }, [readerShortcuts, shortcutStorageKey]);
  useEffect(() => {
    const clearRenderRetryState = () => {
      setRenderingPreviewPages(new Set());
      setFailedPreviewPages(new Set());
      setPreviewPageFailures({});
      previewRenderInFlightRef.current.clear();
      previewRenderQueuedRef.current.clear();
      previewRenderRetryCountRef.current.clear();
      for (const timeoutId of previewRenderRetryTimerRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      previewRenderRetryTimerRef.current.clear();
    };

    const run = async () => {
      if (!selectedId) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        setPreviewStalled(false);
        setPreviewPages([]);
        setPreviewTextLayers([]);
        clearRenderRetryState();
        setPreviewError(null);
        setPageCount(null);
        setExtractedText("");
        setChunks([]);
        setSelectedChunkIdxs(new Set());
        setExtractError(null);
        return;
      }

      if (!immersiveMode) {
        setPreviewLoading(false);
        setPreviewStalled(false);
        setPreviewPages([]);
        setPreviewTextLayers([]);
        clearRenderRetryState();
        setPreviewError(null);
        setPageCount(null);
        return;
      }

      const selectedMeta = items.find((item) => item.id === selectedId) ?? null;
      const isTouch = isTouchInputDevice();
      const compatibilityThreshold = isTouch ? LARGE_PDF_COMPATIBILITY_BYTES_TOUCH : LARGE_PDF_COMPATIBILITY_BYTES_DESKTOP;
      const useCompatibilityMode = Boolean(selectedMeta && selectedMeta.sizeBytes >= compatibilityThreshold);
      const remoteCompatibilityUrl = useCompatibilityMode ? resolveLargePdfRemoteUrl(selectedMeta, largePdfRemoteUrlById) : null;

      const cached = PDF_PREVIEW_CACHE.get(selectedId);
      if (cached && !useCompatibilityMode) {
        setPreviewUrl(cached.objectUrl);
        setPreviewPages(cached.pages);
        setPreviewTextLayers(cached.textLayers);
        clearRenderRetryState();
        setPageCount(cached.pageCount);
        setPreviewLoading(false);
        setPreviewStalled(false);
        setPreviewError(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewStalled(false);
      setPreviewPages([]);
      setPreviewTextLayers([]);
      clearRenderRetryState();
      setPreviewError(null);
      setPageCount(null);
      setExtractedText("");
      setChunks([]);
      setSelectedChunkIdxs(new Set());
      setExtractError(null);
      setAiNotes(null);
      setAiError(null);

      if (useCompatibilityMode) {
        if (!remoteCompatibilityUrl) {
          setPreviewUrl(null);
          setPreviewPages([]);
          setPreviewTextLayers([]);
          clearRenderRetryState();
          setPageCount(null);
          setPreviewLoading(false);
          setPreviewStalled(false);
          setPreviewError("Este PDF es grande y requiere URL remota (R2). Configura la URL en Vista gestión → URL remota (R2).");
          return;
        }

        try {
          const rendered = await renderPdfPagesFromRemoteUrl(remoteCompatibilityUrl);
          const entry: PdfPreviewCacheEntry = {
            objectUrl: remoteCompatibilityUrl,
            sourceData: null,
            remoteUrl: remoteCompatibilityUrl,
            pages: rendered.pages,
            textLayers: Array(rendered.pageCount).fill(null),
            pageCount: rendered.pageCount,
          };
          PDF_PREVIEW_CACHE.set(selectedId, entry);
          setPreviewUrl(entry.objectUrl);
          setPreviewPages(entry.pages);
          setPreviewTextLayers(entry.textLayers);
          clearRenderRetryState();
          setPageCount(entry.pageCount);
          setPreviewLoading(false);
          setPreviewStalled(false);
          setPreviewError(null);
        } catch (error) {
          setPreviewUrl(remoteCompatibilityUrl);
          setPreviewLoading(false);
          setPreviewPages([]);
          setPreviewTextLayers([]);
          clearRenderRetryState();
          setPreviewError(classifyRemotePdfLoadError(error));
        }
        return;
      }

      const blob = await getPdfResourceBlob(selectedId);
      if (!blob) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        setPreviewPages([]);
        setPreviewTextLayers([]);
        clearRenderRetryState();
        setPageCount(null);
        setExtractedText("");
        setChunks([]);
        setSelectedChunkIdxs(new Set());
        setExtractError(null);
        setPreviewError("No se pudo leer el PDF.");
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      bindPreviewCacheCleanup();

      if (useCompatibilityMode) {
        setPreviewUrl(objectUrl);
        setPreviewPages([]);
        setPreviewTextLayers([]);
        clearRenderRetryState();
        setPageCount(null);
        setPreviewLoading(false);
        setPreviewStalled(false);
        setPreviewError(null);
        return;
      }

      try {
        const rendered = await renderPdfPages(blob);
        const entry: PdfPreviewCacheEntry = {
          objectUrl,
          sourceData: rendered.sourceData,
          remoteUrl: null,
          pages: rendered.pages,
          textLayers: Array(rendered.pageCount).fill(null),
          pageCount: rendered.pageCount,
        };
        PDF_PREVIEW_CACHE.set(selectedId, entry);
        setPreviewUrl(entry.objectUrl);
        setPreviewPages(entry.pages);
        setPreviewTextLayers(entry.textLayers);
        clearRenderRetryState();
        setPageCount(entry.pageCount);
        setPreviewLoading(false);
        setPreviewStalled(false);
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        setPreviewLoading(false);
        setPreviewPages([]);
        setPreviewTextLayers([]);
        clearRenderRetryState();
        setPreviewError(e instanceof Error ? e.message : "No se pudo renderizar el PDF.");
      }
    };

    void run();
  }, [selectedId, immersiveMode, items, largePdfRemoteUrlById, isTouchInputDevice]);

  useEffect(() => {
    previewPagesRef.current = previewPages;
  }, [previewPages]);

  useEffect(() => {
    readerPageRef.current = readerPage;
  }, [readerPage]);

  useEffect(() => {
    readerEffectiveZoomRef.current = readerEffectiveZoom;
  }, [readerEffectiveZoom]);

  useEffect(() => {
    if (!immersiveMode || readerToolMode !== "lectura" || !selectedId || !previewPages.length) return;
    const root = previewScrollRef.current;
    if (!root) return;
    const { targetWidth, dprBucket } = resolvePdfRenderProfile();
    const maxConcurrentRenders = prefersLightPdfRenderProfile() ? 1 : 2;
    const retryTimerMap = previewRenderRetryTimerRef.current;
    const renderQueue = previewRenderQueuedRef.current;
    let disposed = false;

    const setPageFailure = (page: number, reason: PageRenderFailureReason, detail = "") => {
      const label = renderFailureReasonLabel(reason, detail);
      setPreviewPageFailures((prev) => (prev[page] === label ? prev : { ...prev, [page]: label }));
    };

    const clearPageFailure = (page: number) => {
      setPreviewPageFailures((prev) => {
        if (!(page in prev)) return prev;
        const next = { ...prev };
        delete next[page];
        return next;
      });
    };

    const clearRetryTimer = (page: number) => {
      const timeoutId = retryTimerMap.get(page);
      if (typeof timeoutId === "number") {
        window.clearTimeout(timeoutId);
        retryTimerMap.delete(page);
      }
    };

    const scheduleRetry = (page: number, reason: PageRenderFailureReason, detail = "") => {
      if (disposed) return;
      setPageFailure(page, reason, detail);
      const attempt = previewRenderRetryCountRef.current.get(page) ?? 0;
      if (attempt >= 6) {
        setFailedPreviewPages((prev) => {
          if (prev.has(page)) return prev;
          const next = new Set(prev);
          next.add(page);
          return next;
        });
        clearRetryTimer(page);
        const timeoutId = window.setTimeout(() => {
          retryTimerMap.delete(page);
          requestPageRender(page);
        }, 2400);
        retryTimerMap.set(page, timeoutId);
        return;
      }

      previewRenderRetryCountRef.current.set(page, attempt + 1);
      clearRetryTimer(page);
      const delay = Math.min(300 * 2 ** attempt, 1800);
      const timeoutId = window.setTimeout(() => {
        retryTimerMap.delete(page);
        requestPageRender(page);
      }, delay);
      retryTimerMap.set(page, timeoutId);
    };

    const pumpRenderQueue = () => {
      if (disposed) return;
      if (!renderQueue.size) return;
      while (previewRenderInFlightRef.current.size < maxConcurrentRenders) {
        const nextPage = renderQueue.values().next().value as number | undefined;
        if (!nextPage) return;
        renderQueue.delete(nextPage);
        startPageRender(nextPage);
      }
    };

    const requestPageRender = (pageNumber: number, priority: "normal" | "high" = "normal") => {
      if (disposed) return;
      if (!Number.isFinite(pageNumber)) return;
      const totalPages = previewPagesRef.current.length;
      if (!totalPages) return;
      const safePage = clamp(Math.floor(pageNumber), 1, totalPages);
      if (previewPagesRef.current[safePage - 1]) {
        previewRenderRetryCountRef.current.delete(safePage);
        clearRetryTimer(safePage);
        clearPageFailure(safePage);
        setFailedPreviewPages((prev) => {
          if (!prev.has(safePage)) return prev;
          const next = new Set(prev);
          next.delete(safePage);
          return next;
        });
        return;
      }
      if (previewRenderInFlightRef.current.has(safePage) || renderQueue.has(safePage)) return;

      if (priority === "high" && previewRenderInFlightRef.current.size < maxConcurrentRenders) {
        startPageRender(safePage);
        return;
      }

      renderQueue.add(safePage);
      if (priority === "high") {
        const ordered = [safePage, ...Array.from(renderQueue).filter((page) => page !== safePage)];
        renderQueue.clear();
        for (const page of ordered) renderQueue.add(page);
      }
      pumpRenderQueue();
    };

    const startPageRender = (safePage: number) => {
      if (disposed) return;

      const entry = PDF_PREVIEW_CACHE.get(selectedId);
      if (!entry) {
        scheduleRetry(safePage, "cache-miss", "entry-null");
        return;
      }

      previewRenderInFlightRef.current.add(safePage);
      setRenderingPreviewPages((prev) => {
        const next = new Set(prev);
        next.add(safePage);
        return next;
      });
      setFailedPreviewPages((prev) => {
        if (!prev.has(safePage)) return prev;
        const next = new Set(prev);
        next.delete(safePage);
        return next;
      });
      clearPageFailure(safePage);

      void (async () => {
        try {
          let cachedPage: { imageSrc: string; textLayer: string | null } | null = null;
          try {
            cachedPage = await getCachedRenderedPdfPage({
              documentId: selectedId,
              page: safePage,
              width: Math.floor(targetWidth),
              dprBucket,
            });
          } catch (error) {
            cachedPage = null;
            setPageFailure(safePage, "cache-lookup", normalizeErrorMessage(error));
          }

          if (cachedPage?.imageSrc) {
            if (!disposed) {
              previewRenderRetryCountRef.current.delete(safePage);
              clearRetryTimer(safePage);
              clearPageFailure(safePage);
              setPreviewPages((prev) => {
                if (!prev.length || prev[safePage - 1]) return prev;
                const next = [...prev];
                next[safePage - 1] = cachedPage.imageSrc;
                return next;
              });

              setPreviewTextLayers((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[safePage - 1] = cachedPage.textLayer;
                return next;
              });

              const memCached = PDF_PREVIEW_CACHE.get(selectedId);
              if (memCached) {
                memCached.pages[safePage - 1] = cachedPage.imageSrc;
                memCached.textLayers[safePage - 1] = cachedPage.textLayer;
              }
            }
            return;
          }

          const pageResult = entry.sourceData
            ? await renderPdfPageAsset(entry.sourceData, safePage)
            : entry.remoteUrl
              ? await renderPdfPageAssetFromRemoteUrl(entry.remoteUrl, safePage)
              : {
                  imageSrc: "",
                  textLayer: "",
                  failureReason: "cache-miss" as PageRenderFailureReason,
                  failureDetail: "source-empty",
                };
          const { imageSrc, textLayer, failureReason, failureDetail } = pageResult;
          if (disposed) return;
          if (!imageSrc) {
            scheduleRetry(safePage, failureReason ?? "unknown", failureDetail);
            return;
          }

          previewRenderRetryCountRef.current.delete(safePage);
          clearRetryTimer(safePage);
          clearPageFailure(safePage);

          setPreviewPages((prev) => {
            if (!prev.length || prev[safePage - 1]) return prev;
            const next = [...prev];
            next[safePage - 1] = imageSrc;
            return next;
          });

          setPreviewTextLayers((prev) => {
            if (!prev.length) return prev;
            const next = [...prev];
            next[safePage - 1] = textLayer || null;
            return next;
          });

          const cached = PDF_PREVIEW_CACHE.get(selectedId);
          if (cached) {
            cached.pages[safePage - 1] = imageSrc;
            cached.textLayers[safePage - 1] = textLayer || null;
          }

          void putCachedRenderedPdfPage({
            documentId: selectedId,
            page: safePage,
            width: Math.floor(targetWidth),
            dprBucket,
            imageSrc,
            textLayer: textLayer || null,
          }).catch(() => {
            // ignore cache persistence failures
          });
        } catch (error) {
          scheduleRetry(safePage, "unknown", normalizeErrorMessage(error));
        } finally {
          previewRenderInFlightRef.current.delete(safePage);
          setRenderingPreviewPages((prev) => {
            if (!prev.has(safePage)) return prev;
            const next = new Set(prev);
            next.delete(safePage);
            return next;
          });
          pumpRenderQueue();
        }
      })();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          const page = Number(target.dataset.previewPage);
          if (!Number.isFinite(page)) continue;
          requestPageRender(page - 1);
          requestPageRender(page);
          requestPageRender(page + 1);
          requestPageRender(page + 2);
          requestPageRender(page + 3);
          requestPageRender(page + 4);
        }
      },
      {
        root,
        rootMargin: "90% 0px 120% 0px",
        threshold: 0.01,
      },
    );

    requestPageRender(readerPage, "high");
    requestPageRender(readerPage - 1, "high");
    requestPageRender(readerPage + 1, "high");
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-preview-page]"));
    for (const node of nodes) observer.observe(node);

    requestPageRender(readerPage + 2, "high");
    requestPageRender(readerPage + 3, "high");
    requestPageRender(readerPage + 4);
    requestPageRender(readerPage + 5);

    return () => {
      disposed = true;
      observer.disconnect();
      const pendingRetryTimeouts = Array.from(retryTimerMap.values());
      for (const timeoutId of pendingRetryTimeouts) {
        window.clearTimeout(timeoutId);
      }
      retryTimerMap.clear();
      renderQueue.clear();
    };
  }, [immersiveMode, readerToolMode, selectedId, previewPages.length, readerPage]);

  useEffect(() => {
    if (!selectedId || !previewPages.length) return;
    if (immersiveMode && readerToolMode === "lectura") return;
    const keepBehind = 4;
    const keepAhead = 12;

    setPreviewPages((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      let changed = false;
      for (let idx = 0; idx < next.length; idx += 1) {
        const page = idx + 1;
        const shouldKeep = page >= readerPage - keepBehind && page <= readerPage + keepAhead;
        if (shouldKeep) continue;
        if (!next[idx]) continue;
        if (renderingPreviewPages.has(page)) continue;
        next[idx] = null;
        changed = true;
      }
      if (!changed) return prev;

      const cacheEntry = PDF_PREVIEW_CACHE.get(selectedId);
      if (cacheEntry) cacheEntry.pages = [...next];
      return next;
    });

    setPreviewTextLayers((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      let changed = false;
      for (let idx = 0; idx < next.length; idx += 1) {
        const page = idx + 1;
        const shouldKeep = page >= readerPage - keepBehind && page <= readerPage + keepAhead;
        if (shouldKeep) continue;
        if (!next[idx]) continue;
        if (renderingPreviewPages.has(page)) continue;
        next[idx] = null;
        changed = true;
      }
      if (!changed) return prev;

      const cacheEntry = PDF_PREVIEW_CACHE.get(selectedId);
      if (cacheEntry) cacheEntry.textLayers = [...next];
      return next;
    });
  }, [immersiveMode, readerToolMode, selectedId, previewPages.length, readerPage, renderingPreviewPages]);

  useEffect(() => {
    if (!previewLoading || !previewUrl) return;
    const timeoutId = window.setTimeout(() => {
      setPreviewStalled(true);
      setPreviewLoading(false);
    }, 9000);
    return () => window.clearTimeout(timeoutId);
  }, [previewLoading, previewUrl]);

  const selectedTextForAi = useMemo(() => {
    if (!chunks.length || selectedChunkIdxs.size === 0) return extractedText;
    const parts = [...selectedChunkIdxs]
      .sort((a, b) => a - b)
      .map((idx) => chunks[idx])
      .filter(Boolean);
    return parts.join("\n\n").trim();
  }, [chunks, selectedChunkIdxs, extractedText]);

  useEffect(() => {
    const requestedSubject = searchParams.get("subject");
    if (!requestedSubject) return;
    if (!(requestedSubject in SUBJECTS)) return;
    setFilterSubject(requestedSubject);
    setSubject(requestedSubject);
  }, [searchParams]);

  useEffect(() => {
    if (!srsLib) return;
    const decks = srsLib.decks.filter((d) => (subject === "all" ? true : d.subjectSlug === subject));
    if (!decks.some((d) => d.id === deckId) && decks[0]) setDeckId(decks[0].id);
  }, [srsLib, subject, deckId]);

  const filtered = useMemo(() => {
    let list = items;
    if (filterSubject === "unassigned") {
      list = list.filter((i) => !i.subjectSlug);
    } else if (filterSubject !== "all") {
      list = list.filter((i) => i.subjectSlug === filterSubject);
    }

    if (filterStarredOnly) {
      list = list.filter((i) => i.starred);
    }

    const folderQ = filterFolder.trim().toLowerCase();
    if (folderQ) {
      list = list.filter((i) => (i.folderPath ?? "").toLowerCase().includes(folderQ));
    }

    const tagQ = filterTag.trim().toLowerCase();
    if (tagQ) {
      list = list.filter((i) => i.tags.some((tag) => tag.includes(tagQ)));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const haystack = [i.title, i.folderPath ?? "", i.tags.join(" ")].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }

    const sorted = [...list];
    if (sortBy === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "es", { sensitivity: "base" }));
    } else if (sortBy === "size") {
      sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
    } else {
      sorted.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    }

    return sorted;
  }, [items, query, filterSubject, filterStarredOnly, filterFolder, filterTag, sortBy]);

  const folderSuggestions = useMemo(
    () => [...new Set(items.map((i) => i.folderPath?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );

  const tagSuggestions = useMemo(
    () => [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );

  const groupedFiltered = useMemo(() => {
    const map = new Map<string, PdfResource[]>();
    for (const item of filtered) {
      const key = item.folderPath?.trim() || "Sin carpeta";
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === "Sin carpeta") return 1;
        if (b === "Sin carpeta") return -1;
        return a.localeCompare(b, "es", { sensitivity: "base" });
      })
      .map(([folder, docs]) => ({ folder, docs }));
  }, [filtered]);

  const bulkSelectedCount = bulkSelection.size;

  const toggleBulkSelection = (id: string, checked: boolean) => {
    setBulkSelection((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearBulkSelection = () => {
    setBulkSelection(new Set());
  };

  useEffect(() => {
    setBulkSelection((prev) => {
      if (!prev.size) return prev;
      const valid = new Set(items.map((i) => i.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
      }
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [items]);

  const applyBulkFavorite = async (starred: boolean) => {
    const ids = [...bulkSelection];
    if (!ids.length) return;
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => updatePdfResourceMeta(id, { starred })));
      const updatedAtMs = Date.now();
      setItems((prev) => prev.map((x) => (bulkSelection.has(x.id) ? { ...x, starred, updatedAtMs } : x)));
      pushNotice("Acción masiva", `${ids.length} PDF${ids.length === 1 ? "" : "s"} actualizado${ids.length === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_RESOURCES_SYNC_BASE_URL?.trim() || withBasePath("/api/resources-sync");

    setSyncBusy(true);
    try {
      const adapter = createHttpResourcesSyncAdapter({
        baseUrl,
        token: process.env.NEXT_PUBLIC_RESOURCES_SYNC_TOKEN,
      });
      const summary = await syncResourcesLocalFirst({
        adapter,
        lastCursor: loadResourcesSyncCursor(),
      });
      saveResourcesSyncCursor(summary.nextCursor);

      const all = await listPdfResources();
      setItems(all);
      setSelectedId((prev) => prev ?? (all[0]?.id ?? null));
      pushNotice(
        "Sync completado",
        `Recursos +${summary.importedResources} (${summary.skippedResources} omitidos), Meta +${summary.importedMeta} (${summary.skippedMeta} omitidos).`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de sincronización";
      pushNotice("Sync fallido", msg);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleExportLibraryBackup = async () => {
    if (typeof window === "undefined") return;
    try {
      const payload = await exportResourcesLibraryBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resources-library-backup-${new Date(payload.exportedAtMs).toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
      pushNotice("Backup exportado", `${payload.resources.length} recursos y ${payload.libraryMeta.length} metadatos listos para respaldo.`);
    } catch {
      pushNotice("Backup fallido", "No se pudo exportar la biblioteca.");
    }
  };

  const onImportLibraryBackup = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = await importResourcesLibraryBackup({ data: parsed });
      const all = await listPdfResources();
      setItems(all);
      setSelectedId((prev) => prev ?? (all[0]?.id ?? null));
      pushNotice(
        "Backup importado",
        `Recursos: +${result.importedResources} (${result.skippedResources} omitidos) · Meta: +${result.importedMeta} (${result.skippedMeta} omitidos).`,
      );
    } catch {
      pushNotice("Importación fallida", "El archivo de respaldo no es válido.");
    }
  };

  const applyBulkFolder = async () => {
    const ids = [...bulkSelection];
    if (!ids.length) return;
    setBusy(true);
    try {
      const nextFolderPath = bulkFolderInput.trim();
      await Promise.all(ids.map((id) => updatePdfResourceMeta(id, { folderPath: nextFolderPath })));
      const updatedAtMs = Date.now();
      setItems((prev) => prev.map((x) => (bulkSelection.has(x.id) ? { ...x, folderPath: nextFolderPath || undefined, updatedAtMs } : x)));
      pushNotice("Carpeta aplicada", `${ids.length} recurso${ids.length === 1 ? "" : "s"} movido${ids.length === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  };

  const applyBulkTagsMerge = async () => {
    const ids = [...bulkSelection];
    const addTags = parseTagInput(bulkTagsInput);
    if (!ids.length || !addTags.length) return;
    setBusy(true);
    try {
      const selectedItems = items.filter((x) => bulkSelection.has(x.id));
      await Promise.all(
        selectedItems.map((item) => {
          const merged = [...new Set([...item.tags, ...addTags])];
          return updatePdfResourceMeta(item.id, { tags: merged });
        }),
      );

      const updatedAtMs = Date.now();
      setItems((prev) =>
        prev.map((x) => {
          if (!bulkSelection.has(x.id)) return x;
          const merged = [...new Set([...x.tags, ...addTags])];
          return { ...x, tags: merged, updatedAtMs };
        }),
      );
      pushNotice("Tags aplicados", `Se agregaron tags en ${ids.length} PDF${ids.length === 1 ? "" : "s"}.`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!filtered.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((i) => i.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  const selectedRemotePdfUrl = useMemo(() => resolveLargePdfRemoteUrl(selected, largePdfRemoteUrlById), [selected, largePdfRemoteUrlById]);
  const isLargePdfCompatibilityMode = useMemo(() => {
    if (!selected) return false;
    const threshold = isTouchInputDevice() ? LARGE_PDF_COMPATIBILITY_BYTES_TOUCH : LARGE_PDF_COMPATIBILITY_BYTES_DESKTOP;
    return selected.sizeBytes >= threshold;
  }, [selected, isTouchInputDevice]);
  const largePdfCompatibilityThresholdLabel = useMemo(() => {
    const threshold = isTouchInputDevice() ? LARGE_PDF_COMPATIBILITY_BYTES_TOUCH : LARGE_PDF_COMPATIBILITY_BYTES_DESKTOP;
    return formatPdfSizeLabel(threshold);
  }, [isTouchInputDevice]);
  const aiRangeStart = selected ? Math.max(1, Math.floor(selected.pageStart || 1)) : 1;
  const aiRangeEnd = selected ? Math.max(aiRangeStart, Math.floor(selected.pageEnd || aiRangeStart)) : aiRangeStart;
  const currentBookmark = useMemo(
    () => readerBookmarks.find((b) => b.page === readerPage) ?? null,
    [readerBookmarks, readerPage],
  );
  const currentNote = useMemo(
    () => readerNotes.find((n) => n.page === readerPage) ?? null,
    [readerNotes, readerPage],
  );
  const filteredReaderBookmarks = useMemo(() => {
    const q = bookmarkFilterQuery.trim().toLowerCase();
    if (!q) return readerBookmarks;
    return readerBookmarks.filter((b) => (b.label ?? "").toLowerCase().includes(q) || `${b.page}`.includes(q));
  }, [readerBookmarks, bookmarkFilterQuery]);
  const bookmarkPageSet = useMemo(() => new Set(readerBookmarks.map((b) => b.page)), [readerBookmarks]);
  const notePageSet = useMemo(() => new Set(readerNotes.map((n) => n.page)), [readerNotes]);
  const filteredReaderNotes = useMemo(() => {
    const q = noteSearchQuery.trim().toLowerCase();
    if (!q) return readerNotes;
    return readerNotes.filter((n) => n.payload.text.toLowerCase().includes(q) || `pag ${n.page}`.includes(q));
  }, [readerNotes, noteSearchQuery]);
  const normalizedShortcutByAction = useMemo(() => {
    return {
      save: normalizeShortcutBinding(readerShortcuts.save),
      bookmark: normalizeShortcutBinding(readerShortcuts.bookmark),
      note: normalizeShortcutBinding(readerShortcuts.note),
      prevBookmark: normalizeShortcutBinding(readerShortcuts.prevBookmark),
      nextBookmark: normalizeShortcutBinding(readerShortcuts.nextBookmark),
    } satisfies ReaderShortcutConfig;
  }, [readerShortcuts]);

  useEffect(() => {
    if (!selected) {
      setRemotePdfUrlInput("");
      return;
    }
    setRemotePdfUrlInput(selectedRemotePdfUrl ?? "");
  }, [selected, selectedRemotePdfUrl]);

  const saveSelectedRemotePdfUrl = useCallback(() => {
    if (!selected) return;
    const nextUrl = remotePdfUrlInput.trim();
    if (!nextUrl) {
      setLargePdfRemoteUrlById((prev) => {
        if (!(selected.id in prev)) return prev;
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      pushNotice("URL remota eliminada", "Este PDF volverá a usar fuente local.");
      return;
    }
    if (!isValidHttpUrl(nextUrl)) {
      pushNotice("URL inválida", "Usa una URL completa que empiece con http:// o https://");
      return;
    }
    setLargePdfRemoteUrlById((prev) => ({ ...prev, [selected.id]: nextUrl }));
    pushNotice("URL remota guardada", "Este PDF grande abrirá desde R2 en modo compatibilidad.");
  }, [selected, remotePdfUrlInput, pushNotice]);

  const shortcutConflictByAction = useMemo(() => {
    const byBinding = new Map<string, ReaderShortcutAction[]>();
    for (const action of READER_SHORTCUT_ACTIONS) {
      const binding = normalizedShortcutByAction[action];
      if (!binding) continue;
      const next = byBinding.get(binding) ?? [];
      next.push(action);
      byBinding.set(binding, next);
    }

    const out: Partial<Record<ReaderShortcutAction, string>> = {};
    for (const actions of byBinding.values()) {
      if (actions.length < 2) continue;
      for (const action of actions) {
        out[action] = actions
          .filter((candidate) => candidate !== action)
          .map((candidate) => READER_SHORTCUT_ACTION_LABELS[candidate])
          .join(", ");
      }
    }
    return out;
  }, [normalizedShortcutByAction]);
  const hasShortcutConflicts = useMemo(
    () => READER_SHORTCUT_ACTIONS.some((action) => Boolean(shortcutConflictByAction[action])),
    [shortcutConflictByAction],
  );
  const resumeQueryPdfId = searchParams.get("resumePdf");
  const resumeQueryPageRaw = Number(searchParams.get("resumePage") ?? "");

  const speakRabbit = (payload: RabbitGuideSpeechPayload) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(RABBIT_GUIDE_SPEAK_EVENT, { detail: payload }));
  };

  const withBasePath = useCallback((path: string) => {
    if (!path) return path;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const basePath = process.env.NODE_ENV === "production" ? "/Medhub-github.com" : "";
    return `${basePath}${path}`;
  }, []);

  const normalizeToWindowRoute = useCallback((href: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return null;

      const targetWindowPath = nextUrl.pathname.replace(/\/+$/, "") || "/";
      return `${targetWindowPath}${nextUrl.search}${nextUrl.hash}`;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    const resume = getPdfResumeForResource(selected.id);
    const nextPage = resume ?? selected.pageStart ?? 1;
    initialPageAlignRef.current = nextPage;
    setReaderPage(nextPage);
    setCommittedReaderPage(nextPage);

    speakRabbit({
      title: "Retomemos lectura",
      message: `${selected.title}: última página guardada ${nextPage}.`,
      actions: [
        {
          href: `/biblioteca?resumePdf=${encodeURIComponent(selected.id)}&resumePage=${nextPage}`,
          label: "Ir a esa página",
          primary: true,
        },
      ],
      durationMs: 5200,
    });
  }, [selected]);

  useEffect(() => {
    if (!selectedId) {
      setReaderBookmarks([]);
      setReaderNotes([]);
      return;
    }

    const loadArtifacts = () => {
      setReaderBookmarks(listReaderBookmarks(selectedId));
      setReaderNotes(listReaderNotes(selectedId));
    };

    loadArtifacts();
    const onUpdated = () => loadArtifacts();
    window.addEventListener(RESOURCES_READER_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(RESOURCES_READER_UPDATED_EVENT, onUpdated);
  }, [selectedId]);

  useEffect(() => {
    const next = readerNotes.find((n) => n.page === readerPage)?.payload.text ?? "";
    setNoteDraft(next);
  }, [readerNotes, readerPage, selectedId]);

  useEffect(() => {
    if (!selected) {
      setAiNotes(null);
      return;
    }

    const cached = findFlashcardsArtifact({
      documentId: selected.id,
      pageStart: aiRangeStart,
      pageEnd: aiRangeEnd,
    });
    if (!cached) {
      setAiNotes(null);
      return;
    }
    setAiNotes(Array.isArray(cached.payload.notes) ? cached.payload.notes : null);
  }, [selected, aiRangeStart, aiRangeEnd]);

  useEffect(() => {
    if (!resumeQueryPdfId) return;
    const target = items.find((x) => x.id === resumeQueryPdfId);
    if (!target) return;
    const page = Number.isFinite(resumeQueryPageRaw) ? Math.max(1, Math.floor(resumeQueryPageRaw)) : 1;
    initialPageAlignRef.current = page;
    setSelectedId(target.id);
    setReaderPage(page);
    setCommittedReaderPage(page);
  }, [items, resumeQueryPdfId, resumeQueryPageRaw]);

  const scrollToPreviewPage = useCallback((page: number, behavior: ScrollBehavior = "smooth") => {
    const root = previewScrollRef.current;
    if (!root) return;
    const node = root.querySelector<HTMLElement>(`[data-preview-page="${page}"]`);
    if (!node) return;
    root.scrollTo({ top: node.offsetTop - 8, behavior });
  }, []);

  const jumpToPage = useCallback((next: number, behavior: ScrollBehavior = "smooth") => {
    const maxPage = (pageCount ?? previewPages.length) || 1;
    const safe = clamp(Math.floor(next || 1), 1, maxPage);
    setReaderPage(safe);
    setReaderPageDialogInput(String(safe));
    scrollToPreviewPage(safe, behavior);
  }, [pageCount, previewPages.length, scrollToPreviewPage]);

  const pauseReaderScrollSync = useCallback((ms = 320) => {
    readerScrollSyncPauseUntilRef.current = Date.now() + Math.max(120, Math.floor(ms));
  }, []);

  const computeReaderFitZoom = useCallback(() => {
    const root = previewScrollRef.current;
    if (!root) return null;
    const firstPage = root.querySelector<HTMLElement>("[data-preview-page='1']");
    if (!firstPage) return null;

    const pageRect = firstPage.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) return null;
    const currentScale = Math.max(0.01, readerEffectiveZoomRef.current || 1);
    const unscaledPageWidth = pageRect.width / currentScale;
    const unscaledPageHeight = pageRect.height / currentScale;
    if (unscaledPageWidth <= 0 || unscaledPageHeight <= 0) return null;

    const fitByWidth = (root.clientWidth - 28) / unscaledPageWidth;
    const fitByHeight = (root.clientHeight - 28) / unscaledPageHeight;
    const viewportLandscape = root.clientWidth > root.clientHeight;
    const fitCoverage = readerFitMode === "full"
      ? (viewportLandscape ? 0.94 : 0.995)
      : (viewportLandscape ? 0.88 : 0.96);
    const fitted = Math.min(fitByWidth, fitByHeight, 1) * fitCoverage;
    return clamp(Number.isFinite(fitted) ? fitted : 1, 0.45, 1);
  }, [readerFitMode]);

  const applyFitZoom = useCallback((force = false) => {
    const nextMin = computeReaderFitZoom();
    if (!nextMin) return;
    setReaderMinZoom(nextMin);
    setReaderZoom((prev) => {
      if (force) return nextMin;
      if (!readerFitZoomAppliedRef.current) return nextMin;
      return clamp(prev, nextMin, 2.4);
    });
    if (force || !readerFitZoomAppliedRef.current) {
      setReaderGestureZoom(1);
      setReaderPan({ x: 0, y: 0 });
      readerFitZoomAppliedRef.current = true;
    }
    pauseReaderScrollSync(force ? 420 : 240);
  }, [computeReaderFitZoom, pauseReaderScrollSync]);

  const recoverReaderViewport = useCallback((reason: string) => {
    const now = Date.now();
    if (now - readerLastRecoverAtRef.current < 1800) return;
    readerLastRecoverAtRef.current = now;
    readerRecoveryBurstRef.current = readerRecoveryBurstRef.current
      .filter((at) => now - at < 12000)
      .concat(now);
    if (readerRecoveryBurstRef.current.length >= 3) {
      setReaderSafeMode(true);
    }
    setReaderPan({ x: 0, y: 0 });
    setReaderGestureZoom(1);
    pauseReaderScrollSync(520);
    setReaderRecoverNonce((prev) => prev + 1);
    window.requestAnimationFrame(() => applyFitZoom(true));
    if (process.env.NODE_ENV !== "production") {
      console.warn("[reader] viewport auto-recovery", {
        reason,
        selectedId,
        readerPage: readerPageRef.current,
        zoom: readerEffectiveZoomRef.current,
        safeMode: readerRecoveryBurstRef.current.length >= 3,
      });
    }
  }, [applyFitZoom, pauseReaderScrollSync, selectedId]);

  const updateReaderZoom = useCallback((next: number) => {
    setReaderZoom(clamp(Number(next) || readerMinZoom, readerMinZoom, 2.4));
    setReaderGestureZoom(1);
    setReaderPan({ x: 0, y: 0 });
    pauseReaderScrollSync(320);
  }, [readerMinZoom, pauseReaderScrollSync]);

  const handleGestureUpdate = useCallback(({ x, y, scale }: { x: number; y: number; scale: number }) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) return;
    pauseReaderScrollSync(360);
    const safeScale = clamp(scale || 1, readerMinGestureScale, 3.2);
    if (safeScale <= readerMinGestureScale + 0.02) {
      setReaderPan({ x: 0, y: 0 });
      setReaderGestureZoom(1);
      return;
    }
    setReaderPan({
      x: clamp(x, -2400, 2400),
      y: clamp(y, -3200, 3200),
    });
    setReaderGestureZoom(safeScale);
  }, [readerMinGestureScale, pauseReaderScrollSync]);

  const commitReaderProgress = useCallback((page: number, notifyMessage: string) => {
    if (!selected) return;
    const safe = Math.max(1, Math.floor(page || 1));
    const resumeHref = `/biblioteca?resumePdf=${encodeURIComponent(selected.id)}&resumePage=${safe}`;
    markPdfProgress({
      resourceId: selected.id,
      title: selected.title,
      page: safe,
      subjectSlug: selectedSubjectSlug,
    });
    setCommittedReaderPage(safe);
    speakRabbit({
      title: "Lectura guardada",
      message: `${selected.title}: retomamos en la página ${safe}.`,
      status: notifyMessage,
      actions: [{ href: resumeHref, label: "Ir a mi página", primary: true }],
      durationMs: 4200,
    });
  }, [selected, selectedSubjectSlug]);

  const hasPendingReaderChanges = Boolean(selected && readerPage !== committedReaderPage);

  useEffect(() => {
    const root = previewScrollRef.current;
    if (!root || !previewPages.length) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-preview-page]"));
    if (!nodes.length) return;

    let rafId = 0;

    const updateCurrentPageFromScroll = () => {
      if (initialPageAlignRef.current !== null) return;
      if (Date.now() < readerScrollSyncPauseUntilRef.current) return;
      if (readerGestureActive || readerEffectiveZoomRef.current > readerMinZoom + 0.05) return;
      const rootRect = root.getBoundingClientRect();
      const currentPage = clamp(Math.floor(readerPageRef.current || 1), 1, Math.max(1, previewPages.length));
      const visibilityByPage = new Map<number, number>();

      for (const node of nodes) {
        const page = Number(node.dataset.previewPage);
        if (!Number.isFinite(page)) continue;
        const rect = node.getBoundingClientRect();
        const visible = Math.max(0, Math.min(rect.bottom, rootRect.bottom) - Math.max(rect.top, rootRect.top));
        const ratio = rect.height > 0 ? visible / rect.height : 0;
        visibilityByPage.set(page, ratio);
      }

      if (!visibilityByPage.size) return;
      const currentRatio = visibilityByPage.get(currentPage) ?? 0;
      const candidate = Array.from(visibilityByPage.entries()).reduce(
        (best, [page, ratio]) => (ratio > best.ratio ? { page, ratio } : best),
        { page: currentPage, ratio: currentRatio },
      );

      let nextPage = currentPage;
      if (
        candidate.page !== currentPage &&
        (candidate.ratio >= 0.58 || candidate.ratio >= currentRatio + 0.18)
      ) {
        nextPage = candidate.page;
      }

      setReaderPage((prev) => {
        if (prev === nextPage) return prev;
        setReaderPageDialogInput(String(nextPage));
        return nextPage;
      });
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        updateCurrentPageFromScroll();
      });
    };

    schedule();
    root.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      root.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [previewPages.length, selectedId, readerZoom, readerToolMode, immersiveMode, readerGestureActive, readerMinZoom]);

  useEffect(() => {
    if (!(immersiveMode && readerToolMode === "lectura")) return;
    if (!previewPages.length) return;

    const id = window.requestAnimationFrame(() => {
      applyFitZoom(false);
    });

    const onResize = () => {
      window.requestAnimationFrame(() => {
        applyFitZoom(false);
      });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [immersiveMode, readerToolMode, previewPages.length, selectedId, applyFitZoom]);

  useEffect(() => {
    if (!(immersiveMode && readerToolMode === "lectura")) return;
    if (!previewPages.length) return;
    const root = previewScrollRef.current;
    if (!root) return;

    const timer = window.setInterval(() => {
      const firstPage = root.querySelector<HTMLElement>("[data-preview-page='1']");
      if (!firstPage) return;
      const firstRect = firstPage.getBoundingClientRect();
      if (firstRect.width < 20 || firstRect.height < 20) return;
      const rootRect = root.getBoundingClientRect();
      const visible = Math.max(0, Math.min(firstRect.bottom, rootRect.bottom) - Math.max(firstRect.top, rootRect.top));
      const visibleByHeight = visible / Math.max(1, firstRect.height);

      if (visibleByHeight >= 0.06) {
        readerViewportMissCountRef.current = 0;
        return;
      }

      readerViewportMissCountRef.current += 1;
      if (readerViewportMissCountRef.current >= 6) {
        readerViewportMissCountRef.current = 0;
        recoverReaderViewport("first-page-not-visible");
      }
    }, 240);

    return () => {
      window.clearInterval(timer);
      readerViewportMissCountRef.current = 0;
    };
  }, [immersiveMode, readerToolMode, previewPages.length, recoverReaderViewport]);

  useEffect(() => {
    if (!(immersiveMode && readerToolMode === "lectura")) return;
    if (!previewPages.length) return;
    const id = window.requestAnimationFrame(() => {
      applyFitZoom(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [readerFitMode, immersiveMode, readerToolMode, previewPages.length, applyFitZoom]);

  useEffect(() => {
    readerFitZoomAppliedRef.current = false;
    readerRecoveryBurstRef.current = [];
    setReaderSafeMode(false);
    setReaderGesturesEnabled(false);
  }, [selectedId]);

  useEffect(() => {
    if (!(immersiveMode && readerToolMode === "lectura")) return;
    const root = previewScrollRef.current;
    if (!root) return;

    const preventSafariGestureZoom = (event: Event) => {
      const target = event.target as Node | null;
      if (!target || !root.contains(target)) return;
      event.preventDefault();
    };

    root.addEventListener("gesturestart", preventSafariGestureZoom as EventListener, { passive: false });
    root.addEventListener("gesturechange", preventSafariGestureZoom as EventListener, { passive: false });
    root.addEventListener("gestureend", preventSafariGestureZoom as EventListener, { passive: false });
    const preventDoubleClickZoom = (event: Event) => {
      const target = event.target as Node | null;
      if (!target || !root.contains(target)) return;
      event.preventDefault();
    };
    let lastTouchEndAt = 0;
    const preventDoubleTapZoom = (event: TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !root.contains(target)) return;
      const now = Date.now();
      if (now - lastTouchEndAt < 280) {
        event.preventDefault();
      }
      lastTouchEndAt = now;
    };
    root.addEventListener("dblclick", preventDoubleClickZoom as EventListener, { passive: false });
    root.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      root.removeEventListener("gesturestart", preventSafariGestureZoom as EventListener);
      root.removeEventListener("gesturechange", preventSafariGestureZoom as EventListener);
      root.removeEventListener("gestureend", preventSafariGestureZoom as EventListener);
      root.removeEventListener("dblclick", preventDoubleClickZoom as EventListener);
      root.removeEventListener("touchend", preventDoubleTapZoom as EventListener);
    };
  }, [immersiveMode, readerToolMode, selectedId]);

  useEffect(() => {
    setReaderZoom(0.55);
    setReaderMinZoom(0.55);
    setReaderGestureZoom(1);
    setReaderPan({ x: 0, y: 0 });
    setReaderPageInfoOpen(false);
    setReaderPageDialogInput("1");
  }, [selectedId]);

  useEffect(() => {
    if (!(immersiveMode && readerToolMode === "lectura")) {
      setReaderGestureZoom(1);
      setReaderPan({ x: 0, y: 0 });
    }
  }, [immersiveMode, readerToolMode]);

  useEffect(() => {
    if (readerGestureActive) return;
    setReaderPan((prev) => {
      if (Math.abs(prev.x) < 0.5 && Math.abs(prev.y) < 0.5) return prev;
      return { x: 0, y: 0 };
    });
  }, [readerGestureActive]);

  useEffect(() => {
    if (!previewPages.length) return;
    if (initialPageAlignRef.current === null) return;
    const pageToAlign = initialPageAlignRef.current;
    const id = window.requestAnimationFrame(() => {
      scrollToPreviewPage(pageToAlign, "auto");
      initialPageAlignRef.current = null;
    });
    return () => window.cancelAnimationFrame(id);
  }, [previewPages, selectedId, scrollToPreviewPage]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingReaderChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPendingReaderChanges]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!hasPendingReaderChanges || pendingLeaveHref) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const targetRoute = normalizeToWindowRoute(href);
      if (!targetRoute) return;
      const currentRoute = `${window.location.pathname.replace(/\/+$/, "") || "/"}${window.location.search}${window.location.hash}`;
      if (targetRoute === currentRoute) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingLeaveHref(targetRoute);
      speakRabbit({
        title: "¿Guardamos tu avance?",
        message: `Vas por la página ${readerPage}. ¿Quieres guardar esa página antes de salir?`,
        status: "Elige Sí para guardar o No para mantener la página anterior.",
        durationMs: 6000,
      });
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [hasPendingReaderChanges, normalizeToWindowRoute, pendingLeaveHref, readerPage]);

  const resolvePendingLeave = (saveCurrentPage: boolean) => {
    const targetHref = pendingLeaveHref;
    setPendingLeaveHref(null);

    if (saveCurrentPage) {
      commitReaderProgress(readerPage, "Confirmado antes de salir.");
    } else {
      jumpToPage(committedReaderPage, "auto");
      speakRabbit({
        title: "Avance conservado",
        message: `Mantenemos la página anterior (${committedReaderPage}) sin cambios.`,
        durationMs: 4200,
      });
    }

    if (targetHref) window.location.assign(targetHref);
  };

  const handleAddBookmarkCurrentPage = () => {
    if (!selected) return;
    addReaderBookmark({
      documentId: selected.id,
      page: readerPage,
      label: bookmarkLabelInput,
    });
    setBookmarkLabelInput("");
    pushNotice("Marcador guardado", `Página ${readerPage} agregada a marcadores.`);
  };

  const handleDeleteBookmark = (bookmarkId: string) => {
    if (!selected) return;
    deleteReaderBookmark(selected.id, bookmarkId);
  };

  const handleSaveCurrentNote = () => {
    if (!selected) return;
    if (!noteDraft.trim()) {
      if (currentNote) {
        deleteReaderNote(selected.id, currentNote.id);
        pushNotice("Nota eliminada", `Se eliminó la nota de la página ${readerPage}.`);
      }
      return;
    }
    upsertReaderNote({
      documentId: selected.id,
      page: readerPage,
      text: noteDraft,
    });
    pushNotice("Nota guardada", `Nota actualizada en página ${readerPage}.`);
  };

  const jumpToBookmarkNeighbor = useCallback((direction: 1 | -1) => {
    if (!readerBookmarks.length) return;
    const pages = [...new Set(readerBookmarks.map((b) => b.page))].sort((a, b) => a - b);
    if (!pages.length) return;

    if (direction > 0) {
      const next = pages.find((p) => p > readerPage) ?? pages[0];
      jumpToPage(next);
      return;
    }

    const prev = [...pages].reverse().find((p) => p < readerPage) ?? pages[pages.length - 1];
    jumpToPage(prev);
  }, [readerBookmarks, readerPage, jumpToPage]);

  const startEditBookmark = (bookmarkId: string, label?: string) => {
    setEditingBookmarkId(bookmarkId);
    setEditingBookmarkLabel(label ?? "");
  };

  const cancelEditBookmark = () => {
    setEditingBookmarkId(null);
    setEditingBookmarkLabel("");
  };

  const saveEditBookmark = () => {
    if (!selected || !editingBookmarkId) return;
    updateReaderBookmarkLabel({
      documentId: selected.id,
      bookmarkId: editingBookmarkId,
      label: editingBookmarkLabel,
    });
    cancelEditBookmark();
  };

  const handleExportReaderArtifacts = () => {
    if (!selected || typeof window === "undefined") return;
    const payload = exportReaderArtifacts(selected.id);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safeTitle = selected.title.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "resource";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-reader-artifacts.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
    pushNotice("Exportación lista", "Se descargaron marcadores y notas del reader.");
  };

  const onImportReaderArtifacts = async (file: File | null) => {
    if (!selected || !file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const imported = importReaderArtifacts({
        documentId: selected.id,
        data: parsed,
        mode: readerImportMode,
      });
      pushNotice("Importación completada", `${imported.bookmarks} marcadores y ${imported.notes} notas disponibles.`);
    } catch {
      pushNotice("Importación fallida", "El archivo no tiene un formato válido.");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selected) return;
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");
      if (isTyping) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        jumpToPage(readerPage - 1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        jumpToPage(readerPage + 1);
        return;
      }

      const pressed = normalizeShortcutBinding(keyboardEventToShortcut(event));
      if (!pressed) return;
      const matchedActions = READER_SHORTCUT_ACTIONS.filter((action) => normalizedShortcutByAction[action] === pressed);
      if (matchedActions.length > 1) {
        event.preventDefault();
        const now = Date.now();
        if (now - shortcutConflictNoticeAtRef.current > 1200) {
          shortcutConflictNoticeAtRef.current = now;
          pushNotice("Atajo en conflicto", "Ese atajo está repetido en varias acciones. Ajusta la configuración para usarlo.");
        }
        return;
      }
      const matchedAction = matchedActions[0];
      if (!matchedAction) return;

      if (matchedAction === "save") {
        event.preventDefault();
        commitReaderProgress(readerPage, "Guardado por atajo de teclado.");
        return;
      }

      if (matchedAction === "bookmark") {
        event.preventDefault();
        if (currentBookmark) {
          deleteReaderBookmark(selected.id, currentBookmark.id);
        } else {
          addReaderBookmark({ documentId: selected.id, page: readerPage });
        }
        return;
      }

      if (matchedAction === "note") {
        event.preventDefault();
        if (!noteDraft.trim()) {
          if (currentNote) deleteReaderNote(selected.id, currentNote.id);
        } else {
          upsertReaderNote({ documentId: selected.id, page: readerPage, text: noteDraft });
        }
        return;
      }

      if (matchedAction === "nextBookmark") {
        event.preventDefault();
        jumpToBookmarkNeighbor(1);
        return;
      }

      if (matchedAction === "prevBookmark") {
        event.preventDefault();
        jumpToBookmarkNeighbor(-1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, readerPage, currentBookmark, noteDraft, currentNote, jumpToPage, commitReaderProgress, jumpToBookmarkNeighbor, normalizedShortcutByAction, pushNotice]);

  const onPickFile = async (file: File) => {
    setBusy(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const title = file.name.replace(/\.pdf$/i, "");
      const preparedBlob = await readPdfFileWithProgress(file, (ratio) => {
        setUploadProgress(Math.round(clamp(ratio, 0, 1) * 100));
      });
      const subjectSlug: SubjectSlug | undefined =
        filterSubject === "anatomia" ||
        filterSubject === "histologia" ||
        filterSubject === "embriologia" ||
        filterSubject === "biologia-celular" ||
        filterSubject === "ingles" ||
        filterSubject === "trabajo-online"
          ? filterSubject
          : undefined;
      const created = await putPdfResource({
        title,
        blob: preparedBlob,
        pageStart: 1,
        pageEnd: 1,
        subjectSlug,
      });
      const next = [created, ...items];
      setItems(next);
      setSelectedId(created.id);
      pushNotice("PDF subido", `Se agregó “${created.title}” a tu biblioteca.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir el PDF";
      setUploadError(msg);
    } finally {
      setUploadProgress(null);
      setBusy(false);
    }
  };

  const runAi = async () => {
    if (!selectedTextForAi.trim()) return;
    if (selectedTextForAi.trim().length < 120) {
      setAiError("Necesitas un poco más de contenido para la IA (mínimo sugerido: 120 caracteres). Extrae más páginas o selecciona más chunks.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent<RabbitAssistantControlPayload>(RABBIT_ASSISTANT_CONTROL_EVENT, {
        detail: { behaviorMode: "guide", visualState: "jump", pauseMs: 900 },
      }),
    );
    setAiBusy(true);
    setAiError(null);
    const safeMaxCards = clamp(Math.floor(Number(maxCards) || 25), 5, 80);
    const aiSubjectSlug = subject === "all" ? selectedSubjectSlug ?? "histologia" : subject;
    const aiLanguage = aiSubjectSlug === "ingles" ? "en" : "es";
    const sourceDocumentId = selected?.id ?? "";
    const inputHash = hashFlashcardsArtifactInput({
      documentId: sourceDocumentId,
      pageStart: aiRangeStart,
      pageEnd: aiRangeEnd,
      text: selectedTextForAi,
      topic,
      maxCards: safeMaxCards,
      language: aiLanguage,
      subjectSlug: aiSubjectSlug,
    });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      if (selected) {
        const cached = findFlashcardsArtifact({
          documentId: selected.id,
          pageStart: aiRangeStart,
          pageEnd: aiRangeEnd,
          inputHash,
        });
        if (cached) {
          setAiNotes(Array.isArray(cached.payload.notes) ? cached.payload.notes : []);
          pushNotice("IA reutilizada", "Se cargaron flashcards guardadas para este documento y rango, sin reprocesar.");
          return;
        }
      }

      if (typeof window !== "undefined" && window.location.hostname.endsWith("github.io")) {
        setAiError("La función de IA no está disponible en GitHub Pages (hosting estático). Para usarla, ejecuta la app en un servidor Next.js.");
        return;
      }

      const r = await fetch(withBasePath("/api/ai/flashcards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectedTextForAi,
          maxCards: safeMaxCards,
          language: aiLanguage,
          topic,
          mode: "flashcards",
          subjectSlug: aiSubjectSlug,
        }),
        signal: controller.signal,
      });
      const data = (await r.json().catch(() => null)) as
        | null
        | { notes?: AiNoteDraft[]; error?: string; details?: string };
      if (!r.ok) {
        const details = typeof data?.details === "string" ? data.details : "";
        if (r.status === 404) {
          setAiError("No se encontró el endpoint de IA (404). Si estás en GitHub Pages o build estático, la IA no está disponible ahí; usa la app en servidor Next.js.");
          return;
        }
        if (r.status === 429) {
          setAiError(
            `IA: límite de uso / cuota excedida (429). Revisá tu cuota en Google AI Studio y que tu API key esté activa.\n${details}`.trim(),
          );
          return;
        }
        const msg = data?.error
          ? `${data.error}${data.details ? `\n${data.details}` : ""}`
          : `Error ${r.status}`;
        setAiError(msg);
        return;
      }
      const notes = Array.isArray(data?.notes) ? data.notes : [];
      setAiNotes(notes);
      if (selected) {
        upsertFlashcardsArtifact({
          documentId: selected.id,
          pageStart: aiRangeStart,
          pageEnd: aiRangeEnd,
          inputHash,
          payload: {
            notes,
            topic: topic.trim() || undefined,
            maxCards: safeMaxCards,
            language: aiLanguage,
            subjectSlug: aiSubjectSlug,
          },
        });
      }
      window.dispatchEvent(
        new CustomEvent<RabbitAssistantControlPayload>(RABBIT_ASSISTANT_CONTROL_EVENT, {
          detail: { behaviorMode: "guide", visualState: "jump", pauseMs: 1200 },
        }),
      );
      pushNotice("IA completada", notes.length ? `Se generaron ${notes.length} notas para revisar.` : "La IA respondió, pero no devolvió notas útiles.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setAiError("La IA tardó demasiado en responder (timeout de 30s). Intenta con menos texto o menor cantidad de tarjetas.");
        return;
      }
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setAiError(msg);
    } finally {
      window.clearTimeout(timeoutId);
      setAiBusy(false);
    }
  };

  const deleteAiCard = (noteIdx: number, cardIdx: number) => {
    setAiNotes((prev) => {
      if (!prev) return prev;
      const next = prev.map((n) => ({ ...n, cards: [...n.cards] }));
      const note = next[noteIdx];
      if (!note) return prev;
      note.cards.splice(cardIdx, 1);
      return next.filter((x) => x.cards.length > 0);
    });
  };

  const updateAiCard = (
    noteIdx: number,
    cardIdx: number,
    patch: Partial<AiNoteDraft["cards"][number]>,
  ) => {
    setAiNotes((prev) => {
      if (!prev) return prev;
      const next = prev.map((n) => ({ ...n, cards: [...n.cards] }));
      const note = next[noteIdx];
      if (!note) return prev;
      const card = note.cards[cardIdx];
      if (!card) return prev;
      note.cards[cardIdx] = { ...card, ...patch };
      return next;
    });
  };

  const importToSrs = () => {
    if (!srsLib || !aiNotes || !aiNotes.length) return;
    const cardCount = aiNotes.reduce((sum, n) => sum + n.cards.length, 0);
    const next = importAiNotesToDeck(srsLib, {
      deckId,
      subjectSlug: subject === "all" ? "histologia" : subject,
      notes: aiNotes,
      defaultTags: selected?.title ? [selected.title] : undefined,
    });
    setSrsLib(next);
    saveSrsLibrary(next);
    setAiNotes(null);
    pushNotice("Importación completada", `${cardCount} tarjetas se agregaron al deck.`);
  };

  const onDelete = async (id: string) => {
    setBusy(true);
    try {
      await deletePdfResource(id);
      const all = await listPdfResources();
      setItems(all);
      setSelectedId((prev) => (prev === id ? (all[0]?.id ?? null) : prev));
      pushNotice("PDF eliminado", "El recurso se borró de tu biblioteca local.");
    } finally {
      setBusy(false);
    }
  };

  const updateMeta = async (
    patch: Partial<Pick<PdfResource, "title" | "pageStart" | "pageEnd" | "subjectSlug" | "starred" | "folderPath" | "tags">>,
  ) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updatePdfResourceMeta(selected.id, patch);
      const updatedAtMs = Date.now();
      setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, ...patch, updatedAtMs } : x)));
    } finally {
      setBusy(false);
    }
  };

  const runExtract = async () => {
    if (!selectedId || !selected) return;
    setBusy(true);
    setExtractError(null);
    try {
      const start = Math.max(1, Math.floor(selected.pageStart || 1));
      const end = Math.max(start, Math.floor(selected.pageEnd || start));

      if (start !== selected.pageStart || end !== selected.pageEnd) {
        setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, pageStart: start, pageEnd: end } : x)));
        await updatePdfResourceMeta(selected.id, { pageStart: start, pageEnd: end });
      }

      const blob = await getPdfResourceBlob(selectedId);
      if (!blob) {
        setExtractError("No se pudo leer el archivo.");
        return;
      }
      const extracted = await extractPdfTextFromBlob({
        blob,
        pageStart: start,
        pageEnd: end,
      });
      const text = typeof extracted?.text === "string" ? extracted.text : "";
      const pc = Number.isFinite(extracted?.pageCount) ? Math.max(1, Math.floor(extracted.pageCount)) : null;
      setPageCount(pc);
      setExtractedText(text);

      const nextChunks = text
        .split(/\n\n(?=\[Page\s+\d+\])/g)
        .map((s) => s.trim())
        .filter(Boolean);
      setChunks(nextChunks);
      setSelectedChunkIdxs(new Set(nextChunks.map((_, idx) => idx)));
      pushNotice("Texto extraído", nextChunks.length ? `${nextChunks.length} chunks listos para IA.` : "Extracción completada.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setExtractError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={immersiveMode ? "relative min-h-dvh bg-black" : "space-y-8 pb-4"}>
      {!immersiveMode ? (
      <div className="relative space-y-4 overflow-hidden rounded-[30px] bg-black/45 p-6 shadow-[0_26px_90px_-54px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-7">
        <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 right-6 h-32 w-32 rounded-full bg-indigo-300/10 blur-3xl" />
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/65">Recursos</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Biblioteca inteligente</h1>
          <p className="text-sm text-white/70">
            Alterna entre gestión e inmersión. Mantén el PDF como protagonista y abre herramientas solo cuando las necesites.
          </p>
        </div>

        {!workspaceModeLocked ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/25 bg-white/8 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${!immersiveMode ? "bg-white text-black" : "text-white/80 hover:text-white"}`}
                onClick={() => setWorkspaceMode("gestion")}
              >
                Vista gestión
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${immersiveMode ? "bg-white text-black" : "text-white/80 hover:text-white"}`}
                onClick={() => setWorkspaceMode("inmersion")}
              >
                Vista inmersión
              </button>
            </div>
            <div className="rounded-full border border-white/20 bg-white/6 p-1">
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${readerToolMode === "lectura" ? "bg-white/90 text-black" : "text-white/75 hover:text-white"}`}
                onClick={() => setReaderToolMode("lectura")}
              >
                Modo lectura
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1.5 text-xs transition ${readerToolMode === "generador" ? "bg-white/90 text-black" : "text-white/75 hover:text-white"}`}
                onClick={() => setReaderToolMode("generador")}
              >
                Modo generador IA
              </button>
            </div>
          </div>
        ) : immersiveMode ? (
          <div className="rounded-full border border-white/20 bg-white/8 p-1">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs transition ${readerToolMode === "lectura" ? "bg-white/90 text-black" : "text-white/75 hover:text-white"}`}
              onClick={() => setReaderToolMode("lectura")}
            >
              Modo lectura
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs transition ${readerToolMode === "generador" ? "bg-white/90 text-black" : "text-white/75 hover:text-white"}`}
              onClick={() => setReaderToolMode("generador")}
            >
              Modo generador IA
            </button>
          </div>
        ) : null}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar PDF por título..."
            className="h-11 w-full rounded-2xl bg-white/10 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-white/35"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-white">
            <Filter className="h-3.5 w-3.5 text-white/70" />
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-transparent text-sm text-white outline-none"
            >
              <option value="all">Todas las materias</option>
              {Object.values(SUBJECTS).map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
              <option value="unassigned">Sin asignar</option>
            </select>
          </div>
          <input
            value={filterFolder}
            onChange={(e) => setFilterFolder(e.target.value)}
            placeholder="Carpeta"
            list="resource-folder-suggestions"
            className="h-9 rounded-xl border border-white/20 bg-white/8 px-3 text-xs text-white outline-none placeholder:text-white/45"
          />
          <input
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Tag"
            list="resource-tag-suggestions"
            className="h-9 rounded-xl border border-white/20 bg-white/8 px-3 text-xs text-white outline-none placeholder:text-white/45"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "title" | "size")}
            className="h-9 rounded-xl border border-white/20 bg-white/8 px-3 text-xs text-white outline-none"
          >
            <option value="recent">Recientes</option>
            <option value="title">Título</option>
            <option value="size">Tamaño</option>
          </select>
          <Button
            variant={filterStarredOnly ? "secondary" : "outline"}
            className="h-9 rounded-xl border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
            onClick={() => setFilterStarredOnly((prev) => !prev)}
          >
            <Star className={`h-3.5 w-3.5 ${filterStarredOnly ? "fill-current" : ""}`} />
            Solo favoritos
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
            onClick={() => setListMode((prev) => (prev === "flat" ? "folder" : "flat"))}
          >
            {listMode === "flat" ? "Vista: Lista" : "Vista: Carpetas"}
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
            onClick={() => setLibraryVisualMode((prev) => (prev === "grid" ? "list" : "grid"))}
          >
            {libraryVisualMode === "grid" ? "Tarjetas: Grid" : "Tarjetas: Lista"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void onPickFile(f);
              e.target.value = "";
            }}
          />
          <input
            ref={libraryBackupImportRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void onImportLibraryBackup(f);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" className="rounded-xl border-0 bg-white text-black hover:bg-white/90" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? `Subiendo PDF${typeof uploadProgress === "number" ? ` ${uploadProgress}%` : "..."}` : "Subir PDF"}
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
            onClick={() => void handleExportLibraryBackup()}
          >
            Exportar biblioteca
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
            onClick={() => libraryBackupImportRef.current?.click()}
          >
            Importar biblioteca
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-white/10 px-3 text-xs text-white hover:bg-white/15"
            onClick={() => void handleSyncNow()}
            disabled={syncBusy}
          >
            {syncBusy ? "Sincronizando..." : "Sync ahora"}
          </Button>
          <div className="ml-auto rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
            {filtered.length} PDF{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
        {bulkSelectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-white/8 px-3 py-2">
            <span className="text-xs text-white/85">Seleccionados: {bulkSelectedCount}</span>
            <Button
              variant="outline"
              className="h-8 rounded-lg border-white/25 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
              onClick={() => void applyBulkFavorite(true)}
              disabled={busy}
            >
              Favorito
            </Button>
            <Button
              variant="outline"
              className="h-8 rounded-lg border-white/25 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
              onClick={() => void applyBulkFavorite(false)}
              disabled={busy}
            >
              Quitar favorito
            </Button>
            <input
              value={bulkFolderInput}
              onChange={(e) => setBulkFolderInput(e.target.value)}
              placeholder="Carpeta masiva"
              list="resource-folder-suggestions"
              className="h-8 rounded-lg border border-white/20 bg-white/8 px-2.5 text-xs text-white outline-none placeholder:text-white/45"
            />
            <Button
              variant="outline"
              className="h-8 rounded-lg border-white/25 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
              onClick={() => void applyBulkFolder()}
              disabled={busy}
            >
              Aplicar carpeta
            </Button>
            <input
              value={bulkTagsInput}
              onChange={(e) => setBulkTagsInput(e.target.value)}
              placeholder="Tags masivos"
              list="resource-tag-suggestions"
              className="h-8 rounded-lg border border-white/20 bg-white/8 px-2.5 text-xs text-white outline-none placeholder:text-white/45"
            />
            <Button
              variant="outline"
              className="h-8 rounded-lg border-white/25 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
              onClick={() => void applyBulkTagsMerge()}
              disabled={busy}
            >
              Agregar tags
            </Button>
            <Button
              variant="outline"
              className="h-8 rounded-lg border-white/25 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
              onClick={clearBulkSelection}
              disabled={busy}
            >
              Limpiar
            </Button>
          </div>
        ) : null}
        {uploadError ? (
          <div className="rounded-xl border border-destructive/45 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Error al subir PDF: {uploadError}
          </div>
        ) : null}
        <datalist id="resource-folder-suggestions">
          {folderSuggestions.map((folder) => (
            <option key={folder} value={folder} />
          ))}
        </datalist>
        <datalist id="resource-tag-suggestions">
          {tagSuggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>
      ) : null}

      {loading ? (
        <div className={`grid ${immersiveMode ? "h-dvh" : "gap-4"} ${showLibraryPane ? "xl:grid-cols-[430px,minmax(0,1.2fr)]" : "xl:grid-cols-1"}`}>
          {showLibraryPane ? (
            <div className="rounded-[24px] bg-black/35 p-3 backdrop-blur-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Biblioteca</div>
                  <div className="text-sm font-semibold text-white/90">Tarjetas PDF</div>
                </div>
              </div>
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl bg-white/8 p-3">
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className={`${immersiveMode ? "bg-black" : "rounded-2xl bg-black/35 p-3 backdrop-blur-xl"}`}>
            <Skeleton className="h-[520px] w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <div className={`grid ${immersiveMode ? "h-dvh" : "gap-4"} ${showLibraryPane ? "xl:grid-cols-[430px,minmax(0,1.2fr)]" : "xl:grid-cols-1"}`}>
          {showLibraryPane ? (
            <div className="rounded-[24px] bg-black/35 p-3 backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/55">Biblioteca</div>
                <div className="text-sm font-semibold text-white/90">Tarjetas PDF</div>
              </div>
              <div className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/75">
                {filtered.length}
              </div>
            </div>
            <div className={libraryVisualMode === "grid" ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "space-y-2"}>
              {(listMode === "flat"
                ? [{ folder: "", docs: filtered }]
                : groupedFiltered
              ).map((group) => (
                <div key={group.folder || "flat"} className={libraryVisualMode === "grid" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                  {listMode === "folder" ? (
                    <div className="rounded-xl border border-white/15 bg-white/6 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/70">
                      {group.folder} · {group.docs.length}
                    </div>
                  ) : null}
                  {group.docs.map((i) => (
                    <div
                      key={i.id}
                      onClick={() => {
                        if (immersiveMode) {
                          setSelectedId(i.id);
                          return;
                        }
                        void router.push(`/lector?openPdf=${encodeURIComponent(i.id)}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (immersiveMode) {
                            setSelectedId(i.id);
                            return;
                          }
                          void router.push(`/lector?openPdf=${encodeURIComponent(i.id)}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`group w-full rounded-2xl ${libraryVisualMode === "grid" ? "p-2.5" : "p-3"} text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 ${
                        i.id === selectedId ? "bg-white/18 ring-1 ring-white/35" : "bg-white/8 ring-1 ring-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={bulkSelection.has(i.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleBulkSelection(i.id, e.target.checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-3.5 w-3.5 rounded border-white/30 bg-black/30"
                            />
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white/85">
                              <FileText className="h-4 w-4" />
                            </span>
                            {i.starred ? <Star className="h-3.5 w-3.5 fill-current text-amber-300" /> : null}
                            <div className="truncate text-sm font-medium text-white">{i.title}</div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/65">
                            <span>{Math.round(i.sizeBytes / 1024)} KB · pp. {i.pageStart}–{i.pageEnd}</span>
                            {i.subjectSlug && SUBJECTS[i.subjectSlug as keyof typeof SUBJECTS] ? (
                              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90">
                                {SUBJECTS[i.subjectSlug as keyof typeof SUBJECTS].name}
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                                Sin materia
                              </span>
                            )}
                            {i.folderPath ? (
                              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-white/90">{i.folderPath}</span>
                            ) : null}
                            {i.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] text-white/85">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80 transition group-hover:opacity-100">
                          {!immersiveMode ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/25 bg-black/30 text-white hover:bg-white/15"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(i.id);
                              }}
                            >
                              Clasificar
                            </Button>
                          ) : null}
                          <Link
                            href={`/lector?openPdf=${encodeURIComponent(i.id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex h-8 items-center rounded-md border border-white/25 bg-black/30 px-2 text-[10px] text-white hover:bg-white/15"
                          >
                            Abrir
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/25 bg-black/30 text-white hover:bg-white/15"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = !i.starred;
                              const updatedAtMs = Date.now();
                              setItems((prev) => prev.map((x) => (x.id === i.id ? { ...x, starred: next, updatedAtMs } : x)));
                              void updatePdfResourceMeta(i.id, { starred: next });
                            }}
                            disabled={busy}
                          >
                            <Star className={`h-4 w-4 ${i.starred ? "fill-current text-amber-300" : ""}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/25 bg-black/30 text-white hover:bg-white/15"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDelete(i.id);
                            }}
                            disabled={busy}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {!filtered.length ? (
                <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/70">
                  No hay PDFs todavía.
                </div>
              ) : null}
            </div>
          </div>
          ) : null}

          <div className={`overflow-hidden ${immersiveMode ? "relative h-dvh bg-[#050505]" : "rounded-[24px] bg-black/35 backdrop-blur-2xl"}`}>
            <div className={immersiveMode ? "absolute left-1/2 top-3 z-30 w-[min(96vw,1100px)] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 shadow-[0_14px_44px_-26px_rgba(0,0,0,0.95)] backdrop-blur-2xl" : "border-b border-white/10 px-6 py-4"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className={`${immersiveMode ? "text-sm font-medium text-white/90" : "text-base font-bold text-white"}`}>{selected ? selected.title : "Seleccioná un PDF"}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {immersiveMode ? (
                    <>
                      <Link
                        href="/biblioteca"
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white hover:bg-white/15"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                      </Link>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => jumpToPage(readerPage - 1)} disabled={readerPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => jumpToPage(readerPage + 1)} disabled={readerPage >= ((pageCount ?? previewPages.length) || 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant={readerToolMode === "lectura" ? "secondary" : "outline"} size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => setReaderToolMode("lectura")}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant={readerToolMode === "generador" ? "secondary" : "outline"} size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => setReaderToolMode("generador")}>
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15"
                        onClick={() => {
                          setReaderGesturesEnabled(false);
                          setReaderGestureZoom(1);
                          setReaderPan({ x: 0, y: 0 });
                          setReaderSafeMode(false);
                          setReaderRecoverNonce((prev) => prev + 1);
                          window.requestAnimationFrame(() => applyFitZoom(true));
                        }}
                      >
                        Modo estable
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => updateReaderZoom(readerZoom - 0.12)}>
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => updateReaderZoom(readerZoom + 0.12)}>
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant={readerFitMode === "reading" ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15"
                        onClick={() => setReaderFitMode("reading")}
                      >
                        Fit lectura
                      </Button>
                      <Button
                        type="button"
                        variant={readerFitMode === "full" ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15"
                        onClick={() => setReaderFitMode("full")}
                      >
                        Fit 100%
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => applyFitZoom(true)}>
                        Ajustar hoja
                      </Button>
                      {selectedRemotePdfUrl ? (
                        <a
                          href={selectedRemotePdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-md border border-white/20 bg-white/10 px-2 text-xs text-white hover:bg-white/15"
                        >
                          Probar fuente PDF
                        </a>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => {
                        setReaderPageDialogInput(String(readerPage));
                        setReaderPageInfoOpen((prev) => !prev);
                      }}>
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => commitReaderProgress(readerPage, "Guardado manual.")} disabled={!selected}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-white/20 bg-white/10 px-2 text-white hover:bg-white/15" onClick={() => setReaderSidebarOpen((prev) => !prev)}>
                        <PanelRight className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                  {selected && !immersiveMode ? (
                    <Link
                      href={`/lector?openPdf=${encodeURIComponent(selected.id)}`}
                      className="inline-flex h-8 items-center rounded-md border border-white/25 bg-white/10 px-2.5 text-xs text-white hover:bg-white/15"
                    >
                      Abrir lector inmersivo
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            <div className={immersiveMode ? "relative h-dvh space-y-4 p-0" : "space-y-4 p-6"}>
              {selected && !immersiveMode ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Título</div>
                    <input
                      value={selected.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, title: v } : x)));
                      }}
                      onBlur={(e) => void updateMeta({ title: e.target.value })}
                      className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Materia</div>
                    <select
                      value={selected.subjectSlug ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v: SubjectSlug | undefined = raw && raw in SUBJECTS ? (raw as SubjectSlug) : undefined;
                        setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, subjectSlug: v } : x)));
                        void updateMeta({ subjectSlug: v });
                      }}
                      className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                    >
                      <option value="">Sin asignar</option>
                      {Object.values(SUBJECTS).map((s) => (
                        <option key={s.slug} value={s.slug}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {selected && !immersiveMode ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="space-y-1 lg:col-span-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Carpeta</div>
                    <input
                      value={selected.folderPath ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, folderPath: v || undefined } : x)));
                      }}
                      onBlur={(e) => void updateMeta({ folderPath: e.target.value.trim() })}
                      list="resource-folder-suggestions"
                      placeholder="Ej: Anatomía/Parcial-1"
                      className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant={selected.starred ? "secondary" : "outline"}
                      className="h-10 w-full rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15"
                      onClick={() => {
                        const next = !selected.starred;
                        setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, starred: next } : x)));
                        void updateMeta({ starred: next });
                      }}
                    >
                      <Star className={`h-4 w-4 ${selected.starred ? "fill-current text-amber-300" : ""}`} />
                      {selected.starred ? "Favorito" : "Marcar favorito"}
                    </Button>
                  </div>
                  <div className="space-y-1 lg:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Tags</div>
                    <input
                      value={selected.tags.join(", ")}
                      onChange={(e) => {
                        const v = parseTagInput(e.target.value);
                        setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, tags: v } : x)));
                      }}
                      onBlur={(e) => void updateMeta({ tags: parseTagInput(e.target.value) })}
                      list="resource-tag-suggestions"
                      placeholder="Ej: parcial, repaso, importante"
                      className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                    />
                  </div>
                  <div className="space-y-1 lg:col-span-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">URL remota (R2) para PDF grande</div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={remotePdfUrlInput}
                        onChange={(e) => setRemotePdfUrlInput(e.target.value)}
                        placeholder="https://pub-xxxx.r2.dev/tu-libro.pdf"
                        className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15"
                        onClick={saveSelectedRemotePdfUrl}
                      >
                        Guardar URL R2
                      </Button>
                    </div>
                    <div className="text-[11px] text-white/65">
                      Si este PDF supera el umbral de compatibilidad, se abrirá desde esta URL para evitar quedarse en la primera página.
                    </div>
                  </div>
                </div>
              ) : null}

              {selected && immersiveMode ? (
                <div className="rounded-2xl bg-white/7 p-3">
                  <input
                    ref={readerImportRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      void onImportReaderArtifacts(file);
                      e.currentTarget.value = "";
                    }}
                  />
                  <div className={`mt-2 overflow-hidden ${immersiveMode ? "h-[calc(100dvh-88px)]" : "rounded-xl border border-white/10"}`}>
                    {previewLoading ? (
                      <div className="flex h-[62svh] min-h-[420px] w-full flex-col items-center justify-center gap-2 text-xs text-foreground/75 md:h-[640px]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Cargando PDF completo...</span>
                      </div>
                    ) : previewError ? (
                      <div className="flex h-[62svh] min-h-[420px] w-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-foreground/75 md:h-[640px]">
                        <p>{previewError}</p>
                        {previewUrl ? (
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
                          >
                            Abrir PDF completo
                          </a>
                        ) : null}
                      </div>
                    ) : previewPages.length ? (
                      <div className={immersiveMode && readerToolMode === "lectura" ? "relative h-full bg-[#050505]" : "relative"}>
                        {!(immersiveMode && readerToolMode === "lectura") ? (
                          <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/70">
                            Página actual detectada: <span className="font-semibold text-white">{readerPage}</span>
                          </div>
                        ) : null}
                        <div
                          ref={previewScrollRef}
                          onWheel={(event) => {
                            if (!(immersiveMode && readerToolMode === "lectura")) return;
                            if (isTouchInputDevice()) return;
                            if (!event.ctrlKey) return;
                            event.preventDefault();
                            const delta = event.deltaY > 0 ? -0.08 : 0.08;
                            updateReaderZoom(readerZoom + delta);
                          }}
                          className={
                            immersiveMode && readerToolMode === "lectura"
                              ? "h-full touch-pan-y overflow-auto overscroll-y-contain bg-[#050505] px-3 pb-8 pt-3"
                              : "h-[58svh] min-h-[360px] overflow-y-auto bg-black/35 p-2 md:h-[600px]"
                          }
                        >
                          {immersiveMode && readerToolMode === "lectura" && !readerSafeMode && readerGesturesEnabled ? (
                            <QuickPinchZoom
                              key={`qz-${selected?.id ?? "none"}-${readerFitMode}-${readerRecoverNonce}`}
                              onUpdate={handleGestureUpdate}
                              minZoom={1}
                              maxZoom={3.2}
                              tapZoomFactor={1}
                              draggableUnZoomed={false}
                              centerContained
                              inertia
                              inertiaFriction={0.9}
                              isTouch={isTouchInputDevice}
                              containerProps={{
                                style: {
                                  touchAction: readerGestureActive ? "none" : "pan-y",
                                },
                              }}
                            >
                              <div
                                className="mx-auto flex w-[min(92vw,980px)] flex-col gap-4 py-6 will-change-transform"
                                style={{
                                  transformOrigin: "center center",
                                  transform: `translate3d(${Math.round(readerPan.x)}px, ${Math.round(readerPan.y)}px, 0) scale(${readerEffectiveZoom})`,
                                }}
                              >
                                {previewPages.map((pageSrc, idx) => (
                                  <section
                                    key={`${selected?.id ?? "pdf"}-page-${idx + 1}`}
                                    data-preview-page={idx + 1}
                                    className={`relative overflow-hidden rounded-lg border bg-white transition ${
                                      readerPage === idx + 1
                                        ? "border-white/35 ring-1 ring-white/25"
                                        : "border-black/20"
                                    }`}
                                  >
                                    <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                                      Pág. {idx + 1}{readerPage === idx + 1 ? " · actual" : ""}
                                    </div>
                                    <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1">
                                      {bookmarkPageSet.has(idx + 1) ? (
                                        <span className="rounded-md bg-amber-300/85 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                                          <Bookmark className="inline h-3 w-3" />
                                        </span>
                                      ) : null}
                                      {notePageSet.has(idx + 1) ? (
                                        <span className="rounded-md bg-cyan-300/85 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                                          <StickyNote className="inline h-3 w-3" />
                                        </span>
                                      ) : null}
                                    </div>
                                    {pageSrc ? (
                                      <>
                                        <img
                                          src={pageSrc}
                                          alt={`Página ${idx + 1}`}
                                          className="block w-full"
                                          loading="lazy"
                                        />
                                        {previewTextLayers[idx] ? (
                                          <div
                                            aria-hidden
                                            className="pointer-events-none absolute inset-0 select-text overflow-hidden whitespace-pre-wrap break-words p-2 text-[1px] leading-[1px] text-transparent opacity-0"
                                          >
                                            {previewTextLayers[idx]}
                                          </div>
                                        ) : null}
                                      </>
                                    ) : (
                                      <div className="flex min-h-[44svh] items-center justify-center text-sm text-slate-600">
                                        <div className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs text-black/75">
                                          <span className="inline-block">🐰</span>
                                          {renderingPreviewPages.has(idx + 1)
                                            ? "Renderizando en alta definición..."
                                            : failedPreviewPages.has(idx + 1)
                                              ? "Reintentando render..."
                                              : "Página en espera"}
                                          {!renderingPreviewPages.has(idx + 1) && previewPageFailures[idx + 1] ? (
                                            <span className="max-w-[260px] truncate text-[10px] text-black/55">
                                              {previewPageFailures[idx + 1]}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    )}
                                  </section>
                                ))}
                              </div>
                            </QuickPinchZoom>
                          ) : (
                            <div
                              className={
                                immersiveMode && readerToolMode === "lectura"
                                  ? "mx-auto flex w-[min(92vw,980px)] flex-col gap-4 py-6 will-change-transform"
                                  : "space-y-3"
                              }
                              style={
                                immersiveMode && readerToolMode === "lectura"
                                  ? {
                                      width: stableReaderWidth,
                                    }
                                  : undefined
                              }
                            >
                              {previewPages.map((pageSrc, idx) => (
                                <section
                                  key={`${selected?.id ?? "pdf"}-page-${idx + 1}`}
                                  data-preview-page={idx + 1}
                                  className={`relative overflow-hidden rounded-lg border bg-white transition ${
                                    readerPage === idx + 1
                                      ? "border-white/35 ring-1 ring-white/25"
                                      : immersiveMode && readerToolMode === "lectura"
                                        ? "border-black/20"
                                        : "border-white/10"
                                  }`}
                                >
                                  <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                                    Pág. {idx + 1}{readerPage === idx + 1 ? " · actual" : ""}
                                  </div>
                                  <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1">
                                    {bookmarkPageSet.has(idx + 1) ? (
                                      <span className="rounded-md bg-amber-300/85 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                                        <Bookmark className="inline h-3 w-3" />
                                      </span>
                                    ) : null}
                                    {notePageSet.has(idx + 1) ? (
                                      <span className="rounded-md bg-cyan-300/85 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                                        <StickyNote className="inline h-3 w-3" />
                                      </span>
                                    ) : null}
                                  </div>
                                  {pageSrc ? (
                                    <>
                                      <img
                                        src={pageSrc}
                                        alt={`Página ${idx + 1}`}
                                        className="block w-full"
                                        loading="lazy"
                                      />
                                      {previewTextLayers[idx] ? (
                                        <div
                                          aria-hidden
                                          className="pointer-events-none absolute inset-0 select-text overflow-hidden whitespace-pre-wrap break-words p-2 text-[1px] leading-[1px] text-transparent opacity-0"
                                        >
                                          {previewTextLayers[idx]}
                                        </div>
                                      ) : null}
                                    </>
                                  ) : (
                                    <div className="flex min-h-[44svh] items-center justify-center text-sm text-slate-600">
                                      <div className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white/70 px-2.5 py-1.5 text-xs text-black/75">
                                        <span className="inline-block">🐰</span>
                                        {renderingPreviewPages.has(idx + 1)
                                          ? "Renderizando en alta definición..."
                                          : failedPreviewPages.has(idx + 1)
                                            ? "Reintentando render..."
                                            : "Página en espera"}
                                        {!renderingPreviewPages.has(idx + 1) && previewPageFailures[idx + 1] ? (
                                          <span className="max-w-[260px] truncate text-[10px] text-black/55">
                                            {previewPageFailures[idx + 1]}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}
                                </section>
                              ))}
                            </div>
                          )}
                        </div>
                        {immersiveMode && readerToolMode === "lectura" ? (
                          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/15 bg-black/55 px-2.5 py-1 text-xs text-white/80 backdrop-blur-xl">
                            {readerPage} / {Math.max(1, pageCount ?? previewPages.length ?? 1)} · {Math.round(readerEffectiveZoom * 100)}%
                          </div>
                        ) : null}
                        {immersiveMode && readerToolMode === "lectura" && readerSafeMode ? (
                          <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/45 bg-amber-200/15 px-2.5 py-1.5 text-[11px] text-amber-100 backdrop-blur-sm">
                            <span>Modo seguro activo (recuperación anti pantalla negra).</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-amber-200/50 bg-amber-100/10 px-2 text-[11px] text-amber-50 hover:bg-amber-100/15"
                              onClick={() => {
                                readerRecoveryBurstRef.current = [];
                                setReaderSafeMode(false);
                                setReaderPan({ x: 0, y: 0 });
                                setReaderGestureZoom(1);
                                setReaderRecoverNonce((prev) => prev + 1);
                                window.requestAnimationFrame(() => applyFitZoom(true));
                              }}
                            >
                              Reintentar gestos
                            </Button>
                          </div>
                        ) : null}
                        {previewStalled && !(immersiveMode && readerToolMode === "lectura") ? (
                          <div className="absolute bottom-3 right-3 rounded-lg border border-amber-300/40 bg-amber-200/10 px-2.5 py-1 text-[11px] text-amber-100">
                            Vista previa lenta. Puedes abrir el PDF completo.
                          </div>
                        ) : null}
                      </div>
                    ) : previewUrl ? (
                      <div className="relative flex h-full w-full items-center justify-center bg-[#050505] px-3 pb-6 pt-6">
                        {isLargePdfCompatibilityMode ? (
                          <div className="absolute left-3 top-3 z-10 max-w-[min(96vw,760px)] rounded-lg border border-amber-300/35 bg-amber-200/12 px-3 py-2 text-[11px] text-amber-100 backdrop-blur-sm">
                            Modo compatibilidad activo para PDF pesado ({formatPdfSizeLabel(selected?.sizeBytes ?? 0)}). Se usa render remoto en la app para evitar fallos de memoria. Umbral actual: {largePdfCompatibilityThresholdLabel}.
                          </div>
                        ) : null}
                        <iframe
                          key={selected?.id ?? "pdf"}
                          src={`${previewUrl}#zoom=page-width`}
                          title={selected?.title ?? "Visor PDF"}
                          className="h-full w-[min(96vw,1080px)] rounded-sm bg-white shadow-[0_34px_90px_-38px_rgba(0,0,0,0.95)]"
                        />
                      </div>
                    ) : (
                      <div className="flex h-[62svh] min-h-[420px] w-full items-center justify-center text-sm text-foreground/70 md:h-[640px]">
                        No se pudo cargar el PDF.
                      </div>
                    )}
                  </div>

                  {!(immersiveMode && readerToolMode === "lectura") ? (
                  <div className="mt-3 grid gap-3 rounded-xl bg-white/7 p-3 lg:grid-cols-3">
                    <div className="space-y-1 lg:col-span-2">
                      {readerToolMode === "generador" ? (
                        <>
                          <div className="text-xs uppercase tracking-wider text-foreground/70">Rango páginas para extracción</div>
                          <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wider text-white/60">Desde</div>
                          <input
                            type="number"
                            min={1}
                            value={selected.pageStart}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, pageStart: n } : x)));
                            }}
                            onBlur={(e) => {
                              const start = Math.max(1, Math.floor(Number(e.target.value)));
                              const end = Math.max(start, Math.floor(selected.pageEnd || start));
                              setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, pageStart: start, pageEnd: end } : x)));
                              void updateMeta({ pageStart: start, pageEnd: end });
                            }}
                            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wider text-white/60">Hasta</div>
                          <input
                            type="number"
                            min={1}
                            value={selected.pageEnd}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              if (!Number.isFinite(n)) return;
                              setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, pageEnd: n } : x)));
                            }}
                            onBlur={(e) => {
                              const end = Math.max(1, Math.floor(Number(e.target.value)));
                              const start = Math.min(Math.max(1, Math.floor(selected.pageStart || 1)), end);
                              setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, pageStart: start, pageEnd: end } : x)));
                              void updateMeta({ pageStart: start, pageEnd: end });
                            }}
                            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                          />
                        </div>
                          </div>
                          <div className="text-xs text-foreground/60">Ej: 10–18</div>
                        </>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={() => jumpToPage(readerPage - 1)}
                          disabled={readerPage <= 1}
                        >
                          -1
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={() => jumpToPage(readerPage + 1)}
                          disabled={readerPage >= ((pageCount ?? previewPages.length) || 1)}
                        >
                          +1
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="border border-white/25 bg-white text-black hover:bg-white/90"
                          onClick={() => commitReaderProgress(readerPage, "Guardado manual.")}
                          disabled={!selected}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={() => jumpToBookmarkNeighbor(-1)}
                          disabled={!readerBookmarks.length}
                        >
                          ← Marc
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={() => jumpToBookmarkNeighbor(1)}
                          disabled={!readerBookmarks.length}
                        >
                          Marc →
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={handleAddBookmarkCurrentPage}
                          disabled={!selected}
                        >
                          <Bookmark className={`h-4 w-4 ${currentBookmark ? "fill-current text-amber-300" : ""}`} />
                          {currentBookmark ? "Actualizar marcador" : "Marcar página"}
                        </Button>
                        {currentBookmark ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                            onClick={() => handleDeleteBookmark(currentBookmark.id)}
                          >
                            Quitar
                          </Button>
                        ) : null}
                      </div>
                      <input
                        value={bookmarkLabelInput}
                        onChange={(e) => setBookmarkLabelInput(e.target.value)}
                        placeholder="Etiqueta marcador (opcional)"
                        className="h-9 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-xs outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                      />
                      <div className="text-xs text-white/60">
                        Guardado actual: pág. {committedReaderPage}. {hasPendingReaderChanges ? "Hay cambios sin confirmar." : "Todo guardado."}
                      </div>
                      <div className="text-[11px] text-white/55">
                        Atajos: ←/→ navegar · {readerShortcuts.save} guardar · {readerShortcuts.bookmark} marcador · {readerShortcuts.note} nota · {readerShortcuts.prevBookmark}/{readerShortcuts.nextBookmark} marcadores
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-fit border-white/25 bg-white/10 px-2.5 text-[11px] text-white hover:bg-white/15"
                        onClick={() => setReaderShortcutEditorOpen((prev) => !prev)}
                      >
                        {readerShortcutEditorOpen ? "Ocultar atajos" : "Configurar atajos"}
                      </Button>
                      {readerShortcutEditorOpen ? (
                        <div className="space-y-2 rounded-xl border border-white/20 bg-white/6 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] uppercase tracking-wider text-white/60">Perfil de atajos</div>
                            <select
                              value={readerShortcutScope}
                              onChange={(e) => setReaderShortcutScope(e.target.value as ReaderShortcutScope)}
                              className="h-7 rounded-md border border-white/25 bg-white/10 px-2 text-[10px] text-white outline-none"
                            >
                              <option value="global">Global</option>
                              <option value="subject" disabled={!selectedSubjectSlug}>Materia actual</option>
                            </select>
                          </div>
                          <div className="text-[10px] text-white/60">
                            Activo: {effectiveShortcutScope === "subject" && selectedSubjectSlug ? `Materia (${selectedSubjectSlug})` : "Global"}
                          </div>
                          {hasShortcutConflicts ? (
                            <div className="rounded-md border border-rose-300/40 bg-rose-400/15 px-2 py-1 text-[10px] text-rose-100">
                              Hay atajos duplicados. Las acciones con conflicto se bloquean hasta corregirlas.
                            </div>
                          ) : null}
                          <div className="text-[10px] uppercase tracking-wider text-white/60">Personaliza combinaciones (ej: ctrl+s, alt+arrowdown)</div>
                          <div className="text-[10px] text-white/60">Tip: toca “Capturar” y luego presiona la combinación en el teclado.</div>
                          {READER_SHORTCUT_ACTIONS.map((action) => (
                            <label key={action} className="flex items-center gap-2 text-[11px] text-white/80">
                              <span className="w-36 shrink-0">{READER_SHORTCUT_ACTION_LABELS[action]}</span>
                              <div className="flex-1 space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <input
                                    value={readerShortcuts[action]}
                                    onChange={(e) => {
                                      const next = normalizeShortcutBinding(e.target.value);
                                      setReaderShortcuts((prev) => ({ ...prev, [action]: next || prev[action] }));
                                    }}
                                    onBlur={(e) => {
                                      const next = normalizeShortcutBinding(e.target.value);
                                      setReaderShortcuts((prev) => ({
                                        ...prev,
                                        [action]: next || DEFAULT_READER_SHORTCUTS[action],
                                      }));
                                    }}
                                    onKeyDown={(event) => {
                                      if (shortcutCaptureAction !== action) return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      if (event.key === "Escape") {
                                        setShortcutCaptureAction(null);
                                        return;
                                      }
                                      const next = normalizeShortcutBinding(keyboardEventToShortcut(event.nativeEvent));
                                      if (!next) return;
                                      setReaderShortcuts((prev) => ({ ...prev, [action]: next }));
                                      setShortcutCaptureAction(null);
                                    }}
                                    readOnly={shortcutCaptureAction === action}
                                    className={`h-7 w-full rounded-md border bg-white/10 px-2 text-[11px] text-white outline-none ${shortcutConflictByAction[action] ? "border-rose-300/60" : "border-white/25"}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 border-white/25 bg-white/10 px-2 text-[10px] text-white hover:bg-white/15 ${shortcutCaptureAction === action ? "ring-2 ring-emerald-300/60" : ""}`}
                                    onClick={() => setShortcutCaptureAction((prev) => (prev === action ? null : action))}
                                  >
                                    {shortcutCaptureAction === action ? "Escuchar..." : "Capturar"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-white/25 bg-white/10 px-2 text-[10px] text-white hover:bg-white/15"
                                    onClick={() => {
                                      setReaderShortcuts((prev) => ({ ...prev, [action]: DEFAULT_READER_SHORTCUTS[action] }));
                                      setShortcutCaptureAction((prev) => (prev === action ? null : prev));
                                    }}
                                  >
                                    Reset
                                  </Button>
                                </div>
                                {shortcutConflictByAction[action] ? (
                                  <div className="text-[10px] text-rose-200">Conflicto con: {shortcutConflictByAction[action]}</div>
                                ) : null}
                                {shortcutCaptureAction === action ? (
                                  <div className="text-[10px] text-emerald-200">Presiona una combinación ahora (Esc para cancelar).</div>
                                ) : null}
                              </div>
                            </label>
                          ))}
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-white/25 bg-white/10 px-2 text-[10px] text-white hover:bg-white/15"
                              onClick={() => setReaderShortcuts(DEFAULT_READER_SHORTCUTS)}
                            >
                              Restablecer
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <select
                          value={readerImportMode}
                          onChange={(e) => setReaderImportMode(e.target.value as "merge" | "replace")}
                          className="h-8 rounded-lg border border-white/20 bg-white/8 px-2.5 text-[11px] text-white outline-none"
                        >
                          <option value="merge">Import mode: merge</option>
                          <option value="replace">Import mode: replace</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={handleExportReaderArtifacts}
                          disabled={!selected}
                        >
                          Exportar notas/marcadores
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={() => readerImportRef.current?.click()}
                          disabled={!selected}
                        >
                          Importar ({readerImportMode})
                        </Button>
                      </div>
                    </div>
                  </div>
                  ) : null}

                  {immersiveMode && readerSidebarOpen ? (
                    <div className="absolute right-4 top-16 z-40 w-[min(360px,92vw)] rounded-xl border border-white/20 bg-slate-900/88 p-3 shadow-[0_30px_70px_-40px_rgba(0,0,0,1)] backdrop-blur-2xl">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wider text-white/70">Panel lector</div>
                        <div className="text-[10px] text-white/60">Pág. {readerPage}</div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5 rounded-lg border border-white/15 bg-white/6 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-white/60">Acciones rápidas</div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-white/25 bg-white/10 px-2 text-[10px] text-white hover:bg-white/15"
                              onClick={() => commitReaderProgress(readerPage, "Guardado manual.")}
                              disabled={!selected}
                            >
                              Guardar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-white/25 bg-white/10 px-2 text-[10px] text-white hover:bg-white/15"
                              onClick={handleAddBookmarkCurrentPage}
                              disabled={!selected}
                            >
                              {currentBookmark ? "Actualizar marcador" : "Marcar página"}
                            </Button>
                            {currentBookmark ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 border-white/25 bg-white/10 px-2 text-[10px] text-white hover:bg-white/15"
                                onClick={() => handleDeleteBookmark(currentBookmark.id)}
                              >
                                Quitar
                              </Button>
                            ) : null}
                          </div>
                          <input
                            value={bookmarkLabelInput}
                            onChange={(e) => setBookmarkLabelInput(e.target.value)}
                            placeholder="Etiqueta marcador (opcional)"
                            className="h-8 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-[11px] outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-white/85">Marcadores</div>
                          <input
                            value={bookmarkFilterQuery}
                            onChange={(e) => setBookmarkFilterQuery(e.target.value)}
                            placeholder="Filtrar marcadores..."
                            className="h-8 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-xs outline-none"
                          />
                          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/15 bg-white/6 p-2">
                            {filteredReaderBookmarks.length ? (
                              filteredReaderBookmarks.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  className="w-full rounded-md bg-white/8 px-2 py-1.5 text-left text-[11px] text-white/85 hover:bg-white/12"
                                  onClick={() => jumpToPage(b.page)}
                                >
                                  Pág. {b.page}{b.label ? ` · ${b.label}` : ""}
                                </button>
                              ))
                            ) : (
                              <div className="text-[11px] text-white/60">Sin marcadores filtrados.</div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-white/85">Notas</div>
                          <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Escribe una nota para esta página..."
                            className="h-24 w-full rounded-xl border border-white/25 bg-white/8 p-2.5 text-xs outline-none"
                          />
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 border-white/25 bg-white/10 px-2 text-[11px] text-white hover:bg-white/15"
                              onClick={handleSaveCurrentNote}
                            >
                              Guardar
                            </Button>
                            {currentNote ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 border-white/25 bg-white/10 px-2 text-[11px] text-white hover:bg-white/15"
                                onClick={() => {
                                  if (!selected) return;
                                  deleteReaderNote(selected.id, currentNote.id);
                                }}
                              >
                                Eliminar
                              </Button>
                            ) : null}
                          </div>
                          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/15 bg-white/6 p-2">
                            {filteredReaderNotes.length ? (
                              filteredReaderNotes.map((n) => (
                                <button
                                  key={n.id}
                                  type="button"
                                  className="w-full rounded-md bg-white/8 px-2 py-1.5 text-left text-[11px] text-white/85 hover:bg-white/12"
                                  onClick={() => jumpToPage(n.page)}
                                >
                                  <span className="font-semibold">Pág. {n.page}</span> · {n.payload.text.slice(0, 72)}
                                </button>
                              ))
                            ) : (
                              <div className="text-[11px] text-white/60">Sin notas filtradas.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {immersiveMode && readerPageInfoOpen ? (
                    <div className="absolute right-4 top-16 z-40 w-[min(320px,90vw)] rounded-xl border border-white/20 bg-slate-900/90 p-3 shadow-[0_30px_70px_-40px_rgba(0,0,0,1)] backdrop-blur-2xl">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wider text-white/70">Estado de lectura</div>
                        <button
                          type="button"
                          className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/15"
                          onClick={() => setReaderPageInfoOpen(false)}
                        >
                          Cerrar
                        </button>
                      </div>
                      <div className="space-y-1.5 text-xs text-white/80">
                        <div>Página actual: <span className="font-semibold text-white">{readerPage}</span></div>
                        <div>Última guardada: <span className="font-semibold text-white">{committedReaderPage}</span></div>
                        <div>Total detectado: <span className="font-semibold text-white">{Math.max(1, pageCount ?? previewPages.length ?? 1)}</span></div>
                        <div>Zoom: <span className="font-semibold text-white">{Math.round(readerZoom * readerGestureZoom * 100)}%</span></div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, pageCount ?? previewPages.length ?? 1)}
                          value={readerPageDialogInput}
                          onChange={(e) => setReaderPageDialogInput(e.target.value)}
                          className="h-8 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-xs text-white outline-none"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-white/25 bg-white/10 px-2 text-xs text-white hover:bg-white/15"
                          onClick={() => jumpToPage(Number(readerPageDialogInput), "auto")}
                        >
                          Ir
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {!immersiveMode ? (
                    <div className="mt-3 grid gap-3 rounded-xl bg-white/7 p-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wider text-foreground/70">Marcadores</div>
                      <input
                        value={bookmarkFilterQuery}
                        onChange={(e) => setBookmarkFilterQuery(e.target.value)}
                        placeholder="Filtrar marcadores..."
                        className="h-8 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                      />
                      {filteredReaderBookmarks.length ? (
                        <div className="space-y-1.5">
                          {filteredReaderBookmarks.map((b) => (
                            <div key={b.id} className="space-y-1 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="text-left text-xs text-white/90 hover:text-white"
                                  onClick={() => jumpToPage(b.page)}
                                >
                                  Pág. {b.page}{b.label ? ` · ${b.label}` : ""}
                                </button>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-white/20 bg-black/30 px-2 text-[10px] text-white hover:bg-white/15"
                                    onClick={() => startEditBookmark(b.id, b.label)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-white/20 bg-black/30 px-2 text-[10px] text-white hover:bg-white/15"
                                    onClick={() => handleDeleteBookmark(b.id)}
                                  >
                                    Borrar
                                  </Button>
                                </div>
                              </div>
                              {editingBookmarkId === b.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    value={editingBookmarkLabel}
                                    onChange={(e) => setEditingBookmarkLabel(e.target.value)}
                                    placeholder="Etiqueta"
                                    className="h-7 flex-1 rounded-md border border-white/25 bg-white/8 px-2 text-[11px] outline-none"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-white/20 bg-black/30 px-2 text-[10px] text-white hover:bg-white/15"
                                    onClick={saveEditBookmark}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-white/20 bg-black/30 px-2 text-[10px] text-white hover:bg-white/15"
                                    onClick={cancelEditBookmark}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-white/20 bg-white/6 px-3 py-2 text-xs text-white/65">
                          Sin coincidencias de marcadores.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wider text-foreground/70">Notas de página</div>
                        <div className="text-[10px] text-white/60">Pág. {readerPage}</div>
                      </div>
                      <input
                        value={noteSearchQuery}
                        onChange={(e) => setNoteSearchQuery(e.target.value)}
                        placeholder="Buscar en notas..."
                        className="h-8 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                      />
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Escribe una nota para esta página..."
                        className="h-28 w-full rounded-xl border border-white/25 bg-white/8 p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                          onClick={handleSaveCurrentNote}
                        >
                          <StickyNote className="h-4 w-4" />
                          Guardar nota
                        </Button>
                        {currentNote ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                            onClick={() => {
                              if (!selected) return;
                              deleteReaderNote(selected.id, currentNote.id);
                            }}
                          >
                            Eliminar
                          </Button>
                        ) : null}
                      </div>
                      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-white/15 bg-white/6 p-2">
                        {filteredReaderNotes.length ? (
                          filteredReaderNotes.map((n) => (
                            <div key={n.id} className="flex items-start justify-between gap-2 rounded-md bg-white/8 px-2 py-1.5">
                              <button
                                type="button"
                                className="text-left text-[11px] text-white/85 hover:text-white"
                                onClick={() => jumpToPage(n.page)}
                              >
                                <span className="font-semibold">Pág. {n.page}</span> · {n.payload.text.slice(0, 88)}{n.payload.text.length > 88 ? "…" : ""}
                              </button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 border-white/20 bg-black/30 px-1.5 text-[10px] text-white hover:bg-white/15"
                                onClick={() => {
                                  if (!selected) return;
                                  deleteReaderNote(selected.id, n.id);
                                }}
                              >
                                X
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="px-1 py-1 text-xs text-white/60">Sin coincidencias de notas.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  ) : null}

                  {readerToolMode === "generador" ? (
                  <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="secondary" className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={() => void runExtract()} disabled={busy || !previewUrl}>
                      Extraer texto (rango)
                    </Button>
                    {extractedText ? (
                      <Button
                        variant="outline"
                        className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(extractedText);
                            pushNotice("Copiado", "Texto extraído copiado al portapapeles.");
                          } catch {
                            // ignore
                          }
                        }}
                        disabled={busy}
                      >
                        Copiar
                      </Button>
                    ) : null}
                    {pageCount ? (
                      <div className="text-xs text-foreground/60">PDF: {pageCount} páginas</div>
                    ) : null}
                  </div>

                  {extractError ? (
                    <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {extractError}
                    </div>
                  ) : null}

                  {extractedText ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs uppercase tracking-wider text-foreground/70">Texto extraído</div>
                      <textarea
                        value={extractedText}
                        onChange={(e) => setExtractedText(e.target.value)}
                        className="min-h-[280px] w-full rounded-xl border border-white/20 bg-white/8 px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                      />

                      {chunks.length ? (
                        <div className="rounded-xl bg-white/7 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs uppercase tracking-wider text-foreground/70">Seleccionar chunks</div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                                onClick={() => setSelectedChunkIdxs(new Set(chunks.map((_, idx) => idx)))}
                              >
                                Todo
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                                onClick={() => setSelectedChunkIdxs(new Set())}
                              >
                                Nada
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2 grid gap-2 lg:grid-cols-2">
                            {chunks.map((c, idx) => {
                              const checked = selectedChunkIdxs.has(idx);
                              const label = c.match(/^\[Page\s+\d+\]/)?.[0] ?? `Chunk ${idx + 1}`;
                              const preview = c.replace(/^\[Page\s+\d+\]\n?/, "").slice(0, 140);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedChunkIdxs((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(idx)) next.delete(idx);
                                      else next.add(idx);
                                      return next;
                                    })
                                  }
                                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 ${
                                    checked ? "border-white/40 bg-white/12" : "border-white/20 bg-white/5"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-medium text-foreground/70">{label}</div>
                                    <div className="text-xs text-foreground/60">{checked ? "✓" : ""}</div>
                                  </div>
                                  <div className="mt-1 text-xs text-foreground/60">{preview}{preview.length >= 140 ? "…" : ""}</div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-2 text-xs text-foreground/60">
                            Seleccionado: {selectedChunkIdxs.size}/{chunks.length}. Si no seleccionás nada, se usa el texto completo.
                          </div>
                          <div className="mt-1 text-xs text-foreground/60">
                            Texto para IA: {selectedTextForAi.length.toLocaleString("es-PE")} caracteres.
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-3 rounded-xl bg-white/7 p-3 lg:grid-cols-3">
                        <div className="space-y-1 lg:col-span-2">
                          <div className="text-xs uppercase tracking-wider text-foreground/70">Destino (SRS)</div>
                          <div className="flex flex-wrap gap-2">
                            <SubjectSelect value={subject} onChange={setSubject} allowAll />
                            <DeckSelect
                              value={deckId}
                              onChange={setDeckId}
                              decks={(srsLib?.decks ?? []).filter((d) => (subject === "all" ? true : d.subjectSlug === subject))}
                            />
                          </div>
                          <div className="mt-2 text-xs text-foreground/60">
                            Importa las tarjetas directamente a tu biblioteca de flashcards.
                          </div>

                          <div className="mt-3 grid gap-2 lg:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-xs uppercase tracking-wider text-white/70">Modo IA</div>
                              <div className="h-10 rounded-xl border border-white/25 bg-white/8 px-3 text-sm leading-10 text-white/90">Flashcards</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs uppercase tracking-wider text-white/70">Tema (opcional)</div>
                              <input
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="Ej: Glomerulonefritis"
                                className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs uppercase tracking-wider text-white/70">Cantidad</div>
                          <input
                            type="number"
                            min={5}
                            max={80}
                            value={maxCards}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              if (!Number.isFinite(parsed)) return;
                              setMaxCards(clamp(Math.floor(parsed), 5, 80));
                            }}
                            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                          />
                          <Button
                            className="mt-2 w-full border border-white/25 bg-white text-black hover:bg-white/90"
                            onClick={() => void runAi()}
                            disabled={aiBusy || busy || !selectedTextForAi.trim()}
                          >
                            {aiBusy ? "Generando..." : "Generar flashcards con IA"}
                          </Button>
                        </div>
                      </div>

                      {aiError ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          {aiError}
                        </div>
                      ) : null}

                      {aiNotes && aiNotes.length ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs uppercase tracking-wider text-foreground/70">Revisión</div>
                            <Button variant="secondary" className="border border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={importToSrs} disabled={!srsLib}>
                              Importar al deck
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {aiNotes.map((n, noteIdx) => (
                              <div key={noteIdx} className="rounded-xl bg-white/7 p-3">
                                <div className="text-sm font-medium">{n.title ?? `Nota ${noteIdx + 1}`}</div>
                                {n.tags?.length ? (
                                  <div className="mt-1 text-xs text-foreground/60">{n.tags.join(" · ")}</div>
                                ) : null}

                                <div className="mt-3 space-y-2">
                                  {n.cards.map((c, cardIdx) => (
                                    <div
                                      key={cardIdx}
                                      className="grid gap-2 rounded-lg border border-white/20 bg-white/8 p-3 lg:grid-cols-[120px,1fr,1fr,auto]"
                                    >
                                      <select
                                        value={c.type}
                                        onChange={(e) =>
                                          updateAiCard(noteIdx, cardIdx, { type: e.target.value === "cloze" ? "cloze" : "basic" })
                                        }
                                        className="h-10 rounded-md border border-white/25 bg-white/8 px-2 text-sm"
                                      >
                                        <option value="basic">basic</option>
                                        <option value="cloze">cloze</option>
                                      </select>

                                      <textarea
                                        value={c.front}
                                        onChange={(e) => updateAiCard(noteIdx, cardIdx, { front: e.target.value })}
                                        className="min-h-[56px] w-full rounded-md border border-white/25 bg-white/8 px-2 py-2 text-sm"
                                      />

                                      <textarea
                                        value={c.back}
                                        onChange={(e) => updateAiCard(noteIdx, cardIdx, { back: e.target.value })}
                                        className="min-h-[56px] w-full rounded-md border border-white/25 bg-white/8 px-2 py-2 text-sm"
                                      />

                                      <Button variant="outline" size="sm" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => deleteAiCard(noteIdx, cardIdx)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : aiNotes && !aiNotes.length ? (
                        <div className="text-sm text-muted-foreground">La IA no devolvió tarjetas útiles. Probá otro rango o más contexto.</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Extraé texto del rango para luego generar flashcards con IA.
                    </div>
                  )}
                  </>
                  ) : null}
                </div>
              ) : selected ? (
                <div className="rounded-xl border border-white/20 bg-white/6 p-6 text-sm text-foreground/70">
                  Clasifica este PDF aquí (título, materia, carpeta, tags y favorito) y usa <strong>Abrir lector inmersivo</strong> para leer con panel lateral.
                </div>
              ) : (
                <div className="rounded-xl border border-white/20 bg-white/5 p-6 text-sm text-foreground/70">
                  Subí un PDF y usa <strong>Abrir</strong> para entrar al lector. Si quieres editar metadatos, pulsa <strong>Clasificar</strong> en la tarjeta.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingLeaveHref ? (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950/95 p-4 text-white shadow-2xl">
            <div className="text-sm font-semibold">¿Guardar página antes de salir?</div>
            <p className="mt-1 text-xs text-white/75">
              Te quedaste en la página {readerPage}. Si eliges &quot;Sí&quot;, se guarda esa página para retomar con el conejo.
              Si eliges &quot;No&quot;, mantenemos la página anterior ({committedReaderPage}).
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                onClick={() => resolvePendingLeave(false)}
              >
                No
              </Button>
              <Button
                type="button"
                className="border border-white/20 bg-white text-black hover:bg-white/90"
                onClick={() => resolvePendingLeave(true)}
              >
                Sí, guardar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {notices.length > 0 ? (
        <div className="pointer-events-none fixed bottom-5 left-5 z-[130] flex w-[min(92vw,360px)] flex-col gap-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-2xl border border-white/25 bg-background/85 p-4 shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] backdrop-blur-xl"
            >
              <div className="text-sm font-semibold">{notice.title}</div>
              <div className="mt-1 text-xs text-foreground/70">{notice.body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
