"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { AlertTriangle, ChevronDown, ChevronRight, ListTree, Loader2, RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildPdfIndexFromBlob,
  clearPdfIndexCache,
  getCachedPdfIndex,
  searchPdfIndex,
  type PdfIndex,
  type PdfSearchMatch,
  type PdfTocNode,
} from "@/lib/pdf-toc-search";

type Props = {
  documentId: string | null;
  currentPage: number;
  getBlob: (documentId: string) => Promise<Blob | null>;
  onJumpToPage: (page: number) => void;
};

type Tab = "toc" | "search";

function TocItem({
  node,
  depth,
  onJumpToPage,
  currentPage,
}: {
  node: PdfTocNode;
  depth: number;
  onJumpToPage: (page: number) => void;
  currentPage: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isCurrent = node.page !== null && node.page === currentPage;

  return (
    <li data-toc-item className="space-y-0.5">
      <div
        className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition-colors ${
          isCurrent ? "bg-white/15 text-white" : "text-white/85 hover:bg-white/10"
        }`}
        style={{ paddingLeft: `${Math.min(depth, 4) * 10 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-white/15"
            aria-label={expanded ? "Colapsar" : "Expandir"}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <button
          type="button"
          disabled={node.page === null}
          onClick={() => node.page && onJumpToPage(node.page)}
          className="flex-1 truncate text-left disabled:cursor-not-allowed disabled:opacity-50"
          title={node.title}
        >
          {node.title}
        </button>
        {node.page !== null ? (
          <span className="shrink-0 text-[10px] tabular-nums text-white/55">p. {node.page}</span>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <TocItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onJumpToPage={onJumpToPage}
              currentPage={currentPage}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TocSearchPanel({ documentId, currentPage, getBlob, onJumpToPage }: Props) {
  const [tab, setTab] = useState<Tab>("toc");
  const [index, setIndex] = useState<PdfIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLUListElement | null>(null);

  // Load/refresh index when documentId changes
  const loadIndex = useCallback(
    async (force = false) => {
      if (!documentId) {
        setIndex(null);
        setError(null);
        return;
      }
      if (!force) {
        const cached = getCachedPdfIndex(documentId);
        if (cached) {
          setIndex(cached);
          setError(null);
          return;
        }
      } else {
        clearPdfIndexCache(documentId);
      }
      setLoading(true);
      setError(null);
      try {
        const blob = await getBlob(documentId);
        if (!blob) {
          setError("No se pudo leer el PDF.");
          setIndex(null);
          return;
        }
        const built = await buildPdfIndexFromBlob(documentId, blob);
        setIndex(built);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al indexar el PDF.");
        setIndex(null);
      } finally {
        setLoading(false);
      }
    },
    [documentId, getBlob],
  );

  useEffect(() => {
    void loadIndex(false);
  }, [loadIndex]);

  // Debounce search input
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 220);
    return () => window.clearTimeout(id);
  }, [query]);

  const results = useMemo<PdfSearchMatch[]>(() => {
    if (!index) return [];
    if (debouncedQuery.trim().length < 2) return [];
    return searchPdfIndex(index, debouncedQuery);
  }, [index, debouncedQuery]);

  // GSAP entrance per tab switch
  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-toc-tab-content]", {
        y: 8,
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
      });
      if (tab === "toc") {
        gsap.from("[data-toc-item]", {
          y: 6,
          opacity: 0,
          duration: 0.25,
          ease: "power2.out",
          stagger: 0.015,
        });
      }
    }, rootRef);
    return () => ctx.revert();
  }, [tab, index]);

  // GSAP stagger for search results
  useEffect(() => {
    if (tab !== "search") return;
    if (!results.length) return;
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll<HTMLElement>("[data-search-result]");
    if (!items.length) return;
    gsap.fromTo(
      items,
      { y: 6, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.22, ease: "power2.out", stagger: 0.02 },
    );
  }, [results, tab]);

  const handleJump = (page: number, resultEl?: HTMLElement | null) => {
    if (resultEl) {
      gsap.fromTo(
        resultEl,
        { backgroundColor: "rgba(250, 204, 21, 0.35)" },
        { backgroundColor: "rgba(255,255,255,0.06)", duration: 0.9, ease: "power2.out" },
      );
    }
    onJumpToPage(page);
  };

  const tocCount = useMemo(() => {
    if (!index) return 0;
    const count = (nodes: PdfTocNode[]): number =>
      nodes.reduce((acc, n) => acc + 1 + count(n.children), 0);
    return count(index.outline);
  }, [index]);

  return (
    <div ref={rootRef} className="space-y-2 rounded-lg border border-white/15 bg-white/6 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("toc")}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              tab === "toc"
                ? "border-white/40 bg-white text-black"
                : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            <ListTree className="h-3 w-3" />
            Índice
          </button>
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              tab === "search"
                ? "border-white/40 bg-white text-black"
                : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            <Search className="h-3 w-3" />
            Buscar
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 border-white/25 bg-white/10 px-1.5 text-[10px] text-white hover:bg-white/15"
          onClick={() => void loadIndex(true)}
          disabled={loading || !documentId}
          title="Re-indexar PDF"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md bg-white/5 p-2 text-[11px] text-white/70">
          <Loader2 className="h-3 w-3 animate-spin" />
          Indexando PDF…
        </div>
      ) : error ? (
        <div className="rounded-md border border-rose-300/30 bg-rose-400/10 p-2 text-[11px] text-rose-100">
          {error}
        </div>
      ) : !index ? (
        <div className="rounded-md bg-white/5 p-2 text-[11px] text-white/70">
          Abrí un PDF para ver el índice y buscar en el texto.
        </div>
      ) : index.diagnostics.likelyFontOrCmapIssue ? (
        <div className="space-y-1 rounded-md border border-amber-300/35 bg-amber-300/10 p-2 text-[11px] text-amber-100">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3 w-3" />
            No se pudo decodificar el texto
          </div>
          <div className="text-amber-100/90">
            El PDF contiene texto pero pdfjs no pudo convertir los códigos de carácter
            (faltan CMaps/fuentes estándar o el PDF usa un encoding no soportado).
          </div>
          <div className="text-[10px] tabular-nums text-amber-100/80">
            {index.diagnostics.pagesWithItemsButNoStrings} páginas con operadores de texto
            vacíos · {index.diagnostics.pagesWithoutAnyItems} sin operadores
          </div>
          {index.diagnostics.lastError ? (
            <div className="truncate text-[10px] text-amber-100/70" title={index.diagnostics.lastError}>
              Último error: {index.diagnostics.lastError}
            </div>
          ) : null}
        </div>
      ) : index.diagnostics.likelyScanned ? (
        <div className="space-y-1 rounded-md border border-amber-300/35 bg-amber-300/10 p-2 text-[11px] text-amber-100">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3 w-3" />
            PDF sin capa de texto (escaneado)
          </div>
          <div className="text-amber-100/90">
            Las {index.pageCount} páginas no tienen operadores de texto. Es una imagen
            escaneada sin OCR, así que no hay nada que buscar.
          </div>
          <div className="text-[10px] text-amber-100/80">
            Solución: pasalo por OCR (ocrmypdf, Adobe Acrobat &ldquo;Reconocer texto&rdquo;)
            y re-subilo.
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-white/15 bg-white/5 p-1.5 text-[10px] tabular-nums text-white/70">
          {index.diagnostics.pagesWithText}/{index.pageCount} páginas con texto ·{" "}
          {index.diagnostics.totalCharacters.toLocaleString()} caracteres ·{" "}
          {Math.round(index.diagnostics.averageCharsPerPage)}/pág
          {index.diagnostics.pagesWithItemsButNoStrings > 0
            ? ` · ${index.diagnostics.pagesWithItemsButNoStrings} con decoding fallido`
            : ""}
        </div>
      )}

      {index && !index.diagnostics.likelyScanned && !index.diagnostics.likelyFontOrCmapIssue ? (
        tab === "toc" ? (
        <div data-toc-tab-content className="space-y-1">
          {tocCount === 0 ? (
            <div className="rounded-md bg-white/5 p-2 text-[11px] text-white/70">
              Este PDF no tiene índice incorporado.
            </div>
          ) : (
            <ul className="max-h-[42vh] space-y-0.5 overflow-y-auto pr-1">
              {index.outline.map((node) => (
                <TocItem
                  key={node.id}
                  node={node}
                  depth={0}
                  onJumpToPage={onJumpToPage}
                  currentPage={currentPage}
                />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div data-toc-tab-content className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el documento…"
              className="h-8 w-full rounded-lg border border-white/25 bg-white/8 pl-7 pr-7 text-[11px] text-white outline-none placeholder:text-white/50 focus-visible:border-white/40 focus-visible:ring-1 focus-visible:ring-white/30"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Limpiar"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          <div className="text-[10px] text-white/60">
            {debouncedQuery.trim().length < 2
              ? "Escribí al menos 2 caracteres."
              : results.length === 0
              ? "Sin resultados."
              : `${results.length} resultado${results.length === 1 ? "" : "s"}`}
          </div>

          {results.length ? (
            <ul ref={resultsRef} className="max-h-[42vh] space-y-1 overflow-y-auto pr-1">
              {results.map((m, idx) => (
                <li
                  key={`${m.page}-${idx}`}
                  data-search-result
                  className="rounded-md bg-white/6 p-2 text-[11px] text-white/85"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={(e) => handleJump(m.page, e.currentTarget.parentElement as HTMLElement)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-white/60">Página {m.page}</span>
                      <ChevronRight className="h-3 w-3 text-white/50" />
                    </div>
                    <div className="mt-0.5 leading-snug">
                      {m.snippet.slice(0, m.matchStart)}
                      <mark className="rounded bg-amber-300/40 px-0.5 text-white">
                        {m.snippet.slice(m.matchStart, m.matchEnd)}
                      </mark>
                      {m.snippet.slice(m.matchEnd)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        )
      ) : null}
    </div>
  );
}
