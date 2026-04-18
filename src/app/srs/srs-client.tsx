"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DeckBuilder } from "@/components/deck-builder";
import { ImageOcclusionCreator } from "@/components/image-occlusion-creator";
import { ImageOcclusionPreview } from "@/components/image-occlusion-preview";
import { SrsStats } from "@/components/srs-stats";
import { Button } from "@/components/ui/button";
// Card imports removed — page uses standalone layout now
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { algoStats, buildStudyQueueAnkiLike, buildTodayPlan, cardMastery, deckMastery, dueQueue, isLeech, type SrsDailyLimits } from "@/lib/srs-algo";
import gsap from "gsap";
import { clozeIndices } from "@/lib/srs-cloze-utils";
import { renderCloze } from "@/lib/srs-cloze";
import { markSrsDeckVisited } from "@/lib/rabbit-guide";
import { applyReview, loadSrsLibrary, resetCardLapses, saveSrsLibrary, setCardConfidence } from "@/lib/srs-storage";
import { SrsFiltersPanel } from "./_components/srs-filters-panel";
import { ConfidenceRater } from "./_components/confidence-rater";
import { AiModesHub } from "./_components/ai-modes-hub";
import { SearchOverlay } from "./_components/search-overlay";
import { ExplainButton } from "./_components/explain-button";
import { SessionHud } from "./_components/session-hud";
import { SrsTopbar, type SrsTab } from "./_components/srs-topbar";
import { StartFab } from "./_components/start-fab";
import { toast } from "@/components/ui/toast";
import { incrementStat } from "@/lib/stats-store";
import {
  clearSession,
  freshSession,
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
  // Always start paused. Session persistence was causing the FAB to render as
  // "Pause" when the user re-entered /srs; we now clear any stored session on
  // mount and require an explicit Start click.
  const [state, setState] = useState<SrsSessionState | null>(null);
  const [slide, setSlide] = useState<SlideAnim>("none");
  const [queueMode, setQueueMode] = useState<"anki" | "due" | "all" | "today">("anki");
  const [activeTab, setActiveTab] = useState<SrsTab>("study");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Drop any persisted session exactly once on mount so /srs always opens paused.
  useEffect(() => {
    clearSession();
  }, []);

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

  // GSAP: slide-in animation whenever the visible card changes.
  useEffect(() => {
    const el = cardBtnRef.current;
    if (!el || !card) return;
    gsap.fromTo(
      el,
      { x: 24, opacity: 0, scale: 0.98 },
      { x: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" },
    );
    // We only want to run when the card id changes, not on every card prop update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

  const progress = useMemo(() => {
    const total = state?.queue.length ?? 0;
    const done = state ? Math.min(total, state.currentIndex) : 0;
    return { total, done };
  }, [state]);

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

  // Global search shortcut: Ctrl/⌘+K always; "/" only when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !isTyping && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

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
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as SrsTab)}
        className="w-full space-y-6"
      >
        <SrsTopbar
          activeTab={activeTab}
          subject={subject}
          onSubjectChange={setSubject}
          deckId={resolvedDeckId}
          decks={decksForSubject}
          onDeckChange={handleSelectDeck}
          queueMode={queueMode}
          onQueueModeChange={setQueueMode}
          studyMode={studyMode}
          onStudyModeChange={setStudyMode}
          dailyLimits={dailyLimits}
          onDailyLimitsChange={(patch) =>
            setDailyLimits((p) => ({ ...p, ...patch }))
          }
          onRestart={restart}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          filtersOpen={filtersOpen}
          filteredCount={filteredCards.length}
          onOpenSearch={() => setSearchOpen(true)}
        />

            <TabsContent value="study" className="space-y-4">
              {filtersOpen ? (
                <SrsFiltersPanel
                  cardsInDeck={cardsInDeck}
                  selectedTags={effectiveTags}
                  onSelectedTagsChange={setSelectedTags}
                  leechOnly={leechOnly}
                  onLeechOnlyChange={setLeechOnly}
                  onResetLeech={handleResetLeech}
                  filteredCount={filteredCards.length}
                />
              ) : null}

              <SessionHud
                deckName={selectedDeck?.name ?? "—"}
                deckDescription={selectedDeck?.description}
                stats={{
                  total: deckStats.total,
                  dueToday: deckStats.algo.dueToday,
                  newCount: deckStats.algo.newCount,
                  learning: deckStats.algo.learning,
                  mastery: deckStats.mastery,
                }}
                session={
                  state
                    ? {
                        total: state.queue.length,
                        done: state.currentIndex,
                        again: sessionCounts.again,
                        hard: sessionCounts.hard,
                        good: sessionCounts.good,
                        easy: sessionCounts.easy,
                      }
                    : null
                }
              />

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
              <AiModesHub
                lib={lib}
                deckId={resolvedDeckId}
                subjectSlug={selectedDeck?.subjectSlug ?? subject}
                onLibraryChange={(next) => setLib(next)}
              />
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

      <StartFab
        sessionActive={!!state && !state.done}
        disabled={cardsInDeck.length === 0}
        onStart={startDeck}
        onExit={() => setState(null)}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        lib={lib}
        onLibraryChange={(next) => setLib(next)}
      />
    </div>
  );
}
