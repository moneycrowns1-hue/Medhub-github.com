"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Plus, Target, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
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
  open?: boolean;
};

function uid() {
  return `q_${Math.random().toString(36).slice(2)}`;
}

export function QuickQuiz({ subjectSlug, semester, availableBlocks, onClose, open = true }: Props) {
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
    <Modal open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <ModalContent size="lg" aria-label="Quiz rápido">
        <ModalHeader>
          <ModalTitle>
            <span className="inline-flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-cyan-200" />
              Quiz rápido · {semester.semester.name}
            </span>
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título del quiz"
            className="h-9 rounded-lg bg-white/[0.06] px-2.5 text-sm text-white outline-none focus:bg-white/[0.09]"
          />
          <select
            value={blockKey}
            onChange={(event) => setBlockKey(event.target.value)}
            className="h-9 rounded-lg bg-white/[0.06] px-2.5 text-sm text-white outline-none focus:bg-white/[0.09]"
          >
            {availableBlocks.map((block) => {
              const key = `${block.blockType}:${block.blockIndex ?? "x"}`;
              return <option key={key} value={key}>{block.label}</option>;
            })}
          </select>
        </div>

        <ul className="mt-3 space-y-2 max-h-[260px] overflow-y-auto pr-1" data-quickquiz-list>
          {questions.map((question, idx) => (
            <li key={question.id} className="rounded-lg bg-white/[0.06] p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/60">#{idx + 1}</span>
                <input
                  value={question.prompt}
                  onChange={(event) =>
                    setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, prompt: event.target.value } : q)))
                  }
                  placeholder="Pregunta"
                  className="h-8 flex-1 rounded-md bg-white/[0.06] px-2 text-sm text-white outline-none focus:bg-white/[0.09]"
                />
                <button
                  type="button"
                  className="rounded-md bg-white/[0.06] p-1.5 text-white/75 hover:bg-white/15 hover:text-white"
                  onClick={() => setQuestions((prev) => prev.filter((q) => q.id !== question.id))}
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${question.correct === true ? "bg-emerald-400/20 text-emerald-100" : "bg-white/[0.06] text-white/75 hover:bg-white/10"}`}
                  onClick={() => setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, correct: true } : q)))}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Acerté
                </button>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${question.correct === false ? "bg-rose-400/20 text-rose-100" : "bg-white/[0.06] text-white/75 hover:bg-white/10"}`}
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
            className="bg-white/10 text-white hover:bg-white/15"
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
          <div className="mt-3 rounded-md bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-100">
            {savedMessage}
          </div>
        ) : null}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" className="bg-white/10 text-white hover:bg-white/15" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            className="bg-white text-black hover:bg-white/90"
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
