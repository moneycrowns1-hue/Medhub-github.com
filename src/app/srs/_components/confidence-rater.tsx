"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { Button } from "@/components/ui/button";
import type { SrsConfidence } from "@/lib/srs";

type Props = {
  value: SrsConfidence | null;
  masteryPct: number;
  onRate: (value: SrsConfidence) => void;
  disabled?: boolean;
};

const LEVELS: {
  value: SrsConfidence;
  label: string;
  hint: string;
  className: string;
}[] = [
  {
    value: 1,
    label: "1",
    hint: "Nada",
    className: "border-red-300/35 bg-red-500/10 text-red-100 hover:bg-red-500/20",
  },
  {
    value: 2,
    label: "2",
    hint: "Poco",
    className: "border-orange-300/35 bg-orange-500/10 text-orange-100 hover:bg-orange-500/20",
  },
  {
    value: 3,
    label: "3",
    hint: "Algo",
    className: "border-amber-300/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20",
  },
  {
    value: 4,
    label: "4",
    hint: "Bien",
    className: "border-lime-300/35 bg-lime-400/10 text-lime-100 hover:bg-lime-400/20",
  },
  {
    value: 5,
    label: "5",
    hint: "Perfecto",
    className: "border-emerald-300/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20",
  },
];

/**
 * Brainscape-style confidence rater. The user rates how well they know the
 * card on a 1-5 scale without flipping — useful for fast review passes over
 * familiar material.
 */
export function ConfidenceRater({ value, masteryPct, onRate, disabled }: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const lastPctRef = useRef(masteryPct);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const from = lastPctRef.current;
    gsap.fromTo(
      el,
      { width: `${Math.max(0, Math.min(100, from))}%` },
      {
        width: `${Math.max(0, Math.min(100, masteryPct))}%`,
        duration: 0.55,
        ease: "power3.out",
      },
    );
    lastPctRef.current = masteryPct;
  }, [masteryPct]);

  return (
    <div className="space-y-3 rounded-xl border border-white/20 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-foreground/70">Confianza</div>
        <div className="text-xs tabular-nums text-foreground/70">Mastery {masteryPct}%</div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          ref={barRef}
          className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400"
          style={{ width: `${Math.max(0, Math.min(100, masteryPct))}%` }}
        />
      </div>

      <div className="grid grid-cols-5 gap-2">
        {LEVELS.map((lvl) => {
          const active = value === lvl.value;
          return (
            <Button
              key={lvl.value}
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => onRate(lvl.value)}
              className={`flex h-auto flex-col items-center gap-0.5 border px-2 py-2 transition-all ${lvl.className} ${
                active ? "ring-2 ring-white/70 scale-[1.03]" : ""
              }`}
              title={`${lvl.value} · ${lvl.hint}`}
            >
              <span className="text-lg font-bold leading-none">{lvl.label}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-80">{lvl.hint}</span>
            </Button>
          );
        })}
      </div>

      <div className="text-[11px] text-foreground/60">
        Atajos <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">1</kbd>–
        <kbd className="rounded border border-border/50 bg-muted/50 px-1 py-0.5 font-mono text-[10px]">5</kbd>. 1–2
        reprograman pronto; 4–5 espacian más.
      </div>
    </div>
  );
}
