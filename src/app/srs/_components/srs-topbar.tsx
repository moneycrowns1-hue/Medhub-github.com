"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronDown, RotateCw, Settings2, SlidersHorizontal } from "lucide-react";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeckSelect } from "@/components/deck-select";
import { SubjectSelect } from "@/components/subject-select";
import type { SrsDailyLimits } from "@/lib/srs-algo";
import type { SrsDeck } from "@/lib/srs";

import type { QueueMode, StudyMode } from "./session-controls";

export type SrsTab = "study" | "ai" | "browser" | "builder" | "io";

const TAB_LABELS: Record<SrsTab, string> = {
  study: "Estudiar",
  ai: "IA",
  browser: "Navegador",
  builder: "Builder",
  io: "Image occlusion",
};

const QUEUE_LABEL: Record<QueueMode, string> = {
  anki: "Anki",
  today: "Plan hoy",
  due: "Due",
  all: "Todo",
};

const STUDY_LABEL: Record<StudyMode, string> = {
  anki: "Flip",
  confidence: "Confianza",
};

type Props = {
  activeTab: SrsTab;
  subject: string;
  onSubjectChange: (next: string) => void;
  deckId: string;
  decks: SrsDeck[];
  onDeckChange: (next: string) => void;

  queueMode: QueueMode;
  onQueueModeChange: (m: QueueMode) => void;
  studyMode: StudyMode;
  onStudyModeChange: (m: StudyMode) => void;

  dailyLimits: SrsDailyLimits;
  onDailyLimitsChange: (patch: Partial<SrsDailyLimits>) => void;

  onRestart: () => void;
  onToggleFilters: () => void;
  filtersOpen: boolean;
  filteredCount: number;
};

/**
 * Unified SRS topbar. Two rows:
 *  1) Subject + Deck (left)  ·  giant animated tab label (center)  ·  Tabs (right)
 *  2) "Modo" popover (queue+study) · "Ajustes" popover (limits+restart) · "Filtros" toggle
 */
export function SrsTopbar({
  activeTab,
  subject,
  onSubjectChange,
  deckId,
  decks,
  onDeckChange,
  queueMode,
  onQueueModeChange,
  studyMode,
  onStudyModeChange,
  dailyLimits,
  onDailyLimitsChange,
  onRestart,
  onToggleFilters,
  filtersOpen,
  filteredCount,
}: Props) {
  const titleRef = useRef<HTMLDivElement | null>(null);

  // Animate the big tab label whenever activeTab changes.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 8, opacity: 0, letterSpacing: "0.1em" },
      { y: 0, opacity: 1, letterSpacing: "0em", duration: 0.45, ease: "power3.out" },
    );
  }, [activeTab]);

  return (
    <div className="space-y-3">
      {/* Row 1 */}
      <div className="grid items-end gap-4 lg:grid-cols-[auto,1fr,auto]">
        {/* Subject + Deck */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Materia</div>
            <SubjectSelect value={subject} onChange={onSubjectChange} allowAll />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Deck</div>
            <DeckSelect value={deckId} onChange={onDeckChange} decks={decks} />
          </div>
        </div>

        {/* Giant animated tab label */}
        <div className="hidden min-w-0 items-center justify-center lg:flex">
          <div
            ref={titleRef}
            className="truncate text-center text-3xl font-bold tracking-tight text-white/90 xl:text-4xl"
          >
            {TAB_LABELS[activeTab]}
          </div>
        </div>

        {/* Tabs (right) */}
        <div className="flex justify-start lg:justify-end">
          <TabsList className="bg-white/5 backdrop-blur-sm">
            <TabsTrigger value="study">Estudiar</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
            <TabsTrigger value="browser">Navegador</TabsTrigger>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="io">IO</TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Row 2: popovers + filter toggle (only on study tab) */}
      {activeTab === "study" ? (
        <div className="flex flex-wrap items-center gap-2">
          <ModePopover
            queueMode={queueMode}
            onQueueModeChange={onQueueModeChange}
            studyMode={studyMode}
            onStudyModeChange={onStudyModeChange}
          />
          <SettingsPopover
            dailyLimits={dailyLimits}
            onDailyLimitsChange={onDailyLimitsChange}
            onRestart={onRestart}
            queueMode={queueMode}
          />
          <button
            type="button"
            onClick={onToggleFilters}
            className={`ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
              filtersOpen
                ? "border-white/40 bg-white text-black"
                : "border-white/15 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white"
            }`}
            title="Mostrar filtros de tags y leeches"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                filtersOpen ? "bg-black/10 text-black" : "bg-white/10 text-white/75"
              }`}
            >
              {filteredCount}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------- Popovers -------------------- */

function Popover({
  label,
  icon,
  summary,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (open) {
      gsap.fromTo(
        el,
        { y: -6, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.22, ease: "power2.out" },
      );
    }
  }, [open]);

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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
          open
            ? "border-white/40 bg-white/15 text-white"
            : "border-white/15 bg-black/20 text-white/80 hover:bg-white/10 hover:text-white"
        }`}
        aria-expanded={open}
      >
        {icon}
        <span>{label}</span>
        {summary ? <span className="text-white/55">· {summary}</span> : null}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div
          ref={panelRef}
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-[280px] rounded-xl border border-white/15 bg-[rgba(18,16,28,0.95)] p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ModePopover({
  queueMode,
  onQueueModeChange,
  studyMode,
  onStudyModeChange,
}: {
  queueMode: QueueMode;
  onQueueModeChange: (m: QueueMode) => void;
  studyMode: StudyMode;
  onStudyModeChange: (m: StudyMode) => void;
}) {
  return (
    <Popover
      label="Modo"
      icon={<Settings2 className="h-3.5 w-3.5" />}
      summary={`${QUEUE_LABEL[queueMode]} · ${STUDY_LABEL[studyMode]}`}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">Cola</div>
          <div className="grid grid-cols-2 gap-1">
            {(["anki", "today", "due", "all"] as QueueMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onQueueModeChange(m)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  queueMode === m
                    ? "border-white/40 bg-white text-black"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {QUEUE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">
            Calificación
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(["anki", "confidence"] as StudyMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onStudyModeChange(m)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  studyMode === m
                    ? "border-white/40 bg-white text-black"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
                title={m === "anki" ? "Voltear → 1-4" : "Brainscape: 1-5 sin voltear"}
              >
                {STUDY_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Popover>
  );
}

function SettingsPopover({
  dailyLimits,
  onDailyLimitsChange,
  onRestart,
  queueMode,
}: {
  dailyLimits: SrsDailyLimits;
  onDailyLimitsChange: (patch: Partial<SrsDailyLimits>) => void;
  onRestart: () => void;
  queueMode: QueueMode;
}) {
  return (
    <Popover label="Ajustes" icon={<Settings2 className="h-3.5 w-3.5" />}>
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">
            Límites diarios (Anki)
          </div>
          {queueMode !== "anki" ? (
            <div className="rounded-md border border-white/10 bg-white/5 p-2 text-[11px] text-white/60">
              Los límites sólo se aplican en el modo <strong className="text-white">Anki</strong>.
            </div>
          ) : null}
          <LimitField
            label="Nuevas/día"
            value={dailyLimits.newLimit}
            onChange={(v) => onDailyLimitsChange({ newLimit: v })}
            disabled={queueMode !== "anki"}
          />
          <LimitField
            label="Repasos/día"
            value={dailyLimits.reviewLimit}
            onChange={(v) => onDailyLimitsChange({ reviewLimit: v })}
            disabled={queueMode !== "anki"}
          />
          <LimitField
            label="Learning/día"
            value={dailyLimits.learningLimit}
            onChange={(v) => onDailyLimitsChange({ learningLimit: v })}
            disabled={queueMode !== "anki"}
          />
        </div>
        <div className="border-t border-white/10 pt-2">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 hover:bg-white/10"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reiniciar sesión
          </button>
        </div>
      </div>
    </Popover>
  );
}

function LimitField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/70">{label}</span>
      <input
        type="number"
        min={0}
        max={9999}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value || 0))}
        disabled={disabled}
        className="h-8 w-20 rounded-md border border-white/15 bg-white/10 px-2 text-right text-xs text-white outline-none focus:border-white/40 disabled:opacity-40"
      />
    </label>
  );
}
