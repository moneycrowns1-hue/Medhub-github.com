import type { ReactNode } from "react";

type Token =
  | { kind: "text"; value: string }
  | { kind: "cloze"; index: number; value: string };

function tokenizeCloze(input: string): Token[] {
  const re = /\{\{c(\d+)::([\s\S]*?)\}\}/g;
  const out: Token[] = [];
  let last = 0;
  for (;;) {
    const m = re.exec(input);
    if (!m) break;
    const start = m.index;
    const end = start + m[0].length;
    if (start > last) out.push({ kind: "text", value: input.slice(last, start) });
    out.push({ kind: "cloze", index: Number(m[1]), value: m[2] });
    last = end;
  }
  if (last < input.length) out.push({ kind: "text", value: input.slice(last) });
  return out;
}

export function renderCloze(
  input: string,
  opts: { reveal: boolean; clozeIndex?: number },
): ReactNode {
  const idx = opts.clozeIndex ?? 1;
  const tokens = tokenizeCloze(input);
  return tokens.map((t, i) => {
    if (t.kind === "text") return <span key={i}>{t.value}</span>;
    const isTarget = t.index === idx;
    if (!isTarget) return <span key={i}>{t.value}</span>;
    if (opts.reveal) {
      return (
        <span
          key={i}
          className="rounded bg-emerald-500/15 px-1 text-emerald-200"
        >
          {t.value}
        </span>
      );
    }
    return (
      <span
        key={i}
        className="inline-flex min-w-[5ch] items-center justify-center rounded bg-muted px-1 text-muted-foreground"
      >
        …
      </span>
    );
  });
}
