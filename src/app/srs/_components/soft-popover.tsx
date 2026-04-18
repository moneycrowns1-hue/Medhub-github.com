"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronDown } from "lucide-react";

type Props = {
  label: string;
  icon?: React.ReactNode;
  summary?: string;
  align?: "left" | "right";
  width?: number;
  children: React.ReactNode;
};

/**
 * Minimal borderless popover trigger + animated panel, matching the
 * "Modo" / "Ajustes" popovers in the Estudiar subsection but reusable.
 */
export function SoftPopover({
  label,
  icon,
  summary,
  align = "left",
  width = 300,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { y: -6, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.22, ease: "power2.out" },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors ${
          open
            ? "bg-white/15 text-white"
            : "bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
        }`}
        aria-expanded={open}
      >
        {icon}
        <span>{label}</span>
        {summary ? <span className="text-white/55">· {summary}</span> : null}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          ref={panelRef}
          style={{ width }}
          className={`absolute top-[calc(100%+6px)] z-40 rounded-xl border border-white/10 bg-[rgba(18,16,28,0.95)] p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
