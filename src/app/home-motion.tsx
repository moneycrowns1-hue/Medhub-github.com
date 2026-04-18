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
    let ctx: gsap.Context | null = null;
    try {
      ctx = gsap.context(() => {
        const heroTitle = document.querySelector("h1 span");
        const heroParagraph = document.querySelector("section p.text-\\[15px\\]");
        const heroActions = document.querySelector("section .flex.flex-wrap.items-center.justify-center");

        if (heroTitle) {
          gsap.fromTo(
            heroTitle,
            { y: 28, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", clearProps: "all" },
          );
        }
        if (heroParagraph) {
          gsap.fromTo(
            heroParagraph,
            { y: 18, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, ease: "power2.out", delay: 0.2, clearProps: "all" },
          );
        }
        if (heroActions) {
          gsap.fromTo(
            heroActions,
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", delay: 0.35, clearProps: "all" },
          );
        }

        const moduleCards = document.querySelectorAll<HTMLElement>("[data-home-module]");
        if (moduleCards.length) {
          gsap.fromTo(
            moduleCards,
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.55,
              ease: "power3.out",
              stagger: 0.08,
              delay: 0.1,
              clearProps: "all",
            },
          );
        }

        const quickTiles = document.querySelectorAll<HTMLElement>("[data-home-quick]");
        if (quickTiles.length) {
          gsap.fromTo(
            quickTiles,
            { y: 10, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.45,
              ease: "power2.out",
              stagger: 0.05,
              delay: 0.1,
              clearProps: "all",
            },
          );
        }
      });
    } catch {
      // If gsap fails, ensure nothing stays hidden by wiping any inline opacity/transform.
      document
        .querySelectorAll<HTMLElement>("[data-home-module], [data-home-quick]")
        .forEach((el) => {
          el.style.removeProperty("opacity");
          el.style.removeProperty("transform");
        });
    }

    return () => {
      ctx?.revert();
      // Safety net: make sure home tiles are fully visible after unmount/HMR.
      document
        .querySelectorAll<HTMLElement>("[data-home-module], [data-home-quick]")
        .forEach((el) => {
          el.style.removeProperty("opacity");
          el.style.removeProperty("transform");
        });
    };
  }, []);

  return null;
}
