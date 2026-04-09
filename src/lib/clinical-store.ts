/**
 * Local-first clinical task store using localStorage.
 * No database needed — tasks persist per date.
 */

const STORAGE_KEY = "somagnus:clinical-tasks:v1";
export const CLINICAL_TASKS_UPDATED_EVENT = "somagnus:clinical-tasks:updated";

export type TaskStatus = "TODAY" | "PENDING" | "COMPLETED";

export type ClinicalTaskItem = {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  status: TaskStatus;
  title: string;
  meta?: string;
  sortOrder: number;
  completedAt?: number;
  createdAt: number;
};

function uid() {
  return `task_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function loadAll(): ClinicalTaskItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ClinicalTaskItem[];
  } catch {
    return [];
  }
}

function saveAll(tasks: ClinicalTaskItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    window.dispatchEvent(new Event(CLINICAL_TASKS_UPDATED_EVENT));
  } catch {
    // quota exceeded
  }
}

export function getTasksForDate(date: string): ClinicalTaskItem[] {
  return loadAll()
    .filter((t) => t.date === date)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

export function addTask(date: string, title: string, status: TaskStatus = "TODAY", meta?: string): ClinicalTaskItem {
  const all = loadAll();
  const existing = all.filter((t) => t.date === date);
  const maxOrder = existing.reduce((m, t) => Math.max(m, t.sortOrder), 0);
  const task: ClinicalTaskItem = {
    id: uid(),
    date,
    status,
    title,
    meta,
    sortOrder: maxOrder + 1,
    createdAt: Date.now(),
  };
  saveAll([...all, task]);
  return task;
}

export function updateTask(id: string, patch: Partial<Pick<ClinicalTaskItem, "title" | "meta" | "status" | "sortOrder">>): void {
  const all = loadAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const task = all[idx];
  if (patch.title !== undefined) task.title = patch.title;
  if (patch.meta !== undefined) task.meta = patch.meta;
  if (patch.status !== undefined) {
    task.status = patch.status;
    task.completedAt = patch.status === "COMPLETED" ? Date.now() : undefined;
  }
  if (patch.sortOrder !== undefined) task.sortOrder = patch.sortOrder;
  all[idx] = task;
  saveAll(all);
}

export function deleteTask(id: string): void {
  const all = loadAll();
  saveAll(all.filter((t) => t.id !== id));
}
