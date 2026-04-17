"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ChevronDown, ChevronUp, Flame, RotateCcw, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listLeeches, SRS_LEECH_THRESHOLD } from "@/lib/srs-algo";
import type { SrsCard } from "@/lib/srs";

type Props = {
  cardsInDeck: SrsCard[];
  selectedTags: string[];
  onSelectedTagsChange: (next: string[]) => void;
  leechOnly: boolean;
  onLeechOnlyChange: (next: boolean) => void;
  onResetLeech: (cardId: string) => void;
  filteredCount: number;
};

type TagEntry = { tag: string; count: number };

function collectTagEntries(cards: SrsCard[]): TagEntry[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (!Array.isArray(card.tags)) continue;
    for (const raw of card.tags) {
      const tag = typeof raw === "string" ? raw.trim() : "";
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function SrsFiltersPanel({
  cardsInDeck,
  selectedTags,
  onSelectedTagsChange,
  leechOnly,
  onLeechOnlyChange,
  onResetLeech,
  filteredCount,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const flameRef = useRef<HTMLSpanElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  const tagEntries = useMemo(() => collectTagEntries(cardsInDeck), [cardsInDeck]);
  const leeches = useMemo(() => listLeeches(cardsInDeck), [cardsInDeck]);
  const leechCount = leeches.length;

  // GSAP entrance
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-srs-filter-root]", {
        y: 14,
        opacity: 0,
        duration: 0.45,
        ease: "power3.out",
      });
      gsap.from("[data-srs-tag-chip]", {
        y: 8,
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
        stagger: 0.02,
        delay: 0.1,
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  // GSAP pulse on flame icon when leeches > 0
  useEffect(() => {
    const el = flameRef.current;
    if (!el) return;
    gsap.killTweensOf(el);
    if (leechCount === 0) return;
    gsap.to(el, {
      scale: 1.18,
      duration: 0.8,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
      transformOrigin: "center center",
    });
    return () => {
      gsap.killTweensOf(el);
    };
  }, [leechCount]);

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    onSelectedTagsChange(next);
  };

  const clearTags = () => onSelectedTagsChange([]);

  const handleResetLeech = (cardId: string, buttonEl: HTMLElement | null) => {
    if (buttonEl) {
      gsap.fromTo(
        buttonEl,
        { rotate: 0 },
        { rotate: -360, duration: 0.5, ease: "power2.inOut" },
      );
    }
    onResetLeech(cardId);
  };

  return (
    <div ref={rootRef}>
      <div
        data-srs-filter-root
        className="space-y-3 rounded-xl border border-white/20 bg-white/5 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-foreground/70">
            <Tag className="h-3.5 w-3.5" />
            Filtros
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onLeechOnlyChange(!leechOnly)}
              disabled={leechCount === 0}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                leechOnly
                  ? "border-rose-300/55 bg-rose-400/30 text-rose-50"
                  : "border-white/25 bg-white/10 text-white/85 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
              title={leechCount === 0 ? "Sin leeches en este deck" : "Solo leeches"}
            >
              <span ref={flameRef} className="inline-flex">
                <Flame className="h-3 w-3" />
              </span>
              Leeches · {leechCount}
            </button>
            <div className="text-[11px] text-foreground/65 tabular-nums">
              {filteredCount} tarjeta{filteredCount === 1 ? "" : "s"} tras filtro
            </div>
          </div>
        </div>

        {tagEntries.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] text-foreground/65">
                Tags (OR, {selectedTags.length} seleccionado{selectedTags.length === 1 ? "" : "s"})
              </div>
              {selectedTags.length ? (
                <button
                  type="button"
                  onClick={clearTags}
                  className="text-[11px] text-white/70 underline-offset-2 hover:underline"
                >
                  Limpiar
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tagEntries.map((entry) => {
                const active = selectedTags.includes(entry.tag);
                return (
                  <button
                    key={entry.tag}
                    data-srs-tag-chip
                    type="button"
                    onClick={() => toggleTag(entry.tag)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? "border-white/45 bg-white text-black"
                        : "border-white/25 bg-white/10 text-white/85 hover:bg-white/15"
                    }`}
                  >
                    {entry.tag}
                    <span className={`ml-1 text-[10px] ${active ? "text-black/60" : "text-white/55"}`}>
                      {entry.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-foreground/65">Este deck no tiene tags aún.</div>
        )}

        {leechCount > 0 ? (
          <div className="space-y-2 rounded-lg border border-rose-300/25 bg-rose-400/10 p-3">
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-rose-100"
            >
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5" />
                {leechCount} tarjeta{leechCount === 1 ? "" : "s"} marcada{leechCount === 1 ? "" : "s"} como leech
                <span className="rounded-full border border-rose-300/40 bg-rose-400/20 px-1.5 py-0.5 text-[10px] font-medium text-rose-50">
                  ≥ {SRS_LEECH_THRESHOLD} lapses
                </span>
              </span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {expanded ? (
              <ul className="space-y-1.5">
                {leeches.slice(0, 10).map((card) => (
                  <li
                    key={card.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-white/10 bg-black/20 p-2 text-[11px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-white/90">{card.front}</div>
                      <div className="mt-0.5 text-[10px] text-white/60">
                        {card.lapses ?? 0} lapses · ease {(card.ease ?? 2.5).toFixed(2)}
                        {card.tags?.length ? ` · ${card.tags.slice(0, 3).join(" · ")}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-white/25 bg-white/10 px-2 text-[11px] text-white hover:bg-white/15"
                      onClick={(event) => handleResetLeech(card.id, event.currentTarget as HTMLElement)}
                      title="Resetear estadísticas y re-aprender"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </Button>
                  </li>
                ))}
                {leeches.length > 10 ? (
                  <li className="text-[10px] text-white/55">+ {leeches.length - 10} más…</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
