"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Megaphone,
  Mic,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getAllDailyStats,
  getCalendarData,
  getCurrentStreak,
  getLast30Days,
  getWeeklyAverage,
  STATS_UPDATED_EVENT,
} from "@/lib/stats-store";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import { algoStats } from "@/lib/srs-algo";
import { listPdfResources, RESOURCES_UPDATED_EVENT } from "@/lib/resources-service";
import { getFlashcardsArtifactsStats, RESOURCES_AI_ARTIFACTS_UPDATED_EVENT } from "@/lib/resources-ai-artifacts-store";
import { isoDate, parseIsoDateLocal } from "@/lib/dates";

type TrackSlug = "ingles" | "trabajo-online";

/* ─── Mini SVG chart components ─── */

function AreaChart({ data, height = 120, color = "var(--color-primary)" }: { data: number[]; height?: number; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const h = height;
  const points = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * w,
    y: h - (v / max) * (h * 0.85) - h * 0.05,
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={`areaGrad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#areaGrad-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="2.5" fill={color} />
      )}
    </svg>
  );
}

function BarChartSimple({ data, height = 100 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${Math.max((d.value / max) * 100, 4)}%`,
              background: d.color,
            }}
          />
          <div className="text-[9px] text-muted-foreground">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function ActivityCalendar({ year, month }: { year: number; month: number }) {
  const calendar = useMemo(() => getCalendarData(year, month), [year, month]);
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleDateString("es", { month: "long" });

  const LEVEL_COLORS = [
    "bg-muted/30",
    "bg-primary/20",
    "bg-primary/40",
    "bg-primary/60",
    "bg-primary",
  ];

  const blanks = Array.from({ length: firstDay }, (_, i) => (
    <div key={`blank-${i}`} className="h-7 w-7" />
  ));

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold capitalize">{monthName} {year}</div>
      <div className="grid grid-cols-7 gap-1">
        {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
          <div key={i} className="flex h-7 w-7 items-center justify-center text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {blanks}
        {calendar.map((day) => {
          const dayNum = parseInt(day.date.split("-")[2], 10);
          const today = isoDate(new Date()) === day.date;
          return (
            <div
              key={day.date}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-medium transition-colors ${LEVEL_COLORS[day.level]} ${today ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              title={`${day.date}: nivel ${day.level}`}
            >
              {dayNum}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        {LEVEL_COLORS.map((c, i) => (
          <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

/* ─── Main Stats Client ─── */

export function StatsClient() {
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [pdfCount, setPdfCount] = useState(0);
  const [trackPdfCounts, setTrackPdfCounts] = useState<Record<TrackSlug, number>>({
    ingles: 0,
    "trabajo-online": 0,
  });
  const [aiArtifactCount, setAiArtifactCount] = useState(0);
  const [aiArtifactCardsCount, setAiArtifactCardsCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      try {
        const all = await listPdfResources();
        setPdfCount(all.length);
        setTrackPdfCounts({
          ingles: all.filter((r) => r.subjectSlug === "ingles").length,
          "trabajo-online": all.filter((r) => r.subjectSlug === "trabajo-online").length,
        });
      } catch {
        setPdfCount(0);
        setTrackPdfCounts({ ingles: 0, "trabajo-online": 0 });
      }
      const artifactsStats = getFlashcardsArtifactsStats();
      setAiArtifactCount(artifactsStats.totalArtifacts);
      setAiArtifactCardsCount(artifactsStats.totalCards);
      setTick((t) => t + 1);
    };

    void refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener(STATS_UPDATED_EVENT, refresh);
    window.addEventListener(SRS_UPDATED_EVENT, refresh);
    window.addEventListener(RESOURCES_UPDATED_EVENT, refresh);
    window.addEventListener(RESOURCES_AI_ARTIFACTS_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(STATS_UPDATED_EVENT, refresh);
      window.removeEventListener(SRS_UPDATED_EVENT, refresh);
      window.removeEventListener(RESOURCES_UPDATED_EVENT, refresh);
      window.removeEventListener(RESOURCES_AI_ARTIFACTS_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const last30 = useMemo(() => {
    void tick;
    return getLast30Days();
  }, [tick]);
  const allDays = useMemo(() => {
    void tick;
    return getAllDailyStats();
  }, [tick]);
  const streak = useMemo(() => {
    void tick;
    return getCurrentStreak();
  }, [tick]);
  const weeklyAvg = useMemo(() => {
    void tick;
    return getWeeklyAverage();
  }, [tick]);

  const srsLib = useMemo(() => {
    if (typeof window === "undefined") return null;
    void tick;
    return loadSrsLibrary();
  }, [tick]);

  const srsStats = useMemo(() => {
    if (!srsLib) return { total: 0, dueToday: 0, learning: 0, newCount: 0 };
    return algoStats(srsLib.cards);
  }, [srsLib]);

  const trackStats = useMemo(() => {
    if (!srsLib) {
      return {
        ingles: { decks: 0, cards: 0, dueToday: 0 },
        "trabajo-online": { decks: 0, cards: 0, dueToday: 0 },
      };
    }

    const englishCards = srsLib.cards.filter((c) => c.subjectSlug === "ingles");
    const onlineWorkCards = srsLib.cards.filter((c) => c.subjectSlug === "trabajo-online");

    return {
      ingles: {
        decks: srsLib.decks.filter((d) => d.subjectSlug === "ingles").length,
        cards: englishCards.length,
        dueToday: algoStats(englishCards).dueToday,
      },
      "trabajo-online": {
        decks: srsLib.decks.filter((d) => d.subjectSlug === "trabajo-online").length,
        cards: onlineWorkCards.length,
        dueToday: algoStats(onlineWorkCards).dueToday,
      },
    };
  }, [srsLib]);

  const totalFocusAll = allDays.reduce((s, d) => s + d.focusMinutes, 0);
  const totalSrsAll = allDays.reduce((s, d) => s + d.srsReviewed, 0);
  const totalCorrect = allDays.reduce((s, d) => s + d.srsCorrect, 0);
  const accuracy = totalSrsAll > 0 ? Math.round((totalCorrect / totalSrsAll) * 100) : 0;
  const daysStudied = allDays.filter((d) => d.focusMinutes > 0 || d.srsReviewed > 0).length;
  const routineDays = allDays.filter((d) => d.routineCompleted).length;

  const routineStreak = (() => {
    let n = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = isoDate(d);
      const day = allDays.find((x) => x.date === key);
      if (day?.routineCompleted) {
        n++;
      } else if (i > 0) {
        break;
      }
    }
    return n;
  })();

  const focusData = last30.map((d) => d.focusMinutes);
  const srsData = last30.map((d) => d.srsReviewed);

  const weekDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const last7 = last30.slice(-7);
  const todayKey = isoDate(new Date());
  const todayStats = allDays.find((d) => d.date === todayKey);
  const todayFocus = todayStats?.focusMinutes ?? 0;
  const todayReviews = todayStats?.srsReviewed ?? 0;
  const weekBarData = last7.map((d, i) => {
    const dayOfWeek = parseIsoDateLocal(d.date).getDay();
    return {
      label: weekDays[dayOfWeek] ?? "",
      value: d.focusMinutes + d.srsReviewed * 2,
      color: `oklch(0.7 0.15 ${264 + i * 10})`,
    };
  });
  const routineBarData = last7.map((d) => {
    const dayOfWeek = parseIsoDateLocal(d.date).getDay();
    return {
      label: weekDays[dayOfWeek] ?? "",
      value: d.routineCompleted ? 1 : 0,
      color: d.routineCompleted
        ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.65) 100%)"
        : "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)",
    };
  });
  const routineWeeklyCompleted = routineBarData.filter((d) => d.value > 0).length;

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Analíticas</div>
            <h1 className="text-3xl font-bold tracking-tight">Estadísticas</h1>
            <p className="text-sm text-foreground/70">
              Vista integrada del progreso para estudiar con foco y menos ruido.
            </p>
          </div>

          <div className="grid min-w-[250px] grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground/60">Hoy · foco</div>
              <div className="text-base font-semibold tabular-nums">{todayFocus}m</div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground/60">Hoy · SRS</div>
              <div className="text-base font-semibold tabular-nums">{todayReviews}</div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground/60">Rutina semana</div>
              <div className="text-base font-semibold tabular-nums">{routineWeeklyCompleted}/7</div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/8 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-foreground/60">Precisión</div>
              <div className="text-base font-semibold tabular-nums">{accuracy}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: <Flame className="h-5 w-5" />,
            label: "Racha actual",
            value: `${streak} ${streak === 1 ? "día" : "días"}`,
            iconBg: "bg-orange-500/10 text-orange-400",
          },
          {
            icon: <Timer className="h-5 w-5" />,
            label: "Enfoque total",
            value: totalFocusAll > 60 ? `${Math.round(totalFocusAll / 60)}h ${totalFocusAll % 60}m` : `${totalFocusAll}m`,
            iconBg: "bg-blue-500/10 text-blue-400",
          },
          {
            icon: <Brain className="h-5 w-5" />,
            label: "Tarjetas revisadas",
            value: totalSrsAll.toLocaleString(),
            iconBg: "bg-violet-500/10 text-violet-400",
          },
          {
            icon: <Target className="h-5 w-5" />,
            label: "Precisión SRS",
            value: `${accuracy}%`,
            iconBg: "bg-emerald-500/10 text-emerald-400",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="space-y-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                {kpi.icon}
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">{kpi.label}</div>
                <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Focus Chart */}
        <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-widest text-primary">Enfoque</div>
              <div className="text-lg font-bold">Minutos de estudio</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-foreground/60">Promedio semanal</div>
              <div className="text-lg font-bold tabular-nums text-primary">{weeklyAvg.focusMin}m</div>
            </div>
          </div>
          <div className="mt-4">
            <AreaChart data={focusData} height={130} color="oklch(0.7 0.15 264)" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-foreground/60">
            <span>Hace 30 días</span>
            <span>Hoy</span>
          </div>
        </div>

        {/* SRS Chart */}
        <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-widest text-primary">SRS</div>
              <div className="text-lg font-bold">Tarjetas por día</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-foreground/60">Promedio semanal</div>
              <div className="text-lg font-bold tabular-nums text-violet-400">{weeklyAvg.srsCards}</div>
            </div>
          </div>
          <div className="mt-4">
            <AreaChart data={srsData} height={130} color="oklch(0.7 0.15 295)" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-foreground/60">
            <span>Hace 30 días</span>
            <span>Hoy</span>
          </div>
        </div>
      </div>

      {/* Week Bar + Library Stats */}
      <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
        {/* Weekly Activity */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-widest text-primary">Actividad</div>
            <div className="text-lg font-bold">Últimos 7 días</div>
            <div className="mt-4">
              <BarChartSimple data={weekBarData} height={120} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Rutina</div>
                <div className="text-lg font-bold">Cumplimiento semanal</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-foreground/60">Completadas</div>
                <div className="text-lg font-bold tabular-nums">{routineBarData.filter((d) => d.value > 0).length}/7</div>
              </div>
            </div>
            <div className="mt-4">
              <BarChartSimple data={routineBarData} height={92} />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">Días estudiados</div>
                <div className="text-xl font-bold tabular-nums">{daysStudied}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">Tarjetas pendientes hoy</div>
                <div className="text-xl font-bold tabular-nums text-blue-400">{srsStats.dueToday}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">PDFs en biblioteca</div>
                <div className="text-xl font-bold tabular-nums text-emerald-400">{pdfCount}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/70">Rutina</div>
                <div className="text-sm text-foreground/80">Completadas: <span className="font-semibold tabular-nums">{routineDays}</span></div>
                <div className="text-sm text-foreground/80">Racha: <span className="font-semibold tabular-nums">{routineStreak} {routineStreak === 1 ? "día" : "días"}</span></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/65">Artifacts IA cacheados</div>
                <div className="text-sm text-foreground/80">
                  <span className="font-semibold tabular-nums text-fuchsia-300">{aiArtifactCount}</span> corridas · {" "}
                  <span className="font-semibold tabular-nums text-fuchsia-200">{aiArtifactCardsCount}</span> tarjetas
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Calendario</div>
          <h2 className="text-xl font-bold tracking-tight">Mapa de actividad</h2>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold capitalize">
                {new Date(calYear, calMonth).toLocaleDateString("es", { month: "long", year: "numeric" })}
              </span>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex justify-center">
            <ActivityCalendar year={calYear} month={calMonth} />
          </div>
        </div>
      </section>

      {/* SRS Breakdown */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">SRS</div>
          <h2 className="text-xl font-bold tracking-tight">Estado de flashcards</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total", value: srsStats.total, color: "text-foreground", bg: "bg-muted/30" },
            { label: "Nuevas", value: srsStats.newCount, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Aprendiendo", value: srsStats.learning, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Due hoy", value: srsStats.dueToday, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/20 bg-white/5 p-5 text-center backdrop-blur-xl">
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${s.bg}`}>
                <span className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</span>
              </div>
              <div className="mt-2 text-xs font-medium uppercase tracking-wider text-foreground/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-primary">Tracks</div>
          <h2 className="text-xl font-bold tracking-tight">Inglés y Trabajo Online</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-300">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Inglés</div>
                <div className="text-xs text-foreground/65">Shadowing y speaking</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground/60">Decks</div>
                <div className="text-lg font-bold tabular-nums">{trackStats.ingles.decks}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground/60">Cards</div>
                <div className="text-lg font-bold tabular-nums">{trackStats.ingles.cards}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground/60">PDFs</div>
                <div className="text-lg font-bold tabular-nums">{trackPdfCounts.ingles}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-foreground/70">Due hoy: <span className="font-semibold tabular-nums">{trackStats.ingles.dueToday}</span></div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Trabajo Online</div>
                <div className="text-xs text-foreground/65">Publicación y monetización</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground/60">Decks</div>
                <div className="text-lg font-bold tabular-nums">{trackStats["trabajo-online"].decks}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground/60">Cards</div>
                <div className="text-lg font-bold tabular-nums">{trackStats["trabajo-online"].cards}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <div className="text-[10px] uppercase tracking-wider text-foreground/60">PDFs</div>
                <div className="text-lg font-bold tabular-nums">{trackPdfCounts["trabajo-online"]}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-foreground/70">Due hoy: <span className="font-semibold tabular-nums">{trackStats["trabajo-online"].dueToday}</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}
