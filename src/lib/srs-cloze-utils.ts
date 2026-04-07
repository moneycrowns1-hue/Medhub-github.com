export function clozeIndices(input: string): number[] {
  const re = /\{\{c(\d+)::/g;
  const s = new Set<number>();
  for (;;) {
    const m = re.exec(input);
    if (!m) break;
    s.add(Number(m[1]));
  }
  return Array.from(s).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}
