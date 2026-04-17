import { isoDate } from "@/lib/dates";
import type { SubjectSlug } from "@/lib/subjects";

export const ACADEMIC_UPDATED_EVENT = "somagnus:academic:updated";

const ACADEMIC_CONFIG_KEY = "somagnus:academic:config:v1";
const ACADEMIC_SEMESTERS_KEY = "somagnus:academic:semesters:v1";
const ACADEMIC_RECORDS_KEY = "somagnus:academic:records:v1";

export const ACADEMIC_MEDICAL_SUBJECTS = [
  "anatomia",
  "histologia",
  "embriologia",
  "biologia-celular",
] as const;

export type AcademicSubjectSlug = (typeof ACADEMIC_MEDICAL_SUBJECTS)[number];
export type AcademicItemType = "tarea" | "practica" | "evaluacion" | "apunte" | "flashcard";
export type AcademicBlockType = "partial" | "final" | "remedial";
export type AcademicDifficulty = "baja" | "media" | "alta";

export type AcademicConfig = {
  passingGrade: number;
  gradingScaleMax: number;
};

export type AcademicSemester = {
  id: string;
  subjectSlug: AcademicSubjectSlug;
  name: string;
  order: number;
  partialCount: number;
  createdAt: number;
};

export type AcademicRecord = {
  id: string;
  subjectSlug: AcademicSubjectSlug;
  semesterId: string;
  blockType: AcademicBlockType;
  blockIndex: number | null;
  itemType: AcademicItemType;
  title: string;
  notes?: string;
  date: string;
  difficulty?: AcademicDifficulty;
  score?: number;
  linkedDeckId?: string;
  linkedCardIds?: string[];
  createdAt: number;
};

export type AcademicSemesterComputed = {
  semester: AcademicSemester;
  partialScores: Array<number | null>;
  finalScore: number | null;
  finalGrade: number | null;
  needsRemedial: boolean;
  remedialScore: number | null;
  passedViaRemedial: boolean;
  effectiveGrade: number | null;
  passed: boolean;
  failedEvaluations: AcademicRecord[];
  unlocked: boolean;
  missingBlocks: Array<{ blockType: AcademicBlockType; blockIndex: number | null; label: string }>;
  projection: {
    status: "pending" | "passed" | "failed" | "remedial";
    requiredFinal: number | null;
    requiredRemedial: number | null;
  };
};

export type AcademicReviewEntry = {
  semester: AcademicSemester;
  record: AcademicRecord;
  priorityScore: number;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isAcademicSubjectSlug(value: string): value is AcademicSubjectSlug {
  return (ACADEMIC_MEDICAL_SUBJECTS as readonly string[]).includes(value);
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return parseJson<T>(window.localStorage.getItem(key), fallback);
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function dispatchAcademicUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACADEMIC_UPDATED_EVENT));
}

function normalizeConfig(input?: Partial<AcademicConfig>): AcademicConfig {
  const passingGrade = clamp(Number(input?.passingGrade ?? 7) || 7, 1, 10);
  const gradingScaleMax = clamp(Number(input?.gradingScaleMax ?? 10) || 10, 1, 10);
  return { passingGrade, gradingScaleMax };
}

function normalizeSemester(input: AcademicSemester): AcademicSemester {
  const subjectSlug = isAcademicSubjectSlug(input.subjectSlug) ? input.subjectSlug : "anatomia";
  return {
    ...input,
    subjectSlug,
    name: input.name?.trim() || "Semestre",
    order: Math.max(1, Math.floor(Number(input.order) || 1)),
    partialCount: clamp(Math.floor(Number(input.partialCount) || 4), 2, 8),
    createdAt: Number(input.createdAt) || Date.now(),
  };
}

function normalizeRecord(input: AcademicRecord): AcademicRecord {
  const subjectSlug = isAcademicSubjectSlug(input.subjectSlug) ? input.subjectSlug : "anatomia";
  const score =
    input.itemType === "evaluacion"
      ? clamp(Number(input.score ?? NaN), 0, 10)
      : undefined;
  const linkedCardIds = Array.isArray(input.linkedCardIds)
    ? input.linkedCardIds.map((id) => String(id).trim()).filter(Boolean)
    : undefined;

  return {
    ...input,
    subjectSlug,
    blockType:
      input.blockType === "final" || input.blockType === "remedial"
        ? input.blockType
        : "partial",
    blockIndex: input.blockType === "partial" ? Math.max(1, Math.floor(Number(input.blockIndex) || 1)) : null,
    itemType: input.itemType,
    title: String(input.title || "").trim() || "Registro académico",
    notes: input.notes?.trim() || undefined,
    date: String(input.date || isoDate(new Date())),
    difficulty:
      input.difficulty === "baja" || input.difficulty === "media" || input.difficulty === "alta"
        ? input.difficulty
        : undefined,
    score,
    linkedDeckId: input.linkedDeckId?.trim() || undefined,
    linkedCardIds: linkedCardIds?.length ? linkedCardIds : undefined,
    createdAt: Number(input.createdAt) || Date.now(),
  };
}

export function loadAcademicConfig(): AcademicConfig {
  return normalizeConfig(readStorage<Partial<AcademicConfig>>(ACADEMIC_CONFIG_KEY, { passingGrade: 7, gradingScaleMax: 10 }));
}

export function saveAcademicConfig(next: Partial<AcademicConfig>) {
  const merged = normalizeConfig({ ...loadAcademicConfig(), ...next });
  writeStorage(ACADEMIC_CONFIG_KEY, merged);
  dispatchAcademicUpdated();
  return merged;
}

export function loadAcademicSemesters(): AcademicSemester[] {
  const raw = readStorage<AcademicSemester[]>(ACADEMIC_SEMESTERS_KEY, []);
  return raw.map(normalizeSemester);
}

function saveAcademicSemesters(semesters: AcademicSemester[]) {
  writeStorage(ACADEMIC_SEMESTERS_KEY, semesters.map(normalizeSemester));
  dispatchAcademicUpdated();
}

export function loadAcademicRecords(): AcademicRecord[] {
  const raw = readStorage<AcademicRecord[]>(ACADEMIC_RECORDS_KEY, []);
  return raw.map(normalizeRecord);
}

function saveAcademicRecords(records: AcademicRecord[]) {
  writeStorage(ACADEMIC_RECORDS_KEY, records.map(normalizeRecord));
  dispatchAcademicUpdated();
}

export function loadAcademicSnapshot() {
  return {
    config: loadAcademicConfig(),
    semesters: loadAcademicSemesters(),
    records: loadAcademicRecords(),
  };
}

export function listSemestersBySubject(subjectSlug: AcademicSubjectSlug): AcademicSemester[] {
  return loadAcademicSemesters()
    .filter((semester) => semester.subjectSlug === subjectSlug)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function createAcademicSemester(input: {
  subjectSlug: AcademicSubjectSlug;
  name: string;
  partialCount: number;
}) {
  const semesters = loadAcademicSemesters();
  const forSubject = semesters.filter((semester) => semester.subjectSlug === input.subjectSlug);
  const nextOrder = forSubject.reduce((max, current) => Math.max(max, current.order), 0) + 1;
  const next: AcademicSemester = normalizeSemester({
    id: uid("sem"),
    subjectSlug: input.subjectSlug,
    name: input.name,
    partialCount: input.partialCount,
    order: nextOrder,
    createdAt: Date.now(),
  });
  saveAcademicSemesters([...semesters, next]);
  return next;
}

export function updateAcademicSemester(
  semesterId: string,
  patch: Partial<Pick<AcademicSemester, "name" | "partialCount" | "order">>,
) {
  const semesters = loadAcademicSemesters();
  const next = semesters.map((semester) => {
    if (semester.id !== semesterId) return semester;
    return normalizeSemester({ ...semester, ...patch });
  });
  saveAcademicSemesters(next);
}

export function deleteAcademicSemester(semesterId: string) {
  const semesters = loadAcademicSemesters().filter((semester) => semester.id !== semesterId);
  const records = loadAcademicRecords().filter((record) => record.semesterId !== semesterId);
  writeStorage(ACADEMIC_SEMESTERS_KEY, semesters);
  writeStorage(ACADEMIC_RECORDS_KEY, records);
  dispatchAcademicUpdated();
}

export function listRecordsBySemester(semesterId: string): AcademicRecord[] {
  return loadAcademicRecords()
    .filter((record) => record.semesterId === semesterId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function addAcademicRecord(
  input: Omit<AcademicRecord, "id" | "createdAt">,
): AcademicRecord {
  const records = loadAcademicRecords();
  const next = normalizeRecord({
    ...input,
    id: uid("acad"),
    createdAt: Date.now(),
  });
  saveAcademicRecords([...records, next]);
  return next;
}

export function updateAcademicRecord(
  recordId: string,
  patch: Partial<Omit<AcademicRecord, "id" | "createdAt">>,
) {
  const records = loadAcademicRecords();
  const next = records.map((record) => {
    if (record.id !== recordId) return record;
    return normalizeRecord({ ...record, ...patch });
  });
  saveAcademicRecords(next);
}

export function deleteAcademicRecord(recordId: string) {
  const records = loadAcademicRecords().filter((record) => record.id !== recordId);
  saveAcademicRecords(records);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function scoreForBlock(
  records: AcademicRecord[],
  blockType: AcademicBlockType,
  blockIndex: number | null,
): number | null {
  const values = records
    .filter((record) => record.itemType === "evaluacion")
    .filter((record) => record.blockType === blockType)
    .filter((record) => (blockType === "partial" ? record.blockIndex === blockIndex : true))
    .map((record) => record.score)
    .filter((score): score is number => typeof score === "number");
  return average(values);
}

export function computeAcademicSemester(
  semester: AcademicSemester,
  records: AcademicRecord[],
  passingGrade: number,
): Omit<AcademicSemesterComputed, "unlocked"> {
  const partialScores = Array.from({ length: semester.partialCount }, (_, idx) =>
    scoreForBlock(records, "partial", idx + 1),
  );
  const finalScore = scoreForBlock(records, "final", null);
  const remedialScore = scoreForBlock(records, "remedial", null);
  const hasAllPartials = partialScores.every((score) => typeof score === "number");
  const finalGrade =
    hasAllPartials && typeof finalScore === "number"
      ? average([...(partialScores as number[]), finalScore])
      : null;

  const missingBlocks: AcademicSemesterComputed["missingBlocks"] = [];
  partialScores.forEach((score, idx) => {
    if (typeof score !== "number") {
      missingBlocks.push({ blockType: "partial", blockIndex: idx + 1, label: `Parcial ${idx + 1}` });
    }
  });
  if (typeof finalScore !== "number") {
    missingBlocks.push({ blockType: "final", blockIndex: null, label: "Final" });
  }

  const needsRemedial = typeof finalGrade === "number" && finalGrade < passingGrade;
  const passedByFinal = typeof finalGrade === "number" && finalGrade >= passingGrade;
  const passedViaRemedial = needsRemedial && typeof remedialScore === "number" && remedialScore >= passingGrade;
  const passed = passedByFinal || passedViaRemedial;

  const effectiveGrade =
    passedViaRemedial && typeof remedialScore === "number"
      ? remedialScore
      : finalGrade;

  let projection: AcademicSemesterComputed["projection"] = {
    status: "pending",
    requiredFinal: null,
    requiredRemedial: null,
  };

  if (passed) {
    projection = { status: "passed", requiredFinal: null, requiredRemedial: null };
  } else if (typeof finalGrade === "number" && !needsRemedial) {
    projection = { status: "passed", requiredFinal: null, requiredRemedial: null };
  } else if (needsRemedial) {
    projection = {
      status: "remedial",
      requiredFinal: null,
      requiredRemedial: passingGrade,
    };
  } else if (hasAllPartials && typeof finalScore !== "number") {
    const partials = partialScores as number[];
    const required = passingGrade * (partials.length + 1) - partials.reduce((a, b) => a + b, 0);
    const clamped = Math.max(0, Math.min(10, Number(required.toFixed(2))));
    projection = {
      status: required > 10 ? "failed" : "pending",
      requiredFinal: clamped,
      requiredRemedial: null,
    };
  }

  const failedEvaluations = records
    .filter((record) => record.itemType === "evaluacion")
    .filter((record) => typeof record.score === "number" && record.score < passingGrade)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  return {
    semester,
    partialScores,
    finalScore,
    finalGrade,
    needsRemedial,
    remedialScore,
    passedViaRemedial,
    effectiveGrade,
    passed,
    failedEvaluations,
    missingBlocks,
    projection,
  };
}

export function getSubjectSemestersComputed(
  subjectSlug: AcademicSubjectSlug,
  semesters: AcademicSemester[],
  records: AcademicRecord[],
  passingGrade: number,
): AcademicSemesterComputed[] {
  const sorted = semesters
    .filter((semester) => semester.subjectSlug === subjectSlug)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  const computed: AcademicSemesterComputed[] = [];
  for (const semester of sorted) {
    const semesterRecords = records.filter((record) => record.semesterId === semester.id);
    const base = computeAcademicSemester(semester, semesterRecords, passingGrade);
    const previous = computed[computed.length - 1];
    const unlocked = !previous || previous.passed;
    computed.push({ ...base, unlocked });
  }
  return computed;
}

export function buildAcademicReviewEntries(params: {
  subjectSlug: AcademicSubjectSlug;
  semesters: AcademicSemester[];
  records: AcademicRecord[];
  semesterId?: string;
  difficulty?: AcademicDifficulty | "all";
  itemType?: AcademicItemType | "all";
  sort: "oldest" | "newest";
  prioritizeOlderAndHarder?: boolean;
}): AcademicReviewEntry[] {
  const semesterMap = new Map(params.semesters.map((semester) => [semester.id, semester]));
  const now = Date.now();

  const filtered = params.records
    .filter((record) => record.subjectSlug === params.subjectSlug)
    .filter((record) => !params.semesterId || record.semesterId === params.semesterId)
    .filter((record) => params.difficulty === "all" || !params.difficulty || record.difficulty === params.difficulty)
    .filter((record) => params.itemType === "all" || !params.itemType || record.itemType === params.itemType)
    .map((record) => {
      const semester = semesterMap.get(record.semesterId);
      if (!semester) return null;
      const ageDays = Math.max(0, Math.floor((now - new Date(record.date).getTime()) / 86_400_000));
      const ageScore = Math.min(4, Math.floor(ageDays / 14));
      const difficultyScore = record.difficulty === "alta" ? 3 : record.difficulty === "media" ? 2 : 1;
      const priorityScore = ageScore + difficultyScore;
      return { semester, record, priorityScore } satisfies AcademicReviewEntry;
    })
    .filter((entry): entry is AcademicReviewEntry => Boolean(entry));

  const byDate = (a: AcademicReviewEntry, b: AcademicReviewEntry) =>
    a.record.date.localeCompare(b.record.date) || a.record.createdAt - b.record.createdAt;

  filtered.sort((a, b) => {
    if (params.prioritizeOlderAndHarder && b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    const dateOrder = byDate(a, b);
    return params.sort === "oldest" ? dateOrder : -dateOrder;
  });

  return filtered;
}

export function getRemedialFailedEvaluations(
  semesterId: string,
  records: AcademicRecord[],
  passingGrade: number,
): AcademicRecord[] {
  return records
    .filter((record) => record.semesterId === semesterId)
    .filter((record) => record.itemType === "evaluacion")
    .filter((record) => typeof record.score === "number" && record.score < passingGrade)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export function isMedicalSubjectSlug(subjectSlug: SubjectSlug): subjectSlug is AcademicSubjectSlug {
  return isAcademicSubjectSlug(subjectSlug);
}

export type AcademicSubjectGpa = {
  subjectSlug: AcademicSubjectSlug;
  average: number | null;
  semestersCompleted: number;
  semestersPassed: number;
};

export type AcademicGlobalGpa = {
  subjects: AcademicSubjectGpa[];
  overallAverage: number | null;
  totalSemesters: number;
  passedSemesters: number;
  failedSemesters: number;
};

function computedForSubject(
  subjectSlug: AcademicSubjectSlug,
  semesters: AcademicSemester[],
  records: AcademicRecord[],
  passingGrade: number,
): AcademicSemesterComputed[] {
  return getSubjectSemestersComputed(subjectSlug, semesters, records, passingGrade);
}

export function computeSubjectGpa(
  subjectSlug: AcademicSubjectSlug,
  semesters: AcademicSemester[],
  records: AcademicRecord[],
  passingGrade: number,
): AcademicSubjectGpa {
  const items = computedForSubject(subjectSlug, semesters, records, passingGrade);
  const withGrade = items.filter((item) => typeof item.effectiveGrade === "number");
  const avg = withGrade.length ? average(withGrade.map((item) => item.effectiveGrade as number)) : null;
  return {
    subjectSlug,
    average: avg,
    semestersCompleted: withGrade.length,
    semestersPassed: items.filter((item) => item.passed).length,
  };
}

export function computeGlobalGpa(
  semesters: AcademicSemester[],
  records: AcademicRecord[],
  passingGrade: number,
): AcademicGlobalGpa {
  const subjects = ACADEMIC_MEDICAL_SUBJECTS.map((slug) => computeSubjectGpa(slug, semesters, records, passingGrade));
  const withAverage = subjects.filter((item) => typeof item.average === "number");
  const overall = withAverage.length
    ? average(withAverage.map((item) => item.average as number))
    : null;
  let total = 0;
  let passed = 0;
  let failed = 0;
  for (const slug of ACADEMIC_MEDICAL_SUBJECTS) {
    const items = computedForSubject(slug, semesters, records, passingGrade);
    for (const item of items) {
      if (typeof item.effectiveGrade !== "number") continue;
      total += 1;
      if (item.passed) passed += 1;
      else failed += 1;
    }
  }
  return {
    subjects,
    overallAverage: overall,
    totalSemesters: total,
    passedSemesters: passed,
    failedSemesters: failed,
  };
}

const ACADEMIC_UI_KEY = "somagnus:academic:ui:v1";

export type AcademicUiContext = {
  lastSubject: AcademicSubjectSlug;
  lastSemesterIdBySubject: Partial<Record<AcademicSubjectSlug, string>>;
  lastViewMode: "gestion" | "repaso";
};

function defaultUiContext(): AcademicUiContext {
  return {
    lastSubject: "anatomia",
    lastSemesterIdBySubject: {},
    lastViewMode: "gestion",
  };
}

export function loadAcademicUiContext(): AcademicUiContext {
  const raw = readStorage<Partial<AcademicUiContext>>(ACADEMIC_UI_KEY, defaultUiContext());
  const lastSubject = raw?.lastSubject && isAcademicSubjectSlug(raw.lastSubject) ? raw.lastSubject : "anatomia";
  const lastViewMode = raw?.lastViewMode === "repaso" ? "repaso" : "gestion";
  const lastSemesterIdBySubject: AcademicUiContext["lastSemesterIdBySubject"] = {};
  if (raw?.lastSemesterIdBySubject && typeof raw.lastSemesterIdBySubject === "object") {
    for (const slug of ACADEMIC_MEDICAL_SUBJECTS) {
      const value = (raw.lastSemesterIdBySubject as Record<string, unknown>)[slug];
      if (typeof value === "string" && value.length > 0) {
        lastSemesterIdBySubject[slug] = value;
      }
    }
  }
  return { lastSubject, lastSemesterIdBySubject, lastViewMode };
}

export function saveAcademicUiContext(patch: Partial<AcademicUiContext>) {
  const current = loadAcademicUiContext();
  const merged: AcademicUiContext = {
    lastSubject: patch.lastSubject && isAcademicSubjectSlug(patch.lastSubject) ? patch.lastSubject : current.lastSubject,
    lastViewMode: patch.lastViewMode === "repaso" || patch.lastViewMode === "gestion" ? patch.lastViewMode : current.lastViewMode,
    lastSemesterIdBySubject: {
      ...current.lastSemesterIdBySubject,
      ...(patch.lastSemesterIdBySubject ?? {}),
    },
  };
  writeStorage(ACADEMIC_UI_KEY, merged);
  return merged;
}

export function countSemesterRecords(semesterId: string): number {
  return loadAcademicRecords().filter((record) => record.semesterId === semesterId).length;
}

export type UpcomingEvaluation = {
  record: AcademicRecord;
  semester: AcademicSemester;
  daysUntil: number;
};

export function listUpcomingEvaluations(params?: {
  subjectSlug?: AcademicSubjectSlug;
  horizonDays?: number;
}): UpcomingEvaluation[] {
  const semesters = loadAcademicSemesters();
  const records = loadAcademicRecords();
  const semesterMap = new Map(semesters.map((semester) => [semester.id, semester]));
  const now = Date.now();
  const horizon = typeof params?.horizonDays === "number" ? params.horizonDays : 60;
  const horizonMs = horizon * 86_400_000;

  return records
    .filter((record) => record.itemType === "evaluacion")
    .filter((record) => (params?.subjectSlug ? record.subjectSlug === params.subjectSlug : true))
    .map((record) => {
      const semester = semesterMap.get(record.semesterId);
      if (!semester) return null;
      const dateMs = new Date(record.date).getTime();
      if (!Number.isFinite(dateMs)) return null;
      const diff = dateMs - now;
      if (diff < -86_400_000) return null;
      if (diff > horizonMs) return null;
      const daysUntil = Math.ceil(diff / 86_400_000);
      return { record, semester, daysUntil } satisfies UpcomingEvaluation;
    })
    .filter((entry): entry is UpcomingEvaluation => Boolean(entry))
    .sort((a, b) => a.record.date.localeCompare(b.record.date));
}
