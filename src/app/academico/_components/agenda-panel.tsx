"use client";

import { CalendarClock } from "lucide-react";

import { SUBJECTS } from "@/lib/subjects";
import type { UpcomingEvaluation } from "@/lib/academic-store";

type Props = {
  events: UpcomingEvaluation[];
};

function urgencyClass(daysUntil: number) {
  if (daysUntil <= 1) return "border-rose-300/40 bg-rose-400/15 text-rose-100";
  if (daysUntil <= 3) return "border-amber-300/40 bg-amber-400/15 text-amber-100";
  if (daysUntil <= 7) return "border-cyan-300/40 bg-cyan-400/15 text-cyan-100";
  return "border-white/20 bg-white/8 text-white/85";
}

export function AgendaPanel({ events }: Props) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/6 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-cyan-200" />
        <div>
          <div className="text-xs uppercase tracking-wider text-white/65">Agenda académica</div>
          <div className="text-sm font-semibold text-white">Próximas evaluaciones ({events.length})</div>
        </div>
      </div>

      {!events.length ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/60">
          No hay evaluaciones programadas en los próximos 60 días. Agrega una evaluación con fecha para verla aquí.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {events.map((event) => (
            <li
              key={event.record.id}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${urgencyClass(event.daysUntil)}`}
            >
              <div>
                <div className="font-semibold">{event.record.title}</div>
                <div className="text-[11px] opacity-85">
                  {SUBJECTS[event.record.subjectSlug as keyof typeof SUBJECTS]?.name ?? event.record.subjectSlug} · {event.semester.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{event.record.date}</div>
                <div className="text-[10px] opacity-85">
                  {event.daysUntil <= 0 ? "Hoy" : event.daysUntil === 1 ? "Mañana" : `En ${event.daysUntil} días`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
