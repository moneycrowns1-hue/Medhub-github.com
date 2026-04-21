import { HomeMotion } from "@/app/home-motion";
import { HomeTabsSection } from "@/app/home-tabs-section";
import { isoDate } from "@/lib/dates";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";

export default function Home() {
  const todayIso = isoDate(new Date());
  const plan = getPlanForDate(new Date());
  const summary = formatPlanSummary(plan);

  return (
    <div className="space-y-6">
      <HomeMotion />

      <HomeTabsSection
        todayIso={todayIso}
        initialPlan={plan}
        dayLabel={summary.dayLabel}
        focusNote={summary.focusNote}
        primarySlug={plan.primary}
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
