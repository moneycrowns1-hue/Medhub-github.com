import type { SubjectSlug } from "@/lib/subjects";

const RABBIT_GUIDE_STATE_KEY = "somagnus:rabbit_guide:phase1:v1";
export const RABBIT_GUIDE_UPDATED_EVENT = "somagnus:rabbit_guide:updated";
export const RABBIT_GUIDE_PROMPT_EVENT = "somagnus:rabbit_guide:prompt";
export const RABBIT_GUIDE_SPEAK_EVENT = "somagnus:rabbit_guide:speak";
export const RABBIT_ASSISTANT_CONTROL_EVENT = "somagnus:rabbit_assistant:control";

export type RabbitVisualState = "run" | "jump" | "idle" | "sleep";
export type RabbitBehaviorMode = "patrol" | "guide" | "waiting" | "resting" | "summary";

export type RabbitRoutinePhase =
  | "idle"
  | "study_selected"
  | "pomodoro_active"
  | "plan_aligned"
  | "module_focus"
  | "srs_review"
  | "reading_block"
  | "closure_ready"
  | "routine_closed";

export type RabbitGuideEventType =
  | "start_study_selected"
  | "pomodoro_started"
  | "plan_viewed"
  | "study_module_viewed"
  | "srs_viewed"
  | "reading_viewed"
  | "routine_completed"
  | "day_reset";

export type RabbitGuideTransitionRecord = {
  atMs: number;
  event: RabbitGuideEventType;
  fromPhase: RabbitRoutinePhase;
  toPhase: RabbitRoutinePhase;
  changed: boolean;
  subjectSlug: SubjectSlug | null;
  pathname: string | null;
};

export type RabbitGuideEvent = {
  type: RabbitGuideEventType;
  subjectSlug?: SubjectSlug;
  pathname?: string;
  atMs?: number;
};

export type RabbitGuideSpeechAction = {
  href: string;
  label: string;
  primary?: boolean;
};

export type RabbitGuideSpeechPayload = {
  title: string;
  message: string;
  status?: string;
  actions?: RabbitGuideSpeechAction[];
  durationMs?: number;
};

export type RabbitAssistantControlPayload = {
  behaviorMode: RabbitBehaviorMode;
  visualState: RabbitVisualState;
  focusHref?: string;
  pauseMs?: number;
};

export type RabbitGuideStep = "idle" | "study_started" | "pomodoro_started" | "plan_checked";

export type RabbitGuideState = {
  step: RabbitGuideStep;
  routinePhase: RabbitRoutinePhase;
  transitionHistory: RabbitGuideTransitionRecord[];
  activeSubjectSlug: SubjectSlug | null;
  lastStudySubjectSlug: SubjectSlug | null;
  lastStudyVisitedAtMs: number | null;
  lastPomodoroStartedAtMs: number | null;
  lastPdfResourceId: string | null;
  lastPdfTitle: string | null;
  lastPdfPage: number | null;
  lastPdfPageByResourceId: Record<string, number>;
  lastPdfSubjectSlug: SubjectSlug | null;
  lastSrsDeckId: string | null;
  lastSrsDeckName: string | null;
  lastSrsSubjectSlug: SubjectSlug | null;
  updatedAtMs: number;
};

export const DEFAULT_RABBIT_GUIDE_STATE: RabbitGuideState = {
  step: "idle",
  routinePhase: "idle",
  transitionHistory: [],
  activeSubjectSlug: null,
  lastStudySubjectSlug: null,
  lastStudyVisitedAtMs: null,
  lastPomodoroStartedAtMs: null,
  lastPdfResourceId: null,
  lastPdfTitle: null,
  lastPdfPage: null,
  lastPdfPageByResourceId: {},
  lastPdfSubjectSlug: null,
  lastSrsDeckId: null,
  lastSrsDeckName: null,
  lastSrsSubjectSlug: null,
  updatedAtMs: 0,
};

const MAX_TRANSITION_HISTORY = 120;

export const RABBIT_ROUTINE_TRANSITIONS: Record<RabbitRoutinePhase, Partial<Record<RabbitGuideEventType, RabbitRoutinePhase>>> = {
  idle: {
    start_study_selected: "study_selected",
    study_module_viewed: "module_focus",
    plan_viewed: "plan_aligned",
    routine_completed: "routine_closed",
  },
  study_selected: {
    pomodoro_started: "pomodoro_active",
    plan_viewed: "plan_aligned",
    study_module_viewed: "module_focus",
    routine_completed: "routine_closed",
  },
  pomodoro_active: {
    plan_viewed: "plan_aligned",
    study_module_viewed: "module_focus",
    srs_viewed: "srs_review",
    reading_viewed: "reading_block",
    routine_completed: "routine_closed",
  },
  plan_aligned: {
    study_module_viewed: "module_focus",
    srs_viewed: "srs_review",
    reading_viewed: "reading_block",
    routine_completed: "routine_closed",
  },
  module_focus: {
    srs_viewed: "srs_review",
    reading_viewed: "reading_block",
    plan_viewed: "closure_ready",
    routine_completed: "routine_closed",
  },
  srs_review: {
    study_module_viewed: "module_focus",
    reading_viewed: "reading_block",
    plan_viewed: "closure_ready",
    routine_completed: "routine_closed",
  },
  reading_block: {
    study_module_viewed: "module_focus",
    srs_viewed: "srs_review",
    plan_viewed: "closure_ready",
    routine_completed: "routine_closed",
  },
  closure_ready: {
    routine_completed: "routine_closed",
    study_module_viewed: "module_focus",
    srs_viewed: "srs_review",
    reading_viewed: "reading_block",
  },
  routine_closed: {
    day_reset: "idle",
    start_study_selected: "study_selected",
  },
};

function isRoutinePhase(value: unknown): value is RabbitRoutinePhase {
  return (
    value === "idle" ||
    value === "study_selected" ||
    value === "pomodoro_active" ||
    value === "plan_aligned" ||
    value === "module_focus" ||
    value === "srs_review" ||
    value === "reading_block" ||
    value === "closure_ready" ||
    value === "routine_closed"
  );
}

function sanitizePdfPageByResourceId(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [resourceId, page] of Object.entries(source)) {
    if (!resourceId) continue;
    if (typeof page !== "number" || !Number.isFinite(page)) continue;
    out[resourceId] = Math.max(1, Math.floor(page));
  }
  return out;
}

function isGuideEventType(value: unknown): value is RabbitGuideEventType {
  return (
    value === "start_study_selected" ||
    value === "pomodoro_started" ||
    value === "plan_viewed" ||
    value === "study_module_viewed" ||
    value === "srs_viewed" ||
    value === "reading_viewed" ||
    value === "routine_completed" ||
    value === "day_reset"
  );
}

function phaseFromLegacyStep(step: RabbitGuideStep): RabbitRoutinePhase {
  if (step === "study_started") return "study_selected";
  if (step === "pomodoro_started") return "pomodoro_active";
  if (step === "plan_checked") return "plan_aligned";
  return "idle";
}

function stepFromPhase(phase: RabbitRoutinePhase): RabbitGuideStep {
  if (phase === "study_selected") return "study_started";
  if (phase === "pomodoro_active") return "pomodoro_started";
  if (phase === "plan_aligned" || phase === "module_focus" || phase === "srs_review" || phase === "reading_block" || phase === "closure_ready") {
    return "plan_checked";
  }
  return "idle";
}

function sanitizeTransitionHistory(value: unknown): RabbitGuideTransitionRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Partial<RabbitGuideTransitionRecord>;
      if (!isGuideEventType(item.event) || !isRoutinePhase(item.fromPhase) || !isRoutinePhase(item.toPhase)) return null;
      return {
        atMs: typeof item.atMs === "number" ? item.atMs : Date.now(),
        event: item.event,
        fromPhase: item.fromPhase,
        toPhase: item.toPhase,
        changed: typeof item.changed === "boolean" ? item.changed : item.fromPhase !== item.toPhase,
        subjectSlug: isSubjectSlug(item.subjectSlug) ? item.subjectSlug : null,
        pathname: typeof item.pathname === "string" ? item.pathname : null,
      };
    })
    .filter((item): item is RabbitGuideTransitionRecord => item !== null)
    .slice(-MAX_TRANSITION_HISTORY);
}

function isSubjectSlug(value: unknown): value is SubjectSlug {
  return (
    value === "anatomia" ||
    value === "histologia" ||
    value === "embriologia" ||
    value === "biologia-celular" ||
    value === "ingles" ||
    value === "trabajo-online"
  );
}

function sanitizeGuideState(value: unknown): RabbitGuideState {
  if (!value || typeof value !== "object") return DEFAULT_RABBIT_GUIDE_STATE;
  const source = value as Partial<RabbitGuideState>;
  const step: RabbitGuideStep =
    source.step === "study_started" || source.step === "pomodoro_started" || source.step === "plan_checked"
      ? source.step
      : "idle";
  const routinePhase = isRoutinePhase(source.routinePhase) ? source.routinePhase : phaseFromLegacyStep(step);
  const transitionHistory = sanitizeTransitionHistory(source.transitionHistory);

  return {
    step: stepFromPhase(routinePhase),
    routinePhase,
    transitionHistory,
    activeSubjectSlug: isSubjectSlug(source.activeSubjectSlug) ? source.activeSubjectSlug : null,
    lastStudySubjectSlug: isSubjectSlug(source.lastStudySubjectSlug) ? source.lastStudySubjectSlug : null,
    lastStudyVisitedAtMs: typeof source.lastStudyVisitedAtMs === "number" ? source.lastStudyVisitedAtMs : null,
    lastPomodoroStartedAtMs: typeof source.lastPomodoroStartedAtMs === "number" ? source.lastPomodoroStartedAtMs : null,
    lastPdfResourceId: typeof source.lastPdfResourceId === "string" ? source.lastPdfResourceId : null,
    lastPdfTitle: typeof source.lastPdfTitle === "string" ? source.lastPdfTitle : null,
    lastPdfPage: typeof source.lastPdfPage === "number" ? Math.max(1, Math.floor(source.lastPdfPage)) : null,
    lastPdfPageByResourceId: sanitizePdfPageByResourceId(source.lastPdfPageByResourceId),
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
  try {
    window.localStorage.setItem(
      RABBIT_GUIDE_STATE_KEY,
      JSON.stringify({
        ...sanitizeGuideState(next),
        updatedAtMs: Date.now(),
      }),
    );
    window.dispatchEvent(new Event(RABBIT_GUIDE_UPDATED_EVENT));
  } catch {
    return;
  }
}

export function patchRabbitGuideState(patch: Partial<RabbitGuideState>) {
  const current = loadRabbitGuideState();
  saveRabbitGuideState({ ...current, ...patch, updatedAtMs: Date.now() });
}

function buildTransitionRecord(current: RabbitGuideState, nextPhase: RabbitRoutinePhase, event: RabbitGuideEvent, atMs: number): RabbitGuideTransitionRecord {
  return {
    atMs,
    event: event.type,
    fromPhase: current.routinePhase,
    toPhase: nextPhase,
    changed: current.routinePhase !== nextPhase,
    subjectSlug: event.subjectSlug ?? null,
    pathname: event.pathname ?? null,
  };
}

export function transitionRabbitGuideState(event: RabbitGuideEvent) {
  const current = loadRabbitGuideState();
  const atMs = event.atMs ?? Date.now();
  const nextPhase = RABBIT_ROUTINE_TRANSITIONS[current.routinePhase]?.[event.type] ?? current.routinePhase;
  const transition = buildTransitionRecord(current, nextPhase, event, atMs);

  const nextState: RabbitGuideState = {
    ...current,
    routinePhase: nextPhase,
    transitionHistory: [...current.transitionHistory, transition].slice(-MAX_TRANSITION_HISTORY),
    step: stepFromPhase(nextPhase),
    updatedAtMs: atMs,
  };

  if (event.type === "start_study_selected" && event.subjectSlug) {
    nextState.activeSubjectSlug = event.subjectSlug;
    nextState.lastStudySubjectSlug = event.subjectSlug;
    nextState.lastStudyVisitedAtMs = atMs;
  }

  if (event.type === "study_module_viewed" && event.subjectSlug) {
    nextState.activeSubjectSlug = nextState.activeSubjectSlug ?? event.subjectSlug;
    nextState.lastStudySubjectSlug = event.subjectSlug;
    nextState.lastStudyVisitedAtMs = atMs;
  }

  if (event.type === "pomodoro_started") {
    nextState.lastPomodoroStartedAtMs = atMs;
  }

  if (event.type === "day_reset") {
    nextState.routinePhase = "idle";
    nextState.step = "idle";
  }

  saveRabbitGuideState(nextState);
}

export function startStudyGuidance(subjectSlug: SubjectSlug, pathname?: string) {
  transitionRabbitGuideState({
    type: "start_study_selected",
    subjectSlug,
    pathname,
  });
}

export function markPomodoroStarted(pathname?: string) {
  transitionRabbitGuideState({
    type: "pomodoro_started",
    pathname,
  });
}

export function markPlanChecked(pathname?: string) {
  transitionRabbitGuideState({
    type: "plan_viewed",
    pathname,
  });
}

export function markStudyVisited(subjectSlug: SubjectSlug, pathname?: string) {
  transitionRabbitGuideState({
    type: "study_module_viewed",
    subjectSlug,
    pathname,
  });
}

export function markSrsVisited(pathname?: string) {
  transitionRabbitGuideState({
    type: "srs_viewed",
    pathname,
  });
}

export function markReadingVisited(pathname?: string) {
  transitionRabbitGuideState({
    type: "reading_viewed",
    pathname,
  });
}

export function markRoutineCompleted(pathname?: string) {
  transitionRabbitGuideState({
    type: "routine_completed",
    pathname,
  });
}

export function markPdfProgress(input: {
  resourceId: string;
  title: string;
  page: number;
  subjectSlug?: SubjectSlug | null;
}) {
  const normalizedPage = Math.max(1, Math.floor(input.page));
  const current = loadRabbitGuideState();
  patchRabbitGuideState({
    lastPdfResourceId: input.resourceId,
    lastPdfTitle: input.title,
    lastPdfPage: normalizedPage,
    lastPdfPageByResourceId: {
      ...current.lastPdfPageByResourceId,
      [input.resourceId]: normalizedPage,
    },
    lastPdfSubjectSlug: input.subjectSlug ?? null,
  });
  transitionRabbitGuideState({
    type: "reading_viewed",
  });
}

export function getPdfResumeForResource(resourceId: string): number | null {
  const state = loadRabbitGuideState();
  const perResourcePage = state.lastPdfPageByResourceId[resourceId];
  if (typeof perResourcePage === "number" && Number.isFinite(perResourcePage)) {
    return Math.max(1, Math.floor(perResourcePage));
  }
  if (state.lastPdfResourceId !== resourceId) return null;
  return state.lastPdfPage;
}

export function markSrsDeckVisited(input: { deckId: string; deckName: string; subjectSlug?: SubjectSlug | null }) {
  patchRabbitGuideState({
    lastSrsDeckId: input.deckId,
    lastSrsDeckName: input.deckName,
    lastSrsSubjectSlug: input.subjectSlug ?? null,
  });
  transitionRabbitGuideState({
    type: "srs_viewed",
    subjectSlug: input.subjectSlug ?? undefined,
  });
}
