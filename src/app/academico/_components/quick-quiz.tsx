"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Plus, Target, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addAcademicRecord, type AcademicSemesterComputed, type AcademicSubjectSlug, type AcademicBlockType } from "@/lib/academic-store";
import { isoDate } from "@/lib/dates";

type QuickQuizQuestion = {
  id: string;
  prompt: string;
  correct: boolean | null;
};

type Props = {
  subjectSlug: AcademicSubjectSlug;
  semester: AcademicSemesterComputed | null;
  availableBlocks: Array<{ blockType: AcademicBlockType; blockIndex: number | null; label: string }>;
  onClose: () => void;
};

function uid() {
  return `q_${Math.random().toString(36).slice(2)}`;
}

export function QuickQuiz({ subjectSlug, semester, availableBlocks, onClose }: Props) {
  const [title, setTitle] = useState("Quiz rápido");
  const [blockKey, setBlockKey] = useState<string>(() => {
    const first = availableBlocks[0];
    return first ? `${first.blockType}:${first.blockIndex ?? "x"}` : "partial:1";
  });
  const [questions, setQuestions] = useState<QuickQuizQuestion[]>([{ id: uid(), prompt: "", correct: null }]);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const answered = questions.filter((q) => q.correct !== null);
  const total = questions.length;
  const correct = questions.filter((q) => q.correct === true).length;
  const score = total > 0 ? Number(((correct / total) * 10).toFixed(2)) : 0;

  const selectedBlock = availableBlocks.find((b) => `${b.blockType}:${b.blockIndex ?? "x"}` === blockKey) ?? availableBlocks[0];

  if (!semester) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-[#0f1116] p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-cyan-200" />
            <div className="text-sm font-semibold">Quiz rápido · {semester.semester.name}</div>
          </div>
          <button type="button" className="rounded-md border border-white/20 bg-black/25 p-1.5 text-white/80 hover:bg-white/15" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título del quiz"
            className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          />
          <select
            value={blockKey}
            onChange={(event) => setBlockKey(event.target.value)}
            className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          >
            {availableBlocks.map((block) => {
              const key = `${block.blockType}:${block.blockIndex ?? "x"}`;
              return <option key={key} value={key}>{block.label}</option>;
            })}
          </select>
        </div>

        <ul className="mt-3 space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {questions.map((question, idx) => (
            <li key={question.id} className="rounded-lg border border-white/15 bg-white/8 p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/60">#{idx + 1}</span>
                <input
                  value={question.prompt}
                  onChange={(event) =>
                    setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, prompt: event.target.value } : q)))
                  }
                  placeholder="Pregunta"
                  className="h-8 flex-1 rounded-md border border-white/25 bg-white/6 px-2 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  className="rounded-md border border-white/20 bg-black/25 p-1.5 text-white/75 hover:bg-white/15"
                  onClick={() => setQuestions((prev) => prev.filter((q) => q.id !== question.id))}
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${question.correct === true ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-100" : "border-white/20 bg-white/8 text-white/75"}`}
                  onClick={() => setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, correct: true } : q)))}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Acerté
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${question.correct === false ? "border-rose-300/50 bg-rose-400/20 text-rose-100" : "border-white/20 bg-white/8 text-white/75"}`}
                  onClick={() => setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, correct: false } : q)))}
                >
                  <Target className="h-3 w-3" />
                  Fallé
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={() => setQuestions((prev) => [...prev, { id: uid(), prompt: "", correct: null }])}
          >
            <Plus className="h-4 w-4" />
            Añadir pregunta
          </Button>
          <div className="text-[11px] text-white/70">
            {answered.length}/{total} respondidas · Nota provisional {score.toFixed(2)}
          </div>
        </div>

        {savedMessage ? (
          <div className="mt-3 rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-100">
            {savedMessage}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            className="border border-white/25 bg-white text-black hover:bg-white/90"
            disabled={answered.length === 0 || !selectedBlock}
            onClick={() => {
              if (!selectedBlock) return;
              addAcademicRecord({
                subjectSlug,
                semesterId: semester.semester.id,
                blockType: selectedBlock.blockType,
                blockIndex: selectedBlock.blockIndex,
                itemType: "evaluacion",
                title: title.trim() || "Quiz rápido",
                notes: `Quiz automático · ${correct}/${total} correctas`,
                date: isoDate(new Date()),
                difficulty: "media",
                score,
              });
              setSavedMessage(`Registrado en ${selectedBlock.label} con nota ${score.toFixed(2)}.`);
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
            Registrar como evaluación
          </Button>
        </div>
      </div>
    </div>
  );
}
