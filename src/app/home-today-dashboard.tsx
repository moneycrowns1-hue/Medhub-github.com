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

type Props = {
  primaryHref: string;
  primaryName: string;
  secondaryHref: string;
  secondaryName: string;
  reading: string;
  isRestDay: boolean;
};

type KpiItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  href: string;
  iconBg: string;
  /** Optional custom bottom content (progress bar). */
  footer?: React.ReactNode;
};

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

  const kpis: KpiItem[] = [
    {
      icon: <CalendarDays className="h-5 w-5" />,
      label: "Plan del día",
      value: `${data.routine.pct}%`,
      hint: `${data.routine.done}/${data.routine.total} pasos`,
      href: "/day",
      iconBg: "bg-emerald-500/10 text-emerald-400",
      footer: (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-400/70 transition-all duration-500"
            style={{ width: `${data.routine.pct}%` }}
          />
        </div>
      ),
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

  const modules: KpiItem[] = isRestDay
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
    <div className="space-y-6">
      {/* Indicadores de hoy (KPIs) */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Resumen</div>
          <h2 className="text-xl font-bold tracking-tight">Indicadores de hoy</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      </section>

      {/* Módulos del día */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Módulos</div>
          <h2 className="text-xl font-bold tracking-tight">Estudio del día</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((kpi) => (
            <KpiCard key={kpi.label} kpi={kpi} />
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ kpi }: { kpi: KpiItem }) {
  const isAnchor = kpi.href.startsWith("#");
  const className =
    "group relative block rounded-2xl bg-white/[0.04] p-5 backdrop-blur-xl transition-colors hover:bg-white/[0.07]";
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg}`}>
          {kpi.icon}
        </div>
        <ArrowRight className="h-4 w-4 text-foreground/35 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/80" />
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">
          {kpi.label}
        </div>
        <div className="truncate text-2xl font-bold tabular-nums leading-tight">{kpi.value}</div>
        {kpi.hint ? <div className="truncate text-xs text-foreground/60">{kpi.hint}</div> : null}
      </div>
      {kpi.footer}
    </>
  );

  if (isAnchor) {
    return (
      <a href={kpi.href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={kpi.href} className={className}>
      {content}
    </Link>
  );
}
