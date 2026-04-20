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

function urgencyStyle(daysUntil: number): { bg: string; chip: string; label: string; dot: string } {
  if (daysUntil <= 0) {
    return {
      bg: "bg-rose-400/10",
      chip: "bg-rose-400/20 text-rose-100",
      dot: "bg-rose-400",
      label: "Hoy",
    };
  }
  if (daysUntil <= 3) {
    return {
      bg: "bg-violet-400/10",
      chip: "bg-violet-400/20 text-violet-100",
      dot: "bg-violet-400",
      label: `En ${daysUntil} d`,
    };
  }
  if (daysUntil <= 7) {
    return {
      bg: "bg-cyan-400/10",
      chip: "bg-cyan-400/20 text-cyan-100",
      dot: "bg-cyan-400",
      label: `En ${daysUntil} d`,
    };
  }
  return {
    bg: "bg-white/[0.04]",
    chip: "bg-white/[0.1] text-white/85",
    dot: "bg-white/50",
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

/* ─────────────────────────────── Popover trigger variant ─────────────────────────────── */

/**
 * Icon-only trigger (matches h-9 w-9 rounded-xl bg-white/[0.06] topbar style)
 * that opens a floating panel with the next evaluations + quick quiz action.
 * Designed to sit inline with the Plan / Settings icons in HomeTabsSection.
 */
export function HomeNextEvalPopover() {
  const upcoming = useSyncExternalStore(subscribeAcademic, getAcademicSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizCtx, setQuizCtx] = useState<{
    subject: AcademicSubjectSlug;
    semester: AcademicSemesterComputed;
    blocks: Array<{ blockType: AcademicBlockType; blockIndex: number | null; label: string }>;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);

  const next = upcoming[0] ?? null;
  const others = upcoming.slice(1, 4);
  const tone = next ? urgencyStyle(next.daysUntil) : null;

  // Panel entrance animation
  useEffect(() => {
    const el = panelRef.current;
    if (!el || !open) return;
    gsap.fromTo(
      el,
      { y: -6, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.22, ease: "power2.out" },
    );
  }, [open]);

  // Pulse the dot when imminent
  useEffect(() => {
    const el = dotRef.current;
    if (!el) return;
    if (!next || next.daysUntil > 3) return;
    const tween = gsap.to(el, {
      scale: 1.35,
      duration: 0.85,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      transformOrigin: "center center",
    });
    return () => {
      tween.kill();
    };
  }, [next]);

  // Click outside + Escape
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

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
    [],
  );

  const openQuickQuiz = useCallback(() => {
    const config = loadAcademicConfig();
    const semesters = loadAcademicSemesters();
    const records = loadAcademicRecords();
    const subjectSlug: AcademicSubjectSlug | null =
      next?.record.subjectSlug ?? (semesters[0]?.subjectSlug as AcademicSubjectSlug | undefined) ?? null;

    if (!subjectSlug) {
      setQuizCtx(null);
      setQuizOpen(true);
      setOpen(false);
      return;
    }
    const computed = getSubjectSemestersComputed(subjectSlug, semesters, records, config.passingGrade);
    const activeSemester = computed.find((c) => !c.passed && c.unlocked) ?? computed[computed.length - 1] ?? null;
    if (!activeSemester) {
      setQuizCtx(null);
      setQuizOpen(true);
      setOpen(false);
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
    setOpen(false);
  }, [next]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={next ? `Próxima: ${next.record.title} (${tone?.label})` : "Próxima evaluación"}
        aria-label="Próxima evaluación"
        aria-expanded={open}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
          open
            ? "bg-white/15 text-white"
            : "bg-white/[0.06] text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        <CalendarClock className="h-4 w-4" />
        {next ? (
          <span
            ref={dotRef}
            className={`absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-[#0a0a0f] ${tone?.dot ?? "bg-white/60"}`}
          />
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Próxima evaluación"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[rgba(18,16,28,0.96)] p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.08]">
                <CalendarClock className="h-3.5 w-3.5 text-white/85" />
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-widest text-white/50">Agenda</div>
                <div className="text-sm font-semibold text-white/90">Próxima evaluación</div>
              </div>
            </div>
            <Link
              href="/academico"
              onClick={() => setOpen(false)}
              title="Abrir académico"
              aria-label="Abrir académico"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <GraduationCap className="h-3.5 w-3.5" />
            </Link>
          </div>

          {next ? (
            <>
              <div className={`mt-3 rounded-xl ${tone?.bg ?? "bg-white/[0.04]"} p-3`}>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone?.chip}`}>
                    {tone?.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/65">
                    <GraduationCap className="h-3 w-3" />
                    {subjectLabel(next.record.subjectSlug)}
                  </span>
                </div>
                <div className="mt-1.5 text-[15px] font-semibold leading-tight text-white">
                  {next.record.title}
                </div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  {next.semester.name} ·{" "}
                  {(() => {
                    const d = new Date(next.record.date);
                    return Number.isFinite(d.getTime()) ? dateFmt.format(d) : next.record.date;
                  })()}
                </div>
              </div>

              {others.length ? (
                <div className="mt-3 space-y-1">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-white/40">Luego</div>
                  <div className="space-y-1">
                    {others.map((entry) => {
                      const s = urgencyStyle(entry.daysUntil);
                      const d = new Date(entry.record.date);
                      const label = Number.isFinite(d.getTime()) ? dateFmt.format(d) : entry.record.date;
                      return (
                        <div
                          key={entry.record.id}
                          className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5"
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white/90">
                            {entry.record.title}
                          </span>
                          <span className="shrink-0 text-[10px] text-white/50">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={openQuickQuiz}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-colors hover:bg-white/90"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Quiz rápido
                </button>
                <Link
                  href="/academico"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-[11px] font-medium text-white/90 transition-colors hover:bg-white/[0.14]"
                >
                  Ver agenda
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-xl bg-white/[0.04] p-3 text-sm text-white/75">
                <span className="font-semibold text-white">Sin evaluaciones cercanas.</span>{" "}
                <span className="text-white/60">
                  Cargá fechas en{" "}
                  <Link
                    href="/academico"
                    onClick={() => setOpen(false)}
                    className="underline underline-offset-2 hover:text-white"
                  >
                    Académico
                  </Link>
                  .
                </span>
              </div>
              <button
                type="button"
                onClick={openQuickQuiz}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-semibold text-black transition-colors hover:bg-white/90"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Quiz rápido
              </button>
            </div>
          )}
        </div>
      ) : null}

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
