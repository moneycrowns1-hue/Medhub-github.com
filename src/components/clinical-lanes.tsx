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
  accentTile,
  accentBorder,
  accentCount,
  config,
  onMove,
  onDelete,
  onRename,
}: {
  title: string;
  icon: React.ReactNode;
  items: ClinicalTaskItem[];
  accentTile: string;
  accentBorder: string;
  accentCount: string;
  config: LaneConfig;
  onMove?: (id: string, status: TaskStatus) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
}) {
  return (
    <div className={cn("relative rounded-2xl bg-white/[0.03] p-4 text-white", accentBorder)}>
      {/* Subtle top accent bar */}
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accentTile)}>
          {icon}
        </div>
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        <span
          className={cn(
            "ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            accentCount,
          )}
        >
          {items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-3 text-center text-[11px] text-white/45">
            Sin tareas
          </div>
        ) : (
          items.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group rounded-xl bg-white/[0.04] p-2.5 transition-all hover:bg-white/[0.07]",
                config.status === "COMPLETED" && "opacity-75",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex-1 text-[13px] font-medium leading-snug text-white/90 outline-none focus:text-white",
                    config.status === "COMPLETED" && "text-white/70 line-through decoration-white/30",
                  )}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const val = e.currentTarget.textContent?.trim();
                    if (val && val !== t.title) onRename?.(t.id, val);
                  }}
                >
                  {t.title}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {config.nextStatus && onMove ? (
                    <button
                      type="button"
                      onClick={() => onMove(t.id, config.nextStatus!)}
                      title={config.nextLabel}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/55 opacity-0 transition-all hover:bg-white/[0.08] hover:text-white group-hover:opacity-100"
                    >
                      {config.nextStatus === "COMPLETED" ? (
                        <CheckSquare className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDelete?.(t.id)}
                    title="Eliminar"
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-md transition-all hover:bg-rose-500/15 hover:text-rose-300",
                      config.status === "COMPLETED"
                        ? "text-white/55"
                        : "text-white/40 opacity-0 group-hover:opacity-100",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {t.meta ? (
                <div className="mt-0.5 text-[11px] text-white/45">{t.meta}</div>
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
    <div className={cn("grid gap-3 lg:grid-cols-3", className)}>
      <Lane
        title="Hoy"
        icon={<Clock3 className="h-4 w-4" />}
        items={today}
        accentTile="bg-cyan-500/15 text-cyan-300"
        accentBorder="ring-1 ring-inset ring-cyan-400/15"
        accentCount="bg-cyan-500/15 text-cyan-200"
        config={LANE_FLOW.TODAY}
        onMove={onMove}
        onDelete={onDelete}
        onRename={onRename}
      />
      <Lane
        title="Pendiente"
        icon={<ClipboardList className="h-4 w-4" />}
        items={pending}
        accentTile="bg-amber-500/15 text-amber-300"
        accentBorder="ring-1 ring-inset ring-amber-400/15"
        accentCount="bg-amber-500/15 text-amber-200"
        config={LANE_FLOW.PENDING}
        onMove={onMove}
        onDelete={onDelete}
        onRename={onRename}
      />
      <Lane
        title="Completado"
        icon={<CheckCircle2 className="h-4 w-4" />}
        items={completed}
        accentTile="bg-emerald-500/15 text-emerald-300"
        accentBorder="ring-1 ring-inset ring-emerald-400/15"
        accentCount="bg-emerald-500/15 text-emerald-200"
        config={LANE_FLOW.COMPLETED}
        onMove={onMove}
        onDelete={onDelete}
        onRename={onRename}
      />
    </div>
  );
}
