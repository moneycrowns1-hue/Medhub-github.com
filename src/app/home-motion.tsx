"use client";

import { useEffect } from "react";
import gsap from "gsap";

/**
 * Global GSAP-driven entrance & micro-interactions for the home page.
 * Attaches to well-known DOM hooks so the existing server-rendered markup
 * in page.tsx doesn't need to become a client component.
 */
export function HomeMotion() {
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero: title / subtitle / CTA row fade+rise, sequenced
      const heroTitle = document.querySelector("h1 span");
      const heroParagraph = document.querySelector("section p.text-\\[15px\\]");
      const heroActions = document.querySelector("section .flex.flex-wrap.items-center.justify-center");

      if (heroTitle) {
        gsap.from(heroTitle, {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
        });
      }
      if (heroParagraph) {
        gsap.from(heroParagraph, {
          y: 18,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          delay: 0.2,
        });
      }
      if (heroActions) {
        gsap.from(heroActions, {
          y: 14,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          delay: 0.35,
        });
      }

      // Modules grid: stagger in
      const moduleCards = document.querySelectorAll<HTMLElement>("[data-home-module]");
      if (moduleCards.length) {
        gsap.from(moduleCards, {
          y: 20,
          opacity: 0,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.08,
          delay: 0.1,
        });
      }

      // Quick access tiles
      const quickTiles = document.querySelectorAll<HTMLElement>("[data-home-quick]");
      if (quickTiles.length) {
        gsap.from(quickTiles, {
          y: 10,
          opacity: 0,
          duration: 0.45,
          ease: "power2.out",
          stagger: 0.05,
          delay: 0.1,
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return null;
}
