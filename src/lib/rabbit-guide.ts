import type { SubjectSlug } from "@/lib/subjects";

const RABBIT_GUIDE_STATE_KEY = "somagnus:rabbit_guide:phase1:v1";
export const RABBIT_GUIDE_UPDATED_EVENT = "somagnus:rabbit_guide:updated";
export const RABBIT_GUIDE_PROMPT_EVENT = "somagnus:rabbit_guide:prompt";

export type RabbitGuideStep = "idle" | "study_started" | "pomodoro_started" | "plan_checked";

export type RabbitGuideState = {
  step: RabbitGuideStep;
  activeSubjectSlug: SubjectSlug | null;
  lastStudySubjectSlug: SubjectSlug | null;
  lastStudyVisitedAtMs: number | null;
  lastPomodoroStartedAtMs: number | null;
  lastPdfResourceId: string | null;
  lastPdfTitle: string | null;
  lastPdfPage: number | null;
  lastPdfSubjectSlug: SubjectSlug | null;
  lastSrsDeckId: string | null;
  lastSrsDeckName: string | null;
  lastSrsSubjectSlug: SubjectSlug | null;
  updatedAtMs: number;
};

export const DEFAULT_RABBIT_GUIDE_STATE: RabbitGuideState = {
  step: "idle",
  activeSubjectSlug: null,
  lastStudySubjectSlug: null,
  lastStudyVisitedAtMs: null,
  lastPomodoroStartedAtMs: null,
  lastPdfResourceId: null,
  lastPdfTitle: null,
  lastPdfPage: null,
  lastPdfSubjectSlug: null,
  lastSrsDeckId: null,
  lastSrsDeckName: null,
  lastSrsSubjectSlug: null,
  updatedAtMs: 0,
};

function isSubjectSlug(value: unknown): value is SubjectSlug {
  return value === "anatomia" || value === "histologia" || value === "embriologia" || value === "biologia-celular";
}

function sanitizeGuideState(value: unknown): RabbitGuideState {
  if (!value || typeof value !== "object") return DEFAULT_RABBIT_GUIDE_STATE;
  const source = value as Partial<RabbitGuideState>;
  const step: RabbitGuideStep =
    source.step === "study_started" || source.step === "pomodoro_started" || source.step === "plan_checked"
      ? source.step
      : "idle";

  return {
    step,
    activeSubjectSlug: isSubjectSlug(source.activeSubjectSlug) ? source.activeSubjectSlug : null,
    lastStudySubjectSlug: isSubjectSlug(source.lastStudySubjectSlug) ? source.lastStudySubjectSlug : null,
    lastStudyVisitedAtMs: typeof source.lastStudyVisitedAtMs === "number" ? source.lastStudyVisitedAtMs : null,
    lastPomodoroStartedAtMs: typeof source.lastPomodoroStartedAtMs === "number" ? source.lastPomodoroStartedAtMs : null,
    lastPdfResourceId: typeof source.lastPdfResourceId === "string" ? source.lastPdfResourceId : null,
    lastPdfTitle: typeof source.lastPdfTitle === "string" ? source.lastPdfTitle : null,
    lastPdfPage: typeof source.lastPdfPage === "number" ? Math.max(1, Math.floor(source.lastPdfPage)) : null,
    lastPdfSubjectSlug: isSubjectSlug(source.lastPdfSubjectSlug) ? source.lastPdfSubjectSlug : null,
    lastSrsDeckId: typeof source.lastSrsDeckId === "string" ? source.lastSrsDeckId : null,
    lastSrsDeckName: typeof source.lastSrsDeckName === "string" ? source.lastSrsDeckName : null,
    lastSrsSubjectSlug: isSubjectSlug(source.lastSrsSubjectSlug) ? source.lastSrsSubjectSlug : null,
    updatedAtMs: typeof source.updatedAtMs === "number" ? source.updatedAtMs : Date.now(),
  };
}

export function loadRabbitGuideState(): RabbitGuideState {
  if (typeof window === "undefined") return DEFAULT_RABBIT_GUIDE_STATE;
  try {
    const raw = window.localStorage.getItem(RABBIT_GUIDE_STATE_KEY);
    if (!raw) return DEFAULT_RABBIT_GUIDE_STATE;
    return sanitizeGuideState(JSON.parse(raw));
  } catch {
    return DEFAULT_RABBIT_GUIDE_STATE;
  }
}

export function saveRabbitGuideState(next: RabbitGuideState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    RABBIT_GUIDE_STATE_KEY,
    JSON.stringify({
      ...sanitizeGuideState(next),
      updatedAtMs: Date.now(),
    }),
  );
  window.dispatchEvent(new Event(RABBIT_GUIDE_UPDATED_EVENT));
}

export function patchRabbitGuideState(patch: Partial<RabbitGuideState>) {
  const current = loadRabbitGuideState();
  saveRabbitGuideState({ ...current, ...patch, updatedAtMs: Date.now() });
}

export function startStudyGuidance(subjectSlug: SubjectSlug) {
  patchRabbitGuideState({
    step: "study_started",
    activeSubjectSlug: subjectSlug,
    lastStudySubjectSlug: subjectSlug,
    lastStudyVisitedAtMs: Date.now(),
  });
}

export function markPomodoroStarted() {
  patchRabbitGuideState({
    step: "pomodoro_started",
    lastPomodoroStartedAtMs: Date.now(),
  });
}

export function markPlanChecked() {
  patchRabbitGuideState({
    step: "plan_checked",
  });
}

export function markStudyVisited(subjectSlug: SubjectSlug) {
  const current = loadRabbitGuideState();
  patchRabbitGuideState({
    activeSubjectSlug: current.activeSubjectSlug ?? subjectSlug,
    lastStudySubjectSlug: subjectSlug,
    lastStudyVisitedAtMs: Date.now(),
  });
}

export function markPdfProgress(input: {
  resourceId: string;
  title: string;
  page: number;
  subjectSlug?: SubjectSlug | null;
}) {
  patchRabbitGuideState({
    lastPdfResourceId: input.resourceId,
    lastPdfTitle: input.title,
    lastPdfPage: Math.max(1, Math.floor(input.page)),
    lastPdfSubjectSlug: input.subjectSlug ?? null,
  });
}

export function getPdfResumeForResource(resourceId: string): number | null {
  const state = loadRabbitGuideState();
  if (state.lastPdfResourceId !== resourceId) return null;
  return state.lastPdfPage;
}

export function markSrsDeckVisited(input: { deckId: string; deckName: string; subjectSlug?: SubjectSlug | null }) {
  patchRabbitGuideState({
    lastSrsDeckId: input.deckId,
    lastSrsDeckName: input.deckName,
    lastSrsSubjectSlug: input.subjectSlug ?? null,
  });
}
