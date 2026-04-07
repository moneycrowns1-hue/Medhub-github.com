import type { SrsRating } from "@/lib/srs";

export function SrsStats({
  total,
  remaining,
  counts,
}: {
  total: number;
  remaining: number;
  counts: Record<SrsRating, number>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{total}</div>
      </div>
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Restantes</div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{remaining}</div>
      </div>
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Again</div>
        <div className="mt-1 font-semibold tabular-nums">{counts.again}</div>
      </div>
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Hard</div>
        <div className="mt-1 font-semibold tabular-nums">{counts.hard}</div>
      </div>
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Good</div>
        <div className="mt-1 font-semibold tabular-nums">{counts.good}</div>
      </div>
      <div className="rounded-md border border-border bg-card/50 p-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Easy</div>
        <div className="mt-1 font-semibold tabular-nums">{counts.easy}</div>
      </div>
    </div>
  );
}
