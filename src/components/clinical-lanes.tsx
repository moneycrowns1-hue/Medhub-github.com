import { ArrowRight, CheckCircle2, CheckSquare, ClipboardList, Clock3, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ClinicalTaskItem, TaskStatus } from "@/lib/clinical-store";

export type ClinicalLanesProps = {
  today: ClinicalTaskItem[];
  pending: ClinicalTaskItem[];
  completed: ClinicalTaskItem[];
  onMove?: (id: string, status: TaskStatus) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  className?: string;
};

type LaneConfig = {
  status: TaskStatus;
  nextStatus?: TaskStatus;
  nextLabel?: string;
};

const LANE_FLOW: Record<TaskStatus, LaneConfig> = {
  TODAY: { status: "TODAY", nextStatus: "COMPLETED", nextLabel: "Completar" },
  PENDING: { status: "PENDING", nextStatus: "TODAY", nextLabel: "Mover a Hoy" },
  COMPLETED: { status: "COMPLETED" },
};

function Lane({
  title,
  icon,
  items,
  accentClass,
  config,
  onMove,
  onDelete,
  onRename,
}: {
  title: string;
  icon: React.ReactNode;
  items: ClinicalTaskItem[];
  accentClass?: string;
  config: LaneConfig;
  onMove?: (id: string, status: TaskStatus) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/8 p-5 text-white backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border border-white/20", accentClass ?? "bg-white/10 text-white/90")}>
          {icon}
        </div>
        <div className="text-sm font-semibold">{title}</div>
        <span className="ml-auto rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-white/75">
          {items.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/25 bg-white/5 p-3 text-xs text-white/60">
            Sin tareas.
          </div>
        ) : (
          items.map((t) => (
            <div
              key={t.id}
              className="group rounded-xl border border-white/20 bg-white/10 p-3 transition-all hover:border-white/35 hover:bg-white/15"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex-1 text-sm font-medium text-white"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val && val !== t.title) onRename?.(t.id, val);
                  }}
                >
                  {t.title}
                </div>
                <div className="flex items-center gap-1.5">
                  {config.nextStatus && onMove ? (
                    <button
                      type="button"
                      onClick={() => onMove(t.id, config.nextStatus!)}
                      title={config.nextLabel}
                      className="shrink-0 text-white/65 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                    >
                      {config.nextStatus === "COMPLETED" ? <CheckSquare className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDelete?.(t.id)}
                    title="Eliminar"
                    className={
                      config.status === "COMPLETED"
                        ? "shrink-0 text-white/70 transition-colors hover:text-white"
                        : "shrink-0 text-white/45 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {t.meta ? (
                <div className="mt-1 text-xs text-white/60">{t.meta}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ClinicalLanes({
  today,
  pending,
  completed,
  onMove,
  onDelete,
  onRename,
  className,
}: ClinicalLanesProps) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-3", className)}>
      <Lane title="Hoy" icon={<Clock3 className="h-4 w-4" />} items={today} accentClass="bg-white/10 text-white/90" config={LANE_FLOW.TODAY} onMove={onMove} onDelete={onDelete} onRename={onRename} />
      <Lane title="Pendiente" icon={<ClipboardList className="h-4 w-4" />} items={pending} accentClass="bg-white/10 text-white/90" config={LANE_FLOW.PENDING} onMove={onMove} onDelete={onDelete} onRename={onRename} />
      <Lane title="Completado" icon={<CheckCircle2 className="h-4 w-4" />} items={completed} accentClass="bg-white/10 text-white/90" config={LANE_FLOW.COMPLETED} onMove={onMove} onDelete={onDelete} onRename={onRename} />
    </div>
  );
}
