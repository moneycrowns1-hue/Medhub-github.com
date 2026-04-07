import { cn } from "@/lib/utils";

export type SparklineProps = {
  values: number[];
  className?: string;
};

function normalize(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v) => (v - min) / span);
}

export function Sparkline({ values, className }: SparklineProps) {
  if (values.length < 2) return null;

  const w = 120;
  const h = 36;
  const n = values.length;
  const norm = normalize(values);

  const points = norm
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = (1 - v) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-9 w-28", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#spark)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
