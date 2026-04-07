"use client";

import { useCallback, useMemo, useState } from "react";

import { Plus } from "lucide-react";

import { ClinicalLanes } from "@/components/clinical-lanes";
import { Button } from "@/components/ui/button";
import {
  addTask,
  deleteTask,
  getTasksForDate,
  updateTask,
  type TaskStatus,
} from "@/lib/clinical-store";

export function ClinicalBoard({ date }: { date: string }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const reload = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  const tasks = useMemo(() => {
    void refreshTick;
    return getTasksForDate(date);
  }, [date, refreshTick]);

  const grouped = useMemo(() => {
    const today = tasks.filter((t) => t.status === "TODAY");
    const pending = tasks.filter((t) => t.status === "PENDING");
    const completed = tasks.filter((t) => t.status === "COMPLETED");
    return { today, pending, completed };
  }, [tasks]);

  const handleAdd = () => {
    const title = newTitle.trim() || "Nueva tarea";
    addTask(date, title, "TODAY");
    setNewTitle("");
    setAdding(false);
    reload();
  };

  const handleMove = (id: string, status: TaskStatus) => {
    updateTask(id, { status });
    reload();
  };

  const handleDelete = (id: string) => {
    deleteTask(id);
    reload();
  };

  const handleRename = (id: string, title: string) => {
    updateTask(id, { title });
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-medium uppercase tracking-widest text-white/70">Seguimiento</div>
          <div className="text-lg font-bold text-white">Tablero clínico</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl border-white/25 bg-white/10 text-white backdrop-blur-xl hover:border-white/35 hover:bg-white/15"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>

      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nombre de la tarea…"
            className="h-9 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white outline-none backdrop-blur-xl placeholder:text-white/45 focus-visible:ring-2 focus-visible:ring-white/30"
          />
          <Button size="sm" className="rounded-xl bg-white text-black hover:bg-white/90" onClick={handleAdd}>
            Crear
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl border-white/25 bg-white/10 text-white hover:bg-white/15"
            onClick={() => setAdding(false)}
          >
            Cancelar
          </Button>
        </div>
      )}

      <ClinicalLanes
        today={grouped.today}
        pending={grouped.pending}
        completed={grouped.completed}
        onMove={handleMove}
        onDelete={handleDelete}
        onRename={handleRename}
      />
    </div>
  );
}
