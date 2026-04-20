"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { CalendarClock, ClipboardCheck, GraduationCap, Sparkles } from "lucide-react";

import { QuickQuiz } from "@/app/academico/_components/quick-quiz";
import {
  ACADEMIC_UPDATED_EVENT,
  getSubjectSemestersComputed,
  listUpcomingEvaluations,
  loadAcademicConfig,
  loadAcademicRecords,
  loadAcademicSemesters,
  type AcademicBlockType,
  type AcademicSemesterComputed,
  type AcademicSubjectSlug,
  type UpcomingEvaluation,
} from "@/lib/academic-store";
import { SUBJECTS, type SubjectSlug } from "@/lib/subjects";

function subjectLabel(slug: AcademicSubjectSlug): string {
  const known = SUBJECTS[slug as SubjectSlug];
  return known ? known.name : slug;
}

function urgencyStyle(daysUntil: number): { bg: string; chip: string; label: string } {
  if (daysUntil <= 0) {
    return {
      bg: "bg-rose-400/12",
      chip: "bg-rose-400/25 text-rose-100",
      label: "Hoy",
    };
  }
  if (daysUntil <= 3) {
    return {
      bg: "bg-amber-400/12",
      chip: "bg-amber-400/25 text-amber-100",
      label: `En ${daysUntil} d`,
    };
  }
  if (daysUntil <= 7) {
    return {
      bg: "bg-cyan-400/12",
      chip: "bg-cyan-400/25 text-cyan-100",
      label: `En ${daysUntil} d`,
    };
  }
  return {
    bg: "bg-white/[0.04]",
    chip: "bg-white/[0.1] text-white/85",
    label: `En ${daysUntil} d`,
  };
}

const EMPTY_UPCOMING: UpcomingEvaluation[] = [];

function subscribeAcademic(notify: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(ACADEMIC_UPDATED_EVENT, notify);
  return () => window.removeEventListener(ACADEMIC_UPDATED_EVENT, notify);
}

let _snapshotCache: { key: string; value: UpcomingEvaluation[] } | null = null;

function getAcademicSnapshot(): UpcomingEvaluation[] {
  if (typeof window === "undefined") return EMPTY_UPCOMING;
  const next = listUpcomingEvaluations({ horizonDays: 30 });
  // Stabilize identity so useSyncExternalStore doesn't loop
  const key = next.map((e) => `${e.record.id}:${e.record.date}:${e.daysUntil}`).join("|");
  if (_snapshotCache && _snapshotCache.key === key) return _snapshotCache.value;
  _snapshotCache = { key, value: next };
  return next;
}

function getServerSnapshot(): UpcomingEvaluation[] {
  return EMPTY_UPCOMING;
}

export function HomeNextEvalCard() {
  const upcoming = useSyncExternalStore(subscribeAcademic, getAcademicSnapshot, getServerSnapshot);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizCtx, setQuizCtx] = useState<{
    subject: AcademicSubjectSlug;
    semester: AcademicSemesterComputed;
    blocks: Array<{ blockType: AcademicBlockType; blockIndex: number | null; label: string }>;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const pulseTweenRef = useRef<gsap.core.Tween | null>(null);

  const next = upcoming[0] ?? null;
  const others = upcoming.slice(1, 3);

  // GSAP entrance animation
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-home-eval-card]", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        ease: "power3.out",
      });
      gsap.from("[data-home-eval-item]", {
        y: 14,
        opacity: 0,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.08,
        delay: 0.15,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // GSAP urgency pulse on the icon when the next eval is imminent
  useEffect(() => {
    if (pulseTweenRef.current) {
      pulseTweenRef.current.kill();
      pulseTweenRef.current = null;
    }
    if (!next) return;
    const imminent = next.daysUntil <= 3;
    if (!imminent) return;
    const target = rootRef.current?.querySelector<HTMLElement>("[data-home-eval-pulse]");
    if (!target) return;
    pulseTweenRef.current = gsap.to(target, {
      scale: 1.12,
      duration: 0.9,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      transformOrigin: "center center",
    });
  }, [next]);

  const openQuickQuiz = useCallback(() => {
    const config = loadAcademicConfig();
    const semesters = loadAcademicSemesters();
    const records = loadAcademicRecords();

    // Prefer subject of the next upcoming evaluation; fall back to first subject with any semester.
    const subjectSlug: AcademicSubjectSlug | null = next?.record.subjectSlug
      ?? (semesters[0]?.subjectSlug as AcademicSubjectSlug | undefined)
      ?? null;

    if (!subjectSlug) {
      setQuizCtx(null);
      setQuizOpen(true);
      return;
    }

    const computed = getSubjectSemestersComputed(subjectSlug, semesters, records, config.passingGrade);
    const activeSemester = computed.find((c) => !c.passed && c.unlocked) ?? computed[computed.length - 1] ?? null;

    if (!activeSemester) {
      setQuizCtx(null);
      setQuizOpen(true);
      return;
    }

    const blocks: Array<{ blockType: AcademicBlockType; blockIndex: number | null; label: string }> = [
      ...Array.from({ length: activeSemester.semester.partialCount }, (_, idx) => ({
        blockType: "partial" as const,
        blockIndex: idx + 1,
        label: `Parcial ${idx + 1}`,
      })),
      { blockType: "final" as const, blockIndex: null, label: "Final" },
      ...(activeSemester.needsRemedial
        ? [{ blockType: "remedial" as const, blockIndex: null, label: "Remedial" }]
        : []),
    ];

    setQuizCtx({ subject: subjectSlug, semester: activeSemester, blocks });
    setQuizOpen(true);
  }, [next]);

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
    [],
  );

  return (
    <div ref={rootRef}>
      {next ? (
        <NextEvalCard
          next={next}
          others={others}
          onQuickQuiz={openQuickQuiz}
          dateFmt={dateFmt}
        />
      ) : (
        <EmptyEvalCard onQuickQuiz={openQuickQuiz} />
      )}

      {quizOpen && quizCtx ? (
        <QuickQuiz
          open={quizOpen}
          subjectSlug={quizCtx.subject}
          semester={quizCtx.semester}
          availableBlocks={quizCtx.blocks}
          onClose={() => setQuizOpen(false)}
        />
      ) : null}
    </div>
  );
}

function NextEvalCard({
  next,
  others,
  onQuickQuiz,
  dateFmt,
}: {
  next: UpcomingEvaluation;
  others: UpcomingEvaluation[];
  onQuickQuiz: () => void;
  dateFmt: Intl.DateTimeFormat;
}) {
  const style = urgencyStyle(next.daysUntil);
  const dateObj = new Date(next.record.date);
  const dateLabel = Number.isFinite(dateObj.getTime()) ? dateFmt.format(dateObj) : next.record.date;

  return (
    <div
      data-home-eval-card
      className={`relative overflow-hidden rounded-2xl ${style.bg} px-4 py-3 text-white backdrop-blur-xl`}
    >
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <div
          data-home-eval-pulse
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.1]"
        >
          <CalendarClock className="h-4 w-4 text-white/90" />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.chip}`}>
            {style.label}
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-white">{next.record.title}</span>
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-white/60 sm:inline-flex">
            <GraduationCap className="h-3 w-3" />
            {subjectLabel(next.record.subjectSlug)} · {dateLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-black transition-colors hover:bg-white/90"
            onClick={onQuickQuiz}
            title="Quiz rápido"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Quiz
          </button>
          <Link
            href="/academico"
            title="Ver agenda"
            aria-label="Ver agenda"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] text-white/85 transition-colors hover:bg-white/[0.14] hover:text-white"
          >
            <CalendarClock className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {others.length ? (
        <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/45">Luego</span>
          {others.map((entry) => {
            const s = urgencyStyle(entry.daysUntil);
            return (
              <span
                key={entry.record.id}
                data-home-eval-item
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/80"
                title={`${subjectLabel(entry.record.subjectSlug)} · ${entry.record.date}`}
              >
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${s.chip}`}>
                  {s.label}
                </span>
                <span className="max-w-[180px] truncate">{entry.record.title}</span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EmptyEvalCard({ onQuickQuiz }: { onQuickQuiz: () => void }) {
  return (
    <div
      data-home-eval-card
      className="relative overflow-hidden rounded-2xl bg-white/[0.04] px-4 py-3 text-white backdrop-blur-xl"
    >
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
          <CalendarClock className="h-4 w-4 text-white/80" />
        </div>
        <div className="min-w-0 flex-1 text-sm text-white/85">
          <span className="font-semibold text-white">Sin evaluaciones cercanas.</span>{" "}
          <span className="text-white/60">
            Cargá fechas en{" "}
            <Link href="/academico" className="underline underline-offset-2 hover:text-white">Académico</Link>.
          </span>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-black transition-colors hover:bg-white/90"
          onClick={onQuickQuiz}
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Quiz
        </button>
      </div>
    </div>
  );
}
