"use client";

import { useMemo, useState } from "react";

import { Trash2 } from "lucide-react";

import type { SrsDeck, SrsLibrary } from "@/lib/srs";
import {
  addBasicOrClozeCard,
  addDeck,
  deleteCard,
  deleteDeck,
  updateDeck,
} from "@/lib/srs-storage";
import { SubjectSelect } from "@/components/subject-select";
import { Button } from "@/components/ui/button";

export function DeckBuilder({
  lib,
  onChange,
  selectedDeckId,
  onSelectDeck,
}: {
  lib: SrsLibrary;
  onChange: (next: SrsLibrary) => void;
  selectedDeckId: string;
  onSelectDeck: (deckId: string) => void;
}) {
  const [builderSubject, setBuilderSubject] = useState<string>("histologia");
  const [newDeckName, setNewDeckName] = useState<string>("");
  const [newDeckDesc, setNewDeckDesc] = useState<string>("");

  const [front, setFront] = useState<string>("");
  const [back, setBack] = useState<string>("");
  const [tags, setTags] = useState<string>("");

  const decks = useMemo(
    () => lib.decks.filter((d) => d.subjectSlug === builderSubject),
    [lib.decks, builderSubject],
  );

  const selectedDeck = useMemo(
    () => lib.decks.find((d) => d.id === selectedDeckId) ?? null,
    [lib.decks, selectedDeckId],
  );

  const cards = useMemo(
    () => lib.cards.filter((c) => c.deckId === selectedDeckId),
    [lib.cards, selectedDeckId],
  );

  const createDeck = () => {
    const name = newDeckName.trim();
    if (!name) return;
    const next = addDeck(lib, {
      name,
      subjectSlug: builderSubject,
      description: newDeckDesc.trim() || undefined,
    });
    onChange(next);
    setNewDeckName("");
    setNewDeckDesc("");
  };

  const createCard = () => {
    if (!selectedDeck) return;
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;
    const next = addBasicOrClozeCard(lib, {
      deckId: selectedDeck.id,
      subjectSlug: selectedDeck.subjectSlug,
      front: f,
      back: b,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    onChange(next);
    setFront("");
    setBack("");
    setTags("");
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Builder</div>
          <div className="text-lg font-semibold">Decks & Cards</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Materia</div>
            <SubjectSelect value={builderSubject} onChange={setBuilderSubject} />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Crear deck</div>
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Nombre del deck"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
            />
            <input
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Descripción (opcional)"
              value={newDeckDesc}
              onChange={(e) => setNewDeckDesc(e.target.value)}
            />
            <Button onClick={createDeck}>Crear</Button>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Decks</div>
            <div className="space-y-2">
              {decks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    d.id === selectedDeckId
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                  onClick={() => onSelectDeck(d.id)}
                >
                  <div className="font-medium">{d.name}</div>
                  {d.description ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">{d.description}</div>
                  ) : null}
                </button>
              ))}
              {!decks.length ? (
                <div className="text-sm text-muted-foreground">No hay decks para esta materia.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Deck seleccionado</div>
                <div className="text-sm font-medium">{selectedDeck?.name ?? "-"}</div>
              </div>
              {selectedDeck ? (
                <Button
                  variant="outline"
                  onClick={() => onChange(deleteDeck(lib, selectedDeck.id))}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar deck
                </Button>
              ) : null}
            </div>
            {selectedDeck ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <input
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={selectedDeck.name}
                  onChange={(e) =>
                    onChange(updateDeck(lib, selectedDeck.id, { name: e.target.value }))
                  }
                />
                <input
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  value={selectedDeck.description ?? ""}
                  onChange={(e) =>
                    onChange(
                      updateDeck(lib, selectedDeck.id, {
                        description: e.target.value || undefined,
                      }),
                    )
                  }
                  placeholder="Descripción"
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Crear tarjeta (Basic/Cloze)</div>
            <div className="mt-2 grid gap-2">
              <textarea
                className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Frente (para cloze usa {{c1::...}})"
                value={front}
                onChange={(e) => setFront(e.target.value)}
              />
              <textarea
                className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Reverso"
                value={back}
                onChange={(e) => setBack(e.target.value)}
              />
              <input
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="Tags (coma)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <Button onClick={createCard} disabled={!selectedDeck}>
                Crear tarjeta
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Tarjetas</div>
            <div className="mt-2 space-y-2">
              {cards.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.type}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-medium">{c.front}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.back}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onChange(deleteCard(lib, c.id))}>
                    <Trash2 className="h-4 w-4" />
                    Borrar
                  </Button>
                </div>
              ))}
              {cards.length > 10 ? (
                <div className="text-xs text-muted-foreground">
                  Mostrando 10 de {cards.length}.
                </div>
              ) : null}
              {!cards.length ? (
                <div className="text-sm text-muted-foreground">Este deck aún no tiene tarjetas.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
