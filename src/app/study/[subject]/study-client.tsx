"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Mic,
  Megaphone,
  Sparkles,
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

const UI_MODE_LABELS: Record<string, string> = {
  visual: "Aprendizaje visual con atlas interactivo",
  timeline: "Líneas de tiempo y desarrollo embrionario",
  flowcharts: "Diagramas de flujo y rutas metabólicas",
  redirect: "App externa especializada",
};

const UI_MODE_ICONS: Record<string, React.ReactNode> = {
  visual: <GraduationCap className="h-5 w-5" />,
  timeline: <Layers className="h-5 w-5" />,
  flowcharts: <Sparkles className="h-5 w-5" />,
  redirect: <ExternalLink className="h-5 w-5" />,
};

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
      href: "/resources?subject=ingles",
      title: "Sprint de shadowing",
      subtitle: "Audio, repetición y speaking",
      icon: <Mic className="h-5 w-5" />,
    };
  }

  if (subject.slug === "trabajo-online") {
    return {
      href: "/resources?subject=trabajo-online",
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

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/day"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al plan del día
        </Link>

        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/5 p-8 backdrop-blur-xl md:p-10">
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-white/5 blur-2xl" />

          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-foreground/85">
              {UI_MODE_ICONS[subject.uiMode] ?? <GraduationCap className="h-3.5 w-3.5" />}
              {UI_MODE_LABELS[subject.uiMode] ?? "Módulo de estudio"}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{subject.name}</h1>
            <p className="max-w-lg text-sm text-foreground/70">
              Módulo adaptado a tu cátedra. Accedé a recursos, flashcards y herramientas de estudio.
            </p>
          </div>
        </div>
      </div>

      {/* External redirect for Histología */}
      {subject.uiMode === "redirect" && subject.redirectUrl && (
        <section className="space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">App externa</div>
            <h2 className="text-xl font-bold tracking-tight">Histología interactiva</h2>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-sm text-foreground/70">
              Tu app de Histología tiene su propia interfaz especializada. Abrila desde aquí para estudiar con atlas y láminas virtuales.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={subject.redirectUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Histología
              </a>
            </div>
          </div>
        </section>
      )}

      {/* SRS Stats */}
      <section className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Flashcards</div>
          <h2 className="text-xl font-bold tracking-tight">Repetición espaciada</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Total tarjetas</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{subjectCards.length}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Nuevas</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{stats.newCount}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Aprendiendo</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{stats.learning}</div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Due hoy</div>
            <div className="mt-2 text-2xl font-bold tabular-nums">{stats.dueToday}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {subjectDecks.map((d) => (
            <Link
              key={d.id}
              href="/srs"
              className="group rounded-xl border border-white/20 bg-white/5 px-4 py-3 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10"
            >
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-white/90" />
                <span className="text-sm font-medium">{d.name}</span>
                <ArrowRight className="h-3.5 w-3.5 text-foreground/65 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {d.description && (
                <div className="mt-1 text-xs text-foreground/65">{d.description}</div>
              )}
            </Link>
          ))}
          {subjectDecks.length === 0 && (
            <div className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-foreground/70">
              No hay decks para esta materia. Crealos desde el <Link href="/srs" className="font-medium text-foreground hover:underline">Builder de SRS</Link>.
            </div>
          )}
        </div>
      </section>

      {/* Resources / PDFs */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase tracking-widest text-foreground/70">Recursos</div>
            <h2 className="text-xl font-bold tracking-tight">Material de estudio</h2>
          </div>
          <Link href="/resources">
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
                href="/resources"
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
              Subí PDFs en la <Link href="/resources" className="font-medium text-foreground hover:underline">Biblioteca</Link> y asignalos a esta materia.
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
            href={`/resources?subject=${encodeURIComponent(subject.slug)}`}
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
