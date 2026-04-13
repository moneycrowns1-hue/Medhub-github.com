"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { FileText, Filter, Loader2, Search, Trash2, Upload } from "lucide-react";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeckSelect } from "@/components/deck-select";
import { SubjectSelect } from "@/components/subject-select";
import {
  deletePdfResource,
  getPdfResourceBlob,
  listPdfResources,
  putPdfResource,
  type PdfResource,
  updatePdfResourceMeta,
} from "@/lib/resources-pdf-store";
import { extractPdfTextFromBlob } from "@/lib/pdf-text-extract";
import {
  importAiNotesToDeck,
  loadSrsLibrary,
  saveSrsLibrary,
  type AiNoteDraft,
} from "@/lib/srs-storage";
import { getPdfResumeForResource, markPdfProgress, RABBIT_GUIDE_SPEAK_EVENT, type RabbitGuideSpeechPayload } from "@/lib/rabbit-guide";
import type { SrsLibrary } from "@/lib/srs";

type InAppNotice = {
  id: string;
  title: string;
  body: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type PdfPreviewCacheEntry = {
  objectUrl: string;
  pages: string[];
  pageCount: number;
};

const PDF_PREVIEW_CACHE = new Map<string, PdfPreviewCacheEntry>();
let pdfWorkerConfigured = false;
let previewCacheCleanupBound = false;

function ensurePdfWorker() {
  if (pdfWorkerConfigured) return;
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
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

async function renderPdfPages(blob: Blob): Promise<{ pages: string[]; pageCount: number }> {
  ensurePdfWorker();
  const data = await blob.arrayBuffer();
  const task = getDocument({ data });
  const pdf = await task.promise;
  const pages: string[] = [];
  const lightProfile = prefersLightPdfRenderProfile();
  const viewportWidth = typeof window === "undefined" ? 1200 : Math.max(360, window.innerWidth);
  const maxWidth = lightProfile ? 780 : 980;
  const minWidth = lightProfile ? 540 : 680;
  const targetWidth = Math.min(maxWidth, Math.max(minWidth, Math.floor(viewportWidth * 0.82)));
  const jpegQuality = lightProfile ? 0.8 : 0.92;

  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p);
    const firstViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / firstViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      pages.push("");
      continue;
    }
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push(canvas.toDataURL("image/jpeg", jpegQuality));
  }

  try {
    await pdf.destroy();
  } catch {
    // ignore
  }

  return { pages, pageCount: pdf.numPages };
}

export function ResourcesClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [items, setItems] = useState<PdfResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewStalled, setPreviewStalled] = useState(false);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [maxCards, setMaxCards] = useState<number>(25);
  const [aiMode, setAiMode] = useState<"flashcards" | "exam">("flashcards");
  const [topic, setTopic] = useState<string>("");
  const [chunks, setChunks] = useState<string[]>([]);
  const [selectedChunkIdxs, setSelectedChunkIdxs] = useState<Set<number>>(() => new Set());
  const [aiNotes, setAiNotes] = useState<AiNoteDraft[] | null>(null);
  const [srsLib, setSrsLib] = useState<SrsLibrary | null>(null);
  const [subject, setSubject] = useState<string>("histologia");
  const [deckId, setDeckId] = useState<string>("deck-histo");
  const [readerPage, setReaderPage] = useState<number>(1);
  const [committedReaderPage, setCommittedReaderPage] = useState<number>(1);
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const [notices, setNotices] = useState<InAppNotice[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const initialPageAlignRef = useRef<number | null>(null);

  const pushNotice = (title: string, body: string) => {
    const id = `res_notice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    setNotices((prev) => [...prev, { id, title, body }]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }, 3800);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const all = await listPdfResources();
        setItems(all);
        setSelectedId((prev) => prev ?? (all[0]?.id ?? null));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    setSrsLib(loadSrsLibrary());
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!selectedId) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        setPreviewStalled(false);
        setPreviewPages([]);
        setPreviewError(null);
        setPageCount(null);
        setExtractedText("");
        setChunks([]);
        setSelectedChunkIdxs(new Set());
        setExtractError(null);
        return;
      }

      const cached = PDF_PREVIEW_CACHE.get(selectedId);
      if (cached) {
        setPreviewUrl(cached.objectUrl);
        setPreviewPages(cached.pages);
        setPageCount(cached.pageCount);
        setPreviewLoading(false);
        setPreviewStalled(false);
        setPreviewError(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewStalled(false);
      setPreviewPages([]);
      setPreviewError(null);
      setPageCount(null);
      setExtractedText("");
      setChunks([]);
      setSelectedChunkIdxs(new Set());
      setExtractError(null);
      setAiNotes(null);
      setAiError(null);

      const blob = await getPdfResourceBlob(selectedId);
      if (!blob) {
        setPreviewUrl(null);
        setPreviewLoading(false);
        setPreviewPages([]);
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

      try {
        const rendered = await renderPdfPages(blob);
        const entry: PdfPreviewCacheEntry = {
          objectUrl,
          pages: rendered.pages,
          pageCount: rendered.pageCount,
        };
        PDF_PREVIEW_CACHE.set(selectedId, entry);
        setPreviewUrl(entry.objectUrl);
        setPreviewPages(entry.pages);
        setPageCount(entry.pageCount);
        setPreviewLoading(false);
        setPreviewStalled(false);
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        setPreviewLoading(false);
        setPreviewPages([]);
        setPreviewError(e instanceof Error ? e.message : "No se pudo renderizar el PDF.");
      }
    };

    void run();
  }, [selectedId]);

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
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((i) => `${i.title}`.toLowerCase().includes(q));
  }, [items, query, filterSubject]);

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
  const resumeQueryPdfId = searchParams.get("resumePdf");
  const resumeQueryPageRaw = Number(searchParams.get("resumePage") ?? "");
  const selectedSubjectSlug =
    selected?.subjectSlug === "anatomia" ||
    selected?.subjectSlug === "histologia" ||
    selected?.subjectSlug === "embriologia" ||
    selected?.subjectSlug === "biologia-celular" ||
    selected?.subjectSlug === "ingles" ||
    selected?.subjectSlug === "trabajo-online"
      ? (selected.subjectSlug as SubjectSlug)
      : null;

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
          href: `/resources?resumePdf=${encodeURIComponent(selected.id)}&resumePage=${nextPage}`,
          label: "Ir a esa página",
          primary: true,
        },
      ],
      durationMs: 5200,
    });
  }, [selected]);

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

  const scrollToPreviewPage = (page: number, behavior: ScrollBehavior = "smooth") => {
    const root = previewScrollRef.current;
    if (!root) return;
    const node = root.querySelector<HTMLElement>(`[data-preview-page="${page}"]`);
    if (!node) return;
    root.scrollTo({ top: node.offsetTop - 8, behavior });
  };

  const jumpToPage = (next: number, behavior: ScrollBehavior = "smooth") => {
    const maxPage = (pageCount ?? previewPages.length) || 1;
    const safe = clamp(Math.floor(next || 1), 1, maxPage);
    setReaderPage(safe);
    scrollToPreviewPage(safe, behavior);
  };

  const commitReaderProgress = (page: number, notifyMessage: string) => {
    if (!selected) return;
    const safe = Math.max(1, Math.floor(page || 1));
    const resumeHref = `/resources?resumePdf=${encodeURIComponent(selected.id)}&resumePage=${safe}`;
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
  };

  const hasPendingReaderChanges = Boolean(selected && readerPage !== committedReaderPage);

  useEffect(() => {
    const root = previewScrollRef.current;
    if (!root || !previewPages.length) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-preview-page]"));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const page = Number((visible.target as HTMLElement).dataset.previewPage);
        if (!Number.isFinite(page)) return;
        setReaderPage((prev) => (prev === page ? prev : page));
      },
      {
        root,
        threshold: [0.55, 0.75, 0.92],
      },
    );

    for (const node of nodes) observer.observe(node);

    return () => observer.disconnect();
  }, [previewPages, selectedId]);

  useEffect(() => {
    if (!previewPages.length) return;
    const pageToAlign = initialPageAlignRef.current ?? 1;
    const id = window.requestAnimationFrame(() => {
      scrollToPreviewPage(pageToAlign, "auto");
    });
    initialPageAlignRef.current = null;
    return () => window.cancelAnimationFrame(id);
  }, [previewPages, selectedId]);

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

  const onPickFile = async (file: File) => {
    setBusy(true);
    setUploadError(null);
    try {
      const title = file.name.replace(/\.pdf$/i, "");
      const subjectSlug = filterSubject !== "all" && filterSubject !== "unassigned" ? filterSubject : undefined;
      const created = await putPdfResource({
        title,
        blob: file,
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
      setBusy(false);
    }
  };

  const runAi = async () => {
    if (!selectedTextForAi.trim()) return;
    if (selectedTextForAi.trim().length < 120) {
      setAiError("Necesitas un poco más de contenido para la IA (mínimo sugerido: 120 caracteres). Extrae más páginas o selecciona más chunks.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    const safeMaxCards = clamp(Math.floor(Number(maxCards) || 25), 5, 80);
    const aiSubjectSlug = subject === "all" ? selectedSubjectSlug ?? "histologia" : subject;
    const aiLanguage = aiSubjectSlug === "ingles" ? "en" : "es";
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
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
          mode: aiMode,
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
    patch: Partial<Pick<PdfResource, "title" | "pageStart" | "pageEnd" | "subjectSlug">>,
  ) => {
    if (!selected) return;
    setBusy(true);
    try {
      await updatePdfResourceMeta(selected.id, patch);
      setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, ...patch } : x)));
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
    <div className="space-y-8 pb-4">
      <div className="relative space-y-4 overflow-hidden rounded-[30px] bg-black/45 p-6 shadow-[0_26px_90px_-54px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-7">
        <div className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 right-6 h-32 w-32 rounded-full bg-indigo-300/10 blur-3xl" />
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/65">Recursos</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Biblioteca inteligente</h1>
          <p className="text-sm text-white/70">
            PDFs locales guardados en tu dispositivo. Seleccioná un rango de páginas para generar flashcards con IA.
          </p>
        </div>

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
          <Button variant="secondary" className="rounded-xl border-0 bg-white text-black hover:bg-white/90" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            Subir PDF
          </Button>
          <div className="ml-auto rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
            {filtered.length} PDF{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
        {uploadError ? (
          <div className="rounded-xl border border-destructive/45 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Error al subir PDF: {uploadError}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[430px,minmax(0,1.2fr)]">
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
          <div className="rounded-2xl bg-black/35 p-3 backdrop-blur-xl">
            <Skeleton className="h-[520px] w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[430px,minmax(0,1.2fr)]">
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
            <div className="space-y-2">
              {filtered.map((i) => (
                <div
                  key={i.id}
                  onClick={() => setSelectedId(i.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(i.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full rounded-2xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 ${
                    i.id === selectedId ? "bg-white/18 ring-1 ring-white/35" : "bg-white/8 ring-1 ring-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white/85">
                          <FileText className="h-4 w-4" />
                        </span>
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
                      </div>
                    </div>
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
              ))}
              {!filtered.length ? (
                <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/70">
                  No hay PDFs todavía.
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] bg-black/35 backdrop-blur-2xl">
            <div className="border-b border-white/10 px-6 py-4">
              <div className="text-base font-bold text-white">{selected ? selected.title : "Seleccioná un PDF"}</div>
            </div>
            <div className="space-y-4 p-6">
              {selected ? (
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
                        const v = e.target.value || undefined;
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

              {selected ? (
                <div className="rounded-2xl bg-white/7 p-3">
                  <div className="text-xs uppercase tracking-wider text-white/70">Vista previa</div>
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10">
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
                      <div className="relative">
                        <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/70">
                          Página actual detectada: <span className="font-semibold text-white">{readerPage}</span>
                        </div>
                        <div ref={previewScrollRef} className="h-[58svh] min-h-[360px] overflow-y-auto bg-black/35 p-2 md:h-[600px]">
                          <div className="space-y-3">
                            {previewPages.map((pageSrc, idx) => (
                              <section
                                key={`${selected?.id ?? "pdf"}-page-${idx + 1}`}
                                data-preview-page={idx + 1}
                                className={`relative overflow-hidden rounded-lg border bg-white transition ${
                                  readerPage === idx + 1 ? "border-cyan-300 ring-2 ring-cyan-300/70" : "border-white/10"
                                }`}
                              >
                                <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                                  Pág. {idx + 1}{readerPage === idx + 1 ? " · actual" : ""}
                                </div>
                                {pageSrc ? (
                                  <img
                                    src={pageSrc}
                                    alt={`Página ${idx + 1}`}
                                    className="w-full"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-56 items-center justify-center text-sm text-slate-600">
                                    No se pudo renderizar esta página.
                                  </div>
                                )}
                              </section>
                            ))}
                          </div>
                        </div>
                        {previewStalled ? (
                          <div className="absolute bottom-3 right-3 rounded-lg border border-amber-300/40 bg-amber-200/10 px-2.5 py-1 text-[11px] text-amber-100">
                            Vista previa lenta. Puedes abrir el PDF completo.
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex h-[62svh] min-h-[420px] w-full items-center justify-center text-sm text-foreground/70 md:h-[640px]">
                        No se pudo cargar el PDF.
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 rounded-xl bg-white/7 p-3 lg:grid-cols-3">
                    <div className="space-y-1 lg:col-span-2">
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
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-white/60">Página actual</div>
                      <input
                        type="number"
                        min={1}
                        value={readerPage}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          jumpToPage(n);
                        }}
                        onBlur={(e) => jumpToPage(Number(e.target.value), "auto")}
                        className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                      />
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
                      </div>
                      <div className="text-xs text-white/60">
                        Guardado actual: pág. {committedReaderPage}. {hasPendingReaderChanges ? "Hay cambios sin confirmar." : "Todo guardado."}
                      </div>
                    </div>
                  </div>

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
                              <select
                                value={aiMode}
                                onChange={(e) => setAiMode(e.target.value === "exam" ? "exam" : "flashcards")}
                                className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                              >
                                <option value="flashcards">Flashcards</option>
                                <option value="exam">Examen (MCQ)</option>
                              </select>
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
                </div>
              ) : (
                <div className="rounded-xl border border-white/20 bg-white/5 p-6 text-sm text-foreground/70">
                  Subí un PDF y selecciónalo para ver la vista previa.
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
