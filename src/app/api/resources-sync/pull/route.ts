import { NextResponse } from "next/server";

import { loadResourcesSyncServerState } from "@/lib/resources-sync-server-store";

export const dynamic = "force-static";
export const revalidate = false;

function isAuthorized(req: Request): boolean {
  const expected = process.env.RESOURCES_SYNC_SERVER_TOKEN?.trim();
  if (!expected) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const state = await loadResourcesSyncServerState();

  if (!state) {
    return NextResponse.json({ backup: null, cursor: undefined });
  }

  if (cursor && cursor === state.cursor) {
    return NextResponse.json({ backup: null, cursor: state.cursor });
  }

  return NextResponse.json({
    backup: state.backup,
    cursor: state.cursor,
  });
}
