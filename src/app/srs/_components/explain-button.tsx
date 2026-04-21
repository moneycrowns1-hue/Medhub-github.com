"use client";

import { useCallback, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Props = {
  front: string;
  back: string;
  subjectSlug?: string;
};

/**
 * Vaia-style "Explain this card" button. Calls /api/ai/explain with the card
 * content and shows a short structured explanation inline. Falls back
 * gracefully when the endpoint isn't available (e.g. static hosting).
 */
export function ExplainButton({ front, back, subjectSlug }: Props) {
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    try {
      const language = "es";
      const r = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back, subjectSlug, language }),
        signal: controller.signal,
      });
      const data = (await r.json().catch(() => null)) as
        | null
        | { explanation?: string; error?: string };
      if (!r.ok) {
        const msg = data?.error || `Error ${r.status}`;
        setError(msg);
        toast.error("La IA no pudo explicar esta tarjeta.");
        return;
      }
      const text = typeof data?.explanation === "string" ? data.explanation : "";
      if (!text) {
        setError("La IA no devolvió texto.");
        return;
      }
      setExplanation(text);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("La IA tardó demasiado (30s).");
        return;
      }
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      window.clearTimeout(timeoutId);
      setBusy(false);
    }
  }, [busy, front, back, subjectSlug]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-white/25 bg-white/10 text-white hover:bg-white/15"
        onClick={run}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
        Explicar con IA
      </Button>
      {explanation ? (
        <div className="whitespace-pre-wrap rounded-md border border-white/20 bg-white/5 p-2 text-xs leading-relaxed text-white/90">
          {explanation}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-300/30 bg-rose-400/10 p-2 text-[11px] text-rose-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
