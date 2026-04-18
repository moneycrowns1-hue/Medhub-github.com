"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Props = {
  deckName: string;
  deckDescription?: string;
  stats: {
    total: number;
    dueToday: number;
    newCount: number;
    learning: number;
    mastery: number;
  };
  session: {
    total: number;
    done: number;
    again: number;
    hard: number;
    good: number;
    easy: number;
  } | null;
};

/**
 * Unified HUD for the Estudiar tab. Replaces the two side-by-side deck/
 * session panels with a single focused strip. Mastery bar and progress bar
 * are animated via GSAP so they feel alive as values change.
 */
export function SessionHud({ deckName, deckDescription, stats, session }: Props) {
  const masteryBarRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const lastMastery = useRef(stats.mastery);
  const lastProgress = useRef(0);

  useEffect(() => {
    const el = masteryBarRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { width: `${clamp(lastMastery.current)}%` },
      {
        width: `${clamp(stats.mastery)}%`,
        duration: 0.6,
        ease: "power3.out",
      },
    );
    lastMastery.current = stats.mastery;
  }, [stats.mastery]);

  const progressPct = session && session.total > 0
    ? Math.round((session.done / session.total) * 100)
    : 0;

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { width: `${clamp(lastProgress.current)}%` },
      { width: `${clamp(progressPct)}%`, duration: 0.4, ease: "power2.out" },
    );
    lastProgress.current = progressPct;
  }, [progressPct]);

  return (
    <div className="grid gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm lg:grid-cols-[1fr,auto]">
      {/* Deck meta + mastery */}
      <div className="space-y-3 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/60">Deck</div>
            <div className="truncate text-base font-semibold text-white">{deckName}</div>
            {deckDescription ? (
              <div className="truncate text-xs text-white/55">{deckDescription}</div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/60">Mastery</div>
            <div className="text-2xl font-bold tabular-nums text-white">{stats.mastery}%</div>
          </div>
        </div>

        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            ref={masteryBarRef}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400"
            style={{ width: `${clamp(stats.mastery)}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <StatChip label="Total" value={stats.total} />
          <StatChip label="Due" value={stats.dueToday} accent="amber" />
          <StatChip label="New" value={stats.newCount} accent="cyan" />
          <StatChip label="Learning" value={stats.learning} accent="violet" />
        </div>
      </div>

      {/* Session progress (only while active) */}
      {session && session.total > 0 ? (
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3 lg:min-w-[240px]">
          <div className="flex items-baseline justify-between">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/60">Sesión</div>
            <div className="tabular-nums text-xs text-white/80">
              {Math.min(session.done, session.total)}/{session.total}
            </div>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              ref={progressBarRef}
              className="absolute inset-y-0 left-0 rounded-full bg-white"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <TinyCount label="Again" value={session.again} color="text-rose-300" />
            <TinyCount label="Hard" value={session.hard} color="text-amber-300" />
            <TinyCount label="Good" value={session.good} color="text-sky-300" />
            <TinyCount label="Easy" value={session.easy} color="text-emerald-300" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clamp(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber" | "cyan" | "violet";
}) {
  const palette =
    accent === "amber"
      ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
      : accent === "cyan"
        ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
        : accent === "violet"
          ? "border-violet-300/30 bg-violet-400/10 text-violet-100"
          : "border-white/15 bg-white/10 text-white/85";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${palette}`}>
      <span className="text-white/60">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function TinyCount({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-center">
      <div className={`text-[9px] font-medium uppercase tracking-widest ${color}`}>{label}</div>
      <div className="tabular-nums text-white">{value}</div>
    </div>
  );
}
