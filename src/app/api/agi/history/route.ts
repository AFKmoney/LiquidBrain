import { NextResponse } from "next/server";
import { clearHistory, isPersistenceAvailable, loadHistory } from "@/lib/agi/history";

export const dynamic = "force-dynamic";

/** GET /api/agi/history?limit=20 → most recent turns, oldest first. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit")) || 20;

  const messages = await loadHistory(limit);
  const persisted = await isPersistenceAvailable();

  return NextResponse.json({ messages, persisted });
}

/** DELETE /api/agi/history → wipe the stored conversation. */
export async function DELETE() {
  const removed = await clearHistory();
  const persisted = await isPersistenceAvailable();
  return NextResponse.json({ ok: true, removed, persisted });
}
