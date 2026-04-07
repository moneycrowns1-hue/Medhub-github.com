"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Flame, Timer } from "lucide-react";

import { getCurrentStreak, getTodayStats, STATS_UPDATED_EVENT } from "@/lib/stats-store";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import { algoStats } from "@/lib/srs-algo";

export function HomeStatsChips({ plannedBlocks = 3 }: { plannedBlocks?: number }) {
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
    const lib = loadSrsLibrary();
    return algoStats(lib.cards).dueToday;
  }, [tick, mounted]);

  const chips = [
    {
      icon: <Flame className="h-4 w-4" />,
      label: "Racha",
      value: `${streak} ${streak === 1 ? "día" : "días"}`,
      accent: "from-white/20 via-white/5 to-transparent",
    },
    {
      icon: <Timer className="h-4 w-4" />,
      label: "Bloques",
      value: `${today.blocksCompleted} / ${plannedBlocks}`,
      accent: "from-white/20 via-white/5 to-transparent",
    },
    {
      icon: <Brain className="h-4 w-4" />,
      label: "SRS pendientes",
      value: `${srsDue}`,
      accent: "from-white/20 via-white/5 to-transparent",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {chips.map((s) => (
        <div
          key={s.label}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-white/8 px-5 py-4 text-white backdrop-blur-xl"
        >
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.accent}`} />
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
            {s.icon}
          </div>
          <div className="relative">
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">{s.label}</div>
            <div className="text-xl font-semibold tabular-nums text-white">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
