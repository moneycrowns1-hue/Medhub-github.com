"use client";

import Link from "next/link";
import {
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  Settings,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";

import { ClinicalBoard } from "@/components/clinical-board";
import { PomodoroControls } from "@/components/pomodoro-controls";
import { HomeDisclosure } from "@/app/home-disclosure";
import {
  HomeKpisContent,
  HomeKpisPreview,
  HomeModulesContent,
  HomeModulesPreview,
  useHomeTodayData,
  type ModulesProps,
} from "@/app/home-today-dashboard";

type Props = ModulesProps & { todayIso: string };

export function HomeDisclosuresBlock({ todayIso, ...modules }: Props) {
  const data = useHomeTodayData();

  return (
    <div className="space-y-3">
      {/* Indicadores (KPIs) */}
      <HomeDisclosure
        storageKey="indicators"
        eyebrow="Resumen"
        title="Indicadores de hoy"
        icon={<Sparkles className="h-5 w-5" />}
        iconAccent="bg-emerald-500/10 text-emerald-300"
        defaultOpen
        preview={<HomeKpisPreview data={data} />}
      >
        <HomeKpisContent data={data} />
      </HomeDisclosure>

      {/* Módulos del día */}
      <HomeDisclosure
        storageKey="modules"
        eyebrow="Módulos"
        title="Estudio del día"
        icon={<Zap className="h-5 w-5" />}
        iconAccent="bg-amber-500/10 text-amber-300"
        preview={<HomeModulesPreview {...modules} />}
      >
        <HomeModulesContent {...modules} />
      </HomeDisclosure>

      {/* Tablero + Pomodoro */}
      <HomeDisclosure
        storageKey="board"
        eyebrow="Ahora"
        title="Tablero & Pomodoro"
        icon={<ClipboardList className="h-5 w-5" />}
        iconAccent="bg-rose-500/10 text-rose-300"
        preview={
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/15 px-2 py-0.5 text-[11px] font-medium text-rose-200">
            <Timer className="h-3 w-3" />
            Foco + tareas
          </span>
        }
      >
        <div id="pomodoro" className="grid gap-6 lg:grid-cols-[1fr,340px]">
          <div className="space-y-6">
            <ClinicalBoard date={todayIso} />
          </div>
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <PomodoroControls />
          </div>
        </div>
      </HomeDisclosure>

      {/* Acceso rápido */}
      <HomeDisclosure
        storageKey="quick"
        eyebrow="Atajos"
        title="Acceso rápido"
        icon={<LayoutGrid className="h-5 w-5" />}
        iconAccent="bg-blue-500/10 text-blue-300"
        preview={
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/80">
            4 atajos
          </span>
        }
      >
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
              className="group flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/90 transition-all hover:bg-white/[0.07]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-white/85 transition-colors group-hover:bg-white/[0.12] group-hover:text-white">
                {q.icon}
              </div>
              {q.label}
            </Link>
          ))}
        </div>
      </HomeDisclosure>
    </div>
  );
}
