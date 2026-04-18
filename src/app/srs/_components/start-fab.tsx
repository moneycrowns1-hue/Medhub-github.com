"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Pause, Play } from "lucide-react";

type Props = {
  sessionActive: boolean;
  disabled: boolean;
  onStart: () => void;
  onExit: () => void;
};

/**
 * Floating "Start / Exit" button pinned to the bottom-right of the SRS view.
 * Uses GSAP for a soft breathing pulse while idle so it never feels dead on
 * screen — and a quick pop transition whenever session state toggles.
 */
export function StartFab({ sessionActive, disabled, onStart, onExit }: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Breath animation while idle (no session, enabled). Stops while active.
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    if (sessionActive || disabled) {
      gsap.to(el, { scale: 1, duration: 0.15, ease: "power1.out" });
      return;
    }
    gsap.to(el, {
      scale: 1.04,
      duration: 1.4,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      transformOrigin: "center center",
    });
    return () => {
      gsap.killTweensOf(el);
    };
  }, [sessionActive, disabled]);

  // Pop transition when sessionActive flips.
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { scale: 0.85, rotate: sessionActive ? -10 : 10 },
      { scale: 1, rotate: 0, duration: 0.3, ease: "back.out(1.8)" },
    );
  }, [sessionActive]);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 sm:bottom-8 sm:right-8">
      <button
        ref={btnRef}
        type="button"
        onClick={sessionActive ? onExit : onStart}
        disabled={disabled && !sessionActive}
        aria-label={sessionActive ? "Salir de la sesión" : "Iniciar sesión"}
        className={`pointer-events-auto group relative flex h-16 w-16 items-center justify-center rounded-full border shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:h-20 sm:w-20 ${
          sessionActive
            ? "border-rose-300/40 bg-rose-500/85 text-white hover:bg-rose-500"
            : "border-white/30 bg-white text-black hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-40"
        }`}
      >
        {/* Glow ring */}
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full transition-opacity ${
            sessionActive
              ? "bg-[radial-gradient(circle_at_center,rgba(255,80,120,0.35),transparent_70%)]"
              : "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),transparent_70%)] opacity-70 group-hover:opacity-100"
          }`}
        />
        {sessionActive ? (
          <Pause className="relative h-7 w-7 sm:h-8 sm:w-8" fill="currentColor" />
        ) : (
          <Play className="relative ml-1 h-7 w-7 sm:h-8 sm:w-8" fill="currentColor" />
        )}
      </button>
      {/* Small caption */}
      <div
        className={`pointer-events-none mt-2 text-right text-[10px] font-medium uppercase tracking-widest transition-opacity ${
          sessionActive ? "text-rose-200/85" : "text-white/60"
        }`}
      >
        {sessionActive ? "Salir" : "Iniciar"}
      </div>
    </div>
  );
}
