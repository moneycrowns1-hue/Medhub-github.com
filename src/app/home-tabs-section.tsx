"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  Settings,
  Wrench,
  Zap,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClinicalBoard } from "@/components/clinical-board";
import { PomodoroControls } from "@/components/pomodoro-controls";
import {
  HomeKpisContent,
  HomeModulesContent,
  useHomeTodayData,
  type ModulesProps,
} from "@/app/home-today-dashboard";

type HomeTab = "resumen" | "herramientas" | "atajos";

const TAB_LABELS: Record<HomeTab, string> = {
  resumen: "Resumen",
  herramientas: "Herramientas",
  atajos: "Atajos",
};

const STORAGE_KEY = "somagnus:home:active-tab:v1";

type Props = ModulesProps & { todayIso: string };

export function HomeTabsSection({ todayIso, ...modules }: Props) {
  const data = useHomeTodayData();
  const titleRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<HomeTab>("resumen");

  // Restore persisted tab once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "resumen" || raw === "herramientas" || raw === "atajos") {
        setActiveTab(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  // Animate the big centered title on tab change (same easing as SRS/Academico).
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 8, opacity: 0, letterSpacing: "0.1em" },
      { y: 0, opacity: 1, letterSpacing: "0em", duration: 0.45, ease: "power3.out" },
    );
  }, [activeTab]);

  // Keyboard shortcut: 1/2/3 (when not typing) switches tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") setActiveTab("resumen");
      else if (e.key === "2") setActiveTab("herramientas");
      else if (e.key === "3") setActiveTab("atajos");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as HomeTab)}
      className="w-full space-y-6"
    >
      {/* Topbar: context + icon-only actions · big animated title · tabs */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Vista</div>
              <div className="inline-flex h-9 items-center rounded-xl bg-white/[0.06] px-3 text-sm font-medium text-white/85">
                Hoy
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Progreso</div>
              <div className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm text-white/80">
                <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="h-full rounded-full bg-emerald-400/75 transition-all duration-500"
                    style={{ width: `${data.routine.pct}%` }}
                  />
                </span>
                <span className="tabular-nums">{data.routine.pct}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/day"
              title="Abrir plan del día"
              aria-label="Abrir plan del día"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CalendarDays className="h-4 w-4" />
            </Link>
            <Link
              href="/settings"
              title="Ajustes"
              aria-label="Ajustes"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid items-center gap-4 lg:grid-cols-[1fr,auto,1fr]">
          <div className="hidden lg:block" />
          <div
            ref={titleRef}
            className="hidden min-w-0 truncate text-center text-3xl font-bold tracking-tight text-white/90 lg:block xl:text-4xl"
          >
            {TAB_LABELS[activeTab]}
          </div>
          <div className="flex justify-start lg:justify-end">
            <TabsList className="bg-white/5 backdrop-blur-sm">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
              <TabsTrigger value="atajos">Atajos</TabsTrigger>
            </TabsList>
          </div>
        </div>
      </div>

      {/* ── Resumen: KPIs + Módulos del día ── */}
      <TabsContent value="resumen" className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Indicadores</div>
              <div className="text-sm font-semibold text-white/90">Tu día en números</div>
            </div>
          </div>
          <HomeKpisContent data={data} />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Módulos</div>
              <div className="text-sm font-semibold text-white/90">Estudio del día</div>
            </div>
          </div>
          <HomeModulesContent {...modules} />
        </section>
      </TabsContent>

      {/* ── Herramientas: Tablero + Pomodoro ── */}
      <TabsContent value="herramientas" className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
            <Wrench className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Ahora</div>
            <div className="text-sm font-semibold text-white/90">Tablero & Pomodoro</div>
          </div>
        </div>
        <div id="pomodoro" className="grid gap-6 lg:grid-cols-[1fr,340px]">
          <div className="space-y-6">
            <ClinicalBoard date={todayIso} />
          </div>
          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <PomodoroControls />
          </div>
        </div>
      </TabsContent>

      {/* ── Atajos ── */}
      <TabsContent value="atajos" className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
            <LayoutGrid className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Navegación</div>
            <div className="text-sm font-semibold text-white/90">Acceso rápido</div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Brain className="h-4 w-4" />, label: "Empezar SRS", href: "/srs", tone: "bg-violet-500/10 text-violet-300" },
            { icon: <BookOpen className="h-4 w-4" />, label: "Recursos PDF", href: "/biblioteca", tone: "bg-cyan-500/10 text-cyan-300" },
            { icon: <CalendarDays className="h-4 w-4" />, label: "Plan semanal", href: "/day", tone: "bg-emerald-500/10 text-emerald-300" },
            { icon: <ClipboardList className="h-4 w-4" />, label: "Académico", href: "/academico", tone: "bg-amber-500/10 text-amber-300" },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              data-home-quick
              className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-sm font-medium text-white/90 transition-all hover:bg-white/[0.07]"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${q.tone} transition-transform group-hover:scale-[1.05]`}>
                {q.icon}
              </div>
              {q.label}
            </Link>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
