import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";

import { endOfDay, isoDate, parseIsoDateLocal, startOfDay } from "@/lib/dates";
import { formatPlanSummary, getPlanForDate } from "@/lib/schedule";
import { SUBJECTS } from "@/lib/subjects";

export const dynamic = "force-static";
export const revalidate = false;

type TaskStatus = "TODAY" | "PENDING" | "COMPLETED";

type FallbackTask = {
  id: string;
  date: Date;
  status: TaskStatus;
  sortOrder: number;
  title: string;
  meta: string | null;
  subjectId: string | null;
  completedAt: Date | null;
  createdAt: Date;
};

const fallbackTasks: FallbackTask[] = [];

function makeFallbackTaskId() {
  return `fallback_task_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function getFallbackTasksForDate(date: Date) {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = endOfDay(date).getTime();

  return fallbackTasks
    .filter((t) => {
      const ts = t.date.getTime();
      return ts >= dayStart && ts <= dayEnd;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
}

function ensureFallbackDefaultTasksForDate(date: Date) {
  const existing = getFallbackTasksForDate(date);
  if (existing.length > 0) return;

  const plan = getPlanForDate(date);
  const summary = formatPlanSummary(plan);
  if (summary.isRestDay) {
    return;
  }
  const primaryName = summary.primaryName;
  const secondaryName = summary.secondaryName;
  const dayStart = startOfDay(date);
  const now = new Date();

  fallbackTasks.push(
    {
      id: makeFallbackTaskId(),
      date: dayStart,
      status: "TODAY",
      sortOrder: 1,
      title: `Bloque 1 — ${primaryName}`,
      meta: "2h",
      subjectId: null,
      completedAt: null,
      createdAt: now,
    },
    {
      id: makeFallbackTaskId(),
      date: dayStart,
      status: "TODAY",
      sortOrder: 2,
      title: "SRS — Flashcards",
      meta: "15–25 min",
      subjectId: null,
      completedAt: null,
      createdAt: now,
    },
    {
      id: makeFallbackTaskId(),
      date: dayStart,
      status: "TODAY",
      sortOrder: 3,
      title: "Lectura",
      meta: plan.reading,
      subjectId: null,
      completedAt: null,
      createdAt: now,
    },
    {
      id: makeFallbackTaskId(),
      date: dayStart,
      status: "PENDING",
      sortOrder: 4,
      title: `Bloque 2 — ${primaryName}`,
      meta: "2h",
      subjectId: null,
      completedAt: null,
      createdAt: now,
    },
    {
      id: makeFallbackTaskId(),
      date: dayStart,
      status: "PENDING",
      sortOrder: 5,
      title: `Bloque 3 — ${secondaryName}`,
      meta: "1h",
      subjectId: null,
      completedAt: null,
      createdAt: now,
    },
  );
}

function createFallbackTask(body: {
  date?: string;
  status: TaskStatus;
  title: string;
  meta?: string;
}) {
  const date = body.date ? parseIsoDateLocal(body.date) : new Date();
  const dayStart = startOfDay(date);
  const existing = getFallbackTasksForDate(dayStart);
  const maxOrder = existing.reduce((max, task) => Math.max(max, task.sortOrder), 0);

  const task: FallbackTask = {
    id: makeFallbackTaskId(),
    date: dayStart,
    status: body.status,
    sortOrder: maxOrder + 1,
    title: body.title,
    meta: body.meta ?? null,
    subjectId: null,
    completedAt: body.status === "COMPLETED" ? new Date() : null,
    createdAt: new Date(),
  };

  fallbackTasks.push(task);
  return task;
}

function patchFallbackTask(body: {
  id: string;
  status?: TaskStatus;
  title?: string;
  meta?: string | null;
  sortOrder?: number;
}) {
  const idx = fallbackTasks.findIndex((task) => task.id === body.id);
  if (idx < 0) return null;

  const current = fallbackTasks[idx];
  const updated: FallbackTask = {
    ...current,
    status: body.status ?? current.status,
    title: body.title ?? current.title,
    meta: body.meta === undefined ? current.meta : body.meta,
    sortOrder: body.sortOrder ?? current.sortOrder,
    completedAt:
      body.status === "COMPLETED"
        ? new Date()
        : body.status
          ? null
          : current.completedAt,
  };

  fallbackTasks[idx] = updated;
  return updated;
}

async function getPrismaClient(): Promise<PrismaClient | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    return prisma;
  } catch {
    return null;
  }
}

async function ensureSubjects(prisma: PrismaClient) {
  const slugs = Object.keys(SUBJECTS);
  const existing = await prisma.subject.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true },
  });
  const existingSet = new Set(existing.map((s: { slug: string }) => s.slug));
  const toCreate = slugs
    .filter((s) => !existingSet.has(s))
    .map((slug) => {
      const def = SUBJECTS[slug as keyof typeof SUBJECTS];
      return {
        slug,
        name: def.name,
        uiMode: def.uiMode,
      };
    });

  if (toCreate.length) {
    await prisma.subject.createMany({ data: toCreate });
  }
}

async function ensureDefaultTasksForDate(prisma: PrismaClient, date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const count = await prisma.studyTask.count({
    where: { date: { gte: dayStart, lte: dayEnd } },
  });
  if (count > 0) return;

  await ensureSubjects(prisma);

  const plan = getPlanForDate(date);
  const summary = formatPlanSummary(plan);
  if (summary.isRestDay) {
    return;
  }
  const primary = await prisma.subject.findUnique({ where: { slug: plan.primary } });
  const secondary = await prisma.subject.findUnique({
    where: { slug: plan.secondary },
  });

  await prisma.studyTask.createMany({
    data: [
      {
        date: dayStart,
        status: "TODAY",
        sortOrder: 1,
        title: `Bloque 1 — ${summary.primaryName}`,
        meta: "2h",
        subjectId: primary?.id,
      },
      {
        date: dayStart,
        status: "TODAY",
        sortOrder: 2,
        title: "SRS — Flashcards",
        meta: "15–25 min",
      },
      {
        date: dayStart,
        status: "TODAY",
        sortOrder: 3,
        title: "Lectura",
        meta: plan.reading,
      },
      {
        date: dayStart,
        status: "PENDING",
        sortOrder: 4,
        title: `Bloque 2 — ${summary.primaryName}`,
        meta: "2h",
        subjectId: primary?.id,
      },
      {
        date: dayStart,
        status: "PENDING",
        sortOrder: 5,
        title: `Bloque 3 — ${summary.secondaryName}`,
        meta: "1h",
        subjectId: secondary?.id,
      },
    ],
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? parseIsoDateLocal(dateParam) : new Date();

  const prisma = await getPrismaClient();
  if (!prisma) {
    ensureFallbackDefaultTasksForDate(date);
    return NextResponse.json({ date: isoDate(date), tasks: getFallbackTasksForDate(date) });
  }

  try {
    await ensureDefaultTasksForDate(prisma, date);

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const tasks = await prisma.studyTask.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ date: isoDate(date), tasks });
  } catch {
    ensureFallbackDefaultTasksForDate(date);
    return NextResponse.json({ date: isoDate(date), tasks: getFallbackTasksForDate(date) });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    date?: string;
    status: TaskStatus;
    title: string;
    meta?: string;
  };

  const date = body.date ? parseIsoDateLocal(body.date) : new Date();
  const dayStart = startOfDay(date);
  const prisma = await getPrismaClient();

  if (!prisma) {
    const task = createFallbackTask(body);
    return NextResponse.json({ task, fallback: true });
  }

  try {
    const created = await prisma.studyTask.create({
      data: {
        date: dayStart,
        status: body.status,
        title: body.title,
        meta: body.meta,
      },
    });

    return NextResponse.json({ task: created });
  } catch {
    const task = createFallbackTask(body);
    return NextResponse.json({ task, fallback: true });
  }
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    id: string;
    status?: TaskStatus;
    title?: string;
    meta?: string | null;
    sortOrder?: number;
  };
  const prisma = await getPrismaClient();

  if (!prisma) {
    const updatedTask = patchFallbackTask(body);
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found", task: null }, { status: 404 });
    }
    return NextResponse.json({ task: updatedTask, fallback: true });
  }

  try {
    const updated = await prisma.studyTask.update({
      where: { id: body.id },
      data: {
        status: body.status,
        title: body.title,
        meta: body.meta === undefined ? undefined : body.meta,
        sortOrder: body.sortOrder,
        completedAt:
          body.status === "COMPLETED" ? new Date() : body.status ? null : undefined,
      },
    });

    return NextResponse.json({ task: updated });
  } catch {
    const updatedTask = patchFallbackTask(body);
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found", task: null }, { status: 404 });
    }
    return NextResponse.json({ task: updatedTask, fallback: true });
  }
}
