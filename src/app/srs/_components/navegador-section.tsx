"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { CardBrowser } from "./card-browser";
import type { SrsLibrary } from "@/lib/srs";

type Props = {
  lib: SrsLibrary;
  onLibraryChange: (next: SrsLibrary) => void;
  onClose: () => void;
};

/**
 * Navegador view rendered inline (not modal). Behaves like any other SRS
 * subsection: transparent background, fills the available width, uses the
 * same fade/slide entrance as a tab change.
 *
 * The big "Navegación" title is rendered by <SrsTopbar /> (it reads the
 * searchOpen flag). This component only owns the body: filters + results.
 */
export function NavegadorSection({ lib, onLibraryChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
    );
  }, []);

  // Esc closes the view — mirrors the Estudiar tab's dismissible affordances.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const target = e.target as HTMLElement | null;
        const isTyping =
          !!target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
        if (isTyping) return;
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={ref} className="space-y-4">
      <CardBrowser lib={lib} onLibraryChange={onLibraryChange} />
    </div>
  );
}
