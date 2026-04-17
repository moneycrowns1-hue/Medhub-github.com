"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addStudyPlanTask,
  deleteStudyPlanTask,
  generateStudyPlanForSemester,
  listStudyPlanForSemester,
  toggleStudyPlanTask,
} from "@/lib/academic-studyplan-store";
import type { AcademicSemester } from "@/lib/academic-store";
import { reportGamificationEvent, reportWeeklyGoalProgress } from "@/lib/academic-gamification-store";
import { isoDate } from "@/lib/dates";

type Props = {
  semester: AcademicSemester | null;
  refreshKey: number;
};

export function StudyPlanPanel({ semester, refreshKey }: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(isoDate(new Date()));

  const tasks = useMemo(() => {
    void refreshKey;
    if (!semester) return [];
    return listStudyPlanForSemester(semester.id);
  }, [semester, refreshKey]);

  if (!semester) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/6 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-cyan-200" />
          <div className="text-sm font-semibold text-white">Plan de estudio</div>
        </div>
        <div className="mt-3 text-xs text-white/60">Selecciona un semestre para ver su plan.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/20 bg-white/6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-cyan-200" />
          <div>
            <div className="text-xs uppercase tracking-wider text-white/65">Plan de estudio</div>
            <div className="text-sm font-semibold text-white">{semester.name} — {tasks.length} tareas</div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/25 bg-white/10 text-white hover:bg-white/15"
          onClick={() => generateStudyPlanForSemester(semester)}
        >
          <Sparkles className="h-4 w-4" />
          Regenerar desde fechas
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-white/15 bg-white/8 p-3">
        <div className="flex-1 min-w-[160px] space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-white/60">Nueva tarea</div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ej: Repaso de tejido conectivo"
            className="h-9 w-full rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-white/60">Fecha</div>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-9 rounded-lg border border-white/25 bg-white/8 px-2.5 text-sm text-white outline-none"
          />
        </div>
        <Button
          type="button"
          className="border border-white/25 bg-white text-black hover:bg-white/90"
          onClick={() => {
            const clean = title.trim();
            if (!clean) return;
            addStudyPlanTask({
              semesterId: semester.id,
              title: clean,
              dueDate: dueDate || isoDate(new Date()),
              blockType: "partial",
              blockIndex: 1,
            });
            setTitle("");
          }}
        >
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      {!tasks.length ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/60">
          No hay tareas aún. Regenera desde fechas de evaluación o agrega una manualmente.
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.map((task) => {
            const done = task.status === "done";
            return (
              <li
                key={task.id}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${done ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-white/20 bg-white/8 text-white/85"}`}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => {
                    const wasDone = task.status === "done";
                    toggleStudyPlanTask(task.id);
                    if (!wasDone) {
                      reportGamificationEvent({ type: "study_plan_task_done" });
                      reportWeeklyGoalProgress("studyplan_tasks");
                    }
                  }}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${done ? "border-emerald-300 bg-emerald-300/30" : "border-white/35"}`}>
                    {done ? <Check className="h-3 w-3 text-emerald-100" /> : null}
                  </span>
                  <span>
                    <span className={`font-semibold ${done ? "line-through opacity-80" : ""}`}>{task.title}</span>
                    <span className="ml-2 text-[11px] opacity-70">{task.dueDate}{task.autoGenerated ? " · auto" : ""}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 bg-black/25 p-1.5 text-white/75 hover:bg-white/15 hover:text-white"
                  onClick={() => deleteStudyPlanTask(task.id)}
                  title="Eliminar tarea"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
