"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarClock,
  ExternalLink,
  FileText,
  Flame,
  GraduationCap,
  Layers,
  Mic,
  Megaphone,
  Sparkles,
  Target,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { markStudyVisited } from "@/lib/rabbit-guide";
import {
  listPdfResources,
  RESOURCES_UPDATED_EVENT,
  type PdfResource,
} from "@/lib/resources-service";
import { algoStats } from "@/lib/srs-algo";
import { loadSrsLibrary, SRS_UPDATED_EVENT } from "@/lib/srs-storage";
import type { SubjectDefinition } from "@/lib/subjects";
import { getPlanForDate, formatPlanSummary } from "@/lib/schedule";
import {
  ACADEMIC_UPDATED_EVENT,
  isMedicalSubjectSlug,
  listUpcomingEvaluations,
  type UpcomingEvaluation,
} from "@/lib/academic-store";
import { notifyGlobal } from "@/lib/global-notifier";

const UI_MODE_LABELS: Record<string, string> = {
  visual: "Atlas visual interactivo",
  timeline: "Línea de tiempo y desarrollo",
  flowcharts: "Diagramas y rutas metabólicas",
  redirect: "App externa especializada",
};

const UI_MODE_ICONS: Record<string, React.ReactNode> = {
  visual: <GraduationCap className="h-3.5 w-3.5" />,
  timeline: <Layers className="h-3.5 w-3.5" />,
  flowcharts: <Sparkles className="h-3.5 w-3.5" />,
  redirect: <ExternalLink className="h-3.5 w-3.5" />,
};

type DayRole = "primary" | "secondary" | "rest" | "off";

function roleLabel(role: DayRole): { label: string; tone: string; icon: React.ReactNode } {
  switch (role) {
    case "primary":
      return {
        label: "Principal de hoy",
        tone: "bg-white text-black shadow-[0_6px_24px_-10px_rgba(255,255,255,0.55)]",
        icon: <Flame className="h-3.5 w-3.5" />,
      };
    case "secondary":
      return {
        label: "Secundaria de hoy",
        tone: "bg-white/15 text-white",
        icon: <Target className="h-3.5 w-3.5" />,
      };
    case "rest":
      return {
        label: "Hoy es descanso",
        tone: "bg-white/10 text-white/85",
        icon: <Sparkles className="h-3.5 w-3.5" />,
      };
    case "off":
    default:
      return {
        label: "Fuera de la rotación de hoy",
        tone: "bg-white/[0.06] text-white/70",
        icon: <Layers className="h-3.5 w-3.5" />,
      };
  }
}

type Props = {
  subject: SubjectDefinition;
};

function trackActionBySubject(subject: SubjectDefinition): {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
} {
  if (subject.slug === "ingles") {
    return {
      href: "/biblioteca?subject=ingles",
      title: "Sprint de shadowing",
      subtitle: "Audio, repetición y speaking",
      icon: <Mic className="h-5 w-5" />,
    };
  }

  if (subject.slug === "trabajo-online") {
    return {
      href: "/biblioteca?subject=trabajo-online",
      title: "Pipeline de publicación",
      subtitle: "Crear, publicar y medir",
      icon: <Megaphone className="h-5 w-5" />,
    };
  }

  return {
    href: "/",
    title: "Dashboard",
    subtitle: "Volver al inicio",
    icon: <Sparkles className="h-5 w-5" />,
  };
}

export function StudyClient({ subject }: Props) {
  const [pdfs, setPdfs] = useState<PdfResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [srsTick, setSrsTick] = useState(0);
  const [evalsTick, setEvalsTick] = useState(0);
  const heroRef = useRef<HTMLDivElement | null>(null);

  const srsLib = useMemo(() => {
    void srsTick;
    if (typeof window === "undefined") return null;
    return loadSrsLibrary();
  }, [srsTick]);

  const subjectDecks = useMemo(() => {
    if (!srsLib) return [];
    return srsLib.decks.filter((d) => d.subjectSlug === subject.slug);
  }, [srsLib, subject.slug]);

  const subjectCards = useMemo(() => {
    if (!srsLib) return [];
    const deckIds = new Set(subjectDecks.map((d) => d.id));
    return srsLib.cards.filter((c) => deckIds.has(c.deckId));
  }, [srsLib, subjectDecks]);

  const stats = useMemo(() => algoStats(subjectCards), [subjectCards]);
  const trackAction = useMemo(() => trackActionBySubject(subject), [subject]);

  // Deck-level due counts, sorted desc for prioritization
  const decksWithDue = useMemo(() => {
    if (!srsLib) return [] as Array<{ id: string; name: string; description?: string; due: number; total: number }>;
    return subjectDecks
      .map((d) => {
        const cards = srsLib.cards.filter((c) => c.deckId === d.id);
        const s = algoStats(cards);
        return { id: d.id, name: d.name, description: d.description, due: s.dueToday, total: cards.length };
      })
      .sort((a, b) => b.due - a.due || b.total - a.total);
  }, [srsLib, subjectDecks]);

  // Role of this subject within today's plan
  const todayRole: DayRole = useMemo(() => {
    const plan = getPlanForDate(new Date());
    const summary = formatPlanSummary(plan);
    if (summary.isRestDay) return "rest";
    if (plan.primary === subject.slug) return "primary";
    if (plan.secondary === subject.slug) return "secondary";
    return "off";
  }, [subject.slug]);

  const todayPlanSummary = useMemo(() => formatPlanSummary(getPlanForDate(new Date())), []);

  // Next evaluations for this subject (30-day horizon)
  const nextEvals = useMemo<UpcomingEvaluation[]>(() => {
    void evalsTick;
    if (!isMedicalSubjectSlug(subject.slug)) return [];
    try {
      return listUpcomingEvaluations({ subjectSlug: subject.slug, horizonDays: 30 }).slice(0, 3);
    } catch {
      return [];
    }
  }, [subject.slug, evalsTick]);

  const nextEval = nextEvals[0] ?? null;
  const roleMeta = roleLabel(todayRole);

  const refreshPdfs = useCallback(
    async (withLoading = false) => {
      if (withLoading) setLoading(true);
      try {
        const all = await listPdfResources();
        const filtered = all.filter((p) => p.subjectSlug === subject.slug);
        setPdfs(filtered);
      } catch {
        setPdfs([]);
      } finally {
        setLoading(false);
      }
    },
    [subject.slug],
  );

  useEffect(() => {
    markStudyVisited(subject.slug);
  }, [subject.slug]);

  useEffect(() => {
    void refreshPdfs(true);

    const onResourcesUpdated = () => {
      void refreshPdfs();
    };

    window.addEventListener("storage", onResourcesUpdated);
    window.addEventListener("focus", onResourcesUpdated);
    window.addEventListener(RESOURCES_UPDATED_EVENT, onResourcesUpdated);
    return () => {
      window.removeEventListener("storage", onResourcesUpdated);
      window.removeEventListener("focus", onResourcesUpdated);
      window.removeEventListener(RESOURCES_UPDATED_EVENT, onResourcesUpdated);
    };
  }, [refreshPdfs]);

  useEffect(() => {
    const refreshSrs = () => setSrsTick((t) => t + 1);
    window.addEventListener("storage", refreshSrs);
    window.addEventListener(SRS_UPDATED_EVENT, refreshSrs);
    return () => {
      window.removeEventListener("storage", refreshSrs);
      window.removeEventListener(SRS_UPDATED_EVENT, refreshSrs);
    };
  }, []);

  useEffect(() => {
    const refreshEvals = () => setEvalsTick((t) => t + 1);
    window.addEventListener(ACADEMIC_UPDATED_EVENT, refreshEvals);
    return () => window.removeEventListener(ACADEMIC_UPDATED_EVENT, refreshEvals);
  }, []);

  // Hero entry animation
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const tl = gsap.timeline();
    const head = el.querySelector("[data-hero-headline]");
    const items = el.querySelectorAll("[data-hero-item]");
    if (head) tl.fromTo(head, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" });
    if (items.length) {
      tl.fromTo(
        items,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.06 },
        "-=0.25",
      );
    }
    return () => {
      tl.kill();
    };
  }, []);

  // Rabbit hint on first entry: contextual suggestion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `somagnus:study:hint:${subject.slug}:${new Date().toDateString()}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    const parts: string[] = [];
    if (todayRole === "primary") parts.push(`${subject.name} es tu principal de hoy.`);
    else if (todayRole === "secondary") parts.push(`${subject.name} es tu secundaria de hoy.`);
    else if (todayRole === "rest") parts.push("Hoy toca descanso. Lectura suave recomendada.");
    else parts.push(`${subject.name} no está en la rotación de hoy, pero podés repasar.`);
    if (stats.dueToday > 0) parts.push(`Tenés ${stats.dueToday} flashcard(s) para revisar.`);
    if (nextEval) {
      const whenLabel = nextEval.daysUntil === 0 ? "hoy" : nextEval.daysUntil === 1 ? "mañana" : `en ${nextEval.daysUntil} días`;
      parts.push(`Próxima evaluación: ${whenLabel}.`);
    }
    notifyGlobal({
      title: `Abriendo ${subject.name}`,
      body: parts.join(" "),
      status: "Módulo activo",
      tag: key,
      durationMs: 5200,
      inAppOnly: true,
    });
    // Intentionally not reactive to stats/nextEval changes to avoid spam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.slug]);

  // Progress metrics for hero bar (reviewed vs total in this subject today)
  const reviewedRatio = useMemo(() => {
    if (!subjectCards.length) return 0;
    const pending = stats.dueToday + stats.newCount;
    const reviewed = Math.max(0, subjectCards.length - pending);
    return Math.min(1, reviewed / subjectCards.length);
  }, [subjectCards.length, stats.dueToday, stats.newCount]);

  return (
    <div className="space-y-10">
      {/* Back link */}
      <Link
        href="/day"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al plan del día
      </Link>

      {/* ───── Hero ───── */}
      <div
        ref={heroRef}
        className="relative isolate overflow-hidden rounded-3xl bg-black px-6 py-10 md:px-12 md:py-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(120,119,198,0.06),transparent_60%)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 -z-10 h-44 w-44 rounded-full bg-white/5 blur-2xl" />

        <div className="mx-auto grid w-full max-w-6xl items-start gap-8 md:grid-cols-[1.4fr_1fr]">
          {/* Left column: identity + CTAs */}
          <div className="flex flex-col items-start gap-6">
            {/* Role + Day + uiMode pills */}
            <div data-hero-item className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${roleMeta.tone}`}>
                {roleMeta.icon}
                <span>{roleMeta.label}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{todayPlanSummary.dayLabel}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">
                {UI_MODE_ICONS[subject.uiMode] ?? <GraduationCap className="h-3.5 w-3.5" />}
                <span>{UI_MODE_LABELS[subject.uiMode] ?? "Módulo de estudio"}</span>
              </div>
            </div>

            {/* Headline */}
            <h1
              data-hero-headline
              className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-[56px]"
            >
              <span className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
                {subject.name}
              </span>
            </h1>

            {/* Contextual subtitle */}
            <p data-hero-item className="max-w-[560px] text-[15px] leading-relaxed text-white/70">
              {todayRole === "primary" && (
                <>
                  Hoy le dedicás <strong className="text-white/90">bloque principal</strong>. Arrancá por material nuevo y cerrá con SRS.
                </>
              )}
              {todayRole === "secondary" && (
                <>
                  Hoy va como <strong className="text-white/90">secundaria</strong>. Prioridad: repaso y tarjetas vencidas.
                </>
              )}
              {todayRole === "rest" && (
                <>
                  Día de descanso. Si querés avanzar algo, usá <strong className="text-white/90">lectura suave o flashcards
                    en modo casual</strong>.
                </>
              )}
              {todayRole === "off" && (
                <>
                  Hoy no está en la rotación, pero podés usar el hueco para{" "}
                  <strong className="text-white/90">repasar vencidas</strong> o revisar recursos.
                </>
              )}
            </p>

            {/* CTAs */}
            <div data-hero-item className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                href="/#pomodoro"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-[0_8px_30px_-10px_rgba(255,255,255,0.5)] transition-all hover:bg-white/90"
              >
                <Timer className="h-4 w-4" />
                Activar Pomodoro
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              {stats.dueToday > 0 ? (
                <Link
                  href="/srs"
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.1] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/[0.16]"
                >
                  <Brain className="h-4 w-4" />
                  Revisar {stats.dueToday} tarjeta{stats.dueToday === 1 ? "" : "s"}
                </Link>
              ) : null}
              <Link
                href={`/biblioteca?subject=${encodeURIComponent(subject.slug)}`}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white/85 transition-all hover:bg-white/[0.12] hover:text-white"
              >
                <BookOpen className="h-4 w-4" />
                Recursos
              </Link>
              {subject.uiMode === "redirect" && subject.redirectUrl ? (
                <a
                  href={subject.redirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white/85 transition-all hover:bg-white/[0.12] hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir app externa
                </a>
              ) : null}
            </div>
          </div>

          {/* Right column: next evaluation + progress snapshot */}
          <div className="flex flex-col gap-4">
            {/* Next evaluation card */}
            <div data-hero-item className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-white/60">
                <CalendarClock className="h-3.5 w-3.5" />
                Próxima evaluación
              </div>
              {nextEval ? (
                <>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {nextEval.daysUntil === 0
                      ? "Hoy"
                      : nextEval.daysUntil === 1
                      ? "Mañana"
                      : `En ${nextEval.daysUntil} días`}
                  </div>
                  <div className="mt-1 truncate text-sm text-white/75">{nextEval.record.title}</div>
                  <div className="mt-0.5 text-xs text-white/55">
                    {nextEval.semester.name} · {nextEval.record.date}
                  </div>
                  <Link
                    href="/academico"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
                  >
                    Ver calendario
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <div className="mt-2 text-sm text-white/65">
                  Sin evaluaciones registradas en los próximos 30 días.
                  <Link href="/academico" className="mt-2 block text-xs font-medium text-white/80 hover:text-white">
                    Agregar evaluación →
                  </Link>
                </div>
              )}
            </div>

            {/* Progress snapshot */}
            <div data-hero-item className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-white/60">
                <Target className="h-3.5 w-3.5" />
                Progreso SRS
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-3xl font-semibold tabular-nums text-white">{Math.round(reviewedRatio * 100)}%</div>
                <div className="text-xs text-white/55">
                  {Math.round(reviewedRatio * subjectCards.length)}/{subjectCards.length} estables
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-white to-white/60 transition-[width] duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, Math.round(reviewedRatio * 100)))}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-white/[0.05] px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/55">Nuevas</div>
                  <div className="text-sm font-semibold tabular-nums text-white">{stats.newCount}</div>
                </div>
                <div className="rounded-lg bg-white/[0.05] px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/55">Aprend.</div>
                  <div className="text-sm font-semibold tabular-nums text-white">{stats.learning}</div>
                </div>
                <div className="rounded-lg bg-white/[0.05] px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-white/55">Due hoy</div>
                  <div className="text-sm font-semibold tabular-nums text-white">{stats.dueToday}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Mazos SRS ───── */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Flashcards</div>
            <h2 className="text-xl font-bold tracking-tight">Mazos de {subject.name}</h2>
          </div>
          <Link href="/srs">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15">
              <Brain className="h-3.5 w-3.5" />
              Builder SRS
            </Button>
          </Link>
        </div>

        {decksWithDue.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decksWithDue.map((d) => (
              <Link
                key={d.id}
                href="/srs"
                className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.08]"
              >
                {d.due > 0 ? (
                  <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">
                    <Flame className="h-3 w-3" />
                    {d.due} due
                  </div>
                ) : null}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{d.name}</div>
                    {d.description ? (
                      <div className="mt-1 line-clamp-2 text-xs text-white/60">{d.description}</div>
                    ) : null}
                    <div className="mt-2 text-[11px] text-white/55">{d.total} tarjetas</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-[11px] font-medium text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                  Estudiar
                  <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/25 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
            <Brain className="mx-auto h-8 w-8 text-white/45" />
            <div className="mt-3 text-sm font-medium text-white/75">No hay mazos en {subject.name}</div>
            <div className="mt-1 text-xs text-white/60">
              Crealos desde el{" "}
              <Link href="/srs" className="font-medium text-white hover:underline">
                Builder de SRS
              </Link>
              .
            </div>
          </div>
        )}
      </section>

      {/* Resources / PDFs */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Recursos</div>
            <h2 className="text-xl font-bold tracking-tight">Material de estudio</h2>
          </div>
          <Link href="/biblioteca">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15">
              <BookOpen className="h-3.5 w-3.5" />
              Ir a Biblioteca
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-2xl border border-white/15 bg-white/5" />
            ))}
          </div>
        ) : pdfs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pdfs.map((p) => (
              <Link
                key={p.id}
                href={`/lector?openPdf=${encodeURIComponent(p.id)}`}
                className="group rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="mt-1 text-xs text-foreground/65">
                      {Math.round(p.sizeBytes / 1024)} KB · pp. {p.pageStart}–{p.pageEnd}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-8 text-center backdrop-blur-xl">
            <FileText className="mx-auto h-8 w-8 text-foreground/45" />
            <div className="mt-3 text-sm font-medium text-foreground/75">
              No hay PDFs asignados a {subject.name}
            </div>
            <div className="mt-1 text-xs text-foreground/60">
              Subí PDFs en la <Link href="/biblioteca" className="font-medium text-foreground hover:underline">Biblioteca</Link> y asignalos a esta materia.
            </div>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Acciones rápidas</div>
          <h2 className="text-xl font-bold tracking-tight">Herramientas</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/srs"
            className="group flex items-center gap-4 rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Estudiar flashcards</div>
              <div className="text-xs text-foreground/65">Iniciar sesión SRS</div>
            </div>
          </Link>

          <Link
            href={`/biblioteca?subject=${encodeURIComponent(subject.slug)}`}
            className="group flex items-center gap-4 rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Abrir biblioteca</div>
              <div className="text-xs text-foreground/65">PDFs y generación IA</div>
            </div>
          </Link>

          <Link
            href={trackAction.href}
            className="group flex items-center gap-4 rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white/90">
              {trackAction.icon}
            </div>
            <div>
              <div className="text-sm font-semibold">{trackAction.title}</div>
              <div className="text-xs text-foreground/65">{trackAction.subtitle}</div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
