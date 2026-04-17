"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Brain, CheckCircle2, CircleOff, Filter, GraduationCap, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACADEMIC_MEDICAL_SUBJECTS,
  ACADEMIC_UPDATED_EVENT,
  addAcademicRecord,
  buildAcademicReviewEntries,
  createAcademicSemester,
  deleteAcademicRecord,
  deleteAcademicSemester,
  getRemedialFailedEvaluations,
  getSubjectSemestersComputed,
  loadAcademicSnapshot,
  saveAcademicConfig,
  updateAcademicSemester,
  type AcademicBlockType,
  type AcademicDifficulty,
  type AcademicItemType,
  type AcademicRecord,
  type AcademicSemesterComputed,
  type AcademicSubjectSlug,
} from "@/lib/academic-store";
import { isoDate } from "@/lib/dates";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import { SUBJECTS } from "@/lib/subjects";

const ITEM_TYPE_OPTIONS: Array<{ value: AcademicItemType; label: string }> = [
  { value: "tarea", label: "Tarea" },
  { value: "practica", label: "Práctica" },
  { value: "evaluacion", label: "Evaluación" },
  { value: "apunte", label: "Apunte" },
  { value: "flashcard", label: "Flashcard" },
];

const DIFFICULTY_OPTIONS: Array<{ value: AcademicDifficulty; label: string }> = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

type ViewMode = "gestion" | "repaso";
type RecordSort = "oldest" | "newest";
type SemesterBlockRef = { blockType: AcademicBlockType; blockIndex: number | null };

type RecordDraft = {
  title: string;
  itemType: AcademicItemType;
  date: string;
  difficulty: AcademicDifficulty;
  score: string;
  notes: string;
  linkedDeckId: string;
  linkedCardIdsText: string;
};

function blockKey(semesterId: string, blockType: AcademicBlockType, blockIndex: number | null) {
  return `${semesterId}:${blockType}:${blockIndex ?? "x"}`;
}

function createDefaultDraft(): RecordDraft {
  return {
    title: "",
    itemType: "apunte",
    date: isoDate(new Date()),
    difficulty: "media",
    score: "",
    notes: "",
    linkedDeckId: "",
    linkedCardIdsText: "",
  };
}

function blockLabel(blockType: AcademicBlockType, blockIndex: number | null) {
  if (blockType === "partial") return `Parcial ${blockIndex ?? 1}`;
  if (blockType === "final") return "Final";
  return "Remedial";
}

function itemTypeLabel(value: AcademicItemType) {
  const found = ITEM_TYPE_OPTIONS.find((option) => option.value === value);
  return found?.label ?? value;
}

function difficultyLabel(value?: AcademicDifficulty) {
  if (!value) return "—";
  const found = DIFFICULTY_OPTIONS.find((option) => option.value === value);
  return found?.label ?? value;
}

function BlockRecordsList({
  records,
  passingGrade,
  onDelete,
}: {
  records: AcademicRecord[];
  passingGrade: number;
  onDelete: (recordId: string) => void;
}) {
  if (!records.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/60">
        No hay registros todavía en este bloque.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const isFailedEvaluation = record.itemType === "evaluacion" && typeof record.score === "number" && record.score < passingGrade;
        return (
          <div key={record.id} className="rounded-xl border border-white/20 bg-white/8 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">{record.title}</div>
                <div className="text-[11px] text-white/65">
                  {record.date} · {itemTypeLabel(record.itemType)} · dificultad {difficultyLabel(record.difficulty)}
                </div>
                {typeof record.score === "number" ? (
                  <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isFailedEvaluation ? "border-rose-300/45 bg-rose-400/20 text-rose-100" : "border-emerald-300/45 bg-emerald-400/20 text-emerald-100"}`}>
                    Nota: {record.score.toFixed(2)} / 10
                  </div>
                ) : null}
                {record.itemType === "flashcard" && (record.linkedDeckId || record.linkedCardIds?.length) ? (
                  <div className="text-[11px] text-cyan-100/90">
                    Ref SRS: {record.linkedDeckId ? `Deck ${record.linkedDeckId}` : "Deck no definido"}
                    {record.linkedCardIds?.length ? ` · cards ${record.linkedCardIds.join(", ")}` : ""}
                  </div>
                ) : null}
                {record.notes ? <div className="text-xs text-white/70">{record.notes}</div> : null}
              </div>

              <div className="flex items-center gap-2">
                {record.itemType === "flashcard" ? (
                  <Link href="/srs" className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/15">
                    <Brain className="h-3.5 w-3.5" />
                    Ir a SRS
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-white/20 bg-black/25 p-1.5 text-white/75 hover:bg-white/15 hover:text-white"
                  onClick={() => onDelete(record.id)}
                  title="Eliminar registro"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RecordForm({
  draft,
  onChange,
  onAdd,
  addLabel,
  scoreError,
  deckOptions,
}: {
  draft: RecordDraft;
  onChange: (patch: Partial<RecordDraft>) => void;
  onAdd: () => void;
  addLabel: string;
  scoreError?: string;
  deckOptions: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-white/20 bg-white/6 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Título del registro"
          className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
        />
        <input
          type="date"
          value={draft.date}
          onChange={(event) => onChange({ date: event.target.value })}
          className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <select
          value={draft.itemType}
          onChange={(event) => onChange({ itemType: event.target.value as AcademicItemType })}
          className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
        >
          {ITEM_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={draft.difficulty}
          onChange={(event) => onChange({ difficulty: event.target.value as AcademicDifficulty })}
          className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
        >
          {DIFFICULTY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {draft.itemType === "evaluacion" ? (
          <input
            type="number"
            min={0}
            max={10}
            step="0.1"
            value={draft.score}
            onChange={(event) => onChange({ score: event.target.value })}
            placeholder="Nota (0-10)"
            className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          />
        ) : (
          <div className="h-9 rounded-lg border border-white/10 bg-white/3 px-2.5 text-xs leading-9 text-white/45">
            Nota solo aplica para evaluación
          </div>
        )}
      </div>

      {draft.itemType === "flashcard" ? (
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={draft.linkedDeckId}
            onChange={(event) => onChange({ linkedDeckId: event.target.value })}
            className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          >
            <option value="">Deck SRS (opcional)</option>
            {deckOptions.map((deck) => (
              <option key={deck.id} value={deck.id}>{deck.name}</option>
            ))}
          </select>
          <input
            value={draft.linkedCardIdsText}
            onChange={(event) => onChange({ linkedCardIdsText: event.target.value })}
            placeholder="IDs cards (coma separada)"
            className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          />
        </div>
      ) : null}

      <textarea
        value={draft.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
        placeholder="Notas opcionales"
        className="min-h-[70px] w-full rounded-lg border border-white/25 bg-white/8 px-2.5 py-2 text-sm text-white outline-none"
      />

      {scoreError ? (
        <div className="rounded-lg border border-rose-300/30 bg-rose-400/15 px-2.5 py-1.5 text-xs text-rose-100">
          {scoreError}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

export function AcademicoClient() {
  const [subject, setSubject] = useState<AcademicSubjectSlug>("anatomia");
  const [viewMode, setViewMode] = useState<ViewMode>("gestion");
  const [refreshTick, setRefreshTick] = useState(0);
  const [srsTick, setSrsTick] = useState(0);

  const [newSemesterName, setNewSemesterName] = useState("");
  const [newPartialCount, setNewPartialCount] = useState(4);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(null);
  const [passingGradeDraft, setPassingGradeDraft] = useState<string | null>(null);

  const [recordDrafts, setRecordDrafts] = useState<Record<string, RecordDraft>>({});
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({});

  const [reviewSemesterFilter, setReviewSemesterFilter] = useState<string>("all");
  const [reviewItemTypeFilter, setReviewItemTypeFilter] = useState<AcademicItemType | "all">("all");
  const [reviewDifficultyFilter, setReviewDifficultyFilter] = useState<AcademicDifficulty | "all">("all");
  const [reviewSort, setReviewSort] = useState<RecordSort>("oldest");

  const snapshot = useMemo(() => {
    void refreshTick;
    return loadAcademicSnapshot();
  }, [refreshTick]);

  const srsLib = useMemo(() => {
    void srsTick;
    if (typeof window === "undefined") return { decks: [], cards: [] };
    return loadSrsLibrary();
  }, [srsTick]);

  useEffect(() => {
    const onUpdate = () => setRefreshTick((prev) => prev + 1);
    window.addEventListener(ACADEMIC_UPDATED_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener(ACADEMIC_UPDATED_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, []);

  useEffect(() => {
    const onSrsUpdated = () => setSrsTick((prev) => prev + 1);
    window.addEventListener(SRS_UPDATED_EVENT, onSrsUpdated);
    window.addEventListener("storage", onSrsUpdated);
    window.addEventListener("focus", onSrsUpdated);
    return () => {
      window.removeEventListener(SRS_UPDATED_EVENT, onSrsUpdated);
      window.removeEventListener("storage", onSrsUpdated);
      window.removeEventListener("focus", onSrsUpdated);
    };
  }, []);

  const semestersComputed = useMemo(
    () => getSubjectSemestersComputed(subject, snapshot.semesters, snapshot.records, snapshot.config.passingGrade),
    [subject, snapshot.semesters, snapshot.records, snapshot.config.passingGrade],
  );

  const activeSemesterId = useMemo(() => {
    if (!semestersComputed.length) return null;
    if (selectedSemesterId && semestersComputed.some((entry) => entry.semester.id === selectedSemesterId)) {
      return selectedSemesterId;
    }
    return semestersComputed[0].semester.id;
  }, [selectedSemesterId, semestersComputed]);

  const passingGradeInput = passingGradeDraft ?? String(snapshot.config.passingGrade);

  const activeComputed = useMemo(
    () => semestersComputed.find((entry) => entry.semester.id === activeSemesterId) ?? null,
    [semestersComputed, activeSemesterId],
  );

  const activeSemesterRecords = useMemo(() => {
    if (!activeComputed) return [];
    return snapshot.records
      .filter((record) => record.semesterId === activeComputed.semester.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  }, [activeComputed, snapshot.records]);

  const deckOptions = useMemo(
    () => srsLib.decks.filter((deck) => deck.subjectSlug === subject).map((deck) => ({ id: deck.id, name: deck.name })),
    [srsLib.decks, subject],
  );

  const reviewEntries = useMemo(() => {
    const base = buildAcademicReviewEntries({
      subjectSlug: subject,
      semesters: snapshot.semesters,
      records: snapshot.records,
      semesterId: reviewSemesterFilter === "all" ? undefined : reviewSemesterFilter,
      difficulty: reviewDifficultyFilter,
      itemType: reviewItemTypeFilter,
      sort: reviewSort,
      prioritizeOlderAndHarder: true,
    });

    return base.filter((entry) => {
      if (entry.record.blockType !== "remedial") return true;
      return entry.record.itemType === "evaluacion" && typeof entry.record.score === "number" && entry.record.score < snapshot.config.passingGrade;
    });
  }, [
    subject,
    snapshot.semesters,
    snapshot.records,
    snapshot.config.passingGrade,
    reviewSemesterFilter,
    reviewDifficultyFilter,
    reviewItemTypeFilter,
    reviewSort,
  ]);

  const reviewGrouped = useMemo(() => {
    const map = new Map<string, { semesterName: string; blocks: Map<string, AcademicRecord[]> }>();
    for (const entry of reviewEntries) {
      if (!map.has(entry.semester.id)) {
        map.set(entry.semester.id, {
          semesterName: entry.semester.name,
          blocks: new Map(),
        });
      }
      const semesterGroup = map.get(entry.semester.id);
      if (!semesterGroup) continue;
      const key = blockKey(entry.semester.id, entry.record.blockType, entry.record.blockIndex);
      if (!semesterGroup.blocks.has(key)) semesterGroup.blocks.set(key, []);
      semesterGroup.blocks.get(key)?.push(entry.record);
    }
    return map;
  }, [reviewEntries]);

  const getDraftForBlock = (semesterId: string, blockType: AcademicBlockType, blockIndex: number | null): RecordDraft => {
    const key = blockKey(semesterId, blockType, blockIndex);
    return recordDrafts[key] ?? createDefaultDraft();
  };

  const updateDraftForBlock = (
    semesterId: string,
    blockType: AcademicBlockType,
    blockIndex: number | null,
    patch: Partial<RecordDraft>,
  ) => {
    const key = blockKey(semesterId, blockType, blockIndex);
    setRecordDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? createDefaultDraft()),
        ...patch,
      },
    }));
    if (recordErrors[key]) {
      setRecordErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCreateSemester = () => {
    const name = newSemesterName.trim() || `Semestre ${semestersComputed.length + 1}`;
    const created = createAcademicSemester({
      subjectSlug: subject,
      name,
      partialCount: newPartialCount,
    });
    setSelectedSemesterId(created.id);
    setNewSemesterName("");
  };

  const handlePassingGradeBlur = () => {
    const parsed = Number(passingGradeInput);
    if (!Number.isFinite(parsed)) {
      setPassingGradeDraft(null);
      return;
    }
    saveAcademicConfig({ passingGrade: parsed });
    setPassingGradeDraft(null);
  };

  const handleAddRecord = (semester: AcademicSemesterComputed, blockType: AcademicBlockType, blockIndex: number | null) => {
    const key = blockKey(semester.semester.id, blockType, blockIndex);
    const draft = getDraftForBlock(semester.semester.id, blockType, blockIndex);

    const title = draft.title.trim();
    if (!title) {
      setRecordErrors((prev) => ({ ...prev, [key]: "Escribe un título para el registro." }));
      return;
    }

    let score: number | undefined;
    if (draft.itemType === "evaluacion") {
      const parsed = Number(draft.score);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
        setRecordErrors((prev) => ({ ...prev, [key]: "La nota debe estar entre 0 y 10 para evaluación." }));
        return;
      }
      score = parsed;
    }

    addAcademicRecord({
      subjectSlug: subject,
      semesterId: semester.semester.id,
      blockType,
      blockIndex,
      itemType: draft.itemType,
      title,
      notes: draft.notes.trim() || undefined,
      date: draft.date || isoDate(new Date()),
      difficulty: draft.difficulty,
      score,
      linkedDeckId: draft.itemType === "flashcard" ? (draft.linkedDeckId || undefined) : undefined,
      linkedCardIds:
        draft.itemType === "flashcard"
          ? draft.linkedCardIdsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
          : undefined,
    });

    setRecordDrafts((prev) => ({ ...prev, [key]: createDefaultDraft() }));
    setRecordErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/20 bg-white/6 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-3 py-1 text-xs text-white/75">
              <GraduationCap className="h-3.5 w-3.5" />
              Sección académica
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white">Académico</h1>
            <p className="mt-1 text-sm text-white/70">
              Organiza tus semestres por materia fija de medicina, con parciales, final, remedial condicional y modo repaso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-xs ${viewMode === "gestion" ? "border-white/20 bg-white text-black" : "border-white/20 bg-white/10 text-white"}`}
              onClick={() => setViewMode("gestion")}
            >
              Gestión académica
            </button>
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-xs ${viewMode === "repaso" ? "border-white/20 bg-white text-black" : "border-white/20 bg-white/10 text-white"}`}
              onClick={() => setViewMode("repaso")}
            >
              Modo repaso
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/20 bg-white/6 p-4 md:grid-cols-3">
        <label className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-white/65">Materia (cátedra fija)</div>
          <select
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value as AcademicSubjectSlug);
              setSelectedSemesterId(null);
              setReviewSemesterFilter("all");
            }}
            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm text-white outline-none"
          >
            {ACADEMIC_MEDICAL_SUBJECTS.map((slug) => (
              <option key={slug} value={slug}>{SUBJECTS[slug].name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-white/65">Nota mínima aprobatoria</div>
          <input
            type="number"
            min={1}
            max={10}
            step="0.1"
            value={passingGradeInput}
            onChange={(event) => setPassingGradeDraft(event.target.value)}
            onBlur={handlePassingGradeBlur}
            className="h-10 w-full rounded-xl border border-white/25 bg-white/8 px-3 text-sm text-white outline-none"
          />
        </label>

        <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2">
          <div className="text-xs uppercase tracking-wider text-white/65">Regla activa</div>
          <div className="mt-1 text-sm text-white/85">
            Promedio parciales + final. Si nota final &lt; {snapshot.config.passingGrade.toFixed(1)} aparece remedial.
          </div>
        </div>
      </div>

      {viewMode === "gestion" ? (
        <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <div className="space-y-3 rounded-2xl border border-white/20 bg-white/6 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/65">Semestres</div>
                <div className="text-sm font-semibold text-white">{SUBJECTS[subject].name}</div>
              </div>
            </div>

            <div className="space-y-2">
              {semestersComputed.map((entry) => (
                <button
                  key={entry.semester.id}
                  type="button"
                  onClick={() => setSelectedSemesterId(entry.semester.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${activeSemesterId === entry.semester.id ? "border-white/45 bg-white/18" : "border-white/20 bg-white/8 hover:bg-white/12"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{entry.semester.name}</div>
                      <div className="text-[11px] text-white/65">{entry.semester.partialCount} parciales</div>
                    </div>
                    <div className="text-right">
                      {!entry.unlocked ? (
                        <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-100">Bloqueado</span>
                      ) : entry.passed ? (
                        <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-100">Aprobado</span>
                      ) : entry.finalGrade !== null ? (
                        <span className="inline-flex rounded-full border border-rose-300/30 bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-100">Reprobado</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] text-white/75">En curso</span>
                      )}
                      <div className="mt-1 text-[11px] text-white/70">
                        Final: {entry.finalGrade !== null ? entry.finalGrade.toFixed(2) : "—"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {!semestersComputed.length ? (
                <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/60">
                  Aún no tienes semestres para esta materia.
                </div>
              ) : null}
            </div>

            <div className="space-y-2 rounded-xl border border-white/20 bg-white/8 p-3">
              <div className="text-xs uppercase tracking-wider text-white/65">Crear semestre</div>
              <input
                value={newSemesterName}
                onChange={(event) => setNewSemesterName(event.target.value)}
                placeholder="Ej: Semestre 1"
                className="h-9 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newPartialCount}
                  onChange={(event) => setNewPartialCount(Number(event.target.value) || 4)}
                  className="h-9 flex-1 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
                >
                  {[2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>{count} parciales</option>
                  ))}
                </select>
                <Button type="button" className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={handleCreateSemester}>
                  <Plus className="h-4 w-4" />
                  Crear
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/20 bg-white/6 p-4">
            {activeComputed ? (
              <>
                <div className="rounded-xl border border-white/20 bg-white/8 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-white/65">Semestre activo</div>
                      <input
                        value={activeComputed.semester.name}
                        onChange={(event) =>
                          updateAcademicSemester(activeComputed.semester.id, { name: event.target.value })
                        }
                        className="mt-1 h-9 w-[min(340px,92vw)] rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={activeComputed.semester.partialCount}
                        onChange={(event) =>
                          updateAcademicSemester(activeComputed.semester.id, {
                            partialCount: Number(event.target.value) || activeComputed.semester.partialCount,
                          })
                        }
                        className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
                        disabled={!activeComputed.unlocked}
                      >
                        {[2, 3, 4, 5, 6].map((count) => (
                          <option key={count} value={count}>{count} parciales</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                        onClick={() => {
                          if (!activeComputed) return;
                          deleteAcademicSemester(activeComputed.semester.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Final: <span className="font-semibold">{activeComputed.finalGrade !== null ? activeComputed.finalGrade.toFixed(2) : "—"}</span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Remedial: <span className="font-semibold">{activeComputed.needsRemedial ? "Activo" : "No requerido"}</span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Estado: <span className="font-semibold">{activeComputed.passed ? "Aprobado" : activeComputed.finalGrade === null ? "En curso" : "Pendiente remedial"}</span>
                    </div>
                  </div>

                  {!activeComputed.unlocked ? (
                    <div className="mt-2 rounded-lg border border-amber-300/35 bg-amber-400/15 px-2.5 py-2 text-xs text-amber-100">
                      Este semestre está bloqueado hasta aprobar el anterior.
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {(() => {
                    const blocks: SemesterBlockRef[] = [
                      ...Array.from({ length: activeComputed.semester.partialCount }, (_, idx) => ({
                        blockType: "partial" as const,
                        blockIndex: idx + 1,
                      })),
                      { blockType: "final", blockIndex: null },
                    ];
                    if (activeComputed.needsRemedial) {
                      blocks.push({ blockType: "remedial", blockIndex: null });
                    }

                    return blocks.map(({ blockType, blockIndex }) => {
                      const key = blockKey(activeComputed.semester.id, blockType, blockIndex);
                      const recordsForBlock = activeSemesterRecords.filter((record) => {
                        if (record.blockType !== blockType) return false;
                        if (blockType === "partial") return record.blockIndex === blockIndex;
                        return true;
                      });
                      const draft = getDraftForBlock(activeComputed.semester.id, blockType, blockIndex);

                      const remedialFailedOnly =
                        blockType === "remedial"
                          ? getRemedialFailedEvaluations(activeComputed.semester.id, activeSemesterRecords, snapshot.config.passingGrade)
                          : [];

                      return (
                        <section key={key} className="rounded-xl border border-white/20 bg-white/7 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-white">{blockLabel(blockType, blockIndex)}</div>
                            <div className="text-[11px] text-white/65">{recordsForBlock.length} registros</div>
                          </div>

                          {blockType === "remedial" ? (
                            <div className="mb-2 rounded-lg border border-rose-300/30 bg-rose-400/15 px-2.5 py-2 text-xs text-rose-100">
                              Remedial muestra únicamente evaluaciones falladas ({remedialFailedOnly.length}).
                            </div>
                          ) : null}

                          <BlockRecordsList
                            records={recordsForBlock}
                            passingGrade={snapshot.config.passingGrade}
                            onDelete={deleteAcademicRecord}
                          />

                          {activeComputed.unlocked ? (
                            <div className="mt-2">
                              <RecordForm
                                draft={draft}
                                onChange={(patch) => updateDraftForBlock(activeComputed.semester.id, blockType, blockIndex, patch)}
                                onAdd={() => handleAddRecord(activeComputed, blockType, blockIndex)}
                                addLabel={`Agregar a ${blockLabel(blockType, blockIndex)}`}
                                scoreError={recordErrors[key]}
                                deckOptions={deckOptions}
                              />
                            </div>
                          ) : null}
                        </section>
                      );
                    });
                  })()}
                </div>

                <div className="rounded-xl border border-white/20 bg-white/7 p-3 text-xs text-white/78">
                  <div className="font-semibold">Desbloqueo</div>
                  <div className="mt-1">
                    Para desbloquear el siguiente semestre necesitas nota final ≥ {snapshot.config.passingGrade.toFixed(1)}.
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/65">
                Crea un semestre para empezar a registrar parciales, evaluaciones y repaso.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/20 bg-white/6 p-4">
          <div className="grid gap-2 md:grid-cols-4">
            <label className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-white/65">Semestre</div>
              <select
                value={reviewSemesterFilter}
                onChange={(event) => setReviewSemesterFilter(event.target.value)}
                className="h-9 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
              >
                <option value="all">Todos</option>
                {semestersComputed.map((entry) => (
                  <option key={entry.semester.id} value={entry.semester.id}>{entry.semester.name}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-white/65">Tipo</div>
              <select
                value={reviewItemTypeFilter}
                onChange={(event) => setReviewItemTypeFilter(event.target.value as AcademicItemType | "all")}
                className="h-9 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
              >
                <option value="all">Todos</option>
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-white/65">Dificultad</div>
              <select
                value={reviewDifficultyFilter}
                onChange={(event) => setReviewDifficultyFilter(event.target.value as AcademicDifficulty | "all")}
                className="h-9 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
              >
                <option value="all">Todas</option>
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-white/65">Orden</div>
              <select
                value={reviewSort}
                onChange={(event) => setReviewSort(event.target.value as RecordSort)}
                className="h-9 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
              >
                <option value="oldest">Más antiguo primero</option>
                <option value="newest">Más reciente primero</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2 text-xs text-white/70">
            <Filter className="mr-1 inline h-3.5 w-3.5" />
            Priorización activa: temas antiguos + dificultad alta para preparar el final y reforzar puntos críticos.
          </div>

          {reviewGrouped.size === 0 ? (
            <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/65">
              No hay registros con esos filtros en modo repaso.
            </div>
          ) : (
            <div className="space-y-4">
              {[...reviewGrouped.entries()].map(([semesterId, semesterGroup]) => (
                <section key={semesterId} className="rounded-xl border border-white/20 bg-white/7 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">{semesterGroup.semesterName}</div>
                    <div className="text-[11px] text-white/65">{[...semesterGroup.blocks.values()].flat().length} items</div>
                  </div>

                  <div className="space-y-2">
                    {[...semesterGroup.blocks.entries()].map(([key, records]) => {
                      const first = records[0];
                      return (
                        <div key={key} className="rounded-lg border border-white/20 bg-white/8 p-3">
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/65">
                            {blockLabel(first.blockType, first.blockIndex)}
                          </div>
                          <div className="space-y-1.5">
                            {records.map((record) => (
                              <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/15 bg-white/8 px-2.5 py-2">
                                <div className="text-xs text-white/85">
                                  <span className="font-semibold">{record.title}</span>
                                  <span className="ml-1 text-white/65">· {record.date} · {itemTypeLabel(record.itemType)} · {difficultyLabel(record.difficulty)}</span>
                                  {typeof record.score === "number" ? (
                                    <span className="ml-1 text-white/75">· nota {record.score.toFixed(2)}</span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  {record.itemType === "flashcard" ? (
                                    <Link href="/srs" className="inline-flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-400/20 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-400/25">
                                      <Brain className="h-3.5 w-3.5" />
                                      Practicar en SRS
                                    </Link>
                                  ) : null}
                                  {record.blockType === "final" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/35 bg-amber-300/15 px-2 py-1 text-[11px] text-amber-100">
                                      <BookOpen className="h-3.5 w-3.5" />
                                      Final prioritario
                                    </span>
                                  ) : null}
                                  {record.blockType === "remedial" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/35 bg-rose-300/15 px-2 py-1 text-[11px] text-rose-100">
                                      <CircleOff className="h-3.5 w-3.5" />
                                      Fallado
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-white/20 bg-white/8 p-3 text-xs text-white/80">
              <CheckCircle2 className="mb-1 h-4 w-4 text-emerald-200" />
              Repasa por bloques: Parcial 1 → Parcial 2 → Parcial 3 → Parcial 4 → Final.
            </div>
            <div className="rounded-xl border border-white/20 bg-white/8 p-3 text-xs text-white/80">
              <ArrowRight className="mb-1 h-4 w-4 text-cyan-200" />
              Los registros flashcard muestran referencia para ir directo a practicar en SRS.
            </div>
            <div className="rounded-xl border border-white/20 bg-white/8 p-3 text-xs text-white/80">
              <CircleOff className="mb-1 h-4 w-4 text-rose-200" />
              Remedial incluye únicamente evaluaciones falladas, como pediste.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
