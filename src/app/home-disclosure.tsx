"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  /** Unique id used to persist expanded state in localStorage. */
  storageKey: string;
  /** Section eyebrow label (e.g. "Resumen"). */
  eyebrow: string;
  /** Section title (e.g. "Indicadores de hoy"). */
  title: string;
  /** Icon rendered in the left tile. */
  icon: React.ReactNode;
  /** Tailwind color classes for the icon tile (e.g. "bg-blue-500/10 text-blue-400"). */
  iconAccent?: string;
  /** Short inline preview chips shown in the header when collapsed. */
  preview?: React.ReactNode;
  /** If true, starts expanded on first render (before localStorage loads). */
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const STORAGE_PREFIX = "somagnus:home-disclosure:v1:";

export function HomeDisclosure({
  storageKey,
  eyebrow,
  title,
  icon,
  iconAccent = "bg-white/[0.08] text-white/90",
  preview,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
      if (raw === "1") setOpen(true);
      else if (raw === "0") setOpen(false);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section
      className={`group relative overflow-hidden rounded-2xl bg-white/[0.04] backdrop-blur-xl transition-[box-shadow,background-color] duration-300 ${
        open ? "ring-1 ring-white/[0.06] shadow-[0_12px_40px_-20px_rgba(255,255,255,0.25)]" : ""
      }`}
    >
      {/* Subtle gradient accent on top */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-40"
        }`}
      />

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${iconAccent}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-[10px] font-medium uppercase tracking-widest text-primary">
            {eyebrow}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-bold tracking-tight sm:text-lg">{title}</h2>
            {preview && !open ? (
              <div className="hidden items-center gap-2 text-xs text-foreground/60 sm:flex">
                {preview}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-foreground/70 transition-all duration-300 group-hover:bg-white/[0.1] group-hover:text-white">
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}
          />
        </div>
      </button>

      {/* Mobile preview row under header */}
      {preview && !open ? (
        <div className="flex items-center gap-2 px-5 pb-3 text-xs text-foreground/60 sm:hidden">
          {preview}
        </div>
      ) : null}

      {/* Animated content: grid-rows trick for smooth height */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        } ${hydrated ? "" : "duration-0"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.05] px-5 pb-5 pt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Small inline preview pill used inside disclosure headers. */
export function PreviewPill({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon?: React.ReactNode;
  label?: string;
  value: string;
  tone?: "neutral" | "emerald" | "blue" | "amber" | "rose" | "violet";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/[0.06] text-white/85",
    emerald: "bg-emerald-400/15 text-emerald-200",
    blue: "bg-blue-400/15 text-blue-200",
    amber: "bg-amber-400/15 text-amber-200",
    rose: "bg-rose-400/15 text-rose-200",
    violet: "bg-violet-400/15 text-violet-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${tones[tone]}`}>
      {icon}
      {label ? <span className="text-foreground/60">{label}</span> : null}
      <span>{value}</span>
    </span>
  );
}
