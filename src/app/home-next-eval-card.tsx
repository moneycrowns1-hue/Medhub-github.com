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
      className={`relative overflow-hidden rounded-2xl ${style.bg} p-5 text-white backdrop-blur-xl`}
    >
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/70">
            <div data-home-eval-pulse className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.12]">
              <CalendarClock className="h-4 w-4 text-white/90" />
            </div>
            Próxima evaluación
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${style.chip}`}>
                {style.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] text-white/85">
                <GraduationCap className="h-3 w-3" />
                {subjectLabel(next.record.subjectSlug)}
              </span>
            </div>
            <div className="text-2xl font-bold leading-tight tracking-tight text-white">{next.record.title}</div>
            <div className="text-xs text-white/70">
              {next.semester.name} · {dateLabel}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-white/90"
            onClick={onQuickQuiz}
          >
            <Sparkles className="h-4 w-4" />
            Quiz rápido
          </button>
          <Link
            href="/academico"
            className="inline-flex h-9 items-center gap-1 rounded-xl bg-white/[0.08] px-3 text-xs font-medium text-white/90 transition-colors hover:bg-white/[0.12]"
          >
            Ver agenda
          </Link>
        </div>
      </div>

      {others.length ? (
        <div className="relative z-10 mt-4 grid gap-2 sm:grid-cols-2">
          {others.map((entry) => {
            const s = urgencyStyle(entry.daysUntil);
            const d = new Date(entry.record.date);
            const label = Number.isFinite(d.getTime()) ? dateFmt.format(d) : entry.record.date;
            return (
              <div
                key={entry.record.id}
                data-home-eval-item
                className={`rounded-xl px-3 py-2 text-xs text-white/85 ${s.bg}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-white">{entry.record.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.chip}`}>
                    {s.label}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-white/65">
                  {subjectLabel(entry.record.subjectSlug)} · {label}
                </div>
              </div>
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
      className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5 text-white backdrop-blur-xl"
    >
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/70">
            <CalendarClock className="h-3.5 w-3.5" />
            Próxima evaluación
          </div>
          <div className="text-2xl font-bold leading-tight tracking-tight text-white">Sin evaluaciones cercanas</div>
          <div className="text-xs text-white/70">
            Cargá fechas en <Link href="/academico" className="underline underline-offset-2 hover:text-white">Académico</Link> para ver la agenda aquí, o practicá ahora con un quiz rápido.
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-white/90"
          onClick={onQuickQuiz}
        >
          <ClipboardCheck className="h-4 w-4" />
          Quiz rápido
        </button>
      </div>
    </div>
  );
}
