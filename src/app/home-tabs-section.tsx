"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flame,
  GraduationCap,
  LayoutGrid,
  MoonStar,
  Settings,
  Sparkles,
  Sun,
  Sunrise,
  Timer,
  Zap,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClinicalBoard } from "@/components/clinical-board";
import { PomodoroControls } from "@/components/pomodoro-controls";
import { StartStudyLink } from "@/components/start-study-link";
import {
  HomeKpisContent,
  HomeModulesContent,
  useHomeTodayData,
  type ModulesProps,
} from "@/app/home-today-dashboard";
import { HomeNextEvalPopover } from "@/app/home-next-eval-card";
import { getCurrentStreak, getTodayStats, STATS_UPDATED_EVENT } from "@/lib/stats-store";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import { algoStats } from "@/lib/srs-algo";
import {
  ACADEMIC_UPDATED_EVENT,
  listUpcomingEvaluations,
  type UpcomingEvaluation,
} from "@/lib/academic-store";
import type { SubjectSlug } from "@/lib/subjects";

type HomeTab = "inicio" | "resumen" | "herramientas" | "atajos";

const TAB_LABELS: Record<HomeTab, string> = {
  inicio: "Inicio",
  resumen: "Resumen",
  herramientas: "Herramientas",
  atajos: "Atajos",
};

const STORAGE_KEY = "somagnus:home:active-tab:v1";

type Props = ModulesProps & {
  todayIso: string;
  dayLabel: string;
  focusNote?: string;
  primarySlug: SubjectSlug;
};

export function HomeTabsSection({
  todayIso,
  dayLabel,
  focusNote,
  primarySlug,
  ...modules
}: Props) {
  const data = useHomeTodayData();
  const titleRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<HomeTab>("inicio");

  // Restore persisted tab once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "inicio" || raw === "resumen" || raw === "herramientas" || raw === "atajos") {
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

  // Keyboard shortcut: 1/2/3/4 (when not typing) switches tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "1") setActiveTab("inicio");
      else if (e.key === "2") setActiveTab("resumen");
      else if (e.key === "3") setActiveTab("herramientas");
      else if (e.key === "4") setActiveTab("atajos");
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
      <div className="space-y-3 pt-6 md:pt-10">
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
            <HomeNextEvalPopover />
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
              <TabsTrigger value="inicio">Inicio</TabsTrigger>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="herramientas">Herramientas</TabsTrigger>
              <TabsTrigger value="atajos">Atajos</TabsTrigger>
            </TabsList>
          </div>
        </div>
      </div>

      {/* ── Inicio: saludo + CTAs + stats ── */}
      <TabsContent value="inicio" className="focus-visible:outline-none">
        <InicioPanel
          dayLabel={dayLabel}
          focusNote={focusNote}
          isRestDay={modules.isRestDay}
          primaryName={modules.primaryName}
          primarySlug={primarySlug}
          secondaryName={modules.secondaryName}
          reading={modules.reading}
          onGoResumen={() => setActiveTab("resumen")}
        />
      </TabsContent>

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

/* ──────────────────────────── Inicio panel ──────────────────────────── */

type InicioPanelProps = {
  dayLabel: string;
  focusNote?: string;
  isRestDay: boolean;
  primaryName: string;
  primarySlug: SubjectSlug;
  secondaryName: string;
  reading: string;
  onGoResumen: () => void;
};

function getGreeting(hour: number): { label: string; icon: React.ReactNode } {
  if (hour >= 5 && hour < 12) return { label: "Buenos días", icon: <Sunrise className="h-3.5 w-3.5" /> };
  if (hour >= 12 && hour < 19) return { label: "Buenas tardes", icon: <Sun className="h-3.5 w-3.5" /> };
  return { label: "Buenas noches", icon: <MoonStar className="h-3.5 w-3.5" /> };
}

function InicioPanel({
  dayLabel,
  focusNote,
  isRestDay,
  primaryName,
  primarySlug,
  secondaryName,
  reading,
  onGoResumen,
}: InicioPanelProps) {
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const statsRef = useRef<HTMLDivElement | null>(null);
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  useEffect(() => {
    const h = headlineRef.current;
    const s = statsRef.current;
    const tl = gsap.timeline();
    if (h) tl.fromTo(h, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" });
    if (s)
      tl.fromTo(
        s.querySelectorAll("[data-inicio-stat]"),
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.08 },
        "-=0.25",
      );
    return () => {
      tl.kill();
    };
  }, []);

  const greeting = useMemo(() => (hour == null ? null : getGreeting(hour)), [hour]);

  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-black px-6 py-10 md:px-14 md:py-14">
      {/* Soft ambient glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(120,119,198,0.06),transparent_60%)]" />

      <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-2">
      <div className="flex w-full flex-col items-center gap-7 text-center md:items-start md:text-left">
        {/* Greeting + day pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {greeting ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
              {greeting.icon}
              <span>{greeting.label}</span>
            </div>
          ) : null}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{dayLabel}</span>
          </div>
        </div>

        {/* Headline */}
        <h1
          ref={headlineRef}
          className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-[60px]"
        >
          {isRestDay ? (
            <>
              Hoy es{" "}
              <span className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
                descanso
              </span>
              .
            </>
          ) : (
            <>
              Hoy toca{" "}
              <span className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
                {primaryName}
              </span>
              .
            </>
          )}
        </h1>

        {/* Description */}
        <p className="max-w-[620px] text-[15px] leading-relaxed text-white/70 md:text-base">
          {isRestDay ? (
            <>
              Recupera energía y prepará el próximo bloque. Lectura ligera sugerida:{" "}
              <strong className="text-white/90">{reading}</strong>.
            </>
          ) : (
            <>
              Módulo secundario: <strong className="text-white/90">{secondaryName}</strong>. Lectura:{" "}
              <strong className="text-white/90">{reading}</strong>.
            </>
          )}
        </p>
        {focusNote ? <p className="max-w-[620px] text-[13px] text-white/50">{focusNote}</p> : null}

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          {!isRestDay ? (
            <StartStudyLink
              href={`/study/${primarySlug}`}
              subjectSlug={primarySlug}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_8px_30px_-10px_rgba(255,255,255,0.5)] transition-all hover:bg-white/90"
            >
              <GraduationCap className="h-4 w-4" />
              Empezar estudio
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </StartStudyLink>
          ) : null}
          <Link
            href="/day"
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/[0.14]"
          >
            <CalendarDays className="h-4 w-4" />
            Ver plan completo
          </Link>
          <button
            type="button"
            onClick={onGoResumen}
            className="group inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/85 transition-all hover:bg-white/[0.1] hover:text-white"
          >
            Resumen de hoy
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Right column: mini calendar + stats under it */}
      <div className="flex w-full flex-col gap-3">
        <MiniCalendar />
        <div ref={statsRef}>
          <InicioStatsRow />
        </div>
      </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Stats row (redesigned) ──────────────────────────── */

function InicioStatsRow() {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mountId = window.setTimeout(() => setMounted(true), 0);
    const refresh = () => setTick((t) => t + 1);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("storage", refresh);
    window.addEventListener(STATS_UPDATED_EVENT, refresh);
    window.addEventListener(SRS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(mountId);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STATS_UPDATED_EVENT, refresh);
      window.removeEventListener(SRS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const today = useMemo(() => {
    if (!mounted) return { blocksCompleted: 0 };
    void tick;
    return getTodayStats();
  }, [tick, mounted]);

  const streak = useMemo(() => {
    if (!mounted) return 0;
    void tick;
    return getCurrentStreak();
  }, [tick, mounted]);

  const srsDue = useMemo(() => {
    if (!mounted) return 0;
    void tick;
    return algoStats(loadSrsLibrary().cards).dueToday;
  }, [tick, mounted]);

  const plannedBlocks = 3;
  const blocksPct = Math.min(100, Math.round((today.blocksCompleted / plannedBlocks) * 100));

  const items: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
    tone: string;
    bar?: number;
    barTone?: string;
  }> = [
    {
      key: "streak",
      icon: <Flame className="h-5 w-5" />,
      label: "Racha",
      value: `${streak}`,
      sub: streak === 1 ? "día consecutivo" : "días consecutivos",
      tone: "bg-orange-500/10 text-orange-300",
    },
    {
      key: "blocks",
      icon: <Timer className="h-5 w-5" />,
      label: "Bloques",
      value: `${today.blocksCompleted}/${plannedBlocks}`,
      sub: "foco hoy",
      tone: "bg-emerald-500/10 text-emerald-300",
      bar: blocksPct,
      barTone: "bg-emerald-400/70",
    },
    {
      key: "srs",
      icon: <Brain className="h-5 w-5" />,
      label: "SRS",
      value: `${srsDue}`,
      sub: srsDue === 0 ? "al día" : "tarjetas pendientes",
      tone: "bg-violet-500/10 text-violet-300",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => (
        <div
          key={it.key}
          data-inicio-stat
          className="group relative overflow-hidden rounded-xl bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]"
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${it.tone}`}>
              {it.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-medium uppercase tracking-widest text-white/50">
                {it.label}
              </div>
              <div className="text-base font-bold leading-tight tabular-nums text-white">
                {it.value}
              </div>
            </div>
          </div>
          <div className="mt-1.5 truncate text-[10px] text-white/50">{it.sub}</div>
          {typeof it.bar === "number" ? (
            <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${it.barTone ?? "bg-white/50"} transition-all duration-500`}
                style={{ width: `${it.bar}%` }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────── Mini calendar (month view + eval dots) ──────────────────────────── */

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"]; // Monday-first

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MiniCalendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [evals, setEvals] = useState<UpcomingEvaluation[]>([]);
  const [mounted, setMounted] = useState(false);

  // Subscribe to academic updates to refresh dots.
  useEffect(() => {
    setMounted(true);
    const refresh = () => {
      setEvals(listUpcomingEvaluations({ horizonDays: 120 }));
    };
    refresh();
    window.addEventListener(ACADEMIC_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(ACADEMIC_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const { cells, evalMap } = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const cells: Array<{ day: number; inMonth: boolean; date: Date }> = [];
    // Leading prev-month days
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevDays - i);
      cells.push({ day: d.getDate(), inMonth: false, date: d });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
    }
    // Trailing next-month to fill 6 rows (42 cells)
    while (cells.length < 42) {
      const nextIdx = cells.length - (startWeekday + daysInMonth);
      const d = new Date(year, month + 1, nextIdx + 1);
      cells.push({ day: d.getDate(), inMonth: false, date: d });
    }

    const evalMap = new Map<string, number>();
    for (const e of evals) {
      const k = e.record.date;
      evalMap.set(k, (evalMap.get(k) ?? 0) + 1);
    }

    return { cells, evalMap };
  }, [cursor, evals]);

  const todayKey = ymd(today);
  const monthLabel = `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const prev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const next = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const todayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [],
  );
  const todayLabel = mounted ? todayFmt.format(today) : "";

  return (
    <div className="rounded-xl bg-white/[0.04] p-3">
      {/* Today + month nav in a single compact row */}
      <div className="flex items-center gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium capitalize text-white/85">{todayLabel}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prev}
            aria-label="Mes anterior"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-6 items-center rounded-md bg-white/[0.06] px-1.5 text-[10px] font-semibold capitalize text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white"
            title="Ir al mes actual"
          >
            {monthLabel}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Mes siguiente"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium uppercase tracking-wider text-white/40">
        {WEEK_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
        {cells.map((c, idx) => {
          const key = ymd(c.date);
          const isToday = key === todayKey;
          const count = evalMap.get(key) ?? 0;
          return (
            <div
              key={`${key}-${idx}`}
              className={`relative flex h-7 items-center justify-center rounded-md text-[11px] transition-colors ${
                isToday
                  ? "bg-white font-semibold text-black"
                  : c.inMonth
                    ? "text-white/85 hover:bg-white/[0.05]"
                    : "text-white/20"
              }`}
              title={count > 0 ? `${count} evaluación${count === 1 ? "" : "es"}` : undefined}
            >
              <span>{c.day}</span>
              {count > 0 ? (
                <span
                  className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                    isToday ? "bg-black/60" : "bg-violet-400"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
