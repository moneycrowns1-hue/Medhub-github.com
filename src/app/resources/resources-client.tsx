"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FileText, Filter, Search, Trash2, Upload } from "lucide-react";
import { SUBJECTS } from "@/lib/subjects";

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
import type { SrsLibrary } from "@/lib/srs";

type InAppNotice = {
  id: string;
  title: string;
  body: string;
};

export function ResourcesClient() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [items, setItems] = useState<PdfResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
  const [notices, setNotices] = useState<InAppNotice[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
        if (!selectedId && all[0]) setSelectedId(all[0].id);
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
        setPageCount(null);
        setExtractedText("");
        setChunks([]);
        setSelectedChunkIdxs(new Set());
        setExtractError(null);
        return;
      }
      const blob = await getPdfResourceBlob(selectedId);
      if (!blob) {
        setPreviewUrl(null);
        setPageCount(null);
        setExtractedText("");
        setChunks([]);
        setSelectedChunkIdxs(new Set());
        setExtractError(null);
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPageCount(null);
      setExtractedText("");
      setChunks([]);
      setSelectedChunkIdxs(new Set());
      setExtractError(null);
      setAiNotes(null);
      setAiError(null);
    };
    void run();
    return () => {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [selectedId]);

  const selectedTextForAi = useMemo(() => {
    if (!chunks.length || selectedChunkIdxs.size === 0) return extractedText;
    const parts = [...selectedChunkIdxs]
      .sort((a, b) => a - b)
      .map((idx) => chunks[idx])
      .filter(Boolean);
    return parts.join("\n\n").trim();
  }, [chunks, selectedChunkIdxs, extractedText]);

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

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

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
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectedTextForAi,
          maxCards,
          language: "es",
          topic,
          mode: aiMode,
        }),
      });
      const data = (await r.json().catch(() => null)) as
        | null
        | { notes?: AiNoteDraft[]; error?: string; details?: string };
      if (!r.ok) {
        const details = typeof data?.details === "string" ? data.details : "";
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
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setAiError(msg);
    } finally {
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
      setItems((prev) => prev.filter((x) => x.id !== id));
      setSelectedId((prev) => {
        if (prev !== id) return prev;
        const rest = items.filter((x) => x.id !== id);
        return rest[0]?.id ?? null;
      });
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
      const blob = await getPdfResourceBlob(selectedId);
      if (!blob) {
        setExtractError("No se pudo leer el archivo.");
        return;
      }
      const { text, pageCount: pc } = await extractPdfTextFromBlob({
        blob,
        pageStart: selected.pageStart,
        pageEnd: selected.pageEnd,
      });
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
    <div className="space-y-10">
      <div className="space-y-4 rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Recursos</div>
          <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-foreground/70">
            PDFs locales guardados en tu dispositivo. Seleccioná un rango de páginas para generar flashcards con IA.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar PDF por título..."
            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 pl-9 pr-3 text-sm outline-none placeholder:text-foreground/45 focus-visible:ring-3 focus-visible:ring-white/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/8 px-3 py-1.5">
            <Filter className="h-3.5 w-3.5 text-foreground/60" />
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-transparent text-sm outline-none"
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
          <Button variant="secondary" className="border border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            Subir PDF
          </Button>
          <Button
            variant="outline"
            className="rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={async () => {
              setBusy(true);
              try {
                const all = await listPdfResources();
                setItems(all);
                if (!selectedId && all[0]) setSelectedId(all[0].id);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            Recargar
          </Button>
        </div>
        {uploadError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Error al subir PDF: {uploadError}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-[320px,1fr]">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="rounded-xl border border-white/20 bg-white/5 p-3 backdrop-blur-xl">
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/20 bg-white/5 p-3 backdrop-blur-xl">
            <Skeleton className="h-[520px] w-full rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[320px,1fr]">
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
                className={`w-full rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/10 ${
                  i.id === selectedId ? "border-white/40 bg-white/12" : "border-white/20 bg-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-foreground/60" />
                      <div className="truncate text-sm font-medium">{i.title}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-foreground/65">
                      <span>{Math.round(i.sizeBytes / 1024)} KB · pp. {i.pageStart}–{i.pageEnd}</span>
                      {i.subjectSlug && SUBJECTS[i.subjectSlug as keyof typeof SUBJECTS] ? (
                        <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/90">
                          {SUBJECTS[i.subjectSlug as keyof typeof SUBJECTS].name}
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] text-foreground/60">
                          Sin materia
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/25 bg-white/10 text-white hover:bg-white/15"
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
              <div className="rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-foreground/70">
                No hay PDFs todavía.
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl">
            <div className="border-b border-white/15 px-6 py-4">
              <div className="text-base font-bold">{selected ? selected.title : "Seleccioná un PDF"}</div>
            </div>
            <div className="space-y-4 p-6">
              {selected ? (
                <div className="grid gap-3 md:grid-cols-3">
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
                        void updateMeta({ subjectSlug: v ?? "" });
                      }}
                      className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                    >
                      <option value="">Sin asignar</option>
                      {Object.values(SUBJECTS).map((s) => (
                        <option key={s.slug} value={s.slug}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Rango páginas</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Desde</div>
                        <input
                          type="number"
                          min={1}
                          value={selected.pageStart}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            setItems((prev) =>
                              prev.map((x) => (x.id === selected.id ? { ...x, pageStart: n } : x)),
                            );
                          }}
                          onBlur={(e) => {
                            const n = Math.max(1, Math.floor(Number(e.target.value)));
                            void updateMeta({ pageStart: n });
                          }}
                          className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hasta</div>
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
                            const n = Math.max(1, Math.floor(Number(e.target.value)));
                            void updateMeta({ pageEnd: n });
                          }}
                          className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-foreground/60">Ej: 10–18</div>
                  </div>
                </div>
              ) : null}

              {selected ? (
                <div className="rounded-xl border border-white/20 bg-white/5 p-3">
                  <div className="text-xs uppercase tracking-wider text-foreground/70">Vista previa</div>
                  <div className="mt-2 overflow-hidden rounded-lg border border-white/15">
                    {previewUrl ? (
                      <iframe title="pdf-preview" src={previewUrl} className="h-[640px] w-full" />
                    ) : (
                      <div className="flex h-[640px] w-full items-center justify-center text-sm text-foreground/70">
                        No se pudo cargar el PDF.
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="secondary" className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={() => void runExtract()} disabled={busy || !previewUrl}>
                      Extraer texto (rango)
                    </Button>
                    <Button
                      variant="outline"
                      className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                      onClick={async () => {
                        if (!extractedText) return;
                        try {
                          await navigator.clipboard.writeText(extractedText);
                          pushNotice("Copiado", "Texto extraído copiado al portapapeles.");
                        } catch {
                          // ignore
                        }
                      }}
                      disabled={busy || !extractedText}
                    >
                      Copiar
                    </Button>
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
                        <div className="rounded-xl border border-white/20 bg-white/5 p-3">
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

                          <div className="mt-2 grid gap-2 md:grid-cols-2">
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
                        </div>
                      ) : null}

                      <div className="grid gap-3 rounded-xl border border-white/20 bg-white/5 p-3 md:grid-cols-3">
                        <div className="space-y-1 md:col-span-2">
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

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <div className="space-y-1">
                              <div className="text-xs uppercase tracking-wider text-foreground/70">Modo IA</div>
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
                              <div className="text-xs uppercase tracking-wider text-foreground/70">Tema (opcional)</div>
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
                          <div className="text-xs uppercase tracking-wider text-foreground/70">Cantidad</div>
                          <input
                            type="number"
                            min={5}
                            max={80}
                            value={maxCards}
                            onChange={(e) => setMaxCards(Number(e.target.value))}
                            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-white/30"
                          />
                          <Button
                            className="mt-2 w-full border border-white/25 bg-white text-black hover:bg-white/90"
                            onClick={() => void runAi()}
                            disabled={aiBusy || busy || !selectedTextForAi.trim()}
                          >
                            Generar flashcards con IA
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
                              <div key={noteIdx} className="rounded-xl border border-white/20 bg-white/5 p-3">
                                <div className="text-sm font-medium">{n.title ?? `Nota ${noteIdx + 1}`}</div>
                                {n.tags?.length ? (
                                  <div className="mt-1 text-xs text-foreground/60">{n.tags.join(" · ")}</div>
                                ) : null}

                                <div className="mt-3 space-y-2">
                                  {n.cards.map((c, cardIdx) => (
                                    <div
                                      key={cardIdx}
                                      className="grid gap-2 rounded-lg border border-white/20 bg-white/8 p-3 md:grid-cols-[120px,1fr,1fr,auto]"
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
