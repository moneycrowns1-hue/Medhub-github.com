"use client";

import Link from "next/link";
import { Brain, Library } from "lucide-react";

import type { SrsCard, SrsDeck } from "@/lib/srs";

type Props = {
  subjectSlug: string;
  decks: SrsDeck[];
  cards: SrsCard[];
};

function isDueToday(card: SrsCard): boolean {
  if (!card.dueAtMs) return (card.state ?? "new") !== "learning";
  return card.dueAtMs <= Date.now();
}

export function SrsLibraryPanel({ subjectSlug, decks, cards }: Props) {
  const subjectDecks = decks.filter((deck) => deck.subjectSlug === subjectSlug);
  const subjectCards = cards.filter((card) => card.subjectSlug === subjectSlug);

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Library className="h-4 w-4 text-emerald-200" />
          <div>
            <div className="text-xs uppercase tracking-wider text-white/65">Biblioteca SRS</div>
            <div className="text-sm font-semibold text-white">
              {subjectDecks.length} decks · {subjectCards.length} cards
            </div>
          </div>
        </div>
        <Link
          href="/srs"
          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/15"
        >
          <Brain className="h-3.5 w-3.5" />
          Ir a SRS
        </Link>
      </div>

      {!subjectDecks.length ? (
        <div className="mt-3 rounded-xl bg-white/[0.03] p-3 text-xs text-white/55">
          Esta materia aún no tiene decks SRS. Crea uno desde <Link href="/srs" className="underline">SRS</Link>.
        </div>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {subjectDecks.map((deck) => {
            const deckCards = subjectCards.filter((card) => card.deckId === deck.id);
            const due = deckCards.filter(isDueToday).length;
            return (
              <li key={deck.id} className="rounded-xl bg-white/[0.06] p-3 transition-colors hover:bg-white/[0.08]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{deck.name}</div>
                    <div className="text-[11px] text-white/65">
                      {deckCards.length} cards · {due} due hoy
                    </div>
                  </div>
                  <Link
                    href={`/srs?deck=${encodeURIComponent(deck.id)}`}
                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/15"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    Practicar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
