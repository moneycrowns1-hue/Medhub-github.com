import {
  ACADEMIC_UPDATED_EVENT,
  loadAcademicSnapshot,
  type AcademicConfig,
  type AcademicRecord,
  type AcademicSemester,
} from "@/lib/academic-store";
import { loadStudyPlan, type StudyPlanTask } from "@/lib/academic-studyplan-store";
import {
  loadGamificationState,
  loadReminderPrefs,
  loadWeeklyGoals,
  type AcademicReminderPrefs,
  type GamificationState,
  type WeeklyGoalsState,
} from "@/lib/academic-gamification-store";

export type AcademicExportPayload = {
  schemaVersion: 1;
  exportedAt: number;
  academic: {
    config: AcademicConfig;
    semesters: AcademicSemester[];
    records: AcademicRecord[];
  };
  studyPlan: { tasks: StudyPlanTask[] };
  gamification: GamificationState;
  weeklyGoals: WeeklyGoalsState;
  reminders: AcademicReminderPrefs;
};

const ACADEMIC_CONFIG_KEY = "somagnus:academic:config:v1";
const ACADEMIC_SEMESTERS_KEY = "somagnus:academic:semesters:v1";
const ACADEMIC_RECORDS_KEY = "somagnus:academic:records:v1";
const STUDYPLAN_KEY = "somagnus:academic:studyplan:v1";
const GAMIFICATION_KEY = "somagnus:academic:gamification:v1";
const WEEKLY_GOALS_KEY = "somagnus:academic:weekly-goals:v1";
const REMINDERS_KEY = "somagnus:academic:reminders:v1";

export function exportAcademicData(): AcademicExportPayload {
  const snapshot = loadAcademicSnapshot();
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    academic: snapshot,
    studyPlan: loadStudyPlan(),
    gamification: loadGamificationState(),
    weeklyGoals: loadWeeklyGoals(),
    reminders: loadReminderPrefs(),
  };
}

export function serializeAcademicData(): string {
  return JSON.stringify(exportAcademicData(), null, 2);
}

export function importAcademicData(input: unknown): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: false, error: "Not in browser" };
  if (!input || typeof input !== "object") return { ok: false, error: "Payload inválido." };
  const payload = input as Partial<AcademicExportPayload>;
  if (payload.schemaVersion !== 1) return { ok: false, error: "Esquema no soportado." };

  try {
    if (payload.academic?.config) {
      window.localStorage.setItem(ACADEMIC_CONFIG_KEY, JSON.stringify(payload.academic.config));
    }
    if (Array.isArray(payload.academic?.semesters)) {
      window.localStorage.setItem(ACADEMIC_SEMESTERS_KEY, JSON.stringify(payload.academic.semesters));
    }
    if (Array.isArray(payload.academic?.records)) {
      window.localStorage.setItem(ACADEMIC_RECORDS_KEY, JSON.stringify(payload.academic.records));
    }
    if (payload.studyPlan) {
      window.localStorage.setItem(STUDYPLAN_KEY, JSON.stringify(payload.studyPlan));
    }
    if (payload.gamification) {
      window.localStorage.setItem(GAMIFICATION_KEY, JSON.stringify(payload.gamification));
    }
    if (payload.weeklyGoals) {
      window.localStorage.setItem(WEEKLY_GOALS_KEY, JSON.stringify(payload.weeklyGoals));
    }
    if (payload.reminders) {
      window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(payload.reminders));
    }
    window.dispatchEvent(new Event(ACADEMIC_UPDATED_EVENT));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al importar" };
  }
}

export function downloadAcademicExport(filename = "somagnus-academic.json") {
  if (typeof window === "undefined") return;
  const blob = new Blob([serializeAcademicData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
