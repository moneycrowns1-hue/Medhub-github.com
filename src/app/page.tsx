import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  GraduationCap,
  Layers,
  Settings,
  Sparkles,
} from "lucide-react";

import { ClinicalBoard } from "@/components/clinical-board";
import { PomodoroControls } from "@/components/pomodoro-controls";
import { StartStudyLink } from "@/components/start-study-link";
import { HomeStatsChips } from "@/app/home-stats-chips";
import { HomeNextEvalCard } from "@/app/home-next-eval-card";
import { HomeMotion } from "@/app/home-motion";
import { isoDate } from "@/lib/dates";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";

export default function Home() {
  const todayIso = isoDate(new Date());
  const plan = getPlanForDate(new Date());
  const summary = formatPlanSummary(plan);

  return (
    <div className="space-y-12">
      <HomeMotion />
      {/* ── HERO full-screen video (no inner container) ── */}
      <section className="font-general-sans relative -mx-6 -mt-8 min-h-screen overflow-hidden bg-black text-white">
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="pointer-events-none absolute inset-0 bg-black/50" />

        <div className="relative z-10 flex min-h-screen flex-col px-6 py-5 md:px-[120px] md:py-[20px]">
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center pt-[200px] pb-[102px] text-center md:pt-[280px]">
            <div className="flex flex-col items-center gap-10">
              <div className="inline-flex items-center gap-2 rounded-[20px] border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-medium">
                <Sparkles className="h-3.5 w-3.5 text-white/90" />
                <span className="text-white/80">{summary.dayLabel}</span>
              </div>

              <div className="space-y-6">
                <h1 className="mx-auto max-w-[613px] text-4xl font-medium leading-[1.28] md:text-[56px]">
                  <span className="bg-[linear-gradient(144.5deg,rgba(255,255,255,1)_28%,rgba(0,0,0,0)_115%)] bg-clip-text text-transparent">
                    Domina tu día con estrategia
                  </span>
                </h1>

                <p className="mx-auto max-w-[680px] text-[15px] font-normal text-white/70">
                  {summary.isRestDay
                    ? "Hoy es descanso. Recupera energía y prepárate para el próximo bloque."
                    : (
                      <>
                        Tu materia principal hoy es <strong className="text-white">{summary.primaryName}</strong>. Enfoque
                        profundo, repetición espaciada y lectura activa.
                      </>
                    )}
                </p>
                {summary.focusNote ? <p className="mx-auto max-w-[680px] text-[13px] text-white/60">{summary.focusNote}</p> : null}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {!summary.isRestDay ? (
                  <StartStudyLink
                    href={`/study/${plan.primary}`}
                    subjectSlug={plan.primary}
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_8px_30px_-10px_rgba(255,255,255,0.8)] transition-all hover:bg-white/90"
                  >
                    Empezar estudio
                    <ArrowRight className="h-4 w-4" />
                  </StartStudyLink>
                ) : null}
                <Link
                  href="/day"
                  className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/15 hover:shadow-[0_10px_28px_-16px_rgba(255,255,255,0.8)]"
                >
                  Ver plan completo
                </Link>
              </div>

              <HomeStatsChips plannedBlocks={3} />
            </div>
          </div>
        </div>
      </section>

      {/* ── PRÓXIMA EVALUACIÓN + QUIZ RÁPIDO ── */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-white/70">Agenda</div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Próxima evaluación</h2>
          <p className="text-sm text-muted-foreground">
            Lo que se viene y una vía rápida para auto-evaluarte.
          </p>
        </div>
        <HomeNextEvalCard />
      </section>

      {/* ── MÓDULOS DEL DÍA ── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-white/70">Módulos</div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Estudio del día</h2>
          <p className="text-sm text-muted-foreground">
            Las materias programadas y tus herramientas de productividad.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <GraduationCap className="h-7 w-7" />,
              title: summary.primaryName,
              desc: "Materia principal del día",
              badge: "Principal",
              href: `/study/${plan.primary}`,
            },
            {
              icon: <Layers className="h-7 w-7" />,
              title: summary.secondaryName,
              desc: "Materia complementaria",
              badge: "Secundaria",
              href: `/study/${plan.secondary}`,
            },
            {
              icon: <Brain className="h-7 w-7" />,
              title: "Repetición espaciada",
              desc: "Flashcards y cloze del día",
              badge: "SRS",
              href: "/srs",
            },
          ]
            .filter((mod) => (summary.isRestDay ? mod.badge === "SRS" : true))
            .map((mod) => (
            <Link
              key={mod.title}
              href={mod.href}
              data-home-module
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white/[0.04] p-6 text-white backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.1] text-white">
                  {mod.icon}
                </div>
                <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                  {mod.badge}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="text-2xl font-bold leading-tight tracking-tight text-white">{mod.title}</div>
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <Sparkles className="h-3.5 w-3.5" />
                  {mod.desc}
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="text-xs font-medium text-white/80">Abrir</span>
                <ArrowRight className="h-4 w-4 text-white/70 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </div>
            </Link>
            ))}
        </div>
      </section>

      {/* ── TABLERO + POMODORO ── */}
      <section id="pomodoro" className="grid gap-6 lg:grid-cols-[1fr,340px]">
        <div className="space-y-6">
          <ClinicalBoard date={todayIso} />

          {/* ── LECTURA ── */}
          <div className="rounded-2xl bg-white/[0.04] p-6 text-white backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.1] text-white">
                <BookOpen className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-white/60">Lectura del día</div>
                <div className="text-2xl font-bold leading-tight tracking-tight text-white">{summary.reading}</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-white/70">
              20–40 min de lectura enfocada. Sin multitarea. Subrayá y generá flashcards después.
            </div>
            <Link
              href="/biblioteca"
              className="group mt-4 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-white/85"
            >
              Ir a Biblioteca <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PomodoroControls />
        </div>
      </section>

      {/* ── ACCESO RÁPIDO ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Acceso rápido</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Brain className="h-4 w-4" />, label: "Empezar SRS", href: "/srs" },
            { icon: <BookOpen className="h-4 w-4" />, label: "Recursos PDF", href: "/biblioteca" },
            { icon: <CalendarDays className="h-4 w-4" />, label: "Plan semanal", href: "/day" },
            { icon: <Settings className="h-4 w-4" />, label: "Ajustes", href: "/settings" },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              data-home-quick
              className="group flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/90 backdrop-blur-xl transition-all hover:bg-white/[0.07]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-white/85 transition-colors group-hover:bg-white/[0.12] group-hover:text-white">{q.icon}</div>
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
