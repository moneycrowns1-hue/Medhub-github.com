export type ResourceLibraryMeta = {
  resourceId: string;
  starred: boolean;
  folderPath?: string;
  tags: string[];
  updatedAtMs: number;
  version: number;
};

const STORAGE_KEY = "somagnus:resources:library_meta:v1";

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of tags) {
    if (typeof item !== "string") continue;
    const next = item.trim().toLowerCase();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function normalizeFolderPath(folderPath: unknown): string | undefined {
  if (typeof folderPath !== "string") return undefined;
  const next = folderPath.trim().replace(/\\+/g, "/").replace(/\/+/g, "/");
  return next || undefined;
}

function sanitizeEntry(resourceId: string, value: unknown): ResourceLibraryMeta | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ResourceLibraryMeta>;
  return {
    resourceId,
    starred: !!row.starred,
    folderPath: normalizeFolderPath(row.folderPath),
    tags: normalizeTags(row.tags),
    updatedAtMs: typeof row.updatedAtMs === "number" ? row.updatedAtMs : Date.now(),
    version:
      typeof (row as { version?: unknown }).version === "number" && Number.isFinite((row as { version: number }).version)
        ? Math.max(1, Math.floor((row as { version: number }).version))
        : 1,
  };
}

function loadAllMap(): Record<string, ResourceLibraryMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const map: Record<string, ResourceLibraryMeta> = {};
    for (const [resourceId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = sanitizeEntry(resourceId, value);
      if (!entry) continue;
      map[resourceId] = entry;
    }
    return map;
  } catch {
    return {};
  }
}

function saveAllMap(map: Record<string, ResourceLibraryMeta>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota/storage errors
  }
}

export function listAllResourceLibraryMeta(): Record<string, ResourceLibraryMeta> {
  return loadAllMap();
}

export function getResourceLibraryMeta(resourceId: string): ResourceLibraryMeta | null {
  const map = loadAllMap();
  return map[resourceId] ?? null;
}

export function upsertResourceLibraryMeta(
  resourceId: string,
  patch: Partial<Pick<ResourceLibraryMeta, "starred" | "folderPath" | "tags">>,
): ResourceLibraryMeta {
  const map = loadAllMap();
  const current = map[resourceId];

  const next: ResourceLibraryMeta = {
    resourceId,
    starred: typeof patch.starred === "boolean" ? patch.starred : current?.starred ?? false,
    folderPath:
      patch.folderPath !== undefined
        ? normalizeFolderPath(patch.folderPath)
        : current?.folderPath,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current?.tags ?? [],
    updatedAtMs: Date.now(),
    version: (current?.version ?? 1) + 1,
  };

  map[resourceId] = next;
  saveAllMap(map);
  return next;
}

function isIncomingNewer(local: ResourceLibraryMeta, incoming: ResourceLibraryMeta): boolean {
  if (incoming.updatedAtMs !== local.updatedAtMs) {
    return incoming.updatedAtMs > local.updatedAtMs;
  }
  return incoming.version > local.version;
}

export function mergeResourceLibraryMeta(input: ResourceLibraryMeta): { applied: boolean; current: ResourceLibraryMeta } {
  const map = loadAllMap();
  const incoming: ResourceLibraryMeta = {
    resourceId: input.resourceId,
    starred: !!input.starred,
    folderPath: normalizeFolderPath(input.folderPath),
    tags: normalizeTags(input.tags),
    updatedAtMs: Math.max(1, Math.floor(input.updatedAtMs || Date.now())),
    version: Math.max(1, Math.floor(input.version || 1)),
  };

  const local = map[input.resourceId];
  if (local && !isIncomingNewer(local, incoming)) {
    return { applied: false, current: local };
  }

  map[input.resourceId] = incoming;
  saveAllMap(map);
  return { applied: true, current: incoming };
}

export function deleteResourceLibraryMeta(resourceId: string) {
  const map = loadAllMap();
  if (!(resourceId in map)) return;
  delete map[resourceId];
  saveAllMap(map);
}
