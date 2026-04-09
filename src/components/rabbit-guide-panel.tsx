"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { getPlanForDate } from "@/lib/schedule";
import { algoStats } from "@/lib/srs-algo";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import {
  isBreakPhase,
  loadPomodoroState,
  phaseLabel,
  POMODORO_STATE_UPDATED_EVENT,
  type PomodoroState,
} from "@/lib/pomodoro";
import { getTodayStats, STATS_UPDATED_EVENT, type DailyStats } from "@/lib/stats-store";
import {
  loadRabbitGuideState,
  markPlanChecked,
  markStudyVisited,
  RABBIT_GUIDE_SPEAK_EVENT,
  RABBIT_GUIDE_PROMPT_EVENT,
  RABBIT_GUIDE_UPDATED_EVENT,
  type RabbitGuideSpeechPayload,
  type RabbitGuideState,
} from "@/lib/rabbit-guide";
import {
  loadRabbitPersonality,
  RABBIT_PERSONALITY_UPDATED_EVENT,
  type RabbitPersonality,
} from "@/lib/rabbit-personality";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";

type GuideAction = {
  href: string;
  label: string;
  primary?: boolean;
};

type GuideCard = {
  title: string;
  message: string;
  status: string;
  actions: GuideAction[];
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

function buildGuide(
  state: RabbitGuideState,
  pathname: string,
  pomodoroState: PomodoroState,
  todayStats: DailyStats,
  srsDueToday: number,
  srsDueForGuidedSubject: number,
  personality: RabbitPersonality,
): GuideCard {
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
  const baseSeed = [dayStamp, pathname, state.step, pomodoroState.phase, String(todayStats.blocksCompleted)].join("|");

  if (todayStats.routineCompleted) {
    const summary = [
      `${todayStats.blocksCompleted} bloques`,
      `${todayStats.focusMinutes} min foco`,
      `${todayStats.srsReviewed} tarjetas`,
      `${todayStats.pdfPages} páginas`,
    ].join(" · ");
    const completionMessage = pickVariant(
      byPersonality(personality, {
        balanced: [
          `Gran jornada. Resumen: ${summary}. Mañana abrimos con ${SUBJECTS[tomorrowPlan.primary].name} y luego ${SUBJECTS[tomorrowPlan.secondary].name}.`,
          `Cierre impecable. Hoy hiciste ${summary}. Mañana seguimos con ${SUBJECTS[tomorrowPlan.primary].name} y después ${SUBJECTS[tomorrowPlan.secondary].name}.`,
          `Día cerrado con buen ritmo: ${summary}. Para mañana te propongo ${SUBJECTS[tomorrowPlan.primary].name} y luego ${SUBJECTS[tomorrowPlan.secondary].name}.`,
        ],
        calm: [
          `Cerramos en calma. Hoy acumulaste ${summary}. Mañana retomamos con ${SUBJECTS[tomorrowPlan.primary].name} y después ${SUBJECTS[tomorrowPlan.secondary].name}.`,
          `Buen cierre, sin prisa: ${summary}. Mañana avanzamos con ${SUBJECTS[tomorrowPlan.primary].name} y luego ${SUBJECTS[tomorrowPlan.secondary].name}.`,
        ],
        active: [
          `Día cerrado con fuerza: ${summary}. Mañana arrancamos con ${SUBJECTS[tomorrowPlan.primary].name} y luego vamos por ${SUBJECTS[tomorrowPlan.secondary].name}.`,
          `Excelente ritmo hoy (${summary}). Mañana abrimos con ${SUBJECTS[tomorrowPlan.primary].name} y seguimos con ${SUBJECTS[tomorrowPlan.secondary].name}.`,
        ],
      }),
      `${baseSeed}|routine-completed`,
    );
    return {
      title: "Cierre del día completado",
      message: completionMessage,
      status: `${pomodoroText} · Día al 100% · Nos vemos mañana`,
      actions: [
        { href: "/stats", label: "Ver resumen", primary: true },
        { href: "/day", label: "Preparar mañana" },
        { href: `/study/${tomorrowPlan.primary}`, label: `Tema de mañana: ${SUBJECTS[tomorrowPlan.primary].name}` },
      ],
    };
  }

  if (isStudyRoute && pomodoroState.phase === "idle") {
    return {
      title: "Primero Pomodoro",
      message: active
        ? `Antes de seguir con ${active.name}, activa Pomodoro para que el bloque quede guiado.`
        : "Antes de continuar, activa Pomodoro para iniciar la sesión guiada.",
      status: `${pomodoroText} · Paso 1`,
      actions: [
        { href: "/#pomodoro", label: "Ir a Pomodoro", primary: true },
        { href: "/day", label: "Ver plan" },
      ],
    };
  }

  if (pomodoroState.phase === "idle" && todayStats.blocksCompleted >= 3 && !todayStats.routineCompleted) {
    const nearCloseMessage = pickVariant(
      byPersonality(personality, {
        balanced: [
          "Ya completaste tus bloques principales. Ve al Plan para marcar tu rutina y cerrar el día con tu resumen.",
          "Te queda el último paso: cerrar checklist en Plan para terminar la jornada con todo registrado.",
          "Muy buen avance. Pasa por Plan, marca rutina completa y dejamos listo el cierre del día.",
        ],
        calm: [
          "Ya hiciste lo importante. Cuando quieras, cerramos checklist en Plan y terminamos el día.",
          "Solo falta un paso tranquilo: marca rutina completa en Plan y queda todo cerrado.",
        ],
        active: [
          "¡Último sprint! Cierra checklist en Plan y dejas el día al 100%.",
          "Gran avance. Remata en Plan marcando rutina completa.",
        ],
      }),
      `${baseSeed}|near-close`,
    );
    return {
      title: "Casi cerramos tu día",
      message: nearCloseMessage,
      status: `${pomodoroText} · Falta checklist final`,
      actions: [
        { href: "/day", label: "Cerrar rutina en Plan", primary: true },
        { href: "/stats", label: "Ver avance" },
      ],
    };
  }

  if (isBreakPhase(pomodoroState.phase)) {
    const breakMessage = pickVariant(
      byPersonality(personality, {
        balanced: active
          ? [
              `Respira un poco. Al volver, seguimos con ${active.name}.`,
              `Buena pausa. Cuando vuelvas, retomamos ${active.name} sin perder el hilo.`,
              `Descanso corto y volvemos con ${active.name}. Vas muy bien.`,
            ]
          : [
              "Respira un poco. Al volver retomamos el enfoque.",
              "Pausa breve, mente fresca, y seguimos con el plan.",
              "Tómate este descanso y regresamos al ritmo de estudio.",
            ],
        calm: active
          ? [
              `Respira profundo. Retomamos ${active.name} con calma al volver.`,
              `Disfruta esta pausa; luego seguimos ${active.name} a buen ritmo.`,
            ]
          : ["Pausa suave. Cuando regreses, retomamos con calma."],
        active: active
          ? [
              `Recarga rápido y volvemos con ${active.name}.`,
              `Pausa corta y seguimos fuerte con ${active.name}.`,
            ]
          : ["Descanso express y volvemos al plan."],
      }),
      `${baseSeed}|break`,
    );
    return {
      title: "Tiempo de descanso",
      message: breakMessage,
      status: `${pomodoroText} · Pausa activa`,
      actions: [
        { href: "/space", label: "Ir a Space", primary: true },
        resumePdfLabel
          ? { href: "/resources", label: `Retomar PDF (${state.lastPdfPage ?? 1})` }
          : active
            ? { href: `/study/${active.slug}`, label: "Volver al módulo" }
            : { href: "/", label: "Volver a hoy" },
      ],
    };
  }

  if (state.step === "plan_checked" && pomodoroState.phase === "idle") {
    const routeMessage = pickVariant(
      byPersonality(personality, {
        balanced: [
          `Primero ${primary.name}, luego ${secondary.name}. Arranca el bloque principal y te guío al secundario después.`,
          `Ruta de hoy: abre con ${primary.name} y luego cambia a ${secondary.name}. Yo te acompaño en cada paso.`,
          `Vamos con secuencia clara: ${primary.name} primero, ${secondary.name} después.`,
        ],
        calm: [
          `Tomemos una ruta tranquila: ${primary.name} primero y ${secondary.name} después.`,
          `Sin prisa: empezamos con ${primary.name} y luego continuamos con ${secondary.name}.`,
        ],
        active: [
          `Ruta activa: arrancamos con ${primary.name} y luego atacamos ${secondary.name}.`,
          `Vamos con orden y energía: ${primary.name} primero, ${secondary.name} después.`,
        ],
      }),
      `${baseSeed}|plan-idle`,
    );
    return {
      title: "Plan del día listo",
      message: routeMessage,
      status: `${pomodoroText} · Ruta ${primary.name} → ${secondary.name}`,
      actions: [
        { href: `/study/${primary.slug}`, label: `Empezar ${primary.name}`, primary: true },
        { href: `/study/${secondary.slug}`, label: `Ver ${secondary.name}` },
      ],
    };
  }

  if (
    state.step === "plan_checked" &&
    pomodoroState.phase === "focus_3" &&
    active?.slug === primary.slug &&
    todayStats.blocksCompleted >= 2
  ) {
    const transitionMessage = pickVariant(
      [
        `Buen avance en ${primary.name}. Puedes cerrar este bloque y pasar a ${secondary.name}.`,
        `Ya consolidaste ${primary.name}. Este es buen momento para movernos a ${secondary.name}.`,
        `Excelente progreso: cerramos ${primary.name} por ahora y abrimos ${secondary.name}.`,
      ],
      `${baseSeed}|secondary-transition`,
    );
    return {
      title: "Transición a materia secundaria",
      message: transitionMessage,
      status: `${pomodoroText} · Cambio sugerido`,
      actions: [
        { href: `/study/${secondary.slug}`, label: `Ir a ${secondary.name}`, primary: true },
        { href: `/study/${primary.slug}`, label: `Seguir ${primary.name}` },
      ],
    };
  }

  if ((pomodoroState.phase === "focus_3" || todayStats.blocksCompleted >= 2) && srsDueToday > 0) {
    const srsMessage =
      srsDueForGuidedSubject > 0
        ? pickVariant(
            byPersonality(personality, {
              balanced: [
                `Tienes ${srsDueForGuidedSubject} tarjetas due de ${active?.name ?? "tu tema activo"}. Conviene pasar a SRS ahora.`,
                `${active?.name ?? "Tu tema"} tiene ${srsDueForGuidedSubject} tarjetas pendientes hoy. Hagamos un repaso corto en SRS.`,
                `Buen punto para consolidar: ${srsDueForGuidedSubject} tarjetas due en ${active?.name ?? "tu enfoque actual"}.`,
              ],
              calm: [
                `Hay ${srsDueForGuidedSubject} tarjetas pendientes en ${active?.name ?? "tu tema"}. Un repaso corto y tranquilo suma mucho.`,
                `Podemos hacer una ronda breve de SRS (${srsDueForGuidedSubject}) para fijar mejor ${active?.name ?? "el tema"}.`,
              ],
              active: [
                `${srsDueForGuidedSubject} tarjetas due en ${active?.name ?? "tu tema"}. Vamos a limpiarlas ahora en SRS.`,
                `Buen momento para sprint SRS: ${srsDueForGuidedSubject} pendientes en ${active?.name ?? "tu enfoque"}.`,
              ],
            }),
            `${baseSeed}|srs-guided`,
          )
        : pickVariant(
            byPersonality(personality, {
              balanced: [
                `Tienes ${srsDueToday} tarjetas due hoy. Buen momento para repasar en SRS.`,
                `Hay ${srsDueToday} tarjetas pendientes hoy. Conviene hacer una ronda en SRS ahora.`,
                `${srsDueToday} tarjetas due te esperan. Un repaso corto ahora suma bastante.`,
              ],
              calm: [
                `Quedaron ${srsDueToday} tarjetas para hoy. Una pasada breve y sin apuro en SRS sería ideal.`,
                `Puedes cerrar ${srsDueToday} tarjetas en SRS con una sesión corta y tranquila.`,
              ],
              active: [
                `${srsDueToday} tarjetas pendientes hoy. Vamos a resolverlas en SRS.`,
                `Hay ${srsDueToday} due hoy: buen momento para un sprint de repaso.`,
              ],
            }),
            `${baseSeed}|srs-global`,
          );
    return {
      title: "Momento de repetición espaciada",
      message: srsMessage,
      status: `${pomodoroText} · Due hoy: ${srsDueToday}`,
      actions: [
        { href: "/srs", label: resumeDeckLabel ? `Reanudar deck: ${resumeDeckLabel}` : "Abrir SRS", primary: true },
        active ? { href: `/study/${active.slug}`, label: "Seguir módulo" } : { href: "/day", label: "Ver plan" },
      ],
    };
  }

  if (state.step === "plan_checked" && pomodoroState.phase !== "idle") {
    const preferSrs = srsDueForGuidedSubject >= 10 && todayStats.blocksCompleted >= 1;
    const inProgressMessage = preferSrs
      ? pickVariant(
          [
            `Ya llevas avance en bloques. Puedes hacer un repaso corto de ${active?.name ?? "tu tema"} en SRS y luego volver al módulo.`,
            `Vas bien. Una pasada breve por SRS en ${active?.name ?? "tu enfoque"} te ayudará a fijar antes de continuar.`,
            `Buen ritmo: repaso corto en SRS y regresamos al módulo para cerrar fuerte.`,
          ],
          `${baseSeed}|plan-progress-srs`,
        )
      : pickVariant(
          active
            ? [
                `Buen ritmo. Te conviene continuar ${active.name} hasta cerrar este bloque.`,
                `Mantén el foco en ${active.name}; estás en buen punto para cerrar este tramo.`,
                `Seguimos con ${active.name} un poco más y cerramos bloque con solidez.`,
              ]
            : [
                "Buen ritmo. Mantén el foco en tu módulo activo.",
                "Vas bien, continúa en el módulo actual para aprovechar el impulso.",
                "Mantén el hilo del estudio en tu tema activo antes de cambiar.",
              ],
          `${baseSeed}|plan-progress-focus`,
        );
    return {
      title: preferSrs ? "¿Seguimos tema o repasamos?" : "Seguimos con enfoque profundo",
      message: inProgressMessage,
      status: `${pomodoroText} · Bloques: ${todayStats.blocksCompleted}`,
      actions: preferSrs
        ? [
            { href: "/srs", label: resumeDeckLabel ? `Repasar ${resumeDeckLabel}` : "Repasar flashcards", primary: true },
            resumePdfLabel
              ? { href: "/resources", label: `Retomar PDF (${state.lastPdfPage ?? 1})` }
              : active
                ? { href: `/study/${active.slug}`, label: "Continuar módulo" }
                : { href: "/day", label: "Abrir plan" },
          ]
        : [
            active ? { href: `/study/${active.slug}`, label: "Continuar módulo", primary: true } : { href: "/", label: "Ir a Hoy", primary: true },
            resumeDeckLabel ? { href: "/srs", label: `Deck: ${resumeDeckLabel}` } : { href: "/srs", label: "Abrir SRS" },
          ],
    };
  }

  if (state.step === "study_started") {
    const prePomodoroMessage = pickVariant(
      byPersonality(personality, {
        balanced: active
          ? [
              `Empezaste ${active.name}. Enciende Pomodoro para arrancar con bloque guiado.`,
              `${active.name} ya está en marcha. Activa Pomodoro y entramos en foco.`,
              `Buen inicio con ${active.name}. Dispara Pomodoro para estructurar el bloque.`,
            ]
          : [
              "Inicia Pomodoro para comenzar tu sesión guiada.",
              "Activa Pomodoro y empezamos el bloque con dirección clara.",
              "Vamos a ordenar el foco: enciende Pomodoro para arrancar.",
            ],
        calm: active
          ? [
              `Ya empezaste ${active.name}. Cuando quieras, activamos Pomodoro y seguimos en calma.`,
              `Buen arranque en ${active.name}. Pomodoro te ayudará a sostener el ritmo sin presión.`,
            ]
          : ["Activa Pomodoro y comenzamos con un bloque tranquilo y claro."],
        active: active
          ? [
              `${active.name} ya arrancó. Activa Pomodoro y entramos en modo foco.`,
              `¡Vamos! Enciende Pomodoro para meter bloque sólido en ${active.name}.`,
            ]
          : ["Dispara Pomodoro y arrancamos fuerte."],
      }),
      `${baseSeed}|study-started`,
    );
    return {
      title: "Listo, activemos enfoque",
      message: prePomodoroMessage,
      status: `${pomodoroText} · Preparación`,
      actions: [
        { href: "/#pomodoro", label: "Ir a Pomodoro", primary: true },
        { href: "/day", label: "Ver plan de hoy" },
      ],
    };
  }

  if (state.step === "pomodoro_started") {
    const postPomodoroMessage = pickVariant(
      byPersonality(personality, {
        balanced: active
          ? [
              `Perfecto. Ahora revisa el plan y confirma tu ruta para ${active.name}.`,
              `Bien activado Pomodoro. Pasa por Plan para alinear la sesión de ${active.name}.`,
              `Excelente, ya arrancaste. Verifica el Plan y afinamos ${active.name}.`,
            ]
          : [
              "Perfecto. Ahora revisa el plan de hoy para mantener dirección.",
              "Con Pomodoro activo, abre Plan para no perder el rumbo.",
              "Buen comienzo. Confirma tu ruta en Plan y seguimos.",
            ],
        calm: active
          ? [
              `Muy bien. Revisa Plan y confirmamos una ruta tranquila para ${active.name}.`,
              `Pomodoro activo. Pasa por Plan para ajustar con calma el bloque de ${active.name}.`,
            ]
          : ["Con Pomodoro activo, revisemos Plan con calma para sostener dirección."],
        active: active
          ? [
              `Pomodoro encendido. Vamos a Plan y cerramos ruta para ${active.name}.`,
              `Perfecto, ya estamos en marcha. Revisa Plan y seguimos con ${active.name}.`,
            ]
          : ["Pomodoro activo: abre Plan y vamos al siguiente paso."],
      }),
      `${baseSeed}|pomodoro-started`,
    );
    return {
      title: "Pomodoro en marcha",
      message: postPomodoroMessage,
      status: `${pomodoroText} · Dirección`,
      actions: [
        { href: "/day", label: "Ir al plan", primary: true },
        active ? { href: `/study/${active.slug}`, label: "Abrir módulo" } : { href: "/", label: "Volver a hoy" },
      ],
    };
  }

  if (pathname === "/" && resume) {
    const resumeMessage = pickVariant(
      byPersonality(personality, {
        balanced: [
          `Tu último módulo fue ${resume.name}. Si quieres, seguimos desde ahí.`,
          `Quedaste en ${resume.name}. ¿Retomamos desde ese punto?`,
          `Tu progreso más reciente está en ${resume.name}. Podemos continuar ahora mismo.`,
        ],
        calm: [
          `Tu último avance fue en ${resume.name}. Podemos retomarlo con calma cuando quieras.`,
          `Quedaste en ${resume.name}. Si te parece, volvemos a ese punto sin prisa.`,
        ],
        active: [
          `Tu último módulo fue ${resume.name}. ¿Lo retomamos ya?`,
          `Hay progreso fresco en ${resume.name}. Vamos a continuarlo.`,
        ],
      }),
      `${baseSeed}|resume-home`,
    );
    return {
      title: "¿Retomamos donde quedaste?",
      message: resumeMessage,
      status: `${pomodoroText} · Reanudar`,
      actions: [
        { href: `/study/${resume.slug}`, label: "Retomar módulo", primary: true },
        resumePdfLabel
          ? { href: "/resources", label: `PDF: ${state.lastPdfPage ? `p. ${state.lastPdfPage}` : "reanudar"}` }
          : { href: "/#pomodoro", label: "Preparar Pomodoro" },
      ],
    };
  }

  const fallbackMessage = pickVariant(
    byPersonality(personality, {
      balanced: [
        `Te acompaño en la ruta de hoy: ${primary.name} → ${secondary.name}.`,
        `Estoy contigo para seguir el plan: ${primary.name} primero y ${secondary.name} después.`,
        `Ruta sugerida activa: ${primary.name} y luego ${secondary.name}. Vamos paso a paso.`,
      ],
      calm: [
        `Vamos con calma: ${primary.name} primero y luego ${secondary.name}.`,
        `Te acompaño en una ruta tranquila: ${primary.name} y después ${secondary.name}.`,
      ],
      active: [
        `Ruta activa del día: ${primary.name} y luego ${secondary.name}.`,
        `Vamos con energía: primero ${primary.name}, después ${secondary.name}.`,
      ],
    }),
    `${baseSeed}|fallback`,
  );

  return {
    title: "Conejo guía activo",
    message: fallbackMessage,
    status: `${pomodoroText} · Due hoy: ${srsDueToday}`,
    actions: [
      { href: `/study/${primary.slug}`, label: `Primaria: ${primary.name}`, primary: true },
      { href: `/study/${secondary.slug}`, label: `Secundaria: ${secondary.name}` },
    ],
  };
}

export function RabbitGuidePanel() {
  const pathname = usePathname();
  const [state, setState] = useState<RabbitGuideState>(() => loadRabbitGuideState());
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>(() => loadPomodoroState());
  const [todayStats, setTodayStats] = useState<DailyStats>(() => getTodayStats());
  const [srsDueToday, setSrsDueToday] = useState(0);
  const [srsDueForGuidedSubject, setSrsDueForGuidedSubject] = useState(0);
  const [personality, setPersonality] = useState<RabbitPersonality>(() => loadRabbitPersonality());
  const lastGuideSignatureRef = useRef("");

  useEffect(() => {
    const syncAll = () => {
      const nextGuide = loadRabbitGuideState();
      setState(nextGuide);
      setPomodoroState(loadPomodoroState());
      setTodayStats(getTodayStats());
      setPersonality(loadRabbitPersonality());

      const todayPlan = getPlanForDate(new Date());
      const guidedSubjectSlug = nextGuide.activeSubjectSlug ?? nextGuide.lastStudySubjectSlug ?? todayPlan.primary;
      const srs = loadSrsLibrary();
      setSrsDueToday(algoStats(srs.cards).dueToday);
      setSrsDueForGuidedSubject(algoStats(srs.cards.filter((card) => card.subjectSlug === guidedSubjectSlug)).dueToday);
    };

    syncAll();
    window.addEventListener("storage", syncAll);
    window.addEventListener(RABBIT_GUIDE_UPDATED_EVENT, syncAll);
    window.addEventListener(POMODORO_STATE_UPDATED_EVENT, syncAll);
    window.addEventListener(STATS_UPDATED_EVENT, syncAll);
    window.addEventListener(SRS_UPDATED_EVENT, syncAll);
    window.addEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, syncAll);

    return () => {
      window.removeEventListener("storage", syncAll);
      window.removeEventListener(RABBIT_GUIDE_UPDATED_EVENT, syncAll);
      window.removeEventListener(POMODORO_STATE_UPDATED_EVENT, syncAll);
      window.removeEventListener(STATS_UPDATED_EVENT, syncAll);
      window.removeEventListener(SRS_UPDATED_EVENT, syncAll);
      window.removeEventListener(RABBIT_PERSONALITY_UPDATED_EVENT, syncAll);
    };
  }, []);

  useEffect(() => {
    const subjectSlug = parseStudySubjectFromPath(pathname);
    if (subjectSlug) {
      markStudyVisited(subjectSlug);
      return;
    }
    if (pathname === "/day" && state.step === "pomodoro_started") {
      markPlanChecked();
    }
  }, [pathname, state.step]);

  const guide = useMemo(
    () => buildGuide(state, pathname, pomodoroState, todayStats, srsDueToday, srsDueForGuidedSubject, personality),
    [state, pathname, pomodoroState, todayStats, srsDueToday, srsDueForGuidedSubject, personality],
  );

  useEffect(() => {
    const signature = `${guide.title}|${guide.message}|${guide.status}`;
    if (lastGuideSignatureRef.current === signature) return;
    lastGuideSignatureRef.current = signature;

    const payload: RabbitGuideSpeechPayload = {
      title: guide.title,
      message: guide.message,
      status: guide.status,
      actions: guide.actions,
      durationMs: 5200,
    };

    window.dispatchEvent(new CustomEvent(RABBIT_GUIDE_SPEAK_EVENT, { detail: payload }));
    window.dispatchEvent(new Event(RABBIT_GUIDE_PROMPT_EVENT));
  }, [guide]);

  return null;
}
