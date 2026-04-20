import { HomeNextEvalCard } from "@/app/home-next-eval-card";
import { HomeMotion } from "@/app/home-motion";
import { HomeHero } from "@/app/home-hero";
import { HomeTabsSection } from "@/app/home-tabs-section";
import { isoDate } from "@/lib/dates";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";

export default function Home() {
  const todayIso = isoDate(new Date());
  const plan = getPlanForDate(new Date());
  const summary = formatPlanSummary(plan);

  return (
    <div className="space-y-8">
      <HomeMotion />

      {/* ── HERO compacto: saludo + día + CTAs directos ── */}
      <HomeHero
        dayLabel={summary.dayLabel}
        focusNote={summary.focusNote}
        isRestDay={summary.isRestDay}
        primaryName={summary.primaryName}
        primarySlug={plan.primary}
        secondaryName={summary.secondaryName}
        reading={summary.reading}
      />

      {/* ── PRÓXIMA EVALUACIÓN (compacta, inline) ── */}
      <HomeNextEvalCard />

      {/* ── Tabs principales (Resumen · Herramientas · Atajos) ── */}
      <div id="hoy-tabs" className="scroll-mt-24" />
      <HomeTabsSection
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
