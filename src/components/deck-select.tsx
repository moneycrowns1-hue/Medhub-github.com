"use client";

import type { SrsDeck } from "@/lib/srs";

export function DeckSelect({
  value,
  onChange,
  decks,
}: {
  value: string;
  onChange: (next: string) => void;
  decks: SrsDeck[];
}) {
  return (
    <select
      className="h-9 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {decks.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}
