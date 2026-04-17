"use client";

import {
  ACADEMIC_MEDICAL_SUBJECTS,
  getSubjectSemestersComputed,
  type AcademicSemester,
  type AcademicRecord,
} from "@/lib/academic-store";
import { SUBJECTS } from "@/lib/subjects";

type Props = {
  semesters: AcademicSemester[];
  records: AcademicRecord[];
  passingGrade: number;
  onSelect?: (subjectSlug: string, semesterId: string) => void;
};

type CellState = "passed" | "passedRemedial" | "failed" | "remedial" | "inProgress" | "locked" | "empty";

function cellClasses(state: CellState): string {
  switch (state) {
    case "passed":
      return "border-emerald-300/40 bg-emerald-400/15 text-emerald-100";
    case "passedRemedial":
      return "border-cyan-300/40 bg-cyan-400/15 text-cyan-100";
    case "failed":
      return "border-rose-300/40 bg-rose-400/15 text-rose-100";
    case "remedial":
      return "border-amber-300/40 bg-amber-400/15 text-amber-100";
    case "inProgress":
      return "border-white/25 bg-white/10 text-white";
    case "locked":
      return "border-white/10 bg-white/3 text-white/45";
    default:
      return "border-white/10 bg-white/4 text-white/35";
  }
}

function cellLabel(state: CellState, grade: number | null): string {
  if (state === "empty" || state === "locked") return "—";
  return typeof grade === "number" ? grade.toFixed(2) : "En curso";
}

export function PensumMatrix({ semesters, records, passingGrade, onSelect }: Props) {
  const maxOrder = semesters.reduce((max, s) => Math.max(max, s.order), 0);
  const columns = Math.max(1, maxOrder);

  return (
    <div className="rounded-2xl border border-white/20 bg-white/6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/65">Pensum visual</div>
          <div className="text-sm font-semibold text-white">Estado por materia × semestre</div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="text-left text-white/60">Materia</th>
              {Array.from({ length: columns }, (_, idx) => (
                <th key={idx} className="text-center text-white/55">S{idx + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACADEMIC_MEDICAL_SUBJECTS.map((slug) => {
              const computed = getSubjectSemestersComputed(slug, semesters, records, passingGrade);
              return (
                <tr key={slug}>
                  <td className="py-1 pr-2 text-white/80">{SUBJECTS[slug].name}</td>
                  {Array.from({ length: columns }, (_, idx) => {
                    const order = idx + 1;
                    const entry = computed.find((c) => c.semester.order === order);
                    let state: CellState = "empty";
                    let grade: number | null = null;
                    if (entry) {
                      grade = entry.effectiveGrade;
                      if (!entry.unlocked) state = "locked";
                      else if (entry.passedViaRemedial) state = "passedRemedial";
                      else if (entry.passed) state = "passed";
                      else if (entry.needsRemedial) state = "remedial";
                      else if (entry.finalGrade !== null) state = "failed";
                      else state = "inProgress";
                    }
                    const label = cellLabel(state, grade);
                    const clickable = !!entry && onSelect;
                    return (
                      <td key={idx} className="p-0">
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => clickable && onSelect?.(slug, entry!.semester.id)}
                          className={`flex h-10 w-full items-center justify-center rounded-md border text-[11px] ${cellClasses(state)} ${clickable ? "hover:brightness-110" : "cursor-default"}`}
                          title={entry ? `${entry.semester.name} — ${label}` : "Sin semestre"}
                        >
                          {label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/60">
        <Legend state="passed" label="Aprobado" />
        <Legend state="passedRemedial" label="Aprobado vía remedial" />
        <Legend state="remedial" label="Remedial" />
        <Legend state="failed" label="Reprobado" />
        <Legend state="inProgress" label="En curso" />
        <Legend state="locked" label="Bloqueado" />
      </div>
    </div>
  );
}

function Legend({ state, label }: { state: CellState; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${cellClasses(state)}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}
