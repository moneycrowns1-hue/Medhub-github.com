"use client";

import { useMemo, useState } from "react";

import { Plus } from "lucide-react";

import type { SrsDeck, SrsIoBox, SrsLibrary } from "@/lib/srs";
import { addImageOcclusionCard } from "@/lib/srs-storage";
import { ImageOcclusionDrawer } from "@/components/image-occlusion-drawer";
import { ImageOcclusionPreview } from "@/components/image-occlusion-preview";
import { Button } from "@/components/ui/button";

export function ImageOcclusionCreator({
  lib,
  ioDeck,
  onChange,
}: {
  lib: SrsLibrary;
  ioDeck: SrsDeck;
  onChange: (next: SrsLibrary) => void;
}) {
  const [imageUrl, setImageUrl] = useState(
    "https://images.unsplash.com/photo-1582719478185-2a67a89b07c8?auto=format&fit=crop&w=1200&q=60",
  );
  const [front, setFront] = useState("Identificá la estructura marcada.");
  const [back, setBack] = useState("Respuesta: ");
  const [x, setX] = useState(35);
  const [y, setY] = useState(32);
  const [w, setW] = useState(24);
  const [h, setH] = useState(18);
  const [extraBoxes, setExtraBoxes] = useState<SrsIoBox[]>([]);

  const allBoxes = useMemo<SrsIoBox[]>(
    () => [...extraBoxes, { x, y, w, h }],
    [extraBoxes, x, y, w, h],
  );

  const io = useMemo(
    () => ({ imageUrl, box: allBoxes[0], boxes: allBoxes }),
    [imageUrl, allBoxes],
  );

  const addBox = () => {
    setExtraBoxes((p) => [...p, { x, y, w, h }]);
    // Offset the next box slightly so the user can see it.
    setX((v) => Math.min(100, v + 6));
    setY((v) => Math.min(100, v + 6));
  };

  const removeLastBox = () => {
    setExtraBoxes((p) => p.slice(0, -1));
  };

  const create = () => {
    const next = addImageOcclusionCard(lib, {
      deckId: ioDeck.id,
      subjectSlug: ioDeck.subjectSlug,
      front,
      back,
      imageUrl,
      box: allBoxes[0],
      boxes: allBoxes.length > 1 ? allBoxes : undefined,
      tags: ["IO"],
    });
    onChange(next);
    setExtraBoxes([]);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Crear Image Occlusion (MVP)</div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium">URL de imagen</div>
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Coordenadas (%)</div>
          <div className="grid grid-cols-4 gap-2">
            <input className="h-10 rounded-md border border-border bg-background px-2 text-sm" type="number" value={x} onChange={(e) => setX(Number(e.target.value))} />
            <input className="h-10 rounded-md border border-border bg-background px-2 text-sm" type="number" value={y} onChange={(e) => setY(Number(e.target.value))} />
            <input className="h-10 rounded-md border border-border bg-background px-2 text-sm" type="number" value={w} onChange={(e) => setW(Number(e.target.value))} />
            <input className="h-10 rounded-md border border-border bg-background px-2 text-sm" type="number" value={h} onChange={(e) => setH(Number(e.target.value))} />
          </div>
          <div className="text-xs text-muted-foreground">x, y, w, h — relativo al tamaño de la imagen</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-medium">Frente</div>
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={front}
            onChange={(e) => setFront(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium">Reverso</div>
          <input
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </div>
      </div>

      <ImageOcclusionPreview io={io} reveal={false} />

      <ImageOcclusionDrawer
        io={io}
        onChange={(b) => {
          setX(b.x);
          setY(b.y);
          setW(b.w);
          setH(b.h);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={addBox}>
          <Plus className="h-4 w-4" />
          Agregar otra caja
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={removeLastBox}
          disabled={extraBoxes.length === 0}
        >
          Quitar última
        </Button>
        <div className="text-xs text-muted-foreground">
          {allBoxes.length} caja{allBoxes.length === 1 ? "" : "s"} · la activa es la que editás arriba
        </div>
      </div>

      <Button onClick={create}>
        <Plus className="h-4 w-4" />
        Guardar tarjeta IO
      </Button>
    </div>
  );
}
