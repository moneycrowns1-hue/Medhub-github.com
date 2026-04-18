"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { X } from "lucide-react";

import { CardBrowser } from "./card-browser";
import type { SrsLibrary } from "@/lib/srs";

type Props = {
  open: boolean;
  onClose: () => void;
  lib: SrsLibrary;
  onLibraryChange: (next: SrsLibrary) => void;
};

/**
 * Full-screen search / browse overlay. Hosts the CardBrowser with all its
 * decks / leeches / tags / types filters and bulk actions.
 */
export function SearchOverlay({ open, onClose, lib, onLibraryChange }: Props) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    // Lock scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (backdropRef.current) {
      gsap.fromTo(
        backdropRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, ease: "power2.out" },
      );
    }
    if (panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { y: 24, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.32, ease: "power3.out" },
      );
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-[rgba(16,14,26,0.95)] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">
              Navegador
            </div>
            <div className="text-sm font-semibold text-white">
              Buscar tarjetas
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
            title="Cerrar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-4">
          <CardBrowser lib={lib} onLibraryChange={onLibraryChange} />
        </div>
      </div>
    </div>
  );
}
