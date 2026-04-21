"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Dumbbell,
  GraduationCap,
  Layers,
  Moon,
  Pause,
  Play,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  getCheckedSteps,
  isRoutineComplete,
  routineProgress,
  ROUTINE_STEPS,
  toggleStep,
} from "@/lib/day-checklist";
import { isoDate } from "@/lib/dates";
import type { DayPlan } from "@/lib/schedule";
import { formatPlanSummary } from "@/lib/schedule";
import { useTodayPlan } from "@/lib/use-today-plan";
import { updateTodayStats } from "@/lib/stats-store";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";
import { RABBIT_GUIDE_SPEAK_EVENT, type RabbitGuideSpeechPayload } from "@/lib/rabbit-guide";

const STEP_ICONS: Record<string, React.ReactNode> = {
  srs: <Brain className="h-4 w-4" />,
  focus1: <Play className="h-4 w-4" />,
  break1: <Pause className="h-4 w-4" />,
  focus2: <Play className="h-4 w-4" />,
  break2: <Pause className="h-4 w-4" />,
  focus3: <Play className="h-4 w-4" />,
  exercise: <Dumbbell className="h-4 w-4" />,
  reading: <BookOpen className="h-4 w-4" />,
  "wind-down": <Moon className="h-4 w-4" />,
};

async function fireConfetti() {
  // Lazy-load canvas-confetti only when the user actually completes the routine,
  // so the ~30 kB lib isn't in the initial /day bundle.
  const { default: confetti } = await import("canvas-confetti");
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  const end = Date.now() + 2500;

  const frame = () => {
    if (Date.now() > end) return;
    confetti({
      ...defaults,
      particleCount: 3,
      origin: { x: Math.random(), y: Math.random() * 0.4 },
    });
    requestAnimationFrame(frame);
  };

  // Initial burst
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.6 } });
  confetti({ ...defaults, particleCount: 40, origin: { x: 0.3, y: 0.5 } });
  confetti({ ...defaults, particleCount: 40, origin: { x: 0.7, y: 0.5 } });
  requestAnimationFrame(frame);
}

type Props = {
  plan: DayPlan;
};

export function DayClient({ plan: initialPlan }: Props) {
  // Use client-local time so the rotation flips exactly at the user's midnight.
  const plan = useTodayPlan(initialPlan);
  const summary = formatPlanSummary(plan);
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    return getCheckedSteps();
  });
  const [celebrated, setCelebrated] = useState(false);
  const [activeDayKey, setActiveDayKey] = useState(() => isoDate(new Date()));

  const speakRabbit = useCallback((title: string, message: string) => {
    const payload: RabbitGuideSpeechPayload = {
      title,
      message,
      status: "Plan del día · Rutina",
      actions: [{ href: "/day", label: "Ver checklist", primary: true }],
      durationMs: 5400,
    };
    window.dispatchEvent(new CustomEvent(RABBIT_GUIDE_SPEAK_EVENT, { detail: payload }));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const key = isoDate(new Date());
      if (key !== activeDayKey) {
        setActiveDayKey(key);
        setChecked(getCheckedSteps());
        setCelebrated(false);
      }
    }, 30_000);

    return () => window.clearInterval(id);
  }, [activeDayKey]);

  const handleToggle = useCallback(
    (stepId: string) => {
      const next = toggleStep(stepId);
      setChecked(new Set(next));
      const nextAllDone = isRoutineComplete(next);

      if (nextAllDone && !celebrated) {
        setCelebrated(true);
        fireConfetti();
        speakRabbit("¡Día completado!", "Completaste toda la rutina de hoy. ¡Excelente disciplina!");
      } else if (!nextAllDone && celebrated) {
        setCelebrated(false);
      }
    },
    [celebrated, speakRabbit],
  );

  const progress = routineProgress(checked);
  const allDone = isRoutineComplete(checked);

  useEffect(() => {
    updateTodayStats({ routineCompleted: allDone });
  }, [allDone]);

  const primaryDef = SUBJECTS[plan.primary as SubjectSlug];
  const secondaryDef = SUBJECTS[plan.secondary as SubjectSlug];

  return (
    <div className="space-y-8">
      {/* Day label chip */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-white">
          <Sparkles className="h-3.5 w-3.5" />
          {summary.dayLabel}
        </div>
        {summary.focusNote ? (
          <span className="text-xs text-foreground/60">{summary.focusNote}</span>
        ) : null}
      </div>

      {/* Materias */}
      <section className="space-y-3 -mt-4">
        <div className="space-y-0.5">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">
            Materias
          </div>
          <h2 className="text-xl font-bold tracking-tight">Estudio programado</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!summary.isRestDay ? (
            <>
              <Link
                href={`/study/${plan.primary}`}
                className="group flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-6 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.1] text-white">
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                    Principal
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="text-2xl font-bold leading-tight tracking-tight">{summary.primaryName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Sparkles className="h-3.5 w-3.5" />
                    {primaryDef?.uiMode === "redirect" ? "App externa" : "Módulo interactivo"}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className="text-xs font-medium text-white/80">Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>

              <Link
                href={`/study/${plan.secondary}`}
                className="group flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-6 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.07]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.1] text-white">
                    <Layers className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                    Secundaria
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="text-2xl font-bold leading-tight tracking-tight">{summary.secondaryName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Layers className="h-3.5 w-3.5" />
                    {secondaryDef?.uiMode === "redirect" ? "App externa" : "Módulo interactivo"}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className="text-xs font-medium text-white/80">Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>
            </>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-6 backdrop-blur-xl sm:col-span-2">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.1] text-white">
                  <Moon className="h-7 w-7" />
                </div>
                <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                  Descanso
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="text-2xl font-bold leading-tight tracking-tight">Domingo: descanso</div>
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  Sin cátedras hoy · Recuperación física y mental
                </div>
              </div>
            </div>
          )}

          {/* Lectura */}
          <Link
            href="/biblioteca"
            className="group flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-6 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.07]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.1] text-white">
                <BookOpen className="h-7 w-7" />
              </div>
              <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                Lectura
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="text-2xl font-bold leading-tight tracking-tight">{summary.reading}</div>
              <div className="flex items-center gap-1.5 text-xs text-white/60">
                <BookOpen className="h-3.5 w-3.5" />
                Ver en Biblioteca
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-xs font-medium text-white/80">Abrir libros</span>
              <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-1 group-hover:text-white" />
            </div>
          </Link>
        </div>
      </section>

      {/* Rutina checklist */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">
              Rutina
            </div>
            <h2 className="text-xl font-bold tracking-tight">Flujo del día</h2>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{progress.pct}%</div>
            <div className="text-[10px] text-muted-foreground">
              {progress.done}/{progress.total} completados
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-white via-white/85 to-white/65 transition-all duration-500"
            style={{ width: `${progress.pct}%` }}
          />
        </div>

        {/* Completion banner */}
        {allDone && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-4 backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.1] text-white/90">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                ¡Día completado!
              </div>
              <div className="text-xs text-foreground/70">
                Completaste toda la rutina. ¡Excelente disciplina!
              </div>
            </div>
          </div>
        )}

        {/* Checklist items */}
        <div className="overflow-hidden rounded-2xl bg-white/[0.04] backdrop-blur-xl">
          {ROUTINE_STEPS.map((step, i) => {
            const done = checked.has(step.id);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleToggle(step.id)}
                className={`flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-white/[0.07] ${
                  i > 0 ? "border-t border-white/[0.06]" : ""
                } ${done ? "opacity-60" : ""}`}
              >
                {/* Toggle icon */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                    done
                      ? "bg-white text-black"
                      : "bg-white/[0.08] text-white/40"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </div>

                {/* Icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    done
                      ? "bg-white/[0.15] text-white"
                      : "bg-white/[0.06] text-foreground/65"
                  }`}
                >
                  {STEP_ICONS[step.id] ?? (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>

                {/* Label */}
                <div className="flex-1">
                  <div className={`text-sm font-medium transition-all ${done ? "line-through text-foreground/50" : ""}`}>
                    {step.label}
                  </div>
                </div>

                {/* Time */}
                {step.time ? (
                  <div className="text-xs tabular-nums text-foreground/60">
                    {step.time}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

      </section>
    </div>
  );
}
