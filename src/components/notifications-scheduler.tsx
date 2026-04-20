"use client";

import { useEffect, useRef } from "react";

import {
  loadNotificationsPrefs,
  markNotificationSent,
  NOTIFICATIONS_PREFS_UPDATED_EVENT,
  wasNotificationSent,
  type NotificationsPrefs,
} from "@/lib/notifications-store";
import {
  ACADEMIC_UPDATED_EVENT,
  listUpcomingEvaluations,
} from "@/lib/academic-store";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";
import { notifyGlobal } from "@/lib/global-notifier";

const CHECK_INTERVAL_MS = 60_000;

function isoDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  return { h: Number.isFinite(h) ? h : 0, m: Number.isFinite(m) ? m : 0 };
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function targetMinutes(hhmm: string): number {
  const { h, m } = parseHHMM(hhmm);
  return h * 60 + m;
}

function tick(prefs: NotificationsPrefs) {
  if (!prefs.enabled) return;

  const now = new Date();
  const today = isoDateOnly(now);
  const currentMin = minutesOfDay(now);

  // Daily plan reminder
  if (prefs.dailyPlanEnabled) {
    const target = targetMinutes(prefs.dailyPlanTime);
    if (currentMin >= target && currentMin <= target + 5) {
      const key = `daily-plan:${today}`;
      if (!wasNotificationSent(key)) {
        const plan = getPlanForDate(now);
        const summary = formatPlanSummary(plan);
        const title = summary.isRestDay ? "Día de descanso" : `Plan de hoy · ${summary.primaryName}`;
        const body = summary.isRestDay
          ? "Hoy toca descansar. Recuperá energía."
          : `Principal: ${summary.primaryName}. Secundaria: ${summary.secondaryName}. Lectura: ${summary.reading}.`;
        notifyGlobal({
          title,
          body,
          tag: key,
          status: "Plan del día",
          actions: summary.isRestDay
            ? [{ href: "/day", label: "Ver plan", primary: true }]
            : [
                { href: "/day", label: "Abrir plan", primary: true },
                { href: "/", label: "Ir a Hoy" },
              ],
          durationMs: 5400,
        });
        markNotificationSent(key);
      }
    }
  }

  // Evaluation reminders
  if (prefs.evaluationsEnabled) {
    const target = targetMinutes(prefs.evaluationsTime);
    if (currentMin >= target && currentMin <= target + 5) {
      const horizon = Math.max(...prefs.evaluationsDaysBefore, 0);
      const upcoming = listUpcomingEvaluations({ horizonDays: Math.max(horizon, 1) });
      for (const entry of upcoming) {
        if (!prefs.evaluationsDaysBefore.includes(entry.daysUntil)) continue;
        const key = `eval:${entry.record.id}:${entry.daysUntil}:${today}`;
        if (wasNotificationSent(key)) continue;
        const subjectName = SUBJECTS[entry.record.subjectSlug as SubjectSlug]?.name ?? entry.record.subjectSlug;
        const when =
          entry.daysUntil === 0
            ? "Hoy"
            : entry.daysUntil === 1
            ? "Mañana"
            : `En ${entry.daysUntil} días`;
        const title = `${when}: ${entry.record.title}`;
        const body = `${subjectName} · ${entry.semester.name} (${entry.record.date})`;
        notifyGlobal({
          title,
          body,
          tag: key,
          status: `Evaluación · ${when}`,
          actions: [
            { href: "/academico", label: "Ver calendario", primary: true },
            { href: "/srs", label: "Repasar" },
          ],
          durationMs: 5400,
        });
        markNotificationSent(key);
      }
    }
  }
}

export function NotificationsScheduler() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let prefs = loadNotificationsPrefs();

    const runTick = () => tick(prefs);
    const reloadAndTick = () => {
      prefs = loadNotificationsPrefs();
      runTick();
    };

    // Initial check (gives immediate feedback after e.g. a setting change)
    runTick();

    timerRef.current = window.setInterval(runTick, CHECK_INTERVAL_MS);

    const onPrefsUpdated = () => {
      prefs = loadNotificationsPrefs();
    };
    const onAcademicUpdated = () => runTick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") reloadAndTick();
    };

    window.addEventListener(NOTIFICATIONS_PREFS_UPDATED_EVENT, onPrefsUpdated);
    window.addEventListener(ACADEMIC_UPDATED_EVENT, onAcademicUpdated);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      window.removeEventListener(NOTIFICATIONS_PREFS_UPDATED_EVENT, onPrefsUpdated);
      window.removeEventListener(ACADEMIC_UPDATED_EVENT, onAcademicUpdated);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
