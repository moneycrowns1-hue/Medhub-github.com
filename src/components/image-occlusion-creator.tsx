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

  const inputCls =
    "h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/35";
  const numInputCls =
    "h-10 w-full rounded-xl border border-white/15 bg-white/5 px-2 text-center text-sm tabular-nums text-white outline-none focus:border-white/35";
  const sectionLabel =
    "text-[10px] font-medium uppercase tracking-widest text-white/55";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className={sectionLabel}>URL de imagen</div>
          <input
            className={inputCls}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className={sectionLabel}>Coordenadas activa (%)</div>
          <div className="grid grid-cols-4 gap-2">
            <input className={numInputCls} type="number" value={x} onChange={(e) => setX(Number(e.target.value))} />
            <input className={numInputCls} type="number" value={y} onChange={(e) => setY(Number(e.target.value))} />
            <input className={numInputCls} type="number" value={w} onChange={(e) => setW(Number(e.target.value))} />
            <input className={numInputCls} type="number" value={h} onChange={(e) => setH(Number(e.target.value))} />
          </div>
          <div className="text-[11px] text-white/55">x, y, w, h — relativo al tamaño de la imagen</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className={sectionLabel}>Frente</div>
          <input
            className={inputCls}
            value={front}
            onChange={(e) => setFront(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <div className={sectionLabel}>Reverso</div>
          <input
            className={inputCls}
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
        <ImageOcclusionPreview io={io} reveal={false} />
      </div>

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
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10"
          onClick={addBox}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar otra caja
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-white/5 text-white hover:bg-white/10 disabled:opacity-40"
          onClick={removeLastBox}
          disabled={extraBoxes.length === 0}
        >
          Quitar última
        </Button>
        <div className="text-[11px] text-white/55">
          {allBoxes.length} caja{allBoxes.length === 1 ? "" : "s"} · la activa es la que editás arriba
        </div>
        <Button
          className="ml-auto gap-1.5 border border-white/25 bg-white text-black hover:bg-white/90"
          onClick={create}
        >
          <Plus className="h-3.5 w-3.5" />
          Guardar tarjeta IO
        </Button>
      </div>
    </div>
  );
}
