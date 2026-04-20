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
import { PreviewPill } from "@/app/home-disclosure";

export type TodaySnapshot = {
  routine: { pct: number; done: number; total: number };
  srsDue: number;
  focusMinutes: number;
  blocksCompleted: number;
  clinicalToday: number;
};

const EMPTY: TodaySnapshot = {
  routine: { pct: 0, done: 0, total: 0 },
  srsDue: 0,
  focusMinutes: 0,
  blocksCompleted: 0,
  clinicalToday: 0,
};

export function useHomeTodayData(): TodaySnapshot {
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

  return useMemo(() => {
    if (!mounted) return EMPTY;
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
}

/* ─────────────────────────────────────── Indicadores (KPIs) ─────────────────────────────────────── */

export function HomeKpisPreview({ data }: { data: TodaySnapshot }) {
  return (
    <>
      <PreviewPill
        icon={<CalendarDays className="h-3 w-3" />}
        value={`${data.routine.pct}%`}
        tone="emerald"
      />
      <PreviewPill
        icon={<Brain className="h-3 w-3" />}
        value={`${data.srsDue} due`}
        tone={data.srsDue > 0 ? "violet" : "neutral"}
      />
      <PreviewPill
        icon={<Timer className="h-3 w-3" />}
        value={`${data.focusMinutes}m`}
        tone="blue"
      />
      <PreviewPill
        icon={<ClipboardList className="h-3 w-3" />}
        value={`${data.clinicalToday}`}
        tone={data.clinicalToday > 0 ? "rose" : "neutral"}
      />
    </>
  );
}

export function HomeKpisContent({ data }: { data: TodaySnapshot }) {
  const kpis = [
    {
      icon: <CalendarDays className="h-5 w-5" />,
      label: "Plan del día",
      value: `${data.routine.pct}%`,
      hint: `${data.routine.done}/${data.routine.total} pasos`,
      href: "/day",
      iconBg: "bg-emerald-500/10 text-emerald-400",
      progress: data.routine.pct,
    },
    {
      icon: <Brain className="h-5 w-5" />,
      label: "SRS · Due hoy",
      value: `${data.srsDue}`,
      hint: data.srsDue === 0 ? "Al día" : "tarjetas pendientes",
      href: "/srs",
      iconBg: "bg-violet-500/10 text-violet-400",
    },
    {
      icon: <Timer className="h-5 w-5" />,
      label: "Foco hoy",
      value: `${data.focusMinutes}m`,
      hint: `${data.blocksCompleted} bloques completados`,
      href: "/stats",
      iconBg: "bg-blue-500/10 text-blue-400",
    },
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: "Tablero · Hoy",
      value: `${data.clinicalToday}`,
      hint: data.clinicalToday === 1 ? "tarea activa" : "tareas activas",
      href: "#pomodoro",
      iconBg: "bg-rose-500/10 text-rose-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────── Módulos del día ─────────────────────────────────────── */

export type ModulesProps = {
  primaryHref: string;
  primaryName: string;
  secondaryHref: string;
  secondaryName: string;
  reading: string;
  isRestDay: boolean;
};

export function HomeModulesPreview({ primaryName, reading, isRestDay }: ModulesProps) {
  if (isRestDay) {
    return (
      <>
        <PreviewPill value="Descanso" tone="neutral" />
        <PreviewPill icon={<BookOpen className="h-3 w-3" />} value={reading} tone="blue" />
      </>
    );
  }
  return (
    <>
      <PreviewPill icon={<GraduationCap className="h-3 w-3" />} value={primaryName} tone="amber" />
      <PreviewPill icon={<BookOpen className="h-3 w-3" />} value={reading} tone="blue" />
    </>
  );
}

export function HomeModulesContent({
  primaryHref,
  primaryName,
  secondaryHref,
  secondaryName,
  reading,
  isRestDay,
}: ModulesProps) {
  const modules = isRestDay
    ? [
        {
          icon: <BookOpen className="h-5 w-5" />,
          label: "Lectura",
          value: reading,
          hint: "20–40 min enfocados",
          href: "/biblioteca",
          iconBg: "bg-cyan-500/10 text-cyan-400",
        },
        {
          icon: <MoonStar className="h-5 w-5" />,
          label: "Space",
          value: "Pausa activa",
          hint: "Respirar · enfocar · descargar",
          href: "/space",
          iconBg: "bg-amber-500/10 text-amber-400",
        },
      ]
    : [
        {
          icon: <GraduationCap className="h-5 w-5" />,
          label: "Principal",
          value: primaryName,
          hint: "Módulo del día",
          href: primaryHref,
          iconBg: "bg-amber-500/10 text-amber-400",
        },
        {
          icon: <Layers className="h-5 w-5" />,
          label: "Secundaria",
          value: secondaryName,
          hint: "Módulo complementario",
          href: secondaryHref,
          iconBg: "bg-fuchsia-500/10 text-fuchsia-400",
        },
        {
          icon: <BookOpen className="h-5 w-5" />,
          label: "Lectura",
          value: reading,
          hint: "20–40 min enfocados",
          href: "/biblioteca",
          iconBg: "bg-cyan-500/10 text-cyan-400",
        },
        {
          icon: <MoonStar className="h-5 w-5" />,
          label: "Space",
          value: "Pausa activa",
          hint: "Respirar · enfocar · descargar",
          href: "/space",
          iconBg: "bg-white/[0.08] text-white/90",
        },
      ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {modules.map((m) => (
        <KpiCard key={m.label} {...m} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────── KpiCard (shared) ─────────────────────────────────────── */

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  href: string;
  iconBg: string;
  progress?: number;
};

function KpiCard({ icon, label, value, hint, href, iconBg, progress }: KpiCardProps) {
  const isAnchor = href.startsWith("#");
  const className =
    "group relative block overflow-hidden rounded-2xl bg-white/[0.03] p-5 transition-all hover:bg-white/[0.06]";
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
        <ArrowRight className="h-4 w-4 text-foreground/35 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/80" />
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">
          {label}
        </div>
        <div className="truncate text-2xl font-bold tabular-nums leading-tight">{value}</div>
        {hint ? <div className="truncate text-xs text-foreground/60">{hint}</div> : null}
      </div>
      {typeof progress === "number" ? (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-400/70 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </>
  );
  if (isAnchor) {
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
