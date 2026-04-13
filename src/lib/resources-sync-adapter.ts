import {
  exportResourcesLibraryBackup,
  importResourcesLibraryBackup,
  type ResourcesLibraryBackup,
} from "@/lib/resources-service";

const RESOURCES_SYNC_CURSOR_KEY = "somagnus:resources:sync:cursor:v1";

export type ResourcesSyncPullResult = {
  backup: ResourcesLibraryBackup | null;
  remoteCursor?: string;
};

export type ResourcesSyncPushResult = {
  accepted: boolean;
  remoteCursor?: string;
};

type ResourcesSyncHttpPullResponse = {
  backup?: ResourcesLibraryBackup | null;
  cursor?: string;
};

type ResourcesSyncHttpPushResponse = {
  accepted?: boolean;
  cursor?: string;
};

export type ResourcesSyncAdapter = {
  pull: (input: { lastCursor?: string }) => Promise<ResourcesSyncPullResult>;
  push: (input: { backup: ResourcesLibraryBackup; lastCursor?: string }) => Promise<ResourcesSyncPushResult>;
};

export type ResourcesSyncRunSummary = {
  importedResources: number;
  skippedResources: number;
  importedMeta: number;
  skippedMeta: number;
  pushed: boolean;
  nextCursor?: string;
};

export function createNoopResourcesSyncAdapter(): ResourcesSyncAdapter {
  return {
    async pull() {
      return { backup: null };
    },
    async push() {
      return { accepted: false };
    },
  };
}

export function createHttpResourcesSyncAdapter(input: {
  baseUrl: string;
  token?: string;
}): ResourcesSyncAdapter {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");

  const headers = (json = true): HeadersInit => {
    const out: Record<string, string> = {};
    if (json) out["Content-Type"] = "application/json";
    if (input.token) out.Authorization = `Bearer ${input.token}`;
    return out;
  };

  return {
    async pull({ lastCursor }) {
      const url = new URL(`${baseUrl}/pull`);
      if (lastCursor) url.searchParams.set("cursor", lastCursor);
      const r = await fetch(url.toString(), {
        method: "GET",
        headers: headers(false),
      });
      if (!r.ok) {
        throw new Error(`Sync pull failed (${r.status})`);
      }
      const data = (await r.json().catch(() => null)) as ResourcesSyncHttpPullResponse | null;
      return {
        backup: data?.backup ?? null,
        remoteCursor: typeof data?.cursor === "string" ? data.cursor : undefined,
      };
    },
    async push({ backup, lastCursor }) {
      const r = await fetch(`${baseUrl}/push`, {
        method: "POST",
        headers: headers(true),
        body: JSON.stringify({ backup, cursor: lastCursor }),
      });
      if (!r.ok) {
        throw new Error(`Sync push failed (${r.status})`);
      }
      const data = (await r.json().catch(() => null)) as ResourcesSyncHttpPushResponse | null;
      return {
        accepted: data?.accepted !== false,
        remoteCursor: typeof data?.cursor === "string" ? data.cursor : undefined,
      };
    },
  };
}

export function loadResourcesSyncCursor(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(RESOURCES_SYNC_CURSOR_KEY);
    if (!value) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function saveResourcesSyncCursor(cursor?: string) {
  if (typeof window === "undefined") return;
  try {
    if (!cursor) {
      window.localStorage.removeItem(RESOURCES_SYNC_CURSOR_KEY);
      return;
    }
    window.localStorage.setItem(RESOURCES_SYNC_CURSOR_KEY, cursor);
  } catch {
    // ignore
  }
}

export async function syncResourcesLocalFirst(input: {
  adapter: ResourcesSyncAdapter;
  lastCursor?: string;
}): Promise<ResourcesSyncRunSummary> {
  const pull = await input.adapter.pull({ lastCursor: input.lastCursor });

  let importedResources = 0;
  let skippedResources = 0;
  let importedMeta = 0;
  let skippedMeta = 0;

  if (pull.backup) {
    const merged = await importResourcesLibraryBackup({ data: pull.backup });
    importedResources = merged.importedResources;
    skippedResources = merged.skippedResources;
    importedMeta = merged.importedMeta;
    skippedMeta = merged.skippedMeta;
  }

  const localBackup = await exportResourcesLibraryBackup();
  const pushed = await input.adapter.push({
    backup: localBackup,
    lastCursor: pull.remoteCursor,
  });

  return {
    importedResources,
    skippedResources,
    importedMeta,
    skippedMeta,
    pushed: pushed.accepted,
    nextCursor: pushed.remoteCursor ?? pull.remoteCursor,
  };
}
