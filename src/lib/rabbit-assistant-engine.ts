import { getPlanForDate } from "@/lib/schedule";
import { phaseLabel, type PomodoroState } from "@/lib/pomodoro";
import type { DailyStats } from "@/lib/stats-store";
import type { RabbitPersonality } from "@/lib/rabbit-personality";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";
import type {
  RabbitAssistantControlPayload,
  RabbitBehaviorMode,
  RabbitGuideSpeechAction,
  RabbitGuideState,
  RabbitGuideSpeechPayload,
  RabbitVisualState,
} from "@/lib/rabbit-guide";

export type RabbitAssistantContext = {
  pathname: string;
  guideState: RabbitGuideState;
  pomodoroState: PomodoroState;
  todayStats: DailyStats;
  srsDueToday: number;
  srsDueForGuidedSubject: number;
  clinicalTodayTasks: number;
  clinicalPendingTasks: number;
  clinicalReminderTick: number;
  personality: RabbitPersonality;
};

export type RabbitGuideCard = {
  title: string;
  message: string;
  status: string;
  actions: RabbitGuideSpeechAction[];
};

function parseStudySubjectFromPath(pathname: string): SubjectSlug | null {
  if (!pathname.startsWith("/study/")) return null;
  const slug = pathname.slice("/study/".length).split("/")[0];
  if (slug === "anatomia" || slug === "histologia" || slug === "embriologia" || slug === "biologia-celular") {
    return slug;
  }
  return null;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickVariant(options: string[], seed: string): string {
  if (!options.length) return "";
  const idx = hashSeed(seed) % options.length;
  return options[idx] ?? options[0] ?? "";
}

function byPersonality(
  personality: RabbitPersonality,
  options: { balanced: string[]; calm?: string[]; active?: string[] },
): string[] {
  if (personality === "calm") return options.calm ?? options.balanced;
  if (personality === "active") return options.active ?? options.balanced;
  return options.balanced;
}

const ROUTINE_PHASE_LABELS: Record<RabbitGuideState["routinePhase"], string> = {
  idle: "Reposo",
  study_selected: "Inicio",
  pomodoro_active: "Pomodoro",
  plan_aligned: "Plan",
  module_focus: "Módulo",
  srs_review: "SRS",
  reading_block: "Lectura",
  closure_ready: "Cierre",
  routine_closed: "Completada",
};

function buildGuideCard(ctx: RabbitAssistantContext): RabbitGuideCard {
  const {
    guideState: state,
    pathname,
    pomodoroState,
    todayStats,
    srsDueToday,
    srsDueForGuidedSubject,
    clinicalTodayTasks,
    clinicalPendingTasks,
    clinicalReminderTick,
    personality,
  } = ctx;
  const todayPlan = getPlanForDate(new Date());
  const tomorrowPlan = getPlanForDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const primary = SUBJECTS[todayPlan.primary];
  const secondary = SUBJECTS[todayPlan.secondary];

  const guidedSubjectSlug = state.activeSubjectSlug ?? state.lastStudySubjectSlug ?? todayPlan.primary;
  const active = guidedSubjectSlug ? SUBJECTS[guidedSubjectSlug] : null;
  const resume = state.lastStudySubjectSlug ? SUBJECTS[state.lastStudySubjectSlug] : null;
  const isStudyRoute = pathname.startsWith("/study/");
  const pomodoroText = `Pomodoro: ${phaseLabel(pomodoroState.phase)}`;
  const resumePdfLabel = state.lastPdfTitle ? `${state.lastPdfTitle}${state.lastPdfPage ? ` · p. ${state.lastPdfPage}` : ""}` : null;
  const resumeDeckLabel = state.lastSrsDeckName ?? null;
  const dayStamp = new Date().toISOString().slice(0, 10);
  const baseSeed = [dayStamp, pathname, state.routinePhase, pomodoroState.phase, String(todayStats.blocksCompleted), String(clinicalReminderTick)].join("|");
  const phaseStatus = `Fase: ${ROUTINE_PHASE_LABELS[state.routinePhase]}`;
  const hasClinicalTasks = clinicalTodayTasks + clinicalPendingTasks > 0;

  if (todayStats.routineCompleted) {
    const summary = [
      `${todayStats.blocksCompleted} bloques`,
      `${todayStats.focusMinutes} min foco`,
      `${todayStats.srsReviewed} tarjetas`,
      `${todayStats.pdfPages} páginas`,
    ].join(" · ");
    return {
      title: "Cierre del día completado",
      message: pickVariant(
        byPersonality(personality, {
          balanced: [
            `Gran jornada. Resumen: ${summary}. Mañana abrimos con ${SUBJECTS[tomorrowPlan.primary].name} y luego ${SUBJECTS[tomorrowPlan.secondary].name}.`,
            `Cierre impecable. Hoy hiciste ${summary}. Mañana seguimos con ${SUBJECTS[tomorrowPlan.primary].name} y después ${SUBJECTS[tomorrowPlan.secondary].name}.`,
          ],
          calm: [`Buen cierre, sin prisa: ${summary}. Mañana avanzamos con ${SUBJECTS[tomorrowPlan.primary].name}.`],
          active: [`Día cerrado con fuerza: ${summary}. Mañana arrancamos con ${SUBJECTS[tomorrowPlan.primary].name}.`],
        }),
        `${baseSeed}|routine-completed`,
      ),
      status: `${pomodoroText} · ${phaseStatus} · Día al 100%`,
      actions: [
        { href: "/stats", label: "Ver resumen", primary: true },
        { href: "/day", label: "Preparar mañana" },
      ],
    };
  }

  if (pathname.startsWith("/day") && hasClinicalTasks) {
    const taskStatus = `Hoy: ${clinicalTodayTasks} · Pendientes: ${clinicalPendingTasks}`;
    return {
      title: "Recordatorio del tablero clínico",
      message: pickVariant(
        byPersonality(personality, {
          balanced: [
            `Te quedan ${clinicalTodayTasks} tareas en Hoy y ${clinicalPendingTasks} en Pendiente. Avancemos una ahora para mantener ritmo.`,
            `Revisión rápida: ${clinicalTodayTasks} tareas en Hoy y ${clinicalPendingTasks} pendientes. ¿Completamos una en este bloque?`,
          ],
          calm: [`A tu ritmo: tienes ${clinicalTodayTasks} en Hoy y ${clinicalPendingTasks} en Pendiente. Una tarea ahora ya suma.`],
          active: [`Vamos con impulso: ${clinicalTodayTasks} en Hoy y ${clinicalPendingTasks} pendientes. Cierra una ya.`],
        }),
        `${baseSeed}|clinical-reminder|${clinicalTodayTasks}|${clinicalPendingTasks}`,
      ),
      status: `${pomodoroText} · ${phaseStatus} · ${taskStatus}`,
      actions: [
        { href: "/day", label: "Abrir tablero", primary: true },
        { href: "/day", label: "Marcar avance" },
      ],
    };
  }

  if (isStudyRoute && pomodoroState.phase === "idle") {
    return {
      title: "Primero Pomodoro",
      message: active
        ? `Antes de seguir con ${active.name}, activa Pomodoro para iniciar bloque guiado.`
        : "Activa Pomodoro para iniciar la sesión.",
      status: `${pomodoroText} · ${phaseStatus} · Paso 1`,
      actions: [
        { href: "/#pomodoro", label: "Ir a Pomodoro", primary: true },
        { href: "/day", label: "Ver plan" },
      ],
    };
  }

  if (state.routinePhase === "study_selected") {
    return {
      title: "Inicio de estudio",
      message: active
        ? `Empezamos con ${active.name}. Te llevo primero a Pomodoro para ordenar la sesión.`
        : "Empezamos. Vamos primero a Pomodoro.",
      status: `${pomodoroText} · ${phaseStatus} · Preparación`,
      actions: [{ href: "/#pomodoro", label: "Ir a Pomodoro", primary: true }],
    };
  }

  if (state.routinePhase === "pomodoro_active") {
    return {
      title: "Siguiente: Plan del día",
      message: `Pomodoro activo. Revisemos el plan y la ruta ${primary.name} → ${secondary.name}.`,
      status: `${pomodoroText} · ${phaseStatus} · Dirección`,
      actions: [
        { href: "/day", label: "Ir al plan", primary: true },
        { href: `/study/${primary.slug}`, label: `Abrir ${primary.name}` },
      ],
    };
  }

  if ((pomodoroState.phase === "focus_3" || todayStats.blocksCompleted >= 2) && srsDueToday > 0) {
    return {
      title: "Momento de repaso",
      message:
        srsDueForGuidedSubject > 0
          ? `Tienes ${srsDueForGuidedSubject} tarjetas pendientes de ${active?.name ?? "tu tema"}.`
          : `Tienes ${srsDueToday} tarjetas pendientes hoy.`,
      status: `${pomodoroText} · ${phaseStatus} · Due: ${srsDueToday}`,
      actions: [
        { href: "/srs", label: resumeDeckLabel ? `Reanudar ${resumeDeckLabel}` : "Abrir SRS", primary: true },
        active ? { href: `/study/${active.slug}`, label: "Seguir módulo" } : { href: "/day", label: "Ver plan" },
      ],
    };
  }

  if (pathname === "/" && resume) {
    return {
      title: "Retomar progreso",
      message: `Tu último módulo fue ${resume.name}.${resumePdfLabel ? ` También tienes ${resumePdfLabel}.` : ""}`,
      status: `${pomodoroText} · ${phaseStatus} · Reanudar`,
      actions: [
        { href: `/study/${resume.slug}`, label: "Retomar módulo", primary: true },
        resumePdfLabel ? { href: "/resources", label: "Retomar lectura" } : { href: "/#pomodoro", label: "Preparar Pomodoro" },
      ],
    };
  }

  return {
    title: "Conejo guía activo",
    message: `Ruta sugerida: ${primary.name} → ${secondary.name}.`,
    status: `${pomodoroText} · ${phaseStatus} · Due hoy: ${srsDueToday}`,
    actions: [
      { href: `/study/${primary.slug}`, label: `Primaria: ${primary.name}`, primary: true },
      { href: `/study/${secondary.slug}`, label: `Secundaria: ${secondary.name}` },
    ],
  };
}

function controlForContext(ctx: RabbitAssistantContext): RabbitAssistantControlPayload {
  const { pomodoroState, todayStats, guideState } = ctx;

  let behaviorMode: RabbitBehaviorMode = "patrol";
  let visualState: RabbitVisualState = "run";
  let pauseMs = 0;

  if (todayStats.routineCompleted || guideState.routinePhase === "routine_closed") {
    behaviorMode = "summary";
    visualState = "idle";
    pauseMs = 900;
  } else if (guideState.routinePhase === "closure_ready") {
    behaviorMode = "guide";
    visualState = "idle";
    pauseMs = 700;
  } else if (pomodoroState.phase === "break_1" || pomodoroState.phase === "break_2") {
    behaviorMode = "resting";
    visualState = "sleep";
    pauseMs = 1400;
  } else if (pomodoroState.phase !== "idle") {
    behaviorMode = "guide";
    visualState = "run";
    pauseMs = 450;
  } else {
    behaviorMode = "waiting";
    visualState = "idle";
    pauseMs = 600;
  }

  return {
    behaviorMode,
    visualState,
    pauseMs,
  };
}

export function deriveRabbitAssistantOutput(ctx: RabbitAssistantContext): {
  card: RabbitGuideCard;
  speech: RabbitGuideSpeechPayload;
  control: RabbitAssistantControlPayload;
  telemetrySignature: string;
} {
  const card = buildGuideCard(ctx);
  const control = controlForContext(ctx);
  const speech: RabbitGuideSpeechPayload = {
    title: card.title,
    message: card.message,
    status: card.status,
    actions: card.actions,
    durationMs: control.visualState === "sleep" ? 6200 : 5200,
  };

  const routeSubject = parseStudySubjectFromPath(ctx.pathname) ?? "none";
  const telemetrySignature = [
    card.title,
    card.message,
    card.status,
    ctx.guideState.routinePhase,
    String(ctx.guideState.transitionHistory.at(-1)?.atMs ?? 0),
    control.behaviorMode,
    control.visualState,
    routeSubject,
  ].join("|");

  return { card, speech, control, telemetrySignature };
}
