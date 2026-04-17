"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleOff,
  Filter,
  GraduationCap,
  Info,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACADEMIC_MEDICAL_SUBJECTS,
  ACADEMIC_UPDATED_EVENT,
  addAcademicRecord,
  buildAcademicReviewEntries,
  computeGlobalGpa,
  countSemesterRecords,
  createAcademicSemester,
  deleteAcademicRecord,
  deleteAcademicSemester,
  getRemedialFailedEvaluations,
  getSubjectSemestersComputed,
  listUpcomingEvaluations,
  loadAcademicSnapshot,
  loadAcademicUiContext,
  saveAcademicConfig,
  saveAcademicUiContext,
  updateAcademicRecord,
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
import { PensumMatrix } from "./_components/pensum-matrix";
import { AgendaPanel } from "./_components/agenda-panel";
import { SrsLibraryPanel } from "./_components/srs-library-panel";
import { StudyPlanPanel } from "./_components/studyplan-panel";
import { AiGeneratorStub } from "./_components/ai-generator-stub";
import { QuickQuiz } from "./_components/quick-quiz";
import { GamificationPanel } from "./_components/gamification-panel";
import {
  reportGamificationEvent,
  reportWeeklyGoalProgress,
} from "@/lib/academic-gamification-store";
import { downloadAcademicExport, importAcademicData } from "@/lib/academic-io";
import { toast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";

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

function draftFromRecord(record: AcademicRecord): RecordDraft {
  return {
    title: record.title,
    itemType: record.itemType,
    date: record.date,
    difficulty: record.difficulty ?? "media",
    score: typeof record.score === "number" ? String(record.score) : "",
    notes: record.notes ?? "",
    linkedDeckId: record.linkedDeckId ?? "",
    linkedCardIdsText: record.linkedCardIds?.join(", ") ?? "",
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

function difficultyBadgeClass(value?: AcademicDifficulty): string {
  if (value === "alta") return "border-rose-300/40 bg-rose-400/15 text-rose-100";
  if (value === "media") return "border-amber-300/40 bg-amber-400/15 text-amber-100";
  if (value === "baja") return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
  return "border-white/20 bg-white/8 text-white/65";
}

function BlockRecordsList({
  records,
  passingGrade,
  onDelete,
  onEdit,
  editingRecordId,
}: {
  records: AcademicRecord[];
  passingGrade: number;
  onDelete: (recordId: string) => void;
  onEdit: (record: AcademicRecord) => void;
  editingRecordId: string | null;
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
        const isEditing = editingRecordId === record.id;
        return (
          <div
            key={record.id}
            className={`rounded-xl border p-3 ${isEditing ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/20 bg-white/8"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-white">{record.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/65">
                  <span>{record.date} · {itemTypeLabel(record.itemType)}</span>
                  <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${difficultyBadgeClass(record.difficulty)}`}>
                    {difficultyLabel(record.difficulty)}
                  </span>
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
                  onClick={() => onEdit(record)}
                  title="Editar registro"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
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
  editing,
  onCancelEdit,
}: {
  draft: RecordDraft;
  onChange: (patch: Partial<RecordDraft>) => void;
  onAdd: () => void;
  addLabel: string;
  scoreError?: string;
  deckOptions: Array<{ id: string; name: string }>;
  editing?: boolean;
  onCancelEdit?: () => void;
}) {
  return (
    <div className={`space-y-2 rounded-xl border p-3 ${editing ? "border-cyan-300/50 bg-cyan-400/10" : "border-white/20 bg-white/6"}`}>
      {editing ? (
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-cyan-100">
          <span>Editando registro</span>
          {onCancelEdit ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-black/25 px-2 py-0.5 text-white/85 hover:bg-white/15"
              onClick={onCancelEdit}
            >
              <X className="h-3 w-3" />
              Cancelar
            </button>
          ) : null}
        </div>
      ) : null}
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
  const initialUi = useMemo(() => {
    if (typeof window === "undefined") {
      return { lastSubject: "anatomia" as AcademicSubjectSlug, lastSemesterIdBySubject: {}, lastViewMode: "gestion" as ViewMode };
    }
    return loadAcademicUiContext();
  }, []);

  const [subject, setSubject] = useState<AcademicSubjectSlug>(initialUi.lastSubject);
  const [viewMode, setViewMode] = useState<ViewMode>(initialUi.lastViewMode);
  const [refreshTick, setRefreshTick] = useState(0);
  const [srsTick, setSrsTick] = useState(0);

  const [newSemesterName, setNewSemesterName] = useState("");
  const [newPartialCount, setNewPartialCount] = useState(4);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string | null>(
    initialUi.lastSemesterIdBySubject?.[initialUi.lastSubject] ?? null,
  );
  const [passingGradeDraft, setPassingGradeDraft] = useState<string | null>(null);

  const [recordDrafts, setRecordDrafts] = useState<Record<string, RecordDraft>>({});
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({});

  const [editingRecord, setEditingRecord] = useState<AcademicRecord | null>(null);
  const [editingDraft, setEditingDraft] = useState<RecordDraft | null>(null);
  const [editingError, setEditingError] = useState<string | null>(null);

  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<AcademicRecord | null>(null);
  const [pendingDeleteSemesterId, setPendingDeleteSemesterId] = useState<string | null>(null);

  const [quickQuizOpen, setQuickQuizOpen] = useState(false);

  const [reviewSemesterFilter, setReviewSemesterFilter] = useState<string>("all");
  const [reviewItemTypeFilter, setReviewItemTypeFilter] = useState<AcademicItemType | "all">("all");
  const [reviewDifficultyFilter, setReviewDifficultyFilter] = useState<AcademicDifficulty | "all">("all");
  const [reviewSort, setReviewSort] = useState<RecordSort>("oldest");
  const [reviewFailedOnly, setReviewFailedOnly] = useState(false);

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

  useEffect(() => {
    saveAcademicUiContext({ lastSubject: subject, lastViewMode: viewMode });
  }, [subject, viewMode]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "g" || event.key === "G") {
        setViewMode("gestion");
      } else if (event.key === "r" || event.key === "R") {
        setViewMode("repaso");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const passedSemesterIdsRef = useRef<Set<string>>(new Set());
  const gamificationMountedRef = useRef(false);
  useEffect(() => {
    const allComputed = ACADEMIC_MEDICAL_SUBJECTS.flatMap((slug) =>
      getSubjectSemestersComputed(slug, snapshot.semesters, snapshot.records, snapshot.config.passingGrade),
    );
    const seen = passedSemesterIdsRef.current;
    if (!gamificationMountedRef.current) {
      for (const entry of allComputed) {
        if (entry.passed) seen.add(entry.semester.id);
      }
      gamificationMountedRef.current = true;
      return;
    }
    for (const entry of allComputed) {
      if (entry.passed && !seen.has(entry.semester.id)) {
        seen.add(entry.semester.id);
        reportGamificationEvent({ type: "semester_passed", viaRemedial: entry.passedViaRemedial });
      }
    }
  }, [snapshot.semesters, snapshot.records, snapshot.config.passingGrade]);

  useEffect(() => {
    if (!selectedSemesterId) return;
    saveAcademicUiContext({ lastSemesterIdBySubject: { [subject]: selectedSemesterId } });
  }, [subject, selectedSemesterId]);

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

    return base
      .filter((entry) => {
        if (entry.record.blockType !== "remedial") return true;
        return entry.record.itemType === "evaluacion" && typeof entry.record.score === "number" && entry.record.score < snapshot.config.passingGrade;
      })
      .filter((entry) => {
        if (!reviewFailedOnly) return true;
        return (
          entry.record.itemType === "evaluacion" &&
          typeof entry.record.score === "number" &&
          entry.record.score < snapshot.config.passingGrade
        );
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
    reviewFailedOnly,
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

  const globalGpa = useMemo(
    () => computeGlobalGpa(snapshot.semesters, snapshot.records, snapshot.config.passingGrade),
    [snapshot.semesters, snapshot.records, snapshot.config.passingGrade],
  );

  const upcomingEvaluations = useMemo(() => {
    void refreshTick;
    return listUpcomingEvaluations({ horizonDays: 60 });
  }, [refreshTick]);

  const startEditRecord = (record: AcademicRecord) => {
    setEditingRecord(record);
    setEditingDraft(draftFromRecord(record));
    setEditingError(null);
  };

  const cancelEditRecord = () => {
    setEditingRecord(null);
    setEditingDraft(null);
    setEditingError(null);
  };

  const handleSaveEditRecord = () => {
    if (!editingRecord || !editingDraft) return;
    const title = editingDraft.title.trim();
    if (!title) {
      setEditingError("Escribe un título para el registro.");
      return;
    }
    let score: number | undefined;
    if (editingDraft.itemType === "evaluacion") {
      const parsed = Number(editingDraft.score);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
        setEditingError("La nota debe estar entre 0 y 10 para evaluación.");
        return;
      }
      score = parsed;
    }
    updateAcademicRecord(editingRecord.id, {
      title,
      itemType: editingDraft.itemType,
      date: editingDraft.date || isoDate(new Date()),
      difficulty: editingDraft.difficulty,
      notes: editingDraft.notes.trim() || undefined,
      score,
      linkedDeckId: editingDraft.itemType === "flashcard" ? (editingDraft.linkedDeckId || undefined) : undefined,
      linkedCardIds:
        editingDraft.itemType === "flashcard"
          ? editingDraft.linkedCardIdsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
          : undefined,
    });
    cancelEditRecord();
  };

  const confirmDeleteRecord = () => {
    if (!pendingDeleteRecord) return;
    deleteAcademicRecord(pendingDeleteRecord.id);
    if (editingRecord?.id === pendingDeleteRecord.id) cancelEditRecord();
    setPendingDeleteRecord(null);
  };

  const confirmDeleteSemester = () => {
    if (!pendingDeleteSemesterId) return;
    deleteAcademicSemester(pendingDeleteSemesterId);
    if (selectedSemesterId === pendingDeleteSemesterId) setSelectedSemesterId(null);
    setPendingDeleteSemesterId(null);
  };

  const pendingDeleteSemesterRecordCount = useMemo(() => {
    if (!pendingDeleteSemesterId) return 0;
    return countSemesterRecords(pendingDeleteSemesterId);
  }, [pendingDeleteSemesterId]);

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

    reportGamificationEvent({ type: "record_added", itemType: draft.itemType });
    reportWeeklyGoalProgress("record_count");
    if (draft.itemType === "flashcard") {
      reportWeeklyGoalProgress("flashcards_reviewed");
    }
    if (draft.itemType === "evaluacion" && typeof score === "number") {
      if (score >= snapshot.config.passingGrade) {
        reportGamificationEvent({ type: "evaluation_passed", score, passingGrade: snapshot.config.passingGrade });
      }
    }

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
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
              onClick={() => downloadAcademicExport()}
              title="Exportar datos académicos"
            >
              Exportar
            </button>
            <label className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15">
              Importar
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    const result = importAcademicData(parsed);
                    if (!result.ok) {
                      toast.error(result.error, "Error al importar");
                    } else {
                      toast.success("Datos importados correctamente.", "Importación");
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "JSON inválido", "Error al importar");
                  }
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/20 bg-white/6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-200" />
            <div>
              <div className="text-xs uppercase tracking-wider text-white/65">Índice académico</div>
              <div className="text-sm font-semibold text-white">
                Global: {globalGpa.overallAverage !== null ? globalGpa.overallAverage.toFixed(2) : "—"} · Aprobados {globalGpa.passedSemesters}/{globalGpa.totalSemesters}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {globalGpa.subjects.map((item) => (
            <div key={item.subjectSlug} className="rounded-xl border border-white/15 bg-white/8 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-white/60">{SUBJECTS[item.subjectSlug].name}</div>
              <div className="mt-1 text-sm font-semibold text-white">
                {item.average !== null ? item.average.toFixed(2) : "—"}
              </div>
              <div className="text-[11px] text-white/65">
                {item.semestersCompleted} cerrados · {item.semestersPassed} aprobados
              </div>
            </div>
          ))}
        </div>
      </div>

      <GamificationPanel refreshKey={refreshTick} />

      <div className="grid gap-3 lg:grid-cols-2">
        <PensumMatrix
          semesters={snapshot.semesters}
          records={snapshot.records}
          passingGrade={snapshot.config.passingGrade}
          onSelect={(subjectSlug, semesterId) => {
            setSubject(subjectSlug as AcademicSubjectSlug);
            setSelectedSemesterId(semesterId);
            setViewMode("gestion");
          }}
        />
        <AgendaPanel events={upcomingEvaluations} />
      </div>

      <SrsLibraryPanel subjectSlug={subject} decks={srsLib.decks} cards={srsLib.cards} />

      <div className="grid gap-3 rounded-2xl border border-white/20 bg-white/6 p-4 md:grid-cols-3">
        <label className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-white/65">Materia (cátedra fija)</div>
          <select
            value={subject}
            onChange={(event) => {
              const nextSubject = event.target.value as AcademicSubjectSlug;
              setSubject(nextSubject);
              const ui = loadAcademicUiContext();
              setSelectedSemesterId(ui.lastSemesterIdBySubject[nextSubject] ?? null);
              setReviewSemesterFilter("all");
              cancelEditRecord();
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
                      ) : entry.passedViaRemedial ? (
                        <span className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-100">Remedial ✓</span>
                      ) : entry.passed ? (
                        <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2 py-0.5 text-[10px] text-emerald-100">Aprobado</span>
                      ) : entry.needsRemedial ? (
                        <span className="inline-flex rounded-full border border-rose-300/30 bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-100">Remedial</span>
                      ) : entry.finalGrade !== null ? (
                        <span className="inline-flex rounded-full border border-rose-300/30 bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-100">Reprobado</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] text-white/75">En curso</span>
                      )}
                      <div className="mt-1 text-[11px] text-white/70">
                        Nota: {entry.effectiveGrade !== null ? entry.effectiveGrade.toFixed(2) : "—"}
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
                    <div className="flex flex-wrap items-center gap-2">
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
                        className="border-cyan-300/40 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25"
                        onClick={() => setQuickQuizOpen(true)}
                        disabled={!activeComputed.unlocked}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Quiz rápido
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                        onClick={() => {
                          if (!activeComputed) return;
                          setPendingDeleteSemesterId(activeComputed.semester.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Final (parciales+final): <span className="font-semibold">{activeComputed.finalGrade !== null ? activeComputed.finalGrade.toFixed(2) : "—"}</span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Nota efectiva: <span className="font-semibold">{activeComputed.effectiveGrade !== null ? activeComputed.effectiveGrade.toFixed(2) : "—"}</span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Remedial: <span className="font-semibold">{activeComputed.needsRemedial ? (activeComputed.passedViaRemedial ? `Aprobado (${activeComputed.remedialScore?.toFixed(2) ?? "—"})` : "Activo") : "No requerido"}</span>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/8 px-2.5 py-2 text-xs text-white/80">
                      Estado: <span className="font-semibold">{
                        activeComputed.passedViaRemedial
                          ? "Aprobado vía remedial"
                          : activeComputed.passed
                            ? "Aprobado"
                            : activeComputed.needsRemedial
                              ? "Pendiente remedial"
                              : activeComputed.finalGrade === null
                                ? "En curso"
                                : "Reprobado"
                      }</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-white/15 bg-white/6 px-3 py-2 text-xs text-white/80">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/60">
                      <Info className="h-3.5 w-3.5" />
                      Resumen inteligente
                    </div>
                    <ul className="mt-1 space-y-1">
                      {activeComputed.partialScores.map((score, idx) => (
                        <li key={`partial-${idx}`} className="flex items-center justify-between">
                          <span>Parcial {idx + 1}</span>
                          <span className={score === null ? "text-white/50" : score < snapshot.config.passingGrade ? "text-rose-200" : "text-emerald-200"}>
                            {score !== null ? score.toFixed(2) : "Pendiente"}
                          </span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between">
                        <span>Final</span>
                        <span className={activeComputed.finalScore === null ? "text-white/50" : activeComputed.finalScore < snapshot.config.passingGrade ? "text-rose-200" : "text-emerald-200"}>
                          {activeComputed.finalScore !== null ? activeComputed.finalScore.toFixed(2) : "Pendiente"}
                        </span>
                      </li>
                      {activeComputed.needsRemedial ? (
                        <li className="flex items-center justify-between">
                          <span>Remedial</span>
                          <span className={activeComputed.remedialScore === null ? "text-white/50" : activeComputed.passedViaRemedial ? "text-emerald-200" : "text-rose-200"}>
                            {activeComputed.remedialScore !== null ? activeComputed.remedialScore.toFixed(2) : "Pendiente"}
                          </span>
                        </li>
                      ) : null}
                    </ul>

                    {activeComputed.projection.status === "pending" && typeof activeComputed.projection.requiredFinal === "number" ? (
                      <div className="mt-2 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-1.5 text-[11px] text-cyan-100">
                        Necesitas ≥ {activeComputed.projection.requiredFinal.toFixed(2)} en el Final para aprobar.
                      </div>
                    ) : null}
                    {activeComputed.projection.status === "failed" ? (
                      <div className="mt-2 rounded-md border border-rose-300/30 bg-rose-400/10 px-2 py-1.5 text-[11px] text-rose-100">
                        Con las notas actuales no alcanzas a aprobar aunque saques 10 en el Final. Prepárate para remedial.
                      </div>
                    ) : null}
                    {activeComputed.projection.status === "remedial" && typeof activeComputed.projection.requiredRemedial === "number" ? (
                      <div className="mt-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-2 py-1.5 text-[11px] text-amber-100">
                        Necesitas ≥ {activeComputed.projection.requiredRemedial.toFixed(2)} en el Remedial para aprobar el semestre.
                      </div>
                    ) : null}
                    {activeComputed.missingBlocks.length ? (
                      <div className="mt-2 text-[11px] text-white/55">
                        Faltan por registrar evaluación en: {activeComputed.missingBlocks.map((block) => block.label).join(", ")}.
                      </div>
                    ) : null}
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
                      const remedialFailedOnly =
                        blockType === "remedial"
                          ? getRemedialFailedEvaluations(
                              activeComputed.semester.id,
                              activeSemesterRecords,
                              snapshot.config.passingGrade,
                            )
                          : [];

                      const recordsForBlock = activeSemesterRecords.filter((record) => {
                        if (record.blockType !== blockType) return false;
                        if (blockType === "partial") return record.blockIndex === blockIndex;
                        return true;
                      });
                      const draft = getDraftForBlock(activeComputed.semester.id, blockType, blockIndex);
                      const isEditingInThisBlock =
                        editingRecord !== null &&
                        editingRecord.semesterId === activeComputed.semester.id &&
                        editingRecord.blockType === blockType &&
                        (blockType !== "partial" || editingRecord.blockIndex === blockIndex);

                      return (
                        <section key={key} className="rounded-xl border border-white/20 bg-white/7 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-semibold text-white">{blockLabel(blockType, blockIndex)}</div>
                            <div className="text-[11px] text-white/65">{recordsForBlock.length} registros</div>
                          </div>

                          {blockType === "remedial" ? (
                            <div className="mb-2 space-y-1 rounded-lg border border-rose-300/30 bg-rose-400/15 px-2.5 py-2 text-xs text-rose-100">
                              <div className="font-semibold">A recuperar ({remedialFailedOnly.length})</div>
                              {remedialFailedOnly.length ? (
                                <ul className="space-y-0.5">
                                  {remedialFailedOnly.map((record) => (
                                    <li key={record.id} className="text-[11px]">
                                      · {record.title} — {record.date}{typeof record.score === "number" ? ` (${record.score.toFixed(2)})` : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-[11px] text-rose-100/80">No hay evaluaciones falladas para recuperar.</div>
                              )}
                            </div>
                          ) : null}

                          <BlockRecordsList
                            records={recordsForBlock}
                            passingGrade={snapshot.config.passingGrade}
                            onDelete={(recordId) => {
                              const target = recordsForBlock.find((r) => r.id === recordId) ?? null;
                              setPendingDeleteRecord(target);
                            }}
                            onEdit={startEditRecord}
                            editingRecordId={editingRecord?.id ?? null}
                          />

                          {activeComputed.unlocked ? (
                            <div className="mt-2">
                              {isEditingInThisBlock && editingDraft ? (
                                <RecordForm
                                  draft={editingDraft}
                                  onChange={(patch) => setEditingDraft((prev) => (prev ? { ...prev, ...patch } : prev))}
                                  onAdd={handleSaveEditRecord}
                                  addLabel="Guardar cambios"
                                  scoreError={editingError ?? undefined}
                                  deckOptions={deckOptions}
                                  editing
                                  onCancelEdit={cancelEditRecord}
                                />
                              ) : (
                                <RecordForm
                                  draft={draft}
                                  onChange={(patch) => updateDraftForBlock(activeComputed.semester.id, blockType, blockIndex, patch)}
                                  onAdd={() => handleAddRecord(activeComputed, blockType, blockIndex)}
                                  addLabel={`Agregar a ${blockLabel(blockType, blockIndex)}`}
                                  scoreError={recordErrors[key]}
                                  deckOptions={deckOptions}
                                />
                              )}

                              <div className="mt-2">
                                <AiGeneratorStub
                                  request={() => ({
                                    subjectSlug: subject,
                                    semesterId: activeComputed.semester.id,
                                    blockRef: { blockType, blockIndex },
                                    source: { type: "text", title: `${blockLabel(blockType, blockIndex)} — ${SUBJECTS[subject].name}` },
                                    outputs: ["flashcards", "notes", "quiz"],
                                    maxItems: 10,
                                  })}
                                />
                              </div>
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
                    Para desbloquear el siguiente semestre necesitas nota final ≥ {snapshot.config.passingGrade.toFixed(1)} (o aprobar remedial).
                  </div>
                </div>

                <StudyPlanPanel semester={activeComputed.semester} refreshKey={refreshTick} />
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

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/8 px-3 py-2 text-xs text-white/70">
            <div>
              <Filter className="mr-1 inline h-3.5 w-3.5" />
              Priorización activa: temas antiguos + dificultad alta.
            </div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={reviewFailedOnly}
                onChange={(event) => setReviewFailedOnly(event.target.checked)}
                className="h-3.5 w-3.5 accent-rose-400"
              />
              Solo falladas
            </label>
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
              Remedial muestra lo fallado + la nota del examen remedial para cerrar el semestre.
            </div>
          </div>
        </div>
      )}

      <Modal
        open={!!pendingDeleteRecord}
        onOpenChange={(next) => {
          if (!next) setPendingDeleteRecord(null);
        }}
      >
        <ModalContent size="sm" aria-label="Eliminar registro">
          <ModalHeader>
            <ModalTitle>
              <span className="inline-flex items-center gap-2">
                <Target className="h-4 w-4 text-rose-300" />
                Eliminar registro
              </span>
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-xs text-white/70">
              Vas a eliminar <span className="font-semibold text-white">{pendingDeleteRecord?.title ?? ""}</span>. Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => setPendingDeleteRecord(null)}>
              Cancelar
            </Button>
            <Button type="button" className="border border-rose-400/50 bg-rose-500/80 text-white hover:bg-rose-500" onClick={confirmDeleteRecord}>
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        open={!!pendingDeleteSemesterId}
        onOpenChange={(next) => {
          if (!next) setPendingDeleteSemesterId(null);
        }}
      >
        <ModalContent size="sm" aria-label="Eliminar semestre">
          <ModalHeader>
            <ModalTitle>
              <span className="inline-flex items-center gap-2">
                <Target className="h-4 w-4 text-rose-300" />
                Eliminar semestre
              </span>
            </ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-xs text-white/70">
              Se eliminarán <span className="font-semibold text-white">{pendingDeleteSemesterRecordCount}</span> registros asociados. Esta acción no se puede deshacer.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => setPendingDeleteSemesterId(null)}>
              Cancelar
            </Button>
            <Button type="button" className="border border-rose-400/50 bg-rose-500/80 text-white hover:bg-rose-500" onClick={confirmDeleteSemester}>
              <Trash2 className="h-4 w-4" />
              Eliminar semestre
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {quickQuizOpen && activeComputed ? (
        <QuickQuiz
          subjectSlug={subject}
          semester={activeComputed}
          availableBlocks={[
            ...Array.from({ length: activeComputed.semester.partialCount }, (_, idx) => ({
              blockType: "partial" as const,
              blockIndex: idx + 1,
              label: `Parcial ${idx + 1}`,
            })),
            { blockType: "final" as const, blockIndex: null, label: "Final" },
            ...(activeComputed.needsRemedial
              ? [{ blockType: "remedial" as const, blockIndex: null, label: "Remedial" }]
              : []),
          ]}
          onClose={() => setQuickQuizOpen(false)}
        />
      ) : null}
    </div>
  );
}
