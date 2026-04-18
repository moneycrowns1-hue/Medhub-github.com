"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { CheckSquare, Flame, Search, Square, Tag as TagIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DeckSelect } from "@/components/deck-select";
import { cardMastery, isLeech } from "@/lib/srs-algo";
import {
  bulkAddTag,
  bulkDeleteCards,
  bulkMoveCards,
  bulkRemoveTag,
  bulkResetLapses,
} from "@/lib/srs-storage";
import type { SrsCardType, SrsLibrary } from "@/lib/srs";

type Props = {
  lib: SrsLibrary;
  onLibraryChange: (next: SrsLibrary) => void;
};

type FilterState = {
  subject: string;
  deckId: string | "all";
  type: SrsCardType | "all";
  leechOnly: boolean;
  query: string;
  tag: string;
};

const DEFAULT_FILTERS: FilterState = {
  subject: "all",
  deckId: "all",
  type: "all",
  leechOnly: false,
  query: "",
  tag: "",
};

const PAGE_SIZE = 100;

function truncate(s: string, n = 140) {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function formatDue(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const diff = ms - Date.now();
  const days = Math.round(diff / 86400000);
  if (days < -1) return `hace ${-days}d`;
  if (days === -1) return "ayer";
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days}d`;
}

export function CardBrowser({ lib, onLibraryChange }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(0);
  const [bulkTag, setBulkTag] = useState("");
  const [moveTarget, setMoveTarget] = useState<string>("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const d of lib.decks) set.add(d.subjectSlug);
    return ["all", ...Array.from(set).sort()];
  }, [lib.decks]);

  const decksForSubject = useMemo(() => {
    if (filters.subject === "all") return lib.decks;
    return lib.decks.filter((d) => d.subjectSlug === filters.subject);
  }, [lib.decks, filters.subject]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of lib.cards) for (const t of c.tags ?? []) if (t) set.add(t);
    return Array.from(set).sort();
  }, [lib.cards]);

  const filteredCards = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const deckIds = new Set(decksForSubject.map((d) => d.id));
    return lib.cards.filter((c) => {
      if (filters.subject !== "all" && !deckIds.has(c.deckId)) return false;
      if (filters.deckId !== "all" && c.deckId !== filters.deckId) return false;
      if (filters.type !== "all" && c.type !== filters.type) return false;
      if (filters.leechOnly && !isLeech(c)) return false;
      if (filters.tag && !(c.tags ?? []).includes(filters.tag)) return false;
      if (q) {
        const hay = `${c.front}\n${c.back}\n${(c.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [lib.cards, filters, decksForSubject]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pagedCards = filteredCards.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  // Any filter change resets selection + returns to page 0 via a single helper.
  const applyFilters = useCallback(
    (patch: Partial<FilterState>) => {
      setFilters((f) => ({ ...f, ...patch }));
      setSelectedIds(new Set());
      setPage(0);
    },
    [],
  );

  useEffect(() => {
    if (!rootRef.current) return;
    const nodes = rootRef.current.querySelectorAll<HTMLElement>("[data-browser-row]");
    if (!nodes.length) return;
    gsap.fromTo(
      nodes,
      { y: 6, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.25, stagger: 0.008, ease: "power2.out", clearProps: "all" },
    );
  }, [clampedPage, filteredCards.length]);

  const allSelected = pagedCards.length > 0 && pagedCards.every((c) => selectedIds.has(c.id));

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const c of pagedCards) next.delete(c.id);
      } else {
        for (const c of pagedCards) next.add(c.id);
      }
      return next;
    });
  }, [allSelected, pagedCards]);

  const selectedList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const doBulk = useCallback(
    (fn: (lib: SrsLibrary, ids: string[]) => SrsLibrary, msg: string) => {
      if (!selectedList.length) return;
      const next = fn(lib, selectedList);
      onLibraryChange(next);
      setSelectedIds(new Set());
      toast.success(msg);
    },
    [selectedList, lib, onLibraryChange],
  );

  const handleBulkDelete = useCallback(() => {
    doBulk(bulkDeleteCards, `${selectedList.length} eliminadas.`);
  }, [doBulk, selectedList.length]);

  const handleBulkReset = useCallback(() => {
    doBulk(bulkResetLapses, `${selectedList.length} reseteadas a aprendizaje.`);
  }, [doBulk, selectedList.length]);

  const handleBulkMove = useCallback(() => {
    if (!moveTarget) {
      toast.warning("Elegí un deck destino primero.");
      return;
    }
    const next = bulkMoveCards(lib, selectedList, moveTarget);
    onLibraryChange(next);
    setSelectedIds(new Set());
    toast.success(`${selectedList.length} movidas.`);
  }, [lib, selectedList, moveTarget, onLibraryChange]);

  const handleBulkAddTag = useCallback(() => {
    const t = bulkTag.trim();
    if (!t) {
      toast.warning("Escribí un tag primero.");
      return;
    }
    onLibraryChange(bulkAddTag(lib, selectedList, t));
    toast.success(`Tag “${t}” agregado a ${selectedList.length}.`);
    setBulkTag("");
  }, [lib, selectedList, bulkTag, onLibraryChange]);

  const handleBulkRemoveTag = useCallback(() => {
    const t = bulkTag.trim();
    if (!t) return;
    onLibraryChange(bulkRemoveTag(lib, selectedList, t));
    toast.success(`Tag “${t}” quitado de ${selectedList.length}.`);
    setBulkTag("");
  }, [lib, selectedList, bulkTag, onLibraryChange]);

  return (
    <div ref={rootRef} className="space-y-3">
      {/* Filters */}
      <div className="grid gap-2 rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm md:grid-cols-[1fr,180px,160px,140px,auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-white/50" />
          <input
            className="h-9 w-full rounded-lg border border-white/15 bg-white/5 pl-7 pr-2 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35"
            placeholder="Buscar en front/back/tags…"
            value={filters.query}
            onChange={(e) => applyFilters({ query: e.currentTarget.value })}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-white/15 bg-white/5 px-2 text-sm text-white outline-none focus:border-white/35"
          value={filters.subject}
          onChange={(e) => applyFilters({ subject: e.currentTarget.value, deckId: "all" })}
        >
          {subjects.map((s) => (
            <option key={s} value={s} className="bg-black text-white">
              {s === "all" ? "Todas las materias" : s}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-white/15 bg-white/5 px-2 text-sm text-white outline-none focus:border-white/35"
          value={filters.deckId}
          onChange={(e) => applyFilters({ deckId: e.currentTarget.value })}
        >
          <option value="all" className="bg-black text-white">Todos los decks</option>
          {decksForSubject.map((d) => (
            <option key={d.id} value={d.id} className="bg-black text-white">
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-white/15 bg-white/5 px-2 text-sm text-white outline-none focus:border-white/35"
          value={filters.type}
          onChange={(e) => applyFilters({ type: e.currentTarget.value as SrsCardType | "all" })}
        >
          <option value="all" className="bg-black text-white">Todos los tipos</option>
          <option value="basic" className="bg-black text-white">basic</option>
          <option value="cloze" className="bg-black text-white">cloze</option>
          <option value="image_occlusion" className="bg-black text-white">image_occlusion</option>
        </select>
        <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 text-xs text-white">
          <input
            type="checkbox"
            checked={filters.leechOnly}
            onChange={(e) => applyFilters({ leechOnly: e.currentTarget.checked })}
          />
          <Flame className="h-3 w-3 text-rose-300" /> Leeches
        </label>
      </div>

      {allTags.length ? (
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/15 bg-white/5 p-2 text-[11px] backdrop-blur-sm">
          <TagIcon className="h-3 w-3 text-white/60" />
          <button
            type="button"
            onClick={() => applyFilters({ tag: "" })}
            className={`rounded-full border border-white/20 px-2 py-0.5 ${
              filters.tag === "" ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            Todos
          </button>
          {allTags.slice(0, 40).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => applyFilters({ tag: filters.tag === t ? "" : t })}
              className={`rounded-full border border-white/20 px-2 py-0.5 ${
                filters.tag === t ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/15"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {/* Bulk actions */}
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/20 bg-white/10 p-2 text-xs backdrop-blur-sm">
          <span className="font-medium text-white">{selectedIds.size} seleccionadas</span>
          <div className="flex items-center gap-1">
            <DeckSelect
              value={moveTarget || decksForSubject[0]?.id || ""}
              onChange={setMoveTarget}
              decks={lib.decks}
            />
            <Button
              size="sm"
              className="border border-white/25 bg-white/85 text-black hover:bg-white"
              onClick={handleBulkMove}
              disabled={!moveTarget}
            >
              Mover
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <input
              className="h-7 rounded-md border border-white/15 bg-white/5 px-2 text-xs text-white outline-none focus:border-white/35"
              placeholder="tag"
              value={bulkTag}
              onChange={(e) => setBulkTag(e.currentTarget.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-white/25 bg-white/10 text-white hover:bg-white/15"
              onClick={handleBulkAddTag}
            >
              + Tag
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/25 bg-white/10 text-white hover:bg-white/15"
              onClick={handleBulkRemoveTag}
            >
              − Tag
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
            onClick={handleBulkReset}
          >
            Reset lapses
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-rose-300/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            onClick={handleBulkDelete}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Eliminar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpiar selección
          </Button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm">
        <div className="grid grid-cols-[32px,1fr,120px,80px,60px,60px,70px] items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2 text-[10px] uppercase tracking-wider text-white/60">
          <button
            type="button"
            onClick={togglePage}
            className="flex h-5 w-5 items-center justify-center rounded border border-white/25 bg-white/8 text-white/80 hover:bg-white/15"
            title={allSelected ? "Deseleccionar página" : "Seleccionar página"}
          >
            {allSelected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </button>
          <div>Front / Back</div>
          <div>Deck</div>
          <div>Tipo</div>
          <div>Due</div>
          <div>Laps</div>
          <div className="text-right">Mastery</div>
        </div>

        {pagedCards.length === 0 ? (
          <div className="p-6 text-center text-xs text-white/60">No hay tarjetas para estos filtros.</div>
        ) : (
          <div>
            {pagedCards.map((c) => {
              const deck = lib.decks.find((d) => d.id === c.deckId);
              const selected = selectedIds.has(c.id);
              const leech = isLeech(c);
              return (
                <div
                  key={c.id}
                  data-browser-row
                  className={`grid grid-cols-[32px,1fr,120px,80px,60px,60px,70px] items-center gap-2 border-b border-white/10 px-3 py-2 text-xs transition-colors ${
                    selected ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleOne(c.id)}
                    className="flex h-5 w-5 items-center justify-center rounded border border-white/25 bg-white/8 text-white/80 hover:bg-white/15"
                  >
                    {selected ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                  </button>
                  <div className="min-w-0">
                    <div className="truncate text-white">{truncate(c.front, 90)}</div>
                    <div className="truncate text-[10px] text-white/50">{truncate(c.back, 110)}</div>
                    {c.tags?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="rounded-full border border-white/15 bg-white/8 px-1.5 py-0.5 text-[9px] text-white/70"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="truncate text-white/75" title={deck?.name}>{deck?.name ?? "—"}</div>
                  <div className="text-white/70">{c.type}</div>
                  <div className="tabular-nums text-white/70">{formatDue(c.dueAtMs)}</div>
                  <div className={`tabular-nums ${leech ? "text-rose-300" : "text-white/70"}`}>
                    {c.lapses ?? 0}
                  </div>
                  <div className="text-right text-white/85 tabular-nums">{cardMastery(c)}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-white/70">
        <div>
          {filteredCards.length} tarjeta{filteredCards.length === 1 ? "" : "s"} · página {clampedPage + 1}/{totalPages}
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
