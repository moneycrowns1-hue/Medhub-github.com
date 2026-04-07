"use client";

import type { MouseEvent, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { SrsImageOcclusion } from "@/lib/srs";
import { clampPct } from "@/lib/srs";

type Box = { x: number; y: number; w: number; h: number };

type Pt = { x: number; y: number };

function boxFromPoints(a: Pt, b: Pt): Box {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x);
  const y2 = Math.max(a.y, b.y);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function ImageOcclusionDrawer({
  io,
  onChange,
}: {
  io: SrsImageOcclusion;
  onChange: (nextBox: Box) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<null | { start: Pt; current: Pt }>(null);

  const previewBox = (() => {
    if (!drag) return io.box;
    const b = boxFromPoints(drag.start, drag.current);
    return {
      x: clampPct(b.x),
      y: clampPct(b.y),
      w: clampPct(b.w),
      h: clampPct(b.h),
    };
  })();

  useEffect(() => {
    const onUp = () => {
      if (!drag) return;
      const b = boxFromPoints(drag.start, drag.current);
      onChange({
        x: clampPct(b.x),
        y: clampPct(b.y),
        w: clampPct(b.w),
        h: clampPct(b.h),
      });
      setDrag(null);
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [drag, onChange]);

  const ptFromEvent = (clientX: number, clientY: number): Pt | null => {
    const el = rootRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 100;
    const y = ((clientY - r.top) / r.height) * 100;
    return { x: clampPct(x), y: clampPct(y) };
  };

  const onMouseDown = (e: MouseEvent) => {
    const p = ptFromEvent(e.clientX, e.clientY);
    if (!p) return;
    setDrag({ start: p, current: p });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!drag) return;
    const p = ptFromEvent(e.clientX, e.clientY);
    if (!p) return;
    setDrag((d) => (d ? { ...d, current: p } : d));
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const p = ptFromEvent(t.clientX, t.clientY);
    if (!p) return;
    setDrag({ start: p, current: p });
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!drag) return;
    const t = e.touches[0];
    if (!t) return;
    const p = ptFromEvent(t.clientX, t.clientY);
    if (!p) return;
    setDrag((d) => (d ? { ...d, current: p } : d));
  };

  const { x, y, w, h } = previewBox;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Dibujá el rectángulo: click y arrastrar (o touch)
      </div>

      <div
        ref={rootRef}
        className="relative overflow-hidden rounded-xl border border-border bg-black/30"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <div className="relative aspect-[16/10] w-full">
          <img
            src={io.imageUrl}
            alt="Imagen"
            className="absolute inset-0 h-full w-full select-none object-cover"
            draggable={false}
          />
          <div
            className="absolute rounded-md bg-black/60"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
          />
          <div
            className="absolute rounded-md ring-2 ring-white/70"
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
          />
        </div>
      </div>
    </div>
  );
}
