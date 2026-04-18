"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RotateCw } from "lucide-react";

import { DeckBuilder } from "@/components/deck-builder";
import { DeckSelect } from "@/components/deck-select";
import { ImageOcclusionCreator } from "@/components/image-occlusion-creator";
import { ImageOcclusionPreview } from "@/components/image-occlusion-preview";
import { SrsStats } from "@/components/srs-stats";
import { SubjectSelect } from "@/components/subject-select";
import { Button } from "@/components/ui/button";
// Card imports removed — page uses standalone layout now
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { algoStats, buildStudyQueueAnkiLike, buildTodayPlan, cardMastery, deckMastery, dueQueue, isLeech, type SrsDailyLimits } from "@/lib/srs-algo";
import { clozeIndices } from "@/lib/srs-cloze-utils";
import { renderCloze } from "@/lib/srs-cloze";
import { markSrsDeckVisited } from "@/lib/rabbit-guide";
import { applyReview, loadSrsLibrary, resetCardLapses, saveSrsLibrary, setCardConfidence } from "@/lib/srs-storage";
import { SrsFiltersPanel } from "./_components/srs-filters-panel";
import { ConfidenceRater } from "./_components/confidence-rater";
import { AiCardComposer } from "./_components/ai-card-composer";
import { CardBrowser } from "./_components/card-browser";
import { ExplainButton } from "./_components/explain-button";
import { toast } from "@/components/ui/toast";
import { incrementStat } from "@/lib/stats-store";
import {
  clearSession,
  freshSession,
  loadSession,
  saveSession,
  type SrsSessionState,
} from "@/lib/srs-session";
import type { SrsCard, SrsConfidence, SrsLibrary, SrsRating } from "@/lib/srs";

type SlideAnim = "none" | "next";

const LIMITS_KEY = "somagnus:srs:anki-limits:v1";
const DEFAULT_DAILY_LIMITS: SrsDailyLimits = {
  newLimit: 20,
  reviewLimit: 200,
  learningLimit: 100,
};

export function SrsClient() {
  const [lib, setLib] = useState<SrsLibrary>(() => loadSrsLibrary());
  const [subject, setSubject] = useState<string>("histologia");
  const [deckId, setDeckId] = useState<string>("deck-histo");
  const [state, setState] = useState<SrsSessionState | null>(() => loadSession());
  const [slide, setSlide] = useState<SlideAnim>("none");
  const [queueMode, setQueueMode] = useState<"anki" | "due" | "all" | "today">("anki");
  const [studyMode, setStudyMode] = useState<"anki" | "confidence">(() => {
    if (typeof window === "undefined") return "anki";
    try {
      const raw = window.localStorage.getItem("somagnus:srs:study-mode:v1");
      return raw === "confidence" ? "confidence" : "anki";
    } catch {
      return "anki";
    }
  });
  const [dailyLimits, setDailyLimits] = useState<SrsDailyLimits>(() => {
    try {
      const raw = window.localStorage.getItem(LIMITS_KEY);
      if (!raw) return DEFAULT_DAILY_LIMITS;
      const parsed = JSON.parse(raw) as Partial<SrsDailyLimits>;
      if (!parsed) return DEFAULT_DAILY_LIMITS;
      return {
        newLimit: typeof parsed.newLimit === "number" ? parsed.newLimit : DEFAULT_DAILY_LIMITS.newLimit,
        reviewLimit: typeof parsed.reviewLimit === "number" ? parsed.reviewLimit : DEFAULT_DAILY_LIMITS.reviewLimit,
        learningLimit:
          typeof parsed.learningLimit === "number" ? parsed.learningLimit : DEFAULT_DAILY_LIMITS.learningLimit,
      };
    } catch {
      return DEFAULT_DAILY_LIMITS;
    }
  });
  const cardBtnRef = useRef<HTMLButtonElement | null>(null);
  const stateRef = useRef<SrsSessionState | null>(state);

  useEffect(() => {
    try {
      window.localStorage.setItem(LIMITS_KEY, JSON.stringify(dailyLimits));
    } catch {
      return;
    }
  }, [dailyLimits]);

  useEffect(() => {
    try {
      window.localStorage.setItem("somagnus:srs:study-mode:v1", studyMode);
    } catch {
      return;
    }
  }, [studyMode]);

  useEffect(() => {
    saveSrsLibrary(lib);
  }, [lib]);

  useEffect(() => {
    if (state) saveSession(state);
  }, [state]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const decksForSubject = useMemo(() => {
    return lib.decks.filter((d) => (subject === "all" ? true : d.subjectSlug === subject));
  }, [lib.decks, subject]);

  const resolvedDeckId = useMemo(() => {
    if (decksForSubject.some((d) => d.id === deckId)) return deckId;
    return decksForSubject[0]?.id ?? deckId;
  }, [decksForSubject, deckId]);

  const cardsInDeck = useMemo(() => {
    return lib.cards.filter((c) => c.deckId === resolvedDeckId);
  }, [lib.cards, resolvedDeckId]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [leechOnly, setLeechOnly] = useState(false);

  // Derive effective filters against the current deck so switching deck
  // naturally drops stale tags without triggering setState-in-effect loops.
  const availableTagSet = useMemo(() => {
    const set = new Set<string>();
    for (const card of cardsInDeck) {
      for (const tag of card.tags ?? []) {
        const trimmed = typeof tag === "string" ? tag.trim() : "";
        if (trimmed) set.add(trimmed);
      }
    }
    return set;
  }, [cardsInDeck]);

  const effectiveTags = useMemo(
    () => selectedTags.filter((t) => availableTagSet.has(t)),
    [selectedTags, availableTagSet],
  );

  const filteredCards = useMemo(() => {
    let list = cardsInDeck;
    if (effectiveTags.length) {
      const tagSet = new Set(effectiveTags);
      list = list.filter((c) => (c.tags ?? []).some((t) => tagSet.has(t)));
    }
    if (leechOnly) {
      list = list.filter((c) => isLeech(c));
    }
    return list;
  }, [cardsInDeck, effectiveTags, leechOnly]);

  const cardsForSession = useMemo(() => {
    if (queueMode === "anki") return buildStudyQueueAnkiLike(filteredCards, dailyLimits);
    if (queueMode === "due") return dueQueue(filteredCards);
    if (queueMode === "today") return buildTodayPlan(filteredCards, 50);
    return [...filteredCards];
  }, [filteredCards, queueMode, dailyLimits]);

  const handleResetLeech = useCallback((cardId: string) => {
    setLib((prev) => resetCardLapses(prev, cardId));
    toast.success("Tarjeta reseteada. Vuelve a aprendizaje.");
  }, []);

  const ioDeck = useMemo(() => lib.decks.find((d) => d.id === "deck-io") ?? null, [lib.decks]);

  const startDeck = useCallback(() => {
    const q = [...cardsForSession];
    const s = freshSession(resolvedDeckId, q);
    setState(s);
    cardBtnRef.current?.focus();
  }, [cardsForSession, resolvedDeckId]);

  const restart = useCallback(() => {
    clearSession();
    startDeck();
  }, [startDeck]);

  const handleSelectDeck = (nextDeckId: string) => {
    if (state && state.deckId !== nextDeckId) {
      clearSession();
      setState(null);
    }
    setDeckId(nextDeckId);
  };

  const card: SrsCard | null = state ? state.queue[state.currentIndex] ?? null : null;

  const progress = useMemo(() => {
    const total = state?.queue.length ?? 0;
    const done = state ? Math.min(total, state.currentIndex) : 0;
    return { total, done };
  }, [state]);

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const reveal = useCallback(() => setState((p) => (p ? { ...p, revealed: true } : p)), []);
  const flip = useCallback(() => {
    setState((p) => {
      if (!p || p.done) return p;
      const currentCard = p.queue[p.currentIndex] ?? null;
      if (!currentCard) return p;
      return { ...p, revealed: !p.revealed };
    });
  }, []);

  const goNext = useCallback((opts?: { rating?: SrsRating; requeueCurrent?: boolean }) => {
    setSlide("next");
    window.setTimeout(() => {
      setState((p) => {
        if (!p) return p;
        const currentCard = p.queue[p.currentIndex] ?? null;
        let nextQueue = p.queue;

        if (opts?.requeueCurrent && currentCard) {
          const appearsSoon = p.queue
            .slice(p.currentIndex + 1, p.currentIndex + 4)
            .some((qCard) => qCard.id === currentCard.id);
          if (!appearsSoon) {
            nextQueue = [...p.queue];
            const insertAt = Math.min(p.currentIndex + 2, nextQueue.length);
            nextQueue.splice(insertAt, 0, currentCard);
          }
        }

        const nextCounts = opts?.rating
          ? { ...p.counts, [opts.rating]: p.counts[opts.rating] + 1 }
          : p.counts;
        const nextIndex = p.currentIndex + 1;
        const done = nextIndex >= nextQueue.length;
        return {
          ...p,
          queue: nextQueue,
          counts: nextCounts,
          currentIndex: done ? Math.max(nextQueue.length - 1, 0) : nextIndex,
          revealed: false,
          done,
        };
      });
      setSlide("none");
      cardBtnRef.current?.focus();
    }, 170);
  }, []);

  const rate = useCallback((r: SrsRating) => {
    const snapshot = stateRef.current;
    if (!snapshot?.revealed) return;
    const currentCard = snapshot.queue[snapshot.currentIndex] ?? null;
    if (currentCard) {
      const wasNew = currentCard.state === "new";
      setLib((prev) => applyReview(prev, currentCard.id, r));
      incrementStat("srsReviewed", 1);
      if (r === "good" || r === "easy") incrementStat("srsCorrect", 1);
      if (wasNew) incrementStat("srsNew", 1);
    }
    goNext({ rating: r, requeueCurrent: r === "again" });
  }, [goNext]);

  // Brainscape-style confidence rating: also reschedules via FSRS by mapping
  // confidence level to a rating, and stores the confidence value for mastery.
  const rateConfidence = useCallback((value: SrsConfidence) => {
    const snapshot = stateRef.current;
    if (!snapshot) return;
    const currentCard = snapshot.queue[snapshot.currentIndex] ?? null;
    if (!currentCard) return;
    const rating: SrsRating =
      value === 1 ? "again" : value === 2 ? "again" : value === 3 ? "hard" : value === 4 ? "good" : "easy";
    const wasNew = currentCard.state === "new";
    setLib((prev) => {
      const next = applyReview(prev, currentCard.id, rating);
      return setCardConfidence(next, currentCard.id, value);
    });
    incrementStat("srsReviewed", 1);
    if (value >= 4) incrementStat("srsCorrect", 1);
    if (wasNew) incrementStat("srsNew", 1);
    goNext({ rating, requeueCurrent: value <= 2 });
  }, [goNext]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || state.done || !card) return;
      // Don't hijack typing in forms/editors across tabs (AI composer, Navegador, Builder).
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        restart();
        return;
      }
      if (studyMode === "confidence") {
        if (e.key === "1") return rateConfidence(1);
        if (e.key === "2") return rateConfidence(2);
        if (e.key === "3") return rateConfidence(3);
        if (e.key === "4") return rateConfidence(4);
        if (e.key === "5") return rateConfidence(5);
        return;
      }
      if (!state?.revealed) return;
      if (e.key === "1") return rate("again");
      if (e.key === "2") return rate("hard");
      if (e.key === "3") return rate("good");
      if (e.key === "4") return rate("easy");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, card, flip, rate, rateConfidence, restart, studyMode]);

  const selectedDeck = useMemo(() => lib.decks.find((d) => d.id === resolvedDeckId) ?? null, [lib.decks, resolvedDeckId]);

  useEffect(() => {
    if (!selectedDeck) return;
    const subjectSlug =
      selectedDeck.subjectSlug === "anatomia" ||
      selectedDeck.subjectSlug === "histologia" ||
      selectedDeck.subjectSlug === "embriologia" ||
      selectedDeck.subjectSlug === "biologia-celular" ||
      selectedDeck.subjectSlug === "ingles" ||
      selectedDeck.subjectSlug === "trabajo-online"
        ? selectedDeck.subjectSlug
        : null;
    markSrsDeckVisited({
      deckId: selectedDeck.id,
      deckName: selectedDeck.name,
      subjectSlug,
    });
  }, [selectedDeck]);

  const deckStats = useMemo(() => {
    const total = filteredCards.length;
    const byType = filteredCards.reduce(
      (acc, c) => {
        acc[c.type] = (acc[c.type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    const algo = algoStats(filteredCards);
    const mastery = deckMastery(filteredCards);
    return { total, byType, algo, mastery };
  }, [filteredCards]);

  const sessionCounts = state?.counts ?? { again: 0, hard: 0, good: 0, easy: 0 };
  const remaining = state ? Math.max(0, state.queue.length - state.currentIndex) : 0;

  const renderFront = (c: SrsCard) => {
    if (c.type === "image_occlusion" && c.io) {
      return (
        <div className="space-y-3">
          <div className="text-lg font-semibold leading-snug">{c.front}</div>
          <ImageOcclusionPreview io={c.io} reveal={false} />
        </div>
      );
    }
    if (c.type === "cloze") {
      return (
        <div className="text-2xl font-semibold leading-snug">
          {renderCloze(c.front, { reveal: false, clozeIndex: state?.clozeIndex ?? 1 })}
        </div>
      );
    }
    return <div className="text-2xl font-semibold leading-snug">{c.front}</div>;
  };

  const renderBack = (c: SrsCard) => {
    if (c.type === "image_occlusion" && c.io) {
      return (
        <div className="space-y-3">
          <div className="text-lg leading-relaxed text-foreground/95">{c.back}</div>
          <ImageOcclusionPreview io={c.io} reveal />
        </div>
      );
    }
    if (c.type === "cloze") {
      return (
        <div className="space-y-2">
          <div className="text-lg leading-relaxed text-foreground/95">
            {renderCloze(c.front, { reveal: true, clozeIndex: state?.clozeIndex ?? 1 })}
          </div>
          {c.back ? <div className="text-sm text-muted-foreground">{c.back}</div> : null}
        </div>
      );
    }
    return <div className="text-lg leading-relaxed text-foreground/95">{c.back}</div>;
  };

  const clozeOptions = useMemo(() => {
    if (!card || card.type !== "cloze") return [];
    return clozeIndices(card.front);
  }, [card]);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Repetición espaciada</h1>
          <p className="text-sm text-foreground/70">
            Atajos: <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">Espacio</kbd> voltear · <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">1-4</kbd> calificar · <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono">R</kbd> reiniciar
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={restart}>
          <RotateCw className="h-3.5 w-3.5" />
          Reiniciar
        </Button>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="study" className="w-full rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-widest text-foreground/70">Materia</div>
              <SubjectSelect value={subject} onChange={setSubject} allowAll />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-widest text-foreground/70">Deck</div>
              <DeckSelect value={resolvedDeckId} onChange={handleSelectDeck} decks={decksForSubject} />
            </div>

            <div className="ml-auto">
              <TabsList>
                <TabsTrigger value="study">Estudiar</TabsTrigger>
                <TabsTrigger value="ai">IA</TabsTrigger>
                <TabsTrigger value="browser">Navegador</TabsTrigger>
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="io">IO</TabsTrigger>
              </TabsList>
            </div>
          </div>

            <TabsContent value="study" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={queueMode === "anki" ? "secondary" : "outline"}
                  className={queueMode === "anki" ? "border border-white/25 bg-white text-black hover:bg-white/90" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}
                  onClick={() => setQueueMode("anki")}
                >
                  Anki
                </Button>
                <Button
                  variant={queueMode === "due" ? "secondary" : "outline"}
                  className={queueMode === "due" ? "border border-white/25 bg-white text-black hover:bg-white/90" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}
                  onClick={() => setQueueMode("due")}
                >
                  Due hoy
                </Button>
                <Button
                  variant={queueMode === "all" ? "secondary" : "outline"}
                  className={queueMode === "all" ? "border border-white/25 bg-white text-black hover:bg-white/90" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}
                  onClick={() => setQueueMode("all")}
                >
                  Todo el deck
                </Button>
                <Button
                  variant={queueMode === "today" ? "secondary" : "outline"}
                  className={queueMode === "today" ? "border border-white/25 bg-white text-black hover:bg-white/90" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}
                  onClick={() => setQueueMode("today")}
                  title="Plan adaptativo: prioriza las cartas con menor retención prevista"
                >
                  Plan hoy
                </Button>
                <Button className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={startDeck} disabled={cardsInDeck.length === 0}>
                  Iniciar
                </Button>
                <Button variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15" onClick={() => setState(null)}>
                  Salir
                </Button>

                <div className="ml-auto flex items-center gap-1 rounded-full border border-white/20 bg-white/5 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setStudyMode("anki")}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      studyMode === "anki" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                    }`}
                    title="Modo Anki: revelar → calificar 1-4"
                  >
                    Anki
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudyMode("confidence")}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      studyMode === "confidence" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                    }`}
                    title="Modo Brainscape: confianza 1-5 sin voltear"
                  >
                    Confianza
                  </button>
                </div>
              </div>

              {queueMode === "anki" ? (
                <div className="grid gap-2 rounded-xl border border-white/20 bg-white/5 p-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-foreground/70">Límite New</div>
                    <input
                      className="h-9 w-full rounded-md border border-white/25 bg-white/8 px-3 text-sm"
                      type="number"
                      min={0}
                      max={9999}
                      value={dailyLimits.newLimit}
                      onChange={(e) =>
                        setDailyLimits((p) => ({ ...p, newLimit: Number(e.currentTarget.value || 0) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-foreground/70">Límite Review</div>
                    <input
                      className="h-9 w-full rounded-md border border-white/25 bg-white/8 px-3 text-sm"
                      type="number"
                      min={0}
                      max={9999}
                      value={dailyLimits.reviewLimit}
                      onChange={(e) =>
                        setDailyLimits((p) => ({ ...p, reviewLimit: Number(e.currentTarget.value || 0) }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-foreground/70">Límite Learning</div>
                    <input
                      className="h-9 w-full rounded-md border border-white/25 bg-white/8 px-3 text-sm"
                      type="number"
                      min={0}
                      max={9999}
                      value={dailyLimits.learningLimit}
                      onChange={(e) =>
                        setDailyLimits((p) => ({ ...p, learningLimit: Number(e.currentTarget.value || 0) }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              <SrsFiltersPanel
                cardsInDeck={cardsInDeck}
                selectedTags={effectiveTags}
                onSelectedTagsChange={setSelectedTags}
                leechOnly={leechOnly}
                onLeechOnlyChange={setLeechOnly}
                onResetLeech={handleResetLeech}
                filteredCount={filteredCards.length}
              />

              <div className="grid gap-3 lg:grid-cols-[1fr,260px]">
                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wider text-foreground/70">Deck</div>
                  <div className="mt-1 text-sm font-medium">{selectedDeck?.name ?? "-"}</div>
                  {selectedDeck?.description ? (
                    <div className="mt-1 text-xs text-foreground/60">{selectedDeck.description}</div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <div className="rounded-md border border-white/20 bg-white/8 px-2 py-1">
                      Total: {deckStats.total}
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/8 px-2 py-1">
                      Due hoy: {deckStats.algo.dueToday}
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/8 px-2 py-1">
                      New: {deckStats.algo.newCount}
                    </div>
                    <div className="rounded-md border border-white/20 bg-white/8 px-2 py-1">
                      Learning: {deckStats.algo.learning}
                    </div>
                    <div className="rounded-md border border-white/20 bg-gradient-to-r from-rose-400/20 via-amber-300/20 to-emerald-400/20 px-2 py-1 font-medium text-white">
                      Mastery: {deckStats.mastery}%
                    </div>
                  </div>
                </div>

                <SrsStats
                  total={state?.queue.length ?? 0}
                  remaining={state ? Math.max(0, state.queue.length - state.currentIndex) : 0}
                  counts={sessionCounts}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">Progreso</div>
                  <div className="tabular-nums">
                    {Math.min(progress.done + 1, progress.total)}/{progress.total}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {!state ? (
                <div className="rounded-xl border border-white/20 bg-white/5 p-6 text-sm text-foreground/70">
                  Elegí un deck y tocá “Iniciar”.
                </div>
              ) : state.done ? (
                <div className="space-y-3">
                  <div className="text-sm text-foreground/70">Sesión terminada</div>
                  <SrsStats total={progress.total} remaining={remaining} counts={sessionCounts} />
                  <div className="flex gap-2">
                    <Button className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={restart}>Reiniciar sesión</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {card?.type === "cloze" && clozeOptions.length > 1 ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/5 p-3 text-sm">
                      <div className="text-foreground/70">Cloze:</div>
                      {clozeOptions.map((n) => (
                        <Button
                          key={n}
                          size="sm"
                          variant={(state.clozeIndex ?? 1) === n ? "secondary" : "outline"}
                          className={(state.clozeIndex ?? 1) === n ? "border border-white/25 bg-white text-black hover:bg-white/90" : "border-white/25 bg-white/10 text-white hover:bg-white/15"}
                          onClick={() => setState((p) => (p ? { ...p, clozeIndex: n } : p))}
                          disabled={state.revealed}
                        >
                          c{n}
                        </Button>
                      ))}
                      <div className="text-xs text-foreground/60">(Elegí antes de voltear)</div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[1fr,260px]">
                    <div className="[perspective:1200px]" data-slide={slide}>
                      <button
                        ref={cardBtnRef}
                        type="button"
                        onClick={flip}
                        className={`group relative w-full rounded-2xl border border-white/20 bg-white/8 p-0 text-left shadow-[0_24px_55px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 active:scale-[0.99] ${
                          slide === "next" ? "translate-x-2 opacity-0" : "translate-x-0 opacity-100"
                        }`}
                      >
                        <div
                          className={`relative min-h-[320px] w-full rounded-2xl p-6 transition-transform duration-500 [transform-style:preserve-3d] ${
                            state.revealed ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
                          }`}
                        >
                          <div className="absolute inset-0 rounded-2xl p-6 [backface-visibility:hidden]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs uppercase tracking-wider text-foreground/70">Frente</div>
                              <div className="text-xs text-foreground/60">Click / Espacio</div>
                            </div>
                            <div className="mt-4">{card ? renderFront(card) : null}</div>
                            {card?.tags?.length ? (
                              <div className="mt-6 text-xs text-foreground/60">{card.tags.join(" · ")}</div>
                            ) : null}
                          </div>

                          <div className="absolute inset-0 rounded-2xl p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs uppercase tracking-wider text-foreground/70">Reverso</div>
                              <div className="text-xs text-foreground/60">1–4</div>
                            </div>
                            <div className="mt-4">{card ? renderBack(card) : null}</div>
                            {card?.tags?.length ? (
                              <div className="mt-6 text-xs text-foreground/60">{card.tags.join(" · ")}</div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {studyMode === "confidence" && card ? (
                        <ConfidenceRater
                          value={(card.confidence ?? null) as SrsConfidence | null}
                          masteryPct={cardMastery(card)}
                          onRate={(v) => rateConfidence(v)}
                        />
                      ) : (
                        <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                          <div className="text-xs uppercase tracking-wider text-foreground/70">Controles</div>
                          <div className="mt-3 flex flex-col gap-2">
                            {!state.revealed ? (
                              <Button className="border border-white/25 bg-white text-black hover:bg-white/90" onClick={reveal}>Mostrar respuesta</Button>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" className="border-red-300/35 bg-red-500/8 text-red-100 hover:bg-red-500/15" onClick={() => rate("again")}>
                                  1 · Again
                                </Button>
                                <Button variant="outline" className="border-amber-300/35 bg-amber-500/8 text-amber-100 hover:bg-amber-500/15" onClick={() => rate("hard")}>
                                  2 · Hard
                                </Button>
                                <Button variant="secondary" className="border border-white/25 bg-white/85 text-black hover:bg-white" onClick={() => rate("good")}>
                                  3 · Good
                                </Button>
                                <Button className="border border-emerald-300/35 bg-emerald-400/85 text-black hover:bg-emerald-300" onClick={() => rate("easy")}>4 · Easy</Button>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              className="border-white/25 bg-white/10 text-white hover:bg-white/15"
                              onClick={() => goNext()}
                              disabled={state.currentIndex >= state.queue.length - 1}
                            >
                              Saltar
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-wider text-foreground/70">Estado</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-md border border-white/15 bg-white/8 p-2">Again: {sessionCounts.again}</div>
                          <div className="rounded-md border border-white/15 bg-white/8 p-2">Hard: {sessionCounts.hard}</div>
                          <div className="rounded-md border border-white/15 bg-white/8 p-2">Good: {sessionCounts.good}</div>
                          <div className="rounded-md border border-white/15 bg-white/8 p-2">Easy: {sessionCounts.easy}</div>
                        </div>
                      </div>

                      {card ? (
                        <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                          <div className="mb-2 text-xs uppercase tracking-wider text-foreground/70">Ayuda IA</div>
                          <ExplainButton
                            front={card.front}
                            back={card.back}
                            subjectSlug={card.subjectSlug}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <AiCardComposer
                lib={lib}
                deckId={resolvedDeckId}
                subjectSlug={selectedDeck?.subjectSlug ?? subject}
                onLibraryChange={(next) => setLib(next)}
              />
            </TabsContent>

            <TabsContent value="browser" className="space-y-4">
              <CardBrowser lib={lib} onLibraryChange={(next) => setLib(next)} />
            </TabsContent>

            <TabsContent value="builder" className="space-y-4">
              <DeckBuilder
                lib={lib}
                onChange={(next) => setLib(next)}
                selectedDeckId={resolvedDeckId}
                onSelectDeck={handleSelectDeck}
              />
            </TabsContent>

            <TabsContent value="io" className="space-y-4">
              {ioDeck ? (
                <ImageOcclusionCreator
                  lib={lib}
                  ioDeck={ioDeck}
                  onChange={(next) => {
                    setLib(next);
                    if (resolvedDeckId === ioDeck.id) {
                      const q = next.cards.filter((c) => c.deckId === resolvedDeckId);
                      setState((p) => (p ? { ...p, queue: q } : p));
                    }
                  }}
                />
              ) : null}
            </TabsContent>
          </Tabs>
      </div>
    </div>
  );
}
