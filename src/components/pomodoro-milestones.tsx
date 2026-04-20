"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  isBreakPhase,
  loadPomodoroState,
  POMODORO_STATE_UPDATED_EVENT,
  remainingSec,
  type PomodoroPhase,
  type PomodoroState,
} from "@/lib/pomodoro";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";
import { SUBJECTS } from "@/lib/subjects";
import { loadRabbitGuideState } from "@/lib/rabbit-guide";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import { algoStats } from "@/lib/srs-algo";
import { notifyGlobal } from "@/lib/global-notifier";

type Milestone = "start" | "half" | "last5" | "end";

function milestoneKey(state: PomodoroState, milestone: Milestone): string | null {
  if (!state.startedAtMs || state.phase === "idle") return null;
  return `pomo:${state.phase}:${state.startedAtMs}:${milestone}`;
}

function phaseLongName(phase: PomodoroPhase): string {
  switch (phase) {
    case "focus_1":
      return "Bloque 1 de foco";
    case "focus_2":
      return "Bloque 2 de foco";
    case "focus_3":
      return "Bloque 3 de cierre";
    case "break_1":
      return "Descanso 1";
    case "break_2":
      return "Descanso 2";
    case "idle":
      return "";
  }
}

function fmtMin(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  return `${m} min`;
}

function subjectForPhase(phase: PomodoroPhase): { name: string; slug: string } | null {
  const plan = getPlanForDate(new Date());
  const summary = formatPlanSummary(plan);
  if (summary.isRestDay) return null;
  if (phase === "focus_1") return { name: summary.primaryName, slug: plan.primary };
  if (phase === "focus_2") return { name: summary.secondaryName, slug: plan.secondary };
  return null;
}

function pickNextAfterFocus(phase: PomodoroPhase): {
  title: string;
  body: string;
  actions: { href: string; label: string; primary?: boolean }[];
} {
  if (phase === "focus_1" || phase === "focus_2") {
    return {
      title: "Descanso obligatorio",
      body: "Para y descansá. Estírate, hidrátate y alejate de la pantalla unos minutos.",
      actions: [{ href: "/", label: "Volver a Hoy", primary: true }],
    };
  }
  // After focus_3: adaptive close
  const srs = loadSrsLibrary();
  const due = algoStats(srs.cards).dueToday;
  const guide = loadRabbitGuideState();
  const plan = getPlanForDate(new Date());
  const summary = formatPlanSummary(plan);

  if (due >= 5) {
    return {
      title: "Rutina cerrada · Cierre con SRS",
      body: `Cerraste los bloques. Te quedan ${due} tarjetas vencidas. Cierra con un repaso rápido para consolidar.`,
      actions: [
        { href: "/srs", label: "Abrir SRS", primary: true },
        { href: "/stats", label: "Ver resumen" },
      ],
    };
  }
  if (guide.lastPdfResourceId) {
    const resumeHref = `/biblioteca?resumePdf=${encodeURIComponent(guide.lastPdfResourceId)}&resumePage=${Math.max(1, Math.floor(guide.lastPdfPage || 1))}`;
    return {
      title: "Rutina cerrada · Lectura suave",
      body: `Buen trabajo. Cierra el día con ${guide.lastPdfTitle ?? "tu lectura pendiente"}${guide.lastPdfPage ? ` (p. ${guide.lastPdfPage})` : ""}.`,
      actions: [
        { href: resumeHref, label: "Retomar lectura", primary: true },
        { href: "/stats", label: "Ver resumen" },
      ],
    };
  }
  return {
    title: "Rutina cerrada",
    body: summary.isRestDay
      ? "Día cerrado. Disfruta el descanso."
      : `Gran día. Cierre opcional: lectura de ${summary.reading}.`,
    actions: [
      { href: "/biblioteca", label: "Ir a biblioteca", primary: true },
      { href: "/stats", label: "Ver resumen" },
    ],
  };
}

function pickMidBreakAction(phase: PomodoroPhase): {
  title: string;
  body: string;
  actions: { href: string; label: string; primary?: boolean }[];
} {
  if (phase === "break_1") {
    const plan = getPlanForDate(new Date());
    const secName = SUBJECTS[plan.secondary]?.name ?? "secundaria";
    return {
      title: "Break terminado · próximo bloque",
      body: `Siguiente: ${secName}. Te acompaño al módulo y arrancamos focus 2.`,
      actions: [
        { href: `/study/${plan.secondary}`, label: `Abrir ${secName}`, primary: true },
        { href: "/#pomodoro", label: "Pomodoro" },
      ],
    };
  }
  // break_2 → focus_3 adaptive
  const srs = loadSrsLibrary();
  const due = algoStats(srs.cards).dueToday;
  const guide = loadRabbitGuideState();

  if (due >= 5) {
    return {
      title: "Último bloque · SRS",
      body: `Tienes ${due} tarjetas vencidas. Cerremos con repaso para consolidar lo de hoy.`,
      actions: [
        { href: "/srs", label: "Iniciar SRS", primary: true },
        { href: "/#pomodoro", label: "Pomodoro" },
      ],
    };
  }
  if (guide.lastPdfResourceId) {
    const resumeHref = `/biblioteca?resumePdf=${encodeURIComponent(guide.lastPdfResourceId)}&resumePage=${Math.max(1, Math.floor(guide.lastPdfPage || 1))}`;
    return {
      title: "Último bloque · Lectura",
      body: `Retomemos ${guide.lastPdfTitle ?? "tu lectura"}${guide.lastPdfPage ? ` en la página ${guide.lastPdfPage}` : ""}.`,
      actions: [
        { href: resumeHref, label: "Retomar lectura", primary: true },
        { href: "/#pomodoro", label: "Pomodoro" },
      ],
    };
  }
  return {
    title: "Último bloque · Lectura suave",
    body: "No hay urgencias. Cerremos con lectura por materia del día.",
    actions: [
      { href: "/biblioteca", label: "Ir a biblioteca", primary: true },
      { href: "/#pomodoro", label: "Pomodoro" },
    ],
  };
}

export function PomodoroMilestones() {
  const firedRef = useRef<Set<string>>(new Set());
  const lastPhaseRef = useRef<PomodoroPhase>("idle");
  const lastStartedAtRef = useRef<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Refresh SRS snapshot when the store updates (cheap).
    const noop = () => {};
    window.addEventListener(SRS_UPDATED_EVENT, noop);
    return () => window.removeEventListener(SRS_UPDATED_EVENT, noop);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith("/lector")) return; // reader is immersive, skip

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const state = loadPomodoroState();
      const now = Date.now();
      const remaining = remainingSec(state, now);
      const elapsed = state.durationSec > 0 ? state.durationSec - remaining : 0;

      // Phase-change detection (handles start of any phase and end of previous).
      const phaseChanged =
        lastPhaseRef.current !== state.phase || lastStartedAtRef.current !== state.startedAtMs;

      if (phaseChanged) {
        const prevPhase = lastPhaseRef.current;
        lastPhaseRef.current = state.phase;
        lastStartedAtRef.current = state.startedAtMs;

        // End of previous (non-idle) phase.
        if (prevPhase !== "idle") {
          if (isBreakPhase(prevPhase)) {
            const next = pickMidBreakAction(prevPhase);
            notifyGlobal({
              ...next,
              tag: `pomo:${prevPhase}:end:${now}`,
              status: "Pomodoro · transición",
              durationMs: 5600,
              inAppOnly: false,
            });
          } else {
            const next = pickNextAfterFocus(prevPhase);
            notifyGlobal({
              ...next,
              tag: `pomo:${prevPhase}:end:${now}`,
              status: "Pomodoro · bloque cerrado",
              durationMs: 5600,
              inAppOnly: false,
            });
          }
        }

        // Start of new non-idle phase.
        if (state.phase !== "idle" && state.startedAtMs) {
          const subj = subjectForPhase(state.phase);
          const label = phaseLongName(state.phase);
          const dur = fmtMin(state.durationSec);
          const subjectLine = subj ? ` Objetivo: ${subj.name}.` : "";
          const key = milestoneKey(state, "start");
          if (key && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            notifyGlobal({
              title: `Arrancó ${label}`,
              body: `${dur} por delante.${subjectLine}`,
              status: "Pomodoro · inicio",
              tag: key,
              durationMs: 4400,
              actions: subj
                ? [
                    { href: `/study/${subj.slug}`, label: `Abrir ${subj.name}`, primary: true },
                    { href: "/#pomodoro", label: "Ver timer" },
                  ]
                : [{ href: "/#pomodoro", label: "Ver timer", primary: true }],
              inAppOnly: true,
            });
          }
        }
      }

      // In-phase milestones.
      if (state.phase !== "idle" && state.startedAtMs && state.durationSec > 0 && remaining > 0) {
        const half = Math.floor(state.durationSec / 2);

        // Mitad
        if (elapsed >= half) {
          const key = milestoneKey(state, "half");
          if (key && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            const label = phaseLongName(state.phase);
            notifyGlobal({
              title: `Mitad de ${label.toLowerCase()}`,
              body: `Llevas ${fmtMin(elapsed)}, quedan ${fmtMin(remaining)}. Termina con foco.`,
              status: "Pomodoro · mitad",
              tag: key,
              durationMs: 4200,
              inAppOnly: true,
            });
          }
        }

        // Últimos 5 min (solo si la fase dura > 10 min)
        if (state.durationSec > 600 && remaining <= 5 * 60 && remaining > 60) {
          const key = milestoneKey(state, "last5");
          if (key && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            const label = phaseLongName(state.phase);
            notifyGlobal({
              title: `Últimos 5 min`,
              body: `${label}: queda poco. Cierra fuerte este tramo.`,
              status: "Pomodoro · final",
              tag: key,
              durationMs: 4200,
              inAppOnly: true,
            });
          }
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 2000);
    const onStorage = () => tick();
    window.addEventListener(POMODORO_STATE_UPDATED_EVENT, onStorage);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(POMODORO_STATE_UPDATED_EVENT, onStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  return null;
}
