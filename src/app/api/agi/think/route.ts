import { NextResponse } from "next/server";
import { callBackend } from "@/lib/agi/backend";
import type { ThinkResponse } from "@/lib/agi/types";

export async function POST(request: Request) {
  let body: { cycles?: number } = {};
  try {
    body = await request.json();
  } catch {
    // tolerate empty bodies: fall back to the default cycle count
  }

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
