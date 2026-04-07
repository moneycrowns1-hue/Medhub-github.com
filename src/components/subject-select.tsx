"use client";

import { SUBJECTS } from "@/lib/subjects";

export function SubjectSelect({
  value,
  onChange,
  allowAll,
}: {
  value: string;
  onChange: (next: string) => void;
  allowAll?: boolean;
}) {
  const slugs = Object.keys(SUBJECTS);

  return (
    <select
      className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowAll ? <option value="all">Todas</option> : null}
      {slugs.map((slug) => (
        <option key={slug} value={slug}>
          {SUBJECTS[slug as keyof typeof SUBJECTS].name}
        </option>
      ))}
    </select>
  );
}
