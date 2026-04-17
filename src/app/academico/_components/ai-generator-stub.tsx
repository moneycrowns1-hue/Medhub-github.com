"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  requestAcademicGeneration,
  type AcademicAiGenerateRequest,
  type AcademicAiGenerateResult,
} from "@/lib/academic-ai-types";

type Props = {
  request: () => AcademicAiGenerateRequest;
  disabled?: boolean;
};

export function AiGeneratorStub({ request, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AcademicAiGenerateResult | null>(null);

  return (
    <div className="rounded-xl border border-purple-300/30 bg-purple-400/10 p-3 text-xs text-purple-100">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-semibold">Generar con IA desde material</span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const response = await requestAcademicGeneration(request());
              setResult(response);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy ? "Generando…" : "Generar"}
        </Button>
      </div>
      <p className="mt-1 opacity-80">
        Flashcards, notas y quiz a partir de un PDF o texto. Actualmente en mantenimiento: el botón devolverá un aviso controlado.
      </p>
      {result && result.status === "disabled" ? (
        <div className="mt-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-2.5 py-1.5 text-amber-100">
          {result.message}
        </div>
      ) : null}
      {result && result.status === "ok" ? (
        <div className="mt-2 rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1.5 text-emerald-100">
          Generación recibida ({(result.flashcards?.length ?? 0)} flashcards · {(result.notes?.length ?? 0)} notas · {(result.quiz?.length ?? 0)} preguntas).
        </div>
      ) : null}
    </div>
  );
}
