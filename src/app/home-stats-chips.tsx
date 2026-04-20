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
      icon: <Flame className="h-3.5 w-3.5" />,
      label: "Racha",
      value: `${streak}${streak === 1 ? "d" : "d"}`,
      tone: "text-orange-200",
    },
    {
      icon: <Timer className="h-3.5 w-3.5" />,
      label: "Bloques",
      value: `${today.blocksCompleted}/${plannedBlocks}`,
      tone: "text-emerald-200",
    },
    {
      icon: <Brain className="h-3.5 w-3.5" />,
      label: "SRS",
      value: `${srsDue}`,
      tone: "text-violet-200",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((s) => (
        <div
          key={s.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm"
        >
          <span className={s.tone}>{s.icon}</span>
          <span className="text-white/60">{s.label}</span>
          <span className="tabular-nums text-white">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
