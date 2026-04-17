import { ACADEMIC_UPDATED_EVENT } from "@/lib/academic-store";
import { isoDate } from "@/lib/dates";

const GAMIFICATION_KEY = "somagnus:academic:gamification:v1";
const WEEKLY_GOALS_KEY = "somagnus:academic:weekly-goals:v1";

export type GamificationEvent =
  | { type: "record_added"; itemType: string }
  | { type: "evaluation_passed"; score: number; passingGrade: number }
  | { type: "semester_passed"; viaRemedial: boolean }
  | { type: "weekly_goal_completed" }
  | { type: "study_plan_task_done" };

export type BadgeId =
  | "first_record"
  | "first_evaluation_passed"
  | "first_semester_passed"
  | "remedial_survivor"
  | "streak_7"
  | "streak_30"
  | "hundred_points"
  | "five_hundred_points"
  | "semester_no_remedial"
  | "weekly_goal_hero";

export type BadgeDefinition = {
  id: BadgeId;
  label: string;
  description: string;
};

export const BADGE_CATALOG: Record<BadgeId, BadgeDefinition> = {
  first_record: {
    id: "first_record",
    label: "Primer registro",
    description: "Registraste tu primer ítem académico.",
  },
  first_evaluation_passed: {
    id: "first_evaluation_passed",
    label: "Primera evaluación aprobada",
    description: "Aprobaste tu primera evaluación.",
  },
  first_semester_passed: {
    id: "first_semester_passed",
    label: "Primer semestre aprobado",
    description: "Cerraste tu primer semestre aprobado.",
  },
  remedial_survivor: {
    id: "remedial_survivor",
    label: "Superviviente del remedial",
    description: "Aprobaste un semestre vía remedial.",
  },
  streak_7: {
    id: "streak_7",
    label: "Racha 7 días",
    description: "7 días consecutivos con actividad académica.",
  },
  streak_30: {
    id: "streak_30",
    label: "Racha 30 días",
    description: "30 días consecutivos con actividad académica.",
  },
  hundred_points: {
    id: "hundred_points",
    label: "100 puntos",
    description: "Acumulaste 100 puntos académicos.",
  },
  five_hundred_points: {
    id: "five_hundred_points",
    label: "500 puntos",
    description: "Acumulaste 500 puntos académicos.",
  },
  semester_no_remedial: {
    id: "semester_no_remedial",
    label: "Semestre sin remedial",
    description: "Aprobaste un semestre sin necesitar remedial.",
  },
  weekly_goal_hero: {
    id: "weekly_goal_hero",
    label: "Objetivo semanal ✓",
    description: "Completaste un objetivo semanal académico.",
  },
};

export type GamificationState = {
  points: number;
  currentStreakDays: number;
  bestStreakDays: number;
  lastActivityDate: string | null;
  unlockedBadges: BadgeId[];
};

export type WeeklyGoalKind = "record_count" | "flashcards_reviewed" | "studyplan_tasks";

export type WeeklyGoal = {
  id: string;
  kind: WeeklyGoalKind;
  target: number;
  progress: number;
  label: string;
  weekStart: string;
  completed: boolean;
};

export type WeeklyGoalsState = {
  weekStart: string;
  goals: WeeklyGoal[];
};

const EVENT_POINTS: Record<GamificationEvent["type"], number> = {
  record_added: 10,
  evaluation_passed: 20,
  semester_passed: 50,
  weekly_goal_completed: 5,
  study_plan_task_done: 3,
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function defaultGamificationState(): GamificationState {
  return {
    points: 0,
    currentStreakDays: 0,
    bestStreakDays: 0,
    lastActivityDate: null,
    unlockedBadges: [],
  };
}

export function loadGamificationState(): GamificationState {
  if (typeof window === "undefined") return defaultGamificationState();
  const raw = parseJson<GamificationState>(
    window.localStorage.getItem(GAMIFICATION_KEY),
    defaultGamificationState(),
  );
  return {
    points: Math.max(0, Number(raw.points) || 0),
    currentStreakDays: Math.max(0, Number(raw.currentStreakDays) || 0),
    bestStreakDays: Math.max(0, Number(raw.bestStreakDays) || 0),
    lastActivityDate: raw.lastActivityDate ?? null,
    unlockedBadges: Array.isArray(raw.unlockedBadges)
      ? (raw.unlockedBadges.filter((id) => id in BADGE_CATALOG) as BadgeId[])
      : [],
  };
}

function saveGamificationState(state: GamificationState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(ACADEMIC_UPDATED_EVENT));
}

function unlockBadge(state: GamificationState, id: BadgeId): GamificationState {
  if (state.unlockedBadges.includes(id)) return state;
  return { ...state, unlockedBadges: [...state.unlockedBadges, id] };
}

function daysBetween(a: string, b: string): number {
  const aTime = new Date(a).getTime();
  const bTime = new Date(b).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return Infinity;
  return Math.round((bTime - aTime) / 86_400_000);
}

function applyStreak(state: GamificationState): GamificationState {
  const today = isoDate(new Date());
  if (state.lastActivityDate === today) return state;
  let streak = state.currentStreakDays;
  if (!state.lastActivityDate) {
    streak = 1;
  } else {
    const delta = daysBetween(state.lastActivityDate, today);
    streak = delta === 1 ? streak + 1 : 1;
  }
  const best = Math.max(state.bestStreakDays, streak);
  let next: GamificationState = { ...state, currentStreakDays: streak, bestStreakDays: best, lastActivityDate: today };
  if (streak >= 7) next = unlockBadge(next, "streak_7");
  if (streak >= 30) next = unlockBadge(next, "streak_30");
  return next;
}

export function reportGamificationEvent(event: GamificationEvent) {
  let state = loadGamificationState();
  const points = EVENT_POINTS[event.type] ?? 0;
  state = { ...state, points: state.points + points };
  state = applyStreak(state);

  switch (event.type) {
    case "record_added":
      state = unlockBadge(state, "first_record");
      break;
    case "evaluation_passed":
      if (event.score >= event.passingGrade) {
        state = unlockBadge(state, "first_evaluation_passed");
      }
      break;
    case "semester_passed":
      state = unlockBadge(state, "first_semester_passed");
      if (event.viaRemedial) state = unlockBadge(state, "remedial_survivor");
      else state = unlockBadge(state, "semester_no_remedial");
      break;
    case "weekly_goal_completed":
      state = unlockBadge(state, "weekly_goal_hero");
      break;
    default:
      break;
  }

  if (state.points >= 100) state = unlockBadge(state, "hundred_points");
  if (state.points >= 500) state = unlockBadge(state, "five_hundred_points");

  saveGamificationState(state);
  return state;
}

export function getBadgeDefinitions(ids: BadgeId[]): BadgeDefinition[] {
  return ids.map((id) => BADGE_CATALOG[id]).filter((badge): badge is BadgeDefinition => Boolean(badge));
}

function startOfIsoWeek(date = new Date()): string {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy.toISOString().slice(0, 10);
}

function defaultWeeklyGoals(weekStart: string): WeeklyGoalsState {
  const base: Array<Omit<WeeklyGoal, "id" | "progress" | "completed" | "weekStart">> = [
    { kind: "record_count", target: 5, label: "Registra 5 ítems académicos" },
    { kind: "flashcards_reviewed", target: 50, label: "Repasa 50 flashcards" },
    { kind: "studyplan_tasks", target: 3, label: "Completa 3 tareas del plan de estudio" },
  ];
  return {
    weekStart,
    goals: base.map((entry) => ({
      id: uid("goal"),
      weekStart,
      progress: 0,
      completed: false,
      ...entry,
    })),
  };
}

export function loadWeeklyGoals(): WeeklyGoalsState {
  const weekStart = startOfIsoWeek();
  if (typeof window === "undefined") return defaultWeeklyGoals(weekStart);
  const raw = parseJson<WeeklyGoalsState>(
    window.localStorage.getItem(WEEKLY_GOALS_KEY),
    defaultWeeklyGoals(weekStart),
  );
  if (raw.weekStart !== weekStart) {
    const refreshed = defaultWeeklyGoals(weekStart);
    window.localStorage.setItem(WEEKLY_GOALS_KEY, JSON.stringify(refreshed));
    return refreshed;
  }
  return raw;
}

function saveWeeklyGoals(state: WeeklyGoalsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WEEKLY_GOALS_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(ACADEMIC_UPDATED_EVENT));
}

export function reportWeeklyGoalProgress(kind: WeeklyGoalKind, delta = 1) {
  const state = loadWeeklyGoals();
  let didComplete = false;
  const nextGoals = state.goals.map((goal) => {
    if (goal.kind !== kind || goal.completed) return goal;
    const progress = Math.min(goal.target, goal.progress + delta);
    const completed = progress >= goal.target;
    if (completed && !goal.completed) didComplete = true;
    return { ...goal, progress, completed };
  });
  saveWeeklyGoals({ ...state, goals: nextGoals });
  if (didComplete) {
    reportGamificationEvent({ type: "weekly_goal_completed" });
  }
}

const REMINDERS_KEY = "somagnus:academic:reminders:v1";

export type AcademicReminderPrefs = {
  daysBefore: number[];
  enabled: boolean;
};

export function loadReminderPrefs(): AcademicReminderPrefs {
  if (typeof window === "undefined") return { daysBefore: [7, 3, 1], enabled: true };
  return parseJson<AcademicReminderPrefs>(window.localStorage.getItem(REMINDERS_KEY), {
    daysBefore: [7, 3, 1],
    enabled: true,
  });
}

export function saveReminderPrefs(prefs: AcademicReminderPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(prefs));
  window.dispatchEvent(new Event(ACADEMIC_UPDATED_EVENT));
}
