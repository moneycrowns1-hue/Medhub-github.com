"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Layers,
  MoonStar,
  Target,
  Timer,
} from "lucide-react";

import { getCheckedSteps, routineProgress } from "@/lib/day-checklist";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import { algoStats } from "@/lib/srs-algo";
import { getTodayStats, STATS_UPDATED_EVENT } from "@/lib/stats-store";
import {
  CLINICAL_TASKS_UPDATED_EVENT,
  getTasksForDate,
} from "@/lib/clinical-store";
import { isoDate } from "@/lib/dates";

type Props = {
  primaryHref: string;
  primaryName: string;
  secondaryHref: string;
  secondaryName: string;
  reading: string;
  isRestDay: boolean;
};

type WidgetColor = "blue" | "purple" | "emerald" | "amber" | "rose" | "cyan" | "fuchsia" | "neutral";

const COLOR_STYLES: Record<WidgetColor, { bg: string; icon: string; accent: string }> = {
  blue: { bg: "bg-blue-400/10", icon: "bg-blue-400/20 text-blue-100", accent: "text-blue-200" },
  purple: { bg: "bg-violet-400/10", icon: "bg-violet-400/20 text-violet-100", accent: "text-violet-200" },
  emerald: { bg: "bg-emerald-400/10", icon: "bg-emerald-400/20 text-emerald-100", accent: "text-emerald-200" },
  amber: { bg: "bg-amber-400/10", icon: "bg-amber-400/20 text-amber-100", accent: "text-amber-200" },
  rose: { bg: "bg-rose-400/10", icon: "bg-rose-400/20 text-rose-100", accent: "text-rose-200" },
  cyan: { bg: "bg-cyan-400/10", icon: "bg-cyan-400/20 text-cyan-100", accent: "text-cyan-200" },
  fuchsia: { bg: "bg-fuchsia-400/10", icon: "bg-fuchsia-400/20 text-fuchsia-100", accent: "text-fuchsia-200" },
  neutral: { bg: "bg-white/[0.04]", icon: "bg-white/[0.1] text-white", accent: "text-white/85" },
};

function Widget({
  href,
  icon,
  label,
  value,
  hint,
  color = "neutral",
  children,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
  hint?: string;
  color?: WidgetColor;
  children?: React.ReactNode;
  external?: boolean;
}) {
  const styles = COLOR_STYLES[color];
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.icon}`}>
          {icon}
        </div>
        <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white/90" />
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-white/55">{label}</div>
        {value ? (
          <div className="truncate text-lg font-bold leading-tight tracking-tight text-white">{value}</div>
        ) : null}
        {hint ? <div className="truncate text-[11px] text-white/55">{hint}</div> : null}
        {children}
      </div>
    </>
  );

  const className = `group relative flex flex-col overflow-hidden rounded-xl ${styles.bg} p-4 transition-colors hover:bg-white/[0.08]`;

  if (external) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function HomeTodayDashboard({
  primaryHref,
  primaryName,
  secondaryHref,
  secondaryName,
  reading,
  isRestDay,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    const refresh = () => setTick((t) => t + 1);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("storage", refresh);
    window.addEventListener(STATS_UPDATED_EVENT, refresh);
    window.addEventListener(SRS_UPDATED_EVENT, refresh);
    window.addEventListener(CLINICAL_TASKS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STATS_UPDATED_EVENT, refresh);
      window.removeEventListener(SRS_UPDATED_EVENT, refresh);
      window.removeEventListener(CLINICAL_TASKS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const data = useMemo(() => {
    if (!mounted) {
      return {
        routine: { pct: 0, done: 0, total: 0 },
        srsDue: 0,
        focusMinutes: 0,
        blocksCompleted: 0,
        clinicalToday: 0,
      };
    }
    void tick;
    const routine = routineProgress(getCheckedSteps());
    const srsDue = algoStats(loadSrsLibrary().cards).dueToday;
    const stats = getTodayStats();
    const clinicalToday = getTasksForDate(isoDate(new Date())).filter((t) => t.status === "TODAY").length;
    return {
      routine,
      srsDue,
      focusMinutes: stats.focusMinutes,
      blocksCompleted: stats.blocksCompleted,
      clinicalToday,
    };
  }, [mounted, tick]);

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <div className="text-xs font-medium uppercase tracking-widest text-white/70">Resumen</div>
        <h2 className="text-xl font-bold tracking-tight text-white">Hoy, de un vistazo</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Plan del día */}
        <Widget
          href="/day"
          icon={<CalendarDays className="h-5 w-5" />}
          label="Plan del día"
          value={`${data.routine.pct}%`}
          color="emerald"
        >
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-emerald-300/70 transition-all duration-500"
              style={{ width: `${data.routine.pct}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-white/55">
            {data.routine.done}/{data.routine.total} pasos
          </div>
        </Widget>

        {/* SRS */}
        <Widget
          href="/srs"
          icon={<Brain className="h-5 w-5" />}
          label="SRS · Due hoy"
          value={`${data.srsDue}`}
          hint={data.srsDue === 0 ? "Al día" : "tarjetas pendientes"}
          color="blue"
        />

        {/* Foco hoy */}
        <Widget
          href="/stats"
          icon={<Timer className="h-5 w-5" />}
          label="Foco hoy"
          value={`${data.focusMinutes}m`}
          hint={`${data.blocksCompleted} bloques completados`}
          color="amber"
        />

        {/* Tablero clínico */}
        <Widget
          href="#pomodoro"
          icon={<ClipboardList className="h-5 w-5" />}
          label="Tablero · Hoy"
          value={`${data.clinicalToday}`}
          hint={data.clinicalToday === 1 ? "tarea activa" : "tareas activas"}
          color="rose"
          external
        />

        {/* Materia principal */}
        {!isRestDay ? (
          <Widget
            href={primaryHref}
            icon={<GraduationCap className="h-5 w-5" />}
            label="Principal"
            value={primaryName}
            hint="Módulo del día"
            color="purple"
          />
        ) : null}

        {/* Materia secundaria */}
        {!isRestDay ? (
          <Widget
            href={secondaryHref}
            icon={<Layers className="h-5 w-5" />}
            label="Secundaria"
            value={secondaryName}
            hint="Módulo complementario"
            color="fuchsia"
          />
        ) : null}

        {/* Lectura */}
        <Widget
          href="/biblioteca"
          icon={<BookOpen className="h-5 w-5" />}
          label="Lectura"
          value={reading}
          hint="20–40 min enfocados"
          color="cyan"
        />

        {/* Space */}
        <Widget
          href="/space"
          icon={<MoonStar className="h-5 w-5" />}
          label="Space"
          value="Pausa activa"
          hint="Respirar · enfocar · descargar"
          color="neutral"
        />

        {/* Agenda (atajo a académico) */}
        {isRestDay ? (
          <Widget
            href="/academico"
            icon={<Target className="h-5 w-5" />}
            label="Agenda"
            value="Evaluaciones"
            hint="Gestioná exámenes y entregas"
            color="neutral"
          />
        ) : null}
      </div>
    </section>
  );
}
