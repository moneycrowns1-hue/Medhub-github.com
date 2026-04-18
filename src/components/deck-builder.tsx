"use client";

import { useMemo, useState } from "react";

import { Trash2 } from "lucide-react";

import type { SrsLibrary } from "@/lib/srs";
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

  const inputCls =
    "h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35";
  const textareaCls =
    "min-h-[80px] w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35";
  const sectionLabel =
    "text-[10px] font-medium uppercase tracking-widest text-white/55";

  return (
    <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
      {/* LEFT COLUMN — materia + crear deck + lista */}
      <div className="space-y-5">
        <div className="space-y-1">
          <div className={sectionLabel}>Materia</div>
          <SubjectSelect value={builderSubject} onChange={setBuilderSubject} />
        </div>

        <div className="space-y-2">
          <div className={sectionLabel}>Crear deck</div>
          <input
            className={inputCls}
            placeholder="Nombre del deck"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Descripción (opcional)"
            value={newDeckDesc}
            onChange={(e) => setNewDeckDesc(e.target.value)}
          />
          <Button
            className="w-full border border-white/25 bg-white text-black hover:bg-white/90"
            onClick={createDeck}
          >
            Crear
          </Button>
        </div>

        <div className="space-y-2">
          <div className={sectionLabel}>Decks ({decks.length})</div>
          <div className="space-y-1.5">
            {decks.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  d.id === selectedDeckId
                    ? "border-white/40 bg-white text-black"
                    : "border-white/15 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => onSelectDeck(d.id)}
              >
                <div className="font-medium">{d.name}</div>
                {d.description ? (
                  <div
                    className={`mt-0.5 text-xs ${
                      d.id === selectedDeckId ? "text-black/60" : "text-white/55"
                    }`}
                  >
                    {d.description}
                  </div>
                ) : null}
              </button>
            ))}
            {!decks.length ? (
              <div className="text-xs text-white/55">No hay decks para esta materia.</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN — deck seleccionado + crear tarjeta + lista */}
      <div className="space-y-6">
        {/* Deck seleccionado */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className={sectionLabel}>Deck seleccionado</div>
              <div className="text-base font-semibold text-white">
                {selectedDeck?.name ?? "—"}
              </div>
            </div>
            {selectedDeck ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-rose-300/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
                onClick={() => onChange(deleteDeck(lib, selectedDeck.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar deck
              </Button>
            ) : null}
          </div>
          {selectedDeck ? (
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className={inputCls}
                value={selectedDeck.name}
                onChange={(e) =>
                  onChange(updateDeck(lib, selectedDeck.id, { name: e.target.value }))
                }
              />
              <input
                className={inputCls}
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
        </section>

        {/* Crear tarjeta */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={sectionLabel}>Crear tarjeta (Basic / Cloze / Caso clínico)</div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  setFront(
                    "Viñeta clínica:\nPaciente de __ años con __.\nAntecedentes: __.\nExamen: __.\n\n¿Cuál es el diagnóstico más probable y por qué?",
                  );
                  setBack(
                    "Diagnóstico: __\nFisiopatología: __\nHallazgo clave: __\nManejo inicial: __\nDx diferenciales: __",
                  );
                  setTags((t) => (t ? `${t}, Caso clínico` : "Caso clínico"));
                }}
              >
                Plantilla: Caso clínico
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  setFront("El {{c1::término}} se define como __.");
                  setBack("Contexto y detalle adicional.");
                }}
              >
                Plantilla: Cloze
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <textarea
              className={textareaCls}
              placeholder="Frente (para cloze usa {{c1::...}})"
              value={front}
              onChange={(e) => setFront(e.target.value)}
            />
            <textarea
              className={textareaCls}
              placeholder="Reverso"
              value={back}
              onChange={(e) => setBack(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Tags (separados por coma)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <Button
              className="w-full border border-white/25 bg-white text-black hover:bg-white/90 disabled:opacity-60"
              onClick={createCard}
              disabled={!selectedDeck}
            >
              Crear tarjeta
            </Button>
          </div>
        </section>

        {/* Tarjetas */}
        <section className="space-y-3">
          <div className={sectionLabel}>Tarjetas ({cards.length})</div>
          <div className="space-y-2">
            {cards.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-white/55">
                    {c.type}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm font-medium text-white">
                    {c.front}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-white/60">{c.back}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-rose-300/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
                  onClick={() => onChange(deleteCard(lib, c.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Borrar
                </Button>
              </div>
            ))}
            {cards.length > 10 ? (
              <div className="text-xs text-white/55">Mostrando 10 de {cards.length}.</div>
            ) : null}
            {!cards.length ? (
              <div className="text-xs text-white/55">Este deck aún no tiene tarjetas.</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
