"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { SrsDeck, SrsLibrary } from "@/lib/srs";
import { importAiNotesToDeck, type AiNoteDraft } from "@/lib/srs-storage";

type Props = {
  lib: SrsLibrary;
  deckId: string;
  subjectSlug: string;
  onLibraryChange: (next: SrsLibrary) => void;
};

type EditableCard = {
  id: string;
  type: "basic" | "cloze";
  front: string;
  back: string;
  tags: string[];
  noteTitle?: string;
};

function flattenNotes(notes: AiNoteDraft[]): EditableCard[] {
  const out: EditableCard[] = [];
  let i = 0;
  for (const n of notes) {
    for (const c of n.cards ?? []) {
      out.push({
        id: `ai_${i++}`,
        type: c.type === "cloze" ? "cloze" : "basic",
        front: c.front,
        back: c.back,
        tags: [...(n.tags ?? []), ...(c.tags ?? [])].filter(Boolean),
        noteTitle: n.title,
      });
    }
  }
  return out;
}

function toNotesForImport(cards: EditableCard[]): AiNoteDraft[] {
  // Each card becomes its own note — simpler and matches how users usually
  // want to trim/keep cards granularly after preview.
  return cards.map((c) => ({
    title: c.noteTitle,
    tags: [],
    cards: [{ type: c.type, front: c.front, back: c.back, tags: c.tags }],
  }));
}

export function AiCardComposer({ lib, deckId, subjectSlug, onLibraryChange }: Props) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [maxCards, setMaxCards] = useState<number>(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EditableCard[]>([]);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const selectedDeck: SrsDeck | null = lib.decks.find((d) => d.id === deckId) ?? null;

  // GSAP entrance for preview cards whenever the list changes length.
  useEffect(() => {
    if (!previewRef.current) return;
    const nodes = previewRef.current.querySelectorAll<HTMLElement>("[data-ai-draft]");
    if (!nodes.length) return;
    gsap.fromTo(
      nodes,
      { y: 12, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.35,
        stagger: 0.04,
        ease: "power2.out",
        clearProps: "all",
      },
    );
  }, [drafts.length]);

  const generate = useCallback(async () => {
    if (busy) return;
    const trimmed = text.trim();
    if (trimmed.length < 60) {
      setError("Pegá al menos 60 caracteres de contenido para generar tarjetas.");
      return;
    }
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);
    try {
      const language = "es";
      const r = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          maxCards,
          language,
          topic: topic.trim() || undefined,
          mode: "flashcards",
          subjectSlug,
        }),
        signal: controller.signal,
      });
      const data = (await r.json().catch(() => null)) as
        | null
        | { notes?: AiNoteDraft[]; error?: string; details?: string };
      if (!r.ok) {
        const msg =
          r.status === 500 && data?.error?.includes("GEMINI_API_KEY")
            ? "Falta configurar GEMINI_API_KEY en el entorno (.env.local)."
            : r.status === 429
              ? "Cuota de IA excedida (429). Intentá en un rato."
              : data?.error || `Error ${r.status}`;
        setError(msg);
        return;
      }
      const notes = Array.isArray(data?.notes) ? data.notes : [];
      const cards = flattenNotes(notes);
      if (!cards.length) {
        setError("La IA no devolvió tarjetas útiles. Probá con más texto o cambiando el tema.");
        return;
      }
      setDrafts(cards);
      toast.success(`La IA generó ${cards.length} tarjetas para revisar.`);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("La IA tardó demasiado (45s). Reducí el texto o el maxCards.");
        return;
      }
      setError(e instanceof Error ? e.message : "Error desconocido al llamar la IA.");
    } finally {
      window.clearTimeout(timeoutId);
      setBusy(false);
    }
  }, [busy, text, topic, maxCards, subjectSlug]);

  const removeDraft = useCallback((id: string) => {
    setDrafts((p) => p.filter((d) => d.id !== id));
  }, []);

  const updateDraft = useCallback((id: string, patch: Partial<EditableCard>) => {
    setDrafts((p) => p.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const pushToDeck = useCallback(() => {
    if (!selectedDeck) {
      toast.error("Elegí un deck antes de importar.");
      return;
    }
    if (!drafts.length) return;
    const notes = toNotesForImport(drafts);
    const next = importAiNotesToDeck(lib, {
      deckId: selectedDeck.id,
      subjectSlug,
      notes,
      sourcePrompt: topic.trim() || undefined,
    });
    const added = next.cards.length - lib.cards.length;
    onLibraryChange(next);
    setDrafts([]);
    setText("");
    if (added > 0) {
      toast.success(`${added} tarjeta${added === 1 ? "" : "s"} agregadas a “${selectedDeck.name}”.`);
    } else {
      toast.info("No se agregó ninguna tarjeta (posibles duplicados).");
    }
  }, [drafts, lib, onLibraryChange, selectedDeck, subjectSlug, topic]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/55">
          <Sparkles className="h-3.5 w-3.5" /> Generar con IA
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr,200px,auto]">
          <input
            className="h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35"
            placeholder="Tema (opcional, ej. ‘Ciclo de Krebs’)"
            value={topic}
            onChange={(e) => setTopic(e.currentTarget.value)}
            disabled={busy}
          />
          <label className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs text-white/70">
            <span className="shrink-0">Máx.</span>
            <input
              type="number"
              min={5}
              max={80}
              className="h-7 w-full rounded-md border border-white/15 bg-white/5 px-2 text-right text-sm text-white outline-none focus:border-white/35"
              value={maxCards}
              onChange={(e) => setMaxCards(Math.max(5, Math.min(80, Number(e.currentTarget.value || 15))))}
              disabled={busy}
            />
            <span className="shrink-0 text-white/40">tarjetas</span>
          </label>
          <Button
            className="h-10 gap-1.5 rounded-xl border border-white/25 bg-white px-4 text-sm text-black hover:bg-white/90 disabled:opacity-60"
            onClick={generate}
            disabled={busy || text.trim().length < 60}
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando…
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" /> Generar
              </>
            )}
          </Button>
        </div>
        <textarea
          className="min-h-[160px] w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35"
          placeholder="Pegá el texto fuente (notas, resumen, párrafos del PDF…). Mínimo 60 caracteres."
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          disabled={busy}
        />
        {error ? (
          <div className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-2.5 text-xs text-rose-100">
            {error}
          </div>
        ) : null}
        <div className="text-[11px] text-white/55">
          Destino: <strong className="text-white">{selectedDeck?.name ?? "(elegí un deck)"}</strong>. Las tarjetas quedan como borradores hasta que toques <em>Agregar al deck</em>.
        </div>
      </div>

      {drafts.length ? (
        <div className="space-y-3" ref={previewRef}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-widest text-white/70">
              {drafts.length} borrador{drafts.length === 1 ? "" : "es"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                onClick={() => setDrafts([])}
              >
                Descartar todo
              </Button>
              <Button
                className="border border-white/25 bg-white text-black hover:bg-white/90"
                onClick={pushToDeck}
                disabled={!selectedDeck || !drafts.length}
              >
                Agregar al deck
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                data-ai-draft
                className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/60">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5">
                    {d.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDraft(d.id)}
                    className="text-rose-200/80 hover:text-rose-200"
                    aria-label="Descartar"
                    title="Descartar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <textarea
                  className="min-h-[64px] w-full rounded-md border border-white/20 bg-white/8 p-2 text-sm text-white"
                  value={d.front}
                  onChange={(e) => updateDraft(d.id, { front: e.currentTarget.value })}
                />
                <textarea
                  className="min-h-[56px] w-full rounded-md border border-white/20 bg-white/8 p-2 text-xs text-white/85"
                  value={d.back}
                  onChange={(e) => updateDraft(d.id, { back: e.currentTarget.value })}
                />
                {d.tags.length ? (
                  <div className="flex flex-wrap gap-1 text-[10px] text-white/55">
                    {d.tags.map((t) => (
                      <span key={t} className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
