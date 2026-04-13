import { NextResponse } from "next/server";

import {
  loadResourcesSyncServerState,
  mergeResourcesBackups,
  saveResourcesSyncServerState,
} from "@/lib/resources-sync-server-store";
import type { ResourcesLibraryBackup } from "@/lib/resources-service";

export const dynamic = "force-static";
export const revalidate = false;

function isAuthorized(req: Request): boolean {
  const expected = process.env.RESOURCES_SYNC_SERVER_TOKEN?.trim();
  if (!expected) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

function normalizeIncomingBackup(raw: unknown): ResourcesLibraryBackup | null {
  const parsed = raw as Partial<ResourcesLibraryBackup>;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.resources) || !Array.isArray(parsed.libraryMeta)) {
    return null;
  }
  return parsed as ResourcesLibraryBackup;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | null
    | {
        backup?: unknown;
        cursor?: string;
      };

  const incoming = normalizeIncomingBackup(body?.backup);
  if (!incoming) {
    return NextResponse.json({ error: "Invalid backup payload" }, { status: 400 });
  }

  const localState = await loadResourcesSyncServerState();
  const merged = mergeResourcesBackups(localState?.backup ?? null, incoming);
  const saved = await saveResourcesSyncServerState({ backup: merged });

  return NextResponse.json({ accepted: true, cursor: saved.cursor });
}
