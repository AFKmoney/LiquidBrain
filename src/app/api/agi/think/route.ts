import { NextResponse } from "next/server";
import { guard } from "@/lib/server/guard";
import { callBackend } from "@/lib/agi/backend";
import type { ThinkResponse } from "@/lib/agi/types";

export async function POST(request: Request) {
  const guarded = await guard(request, { scope: "engine" });
  if (!guarded.ok) return guarded.response;
  // An empty body is fine: the default cycle count applies.
  const body = guarded.body as { cycles?: number };

  const cycles = Math.min(Math.max(Number(body.cycles) || 5, 1), 50);

  const result = await callBackend<ThinkResponse>("/api/think", {
    method: "POST",
    body: { cycles },
  });

  if (!result.ok) {
    return NextResponse.json(
      { cycles_run: 0, active_nodes: 0, error: result.error },
      { status: result.status ?? 503 }
    );
  }

  return NextResponse.json(result.data);
}
