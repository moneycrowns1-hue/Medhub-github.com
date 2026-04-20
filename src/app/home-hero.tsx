"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  GraduationCap,
  MoonStar,
  Sparkles,
  Sunrise,
  Sun,
} from "lucide-react";

import { StartStudyLink } from "@/components/start-study-link";
import { HomeStatsChips } from "@/app/home-stats-chips";
import type { SubjectSlug } from "@/lib/subjects";

type Props = {
  dayLabel: string;
  focusNote?: string;
  isRestDay: boolean;
  primaryName: string;
  primarySlug: SubjectSlug;
  secondaryName: string;
  reading: string;
};

function getGreeting(hour: number): { label: string; icon: React.ReactNode } {
  if (hour >= 5 && hour < 12) return { label: "Buenos días", icon: <Sunrise className="h-3.5 w-3.5" /> };
  if (hour >= 12 && hour < 19) return { label: "Buenas tardes", icon: <Sun className="h-3.5 w-3.5" /> };
  return { label: "Buenas noches", icon: <MoonStar className="h-3.5 w-3.5" /> };
}

export function HomeHero({
  dayLabel,
  focusNote,
  isRestDay,
  primaryName,
  primarySlug,
  secondaryName,
  reading,
}: Props) {
  const headlineRef = useRef<HTMLHeadingElement | null>(null);
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  useEffect(() => {
    const el = headlineRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
    );
  }, []);

  const greeting = useMemo(() => (hour == null ? null : getGreeting(hour)), [hour]);

  const scrollToTabs = () => {
    const el = document.getElementById("hoy-tabs");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="font-general-sans relative -mx-6 -mt-8 overflow-hidden bg-black text-white">
      {/* Ambient video background (compact, no min-h-screen) */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/60 to-black/85" />

      <div className="relative z-10 flex flex-col px-6 py-10 md:px-[120px] md:py-14">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
          {/* Row 1: greeting pill + day pill */}
          <div className="flex flex-wrap items-center gap-2">
            {greeting ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/90 backdrop-blur-md">
                {greeting.icon}
                <span>{greeting.label}</span>
              </div>
            ) : null}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white/90 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-white/90" />
              <span>{dayLabel}</span>
            </div>
          </div>

          {/* Row 2: direct headline — what to do today */}
          <div className="space-y-2">
            <h1
              ref={headlineRef}
              className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-[52px]"
            >
              {isRestDay ? (
                <>
                  Hoy es <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">descanso</span>.
                </>
              ) : (
                <>
                  Hoy toca{" "}
                  <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    {primaryName}
                  </span>
                  .
                </>
              )}
            </h1>
            <p className="max-w-[640px] text-[15px] text-white/70">
              {isRestDay ? (
                <>Recupera energía y prepará el próximo bloque. Lectura ligera sugerida: <strong className="text-white/90">{reading}</strong>.</>
              ) : (
                <>
                  Módulo secundario: <strong className="text-white/90">{secondaryName}</strong>. Lectura:{" "}
                  <strong className="text-white/90">{reading}</strong>.
                </>
              )}
            </p>
            {focusNote ? <p className="text-[13px] text-white/55">{focusNote}</p> : null}
          </div>

          {/* Row 3: direct action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {!isRestDay ? (
              <StartStudyLink
                href={`/study/${primarySlug}`}
                subjectSlug={primarySlug}
                className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_8px_30px_-10px_rgba(255,255,255,0.7)] transition-all hover:bg-white/90"
              >
                <GraduationCap className="h-4 w-4" />
                Empezar estudio
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </StartStudyLink>
            ) : null}
            <Link
              href="/day"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/15"
            >
              <CalendarDays className="h-4 w-4" />
              Ver plan completo
            </Link>
            <button
              type="button"
              onClick={scrollToTabs}
              className="group inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white/85 backdrop-blur-sm transition-all hover:bg-white/[0.12] hover:text-white"
              title="Ir al resumen de hoy"
            >
              Resumen de hoy
              <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
            </button>
          </div>

          {/* Row 4: live stats chips */}
          <HomeStatsChips plannedBlocks={3} />
        </div>
      </div>
    </section>
  );
}
