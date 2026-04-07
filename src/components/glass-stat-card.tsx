import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/sparkline";

export type GlassStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  series?: number[];
  className?: string;
};

export function GlassStatCard({
  label,
  value,
  hint,
  series,
  className,
}: GlassStatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-white/10 bg-white/5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/5",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
        </div>

        {series && series.length >= 2 ? (
          <div className="text-foreground/90">
            <Sparkline values={series} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
