import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResourceLibraryMeta } from "@/lib/resources-library-meta-store";
import type { PdfResourceBackupItem } from "@/lib/resources-pdf-store";
import type { ResourcesLibraryBackup } from "@/lib/resources-service";

type ResourcesSyncServerState = {
  cursor: string;
  backup: ResourcesLibraryBackup;
  updatedAtMs: number;
};

const STORE_FILE = path.join(process.cwd(), ".sync", "resources-sync-state.json");
let memoryFallbackState: ResourcesSyncServerState | null = null;

function normalizeBackup(input: unknown): ResourcesLibraryBackup | null {
  const row = input as Partial<ResourcesLibraryBackup>;
  if (!row || row.version !== 1 || !Array.isArray(row.resources) || !Array.isArray(row.libraryMeta)) {
    return null;
  }

  const resources = row.resources
    .filter((r): r is PdfResourceBackupItem => {
      return !!r && typeof r.id === "string" && typeof r.title === "string" && typeof r.blobBase64 === "string";
    })
    .map((r) => ({
      ...r,
      updatedAtMs: Math.max(1, Math.floor(r.updatedAtMs || r.createdAtMs || Date.now())),
      version: Math.max(1, Math.floor(r.version || 1)),
      createdAtMs: Math.max(1, Math.floor(r.createdAtMs || Date.now())),
      pageStart: Math.max(1, Math.floor(r.pageStart || 1)),
      pageEnd: Math.max(1, Math.floor(r.pageEnd || r.pageStart || 1)),
      sizeBytes: Math.max(0, Math.floor(r.sizeBytes || 0)),
      blobType: typeof r.blobType === "string" ? r.blobType : "application/pdf",
    }));

  const libraryMeta = row.libraryMeta
    .filter((m): m is ResourceLibraryMeta => {
      return !!m && typeof m.resourceId === "string";
    })
    .map((m) => ({
      ...m,
      updatedAtMs: Math.max(1, Math.floor(m.updatedAtMs || Date.now())),
      version: Math.max(1, Math.floor(m.version || 1)),
      tags: Array.isArray(m.tags) ? m.tags.filter((t) => typeof t === "string") : [],
    }));

  return {
    version: 1,
    exportedAtMs: Math.max(1, Math.floor(row.exportedAtMs || Date.now())),
    resources,
    libraryMeta,
  };
}

function isResourceIncomingNewer(local: PdfResourceBackupItem, incoming: PdfResourceBackupItem): boolean {
  if (incoming.updatedAtMs !== local.updatedAtMs) return incoming.updatedAtMs > local.updatedAtMs;
  return incoming.version > local.version;
}

function isMetaIncomingNewer(local: ResourceLibraryMeta, incoming: ResourceLibraryMeta): boolean {
  if (incoming.updatedAtMs !== local.updatedAtMs) return incoming.updatedAtMs > local.updatedAtMs;
  return incoming.version > local.version;
}

export function mergeResourcesBackups(local: ResourcesLibraryBackup | null, incoming: ResourcesLibraryBackup): ResourcesLibraryBackup {
  if (!local) return incoming;

  const resourcesById = new Map<string, PdfResourceBackupItem>();
  for (const item of local.resources) resourcesById.set(item.id, item);
  for (const item of incoming.resources) {
    const prev = resourcesById.get(item.id);
    if (!prev || isResourceIncomingNewer(prev, item)) {
      resourcesById.set(item.id, item);
    }
  }

  const metaById = new Map<string, ResourceLibraryMeta>();
  for (const item of local.libraryMeta) metaById.set(item.resourceId, item);
  for (const item of incoming.libraryMeta) {
    const prev = metaById.get(item.resourceId);
    if (!prev || isMetaIncomingNewer(prev, item)) {
      metaById.set(item.resourceId, item);
    }
  }

  return {
    version: 1,
    exportedAtMs: Date.now(),
    resources: [...resourcesById.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs),
    libraryMeta: [...metaById.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs),
  };
}

function createCursor() {
  return `cursor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadResourcesSyncServerState(): Promise<ResourcesSyncServerState | null> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as {
      cursor?: unknown;
      updatedAtMs?: unknown;
      backup?: unknown;
    };
    if (!parsed || typeof parsed.cursor !== "string") return memoryFallbackState;
    const backup = normalizeBackup(parsed.backup);
    if (!backup) return memoryFallbackState;

    return {
      cursor: parsed.cursor,
      updatedAtMs: typeof parsed.updatedAtMs === "number" ? parsed.updatedAtMs : Date.now(),
      backup,
    };
  } catch {
    return memoryFallbackState;
  }
}

export async function saveResourcesSyncServerState(input: {
  backup: ResourcesLibraryBackup;
}): Promise<ResourcesSyncServerState> {
  const state: ResourcesSyncServerState = {
    cursor: createCursor(),
    updatedAtMs: Date.now(),
    backup: input.backup,
  };

  memoryFallbackState = state;
  try {
    await mkdir(path.dirname(STORE_FILE), { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // ignore filesystem errors and keep in-memory fallback
  }

  return state;
}
