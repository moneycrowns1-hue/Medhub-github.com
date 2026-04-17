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
  passed: boolean;
  failedEvaluations: AcademicRecord[];
  unlocked: boolean;
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
  const hasAllPartials = partialScores.every((score) => typeof score === "number");
  const finalGrade = hasAllPartials && typeof finalScore === "number"
    ? average([...(partialScores as number[]), finalScore])
    : null;
  const needsRemedial = typeof finalGrade === "number" && finalGrade < passingGrade;
  const passed = typeof finalGrade === "number" && finalGrade >= passingGrade;
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
    passed,
    failedEvaluations,
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
