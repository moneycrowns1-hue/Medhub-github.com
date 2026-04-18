"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowLeft,
  BookOpenCheck,
  ChevronRight,
  FileText,
  ImagePlus,
  Music2,
  Pencil,
  Plus,
  Sparkles,
  Type,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";

import { AiCardComposer } from "./ai-card-composer";
import type { SrsLibrary } from "@/lib/srs";

type Mode =
  | "home"
  | "youtube"
  | "pdf"
  | "audio"
  | "fotos"
  | "anki"
  | "texto"
  | "aprende"
  | "manual";

type Props = {
  lib: SrsLibrary;
  deckId: string;
  subjectSlug: string;
  onLibraryChange: (next: SrsLibrary) => void;
};

const MODE_META: Record<
  Exclude<Mode, "home">,
  { title: string; subtitle: string; icon: (c: string) => React.ReactNode; tone: string }
> = {
  youtube: {
    title: "Pegar un enlace de YouTube",
    subtitle: "Transformá cualquier video en notas y tarjetas.",
    icon: (c) => <Video className={c} />,
    tone: "from-rose-400/25 to-rose-400/5 text-rose-100",
  },
  pdf: {
    title: "Subí tus PDFs o presentaciones",
    subtitle: "50 MB máx. (.pdf, .docx, .pptx, .txt)",
    icon: (c) => <FileText className={c} />,
    tone: "from-violet-400/25 to-violet-400/5 text-violet-100",
  },
  audio: {
    title: "Subí un audio y obtené la transcripción",
    subtitle: "200 MB máx. (.mp3, .wav)",
    icon: (c) => <Music2 className={c} />,
    tone: "from-sky-400/25 to-sky-400/5 text-sky-100",
  },
  fotos: {
    title: "Fotos",
    subtitle: "Subí o tomá fotos para extraer contenido.",
    icon: (c) => <ImagePlus className={c} />,
    tone: "from-fuchsia-400/25 to-fuchsia-400/5 text-fuchsia-100",
  },
  anki: {
    title: "Importar Anki",
    subtitle: "Importar archivos .apkg de Anki.",
    icon: (c) => <Upload className={c} />,
    tone: "from-cyan-400/25 to-cyan-400/5 text-cyan-100",
  },
  texto: {
    title: "Texto",
    subtitle: "Pegá cualquier texto y generá tarjetas.",
    icon: (c) => <Type className={c} />,
    tone: "from-amber-400/25 to-amber-400/5 text-amber-100",
  },
  aprende: {
    title: "Aprende lo que quieras",
    subtitle: "Decile a la IA lo que querés aprender.",
    icon: (c) => <Wand2 className={c} />,
    tone: "from-pink-400/25 to-pink-400/5 text-pink-100",
  },
  manual: {
    title: "Manual",
    subtitle: "Escribí tus propias flashcards.",
    icon: (c) => <Pencil className={c} />,
    tone: "from-emerald-400/25 to-emerald-400/5 text-emerald-100",
  },
};

export function AiModesHub({ lib, deckId, subjectSlug, onLibraryChange }: Props) {
  const [mode, setMode] = useState<Mode>("home");
  const [modalOpen, setModalOpen] = useState(false);
  const hubRef = useRef<HTMLDivElement | null>(null);

  // Stagger the primary mode cards on mount / when returning to home.
  useEffect(() => {
    if (mode !== "home" || !hubRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-ai-primary]", {
        y: 16,
        opacity: 0,
        duration: 0.45,
        ease: "power3.out",
        stagger: 0.08,
      });
      gsap.from("[data-ai-progress]", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 0.9,
        ease: "power3.out",
      });
    }, hubRef);
    return () => ctx.revert();
  }, [mode]);

  // Texto mode wraps the existing composer directly.
  if (mode === "texto") {
    return (
      <ModeShell title="Texto" onBack={() => setMode("home")}>
        <AiCardComposer
          lib={lib}
          deckId={deckId}
          subjectSlug={subjectSlug}
          onLibraryChange={onLibraryChange}
        />
      </ModeShell>
    );
  }

  if (mode !== "home") {
    return (
      <ModeShell
        title={MODE_META[mode].title}
        onBack={() => setMode("home")}
      >
        <ComingSoon mode={mode} />
      </ModeShell>
    );
  }

  return (
    <div ref={hubRef} className="space-y-8">
      {/* Progress + heading */}
      <div className="space-y-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            data-ai-progress
            className="h-full w-3/4 rounded-full bg-gradient-to-r from-white/80 via-white to-white/70"
          />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            ¿Tenés tu material listo para estudiar?
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Subí tu material de estudio o dejá que la IA lo cree por vos.
          </p>
        </div>
      </div>

      {/* Primary modes: Youtube / PDF / Audio */}
      <div className="grid gap-4 md:grid-cols-3">
        <PrimaryCard
          mode="youtube"
          placeholder="https://youtu.be/…"
          cta="Analizar"
          onSelect={() => setMode("youtube")}
        />
        <PrimaryCard
          mode="pdf"
          cta="Sube un PDF"
          highlighted
          onSelect={() => setMode("pdf")}
        />
        <PrimaryCard
          mode="audio"
          cta="Subir audio"
          onSelect={() => setMode("audio")}
        />
      </div>

      {/* Secondary modes opener */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/75 underline-offset-4 hover:text-white hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Quiero probar otros modos (Importación Anki, Texto, Aprender, Manual)
        </button>
      </div>

      {modalOpen ? (
        <ModesModal
          onClose={() => setModalOpen(false)}
          onSelect={(m) => {
            setMode(m);
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------- Primary card ------------------------- */

function PrimaryCard({
  mode,
  cta,
  placeholder,
  highlighted,
  onSelect,
}: {
  mode: "youtube" | "pdf" | "audio";
  cta: string;
  placeholder?: string;
  highlighted?: boolean;
  onSelect: () => void;
}) {
  const meta = MODE_META[mode];
  return (
    <button
      type="button"
      data-ai-primary
      onClick={onSelect}
      className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border p-6 text-center transition-all hover:-translate-y-0.5 hover:border-white/35 ${
        highlighted
          ? "border-white/35 bg-white/10"
          : "border-white/15 bg-white/5"
      }`}
    >
      {/* Soft tonal glow */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b opacity-60 blur-2xl ${meta.tone}`}
      />
      {/* Icon ring */}
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-sm ${meta.tone.split(" ").pop()}`}
      >
        {meta.icon("h-7 w-7")}
      </div>
      <div className="relative space-y-1">
        <div className="text-sm font-semibold text-white">{meta.title}</div>
        <div className="text-xs text-white/55">{meta.subtitle}</div>
      </div>

      {/* Pseudo input (visual only for now) */}
      {placeholder ? (
        <div className="relative mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left text-xs text-white/50 italic">
          {placeholder}
        </div>
      ) : (
        <div
          className={`relative mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border text-xs font-medium transition-colors ${
            highlighted
              ? "border-white/40 bg-white text-black group-hover:bg-white/90"
              : "border-white/20 bg-white/10 text-white/90 group-hover:bg-white/15"
          }`}
        >
          {mode === "pdf" ? <FileText className="h-3.5 w-3.5" /> : null}
          {mode === "audio" ? <Music2 className="h-3.5 w-3.5" /> : null}
          {cta}
        </div>
      )}
    </button>
  );
}

/* ------------------------- Modes modal ------------------------- */

function ModesModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (m: Mode) => void;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!backdropRef.current || !panelRef.current) return;
    gsap.fromTo(
      backdropRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.18, ease: "power2.out" },
    );
    gsap.fromTo(
      panelRef.current,
      { y: 24, opacity: 0, scale: 0.97 },
      { y: 0, opacity: 1, scale: 1, duration: 0.32, ease: "power3.out" },
    );
    gsap.from("[data-secondary-mode]", {
      y: 10,
      opacity: 0,
      duration: 0.28,
      ease: "power2.out",
      stagger: 0.04,
      delay: 0.1,
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const secondaryModes: Mode[] = ["fotos", "anki", "texto", "aprende", "manual"];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[rgba(20,18,32,0.92)] p-5 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90">
            <Plus className="h-3.5 w-3.5" />
            Nuevo mazo de estudio
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {secondaryModes.map((m) => {
            const meta = MODE_META[m as Exclude<Mode, "home">];
            const accent = meta.tone.split(" ").pop();
            return (
              <button
                key={m}
                data-secondary-mode
                type="button"
                onClick={() => onSelect(m)}
                className="group flex items-center gap-3 rounded-2xl border border-white/12 bg-white/5 p-3 text-left transition-colors hover:border-white/30 hover:bg-white/10"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-gradient-to-br ${meta.tone}`}
                >
                  {meta.icon(`h-5 w-5 ${accent}`)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{meta.title}</div>
                  <div className="truncate text-xs text-white/55">{meta.subtitle}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white/70" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Mode shell + placeholder ------------------------- */

function ModeShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { x: 14, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.32, ease: "power3.out" },
    );
  }, []);
  return (
    <div ref={ref} className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Volver"
          title="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold uppercase tracking-widest text-white/70">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function ComingSoon({ mode }: { mode: Exclude<Mode, "home" | "texto"> }) {
  const meta = MODE_META[mode];
  const accent = meta.tone.split(" ").pop();
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/15 bg-white/5 p-12 text-center backdrop-blur-sm">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br ${meta.tone}`}
      >
        {meta.icon(`h-7 w-7 ${accent}`)}
      </div>
      <div className="space-y-1">
        <div className="text-base font-semibold text-white">{meta.title}</div>
        <div className="text-sm text-white/60">{meta.subtitle}</div>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-white/65">
        <BookOpenCheck className="h-3 w-3" />
        Próximamente
      </div>
      <p className="max-w-sm text-xs text-white/50">
        Este modo todavía no está conectado. La estructura visual está lista para integrar la lógica.
      </p>
    </div>
  );
}
