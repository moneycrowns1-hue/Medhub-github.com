import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { StartStudyLink } from "@/components/start-study-link";
import { HomeStatsChips } from "@/app/home-stats-chips";
import { HomeNextEvalCard } from "@/app/home-next-eval-card";
import { HomeMotion } from "@/app/home-motion";
import { HomeDisclosuresBlock } from "@/app/home-disclosures-block";
import { isoDate } from "@/lib/dates";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";

export default function Home() {
  const todayIso = isoDate(new Date());
  const plan = getPlanForDate(new Date());
  const summary = formatPlanSummary(plan);

  return (
    <div className="space-y-8">
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
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Agenda</div>
          <h2 className="text-xl font-bold tracking-tight">Próxima evaluación</h2>
        </div>
        <HomeNextEvalCard />
      </section>

      {/* ── SUBSECCIONES COLAPSABLES (dashboard + tablero + atajos) ── */}
      <HomeDisclosuresBlock
        todayIso={todayIso}
        primaryHref={`/study/${plan.primary}`}
        primaryName={summary.primaryName}
        secondaryHref={`/study/${plan.secondary}`}
        secondaryName={summary.secondaryName}
        reading={summary.reading}
        isRestDay={summary.isRestDay}
      />
    </div>
  );
}
