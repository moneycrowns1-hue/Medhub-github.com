"use client";

import { useMemo } from "react";
import { Flame, Sparkles, Star, Trophy } from "lucide-react";

import {
  BADGE_CATALOG,
  loadGamificationState,
  loadWeeklyGoals,
  type BadgeDefinition,
  type BadgeId,
} from "@/lib/academic-gamification-store";

type Props = {
  refreshKey: number;
};

export function GamificationPanel({ refreshKey }: Props) {
  const state = useMemo(() => {
    void refreshKey;
    return loadGamificationState();
  }, [refreshKey]);

  const weekly = useMemo(() => {
    void refreshKey;
    return loadWeeklyGoals();
  }, [refreshKey]);

  const unlockedBadges: BadgeDefinition[] = state.unlockedBadges
    .map((id) => BADGE_CATALOG[id])
    .filter(Boolean);
  const lockedBadges: BadgeDefinition[] = Object.values(BADGE_CATALOG).filter(
    (badge) => !state.unlockedBadges.includes(badge.id as BadgeId),
  );

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-200" />
          <div>
            <div className="text-xs uppercase tracking-wider text-white/65">Progreso académico</div>
            <div className="text-sm font-semibold text-white">
              {state.points} pts · Racha {state.currentStreakDays}d · Mejor {state.bestStreakDays}d
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/75">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5">
            <Star className="h-3 w-3" />
            {unlockedBadges.length}/{Object.keys(BADGE_CATALOG).length}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/15 px-2 py-0.5">
            <Flame className="h-3 w-3" />
            {state.currentStreakDays}d
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/60">Objetivos de la semana</div>
          <ul className="mt-2 space-y-2">
            {weekly.goals.map((goal) => {
              const percent = Math.min(100, Math.round((goal.progress / Math.max(goal.target, 1)) * 100));
              return (
                <li
                  key={goal.id}
                  className={`rounded-xl px-3 py-2 text-xs ${goal.completed ? "bg-emerald-400/10 text-emerald-100" : "bg-white/[0.06] text-white/85"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{goal.label}</span>
                    <span className="text-[11px] opacity-80">{goal.progress}/{goal.target}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full ${goal.completed ? "bg-emerald-300" : "bg-cyan-300"}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/60">Logros</div>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {unlockedBadges.map((badge) => (
              <li
                key={badge.id}
                className="rounded-xl bg-amber-400/15 px-2.5 py-2 text-[11px] text-amber-100"
                title={badge.description}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3 w-3" />
                  {badge.label}
                </div>
                <div className="mt-0.5 opacity-80">{badge.description}</div>
              </li>
            ))}
            {lockedBadges.slice(0, Math.max(0, 4 - unlockedBadges.length)).map((badge) => (
              <li
                key={badge.id}
                className="rounded-xl bg-white/[0.04] px-2.5 py-2 text-[11px] text-white/55"
                title={badge.description}
              >
                <div className="font-semibold">{badge.label}</div>
                <div className="mt-0.5 opacity-80">{badge.description}</div>
              </li>
            ))}
          </ul>
          {!unlockedBadges.length ? (
            <div className="mt-2 text-[11px] text-white/55">
              Registra un ítem o aprueba una evaluación para empezar a desbloquear logros.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
