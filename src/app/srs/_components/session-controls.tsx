"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Play, Settings, Sparkles, Target, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SrsDailyLimits } from "@/lib/srs-algo";

export type QueueMode = "anki" | "due" | "all" | "today";
export type StudyMode = "anki" | "confidence";

type Props = {
  queueMode: QueueMode;
  onQueueModeChange: (m: QueueMode) => void;
  studyMode: StudyMode;
  onStudyModeChange: (m: StudyMode) => void;
  onStart: () => void;
  onExit: () => void;
  canStart: boolean;
  sessionActive: boolean;
  dailyLimits: SrsDailyLimits;
  onDailyLimitsChange: (patch: Partial<SrsDailyLimits>) => void;
};

const QUEUE_MODES: { value: QueueMode; label: string; hint: string; icon: typeof Play }[] = [
  { value: "anki", label: "Anki", hint: "Nuevas + repasos con límites diarios", icon: Zap },
  { value: "today", label: "Plan hoy", hint: "FSRS prioriza las que más vas a olvidar", icon: Target },
  { value: "due", label: "Due", hint: "Solo las vencidas", icon: Play },
  { value: "all", label: "Todo", hint: "Todo el deck sin filtrar", icon: Sparkles },
];

/**
 * Single consolidated control bar for the Estudiar tab. Hides noisy daily
 * limits behind a collapsible gear and renders a clean segmented control
 * for queue/study modes. Designed as the primary "setup" surface before a
 * session starts; during a session it becomes a compact strip.
 */
export function SessionControls({
  queueMode,
  onQueueModeChange,
  studyMode,
  onStudyModeChange,
  onStart,
  onExit,
  canStart,
  sessionActive,
  dailyLimits,
  onDailyLimitsChange,
}: Props) {
  const [showLimits, setShowLimits] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const limitsRef = useRef<HTMLDivElement | null>(null);

  // Entry animation on mount.
  useEffect(() => {
    if (!rootRef.current) return;
    gsap.fromTo(
      rootRef.current,
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" },
    );
  }, []);

  // Expand/collapse the limits drawer with a proper height animation.
  useEffect(() => {
    const el = limitsRef.current;
    if (!el) return;
    if (showLimits) {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        {
          height: "auto",
          opacity: 1,
          duration: 0.3,
          ease: "power2.out",
          clearProps: "height",
        },
      );
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.2, ease: "power2.in" });
    }
  }, [showLimits]);

  return (
    <div ref={rootRef} className="space-y-2">
      {/* Primary row: queue mode + study mode + start */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/15 bg-white/5 p-2 backdrop-blur-sm">
        {/* Queue mode segmented */}
        <div className="flex items-center gap-0.5 rounded-xl border border-white/15 bg-black/20 p-0.5">
          {QUEUE_MODES.map(({ value, label, hint, icon: Icon }) => {
            const active = queueMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onQueueModeChange(value)}
                title={hint}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-white text-black shadow-[0_4px_14px_-6px_rgba(255,255,255,0.5)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Study mode toggle */}
        <div className="flex items-center gap-0.5 rounded-xl border border-white/15 bg-black/20 p-0.5">
          <button
            type="button"
            onClick={() => onStudyModeChange("anki")}
            title="Modo Anki: voltear → 1-4"
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              studyMode === "anki" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            Flip
          </button>
          <button
            type="button"
            onClick={() => onStudyModeChange("confidence")}
            title="Modo Brainscape: confianza 1-5 sin voltear"
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              studyMode === "confidence"
                ? "bg-white text-black"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            Confianza
          </button>
        </div>

        {/* Gear for advanced */}
        <button
          type="button"
          onClick={() => setShowLimits((v) => !v)}
          className={`ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 transition-colors ${
            showLimits ? "bg-white/15 text-white" : "bg-black/20 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
          title="Límites diarios (Anki)"
          aria-expanded={showLimits}
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {sessionActive ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={onExit}
          >
            Salir
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 gap-1.5 border border-white/25 bg-white text-black hover:bg-white/90 disabled:opacity-40"
            onClick={onStart}
            disabled={!canStart}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            Iniciar
          </Button>
        )}
      </div>

      {/* Collapsible daily limits (Anki mode) */}
      <div ref={limitsRef} className="overflow-hidden" style={{ height: showLimits ? "auto" : 0, opacity: showLimits ? 1 : 0 }}>
        {queueMode === "anki" ? (
          <div className="grid gap-2 rounded-xl border border-white/15 bg-white/5 p-3 sm:grid-cols-3">
            <LimitField
              label="Nuevas/día"
              value={dailyLimits.newLimit}
              onChange={(v) => onDailyLimitsChange({ newLimit: v })}
            />
            <LimitField
              label="Repasos/día"
              value={dailyLimits.reviewLimit}
              onChange={(v) => onDailyLimitsChange({ reviewLimit: v })}
            />
            <LimitField
              label="Learning/día"
              value={dailyLimits.learningLimit}
              onChange={(v) => onDailyLimitsChange({ learningLimit: v })}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-white/60">
            Los límites diarios solo se aplican en el modo <strong className="text-white">Anki</strong>.
          </div>
        )}
      </div>
    </div>
  );
}

function LimitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-widest text-white/60">{label}</span>
      <input
        type="number"
        min={0}
        max={9999}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value || 0))}
        className="h-9 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white outline-none focus:border-white/40"
      />
    </label>
  );
}
