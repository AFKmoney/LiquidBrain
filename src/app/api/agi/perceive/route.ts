import { NextResponse } from "next/server";
import { guard } from "@/lib/server/guard";
import { callBackend } from "@/lib/agi/backend";
import type { PerceiveResponse } from "@/lib/agi/types";

export async function POST(request: Request) {
  const guarded = await guard(request, { scope: "engine" });
  if (!guarded.ok) return guarded.response;
  const body = guarded.body as { input?: string; message?: string };

  const input = (body.input ?? body.message ?? "").toString();
  if (input.trim().length === 0) {
    return NextResponse.json(
      { embedding_dim: 0, perceived: false, memory_stored: false, error: "Input is required" },
      { status: 400 }
    );
  }

  const result = await callBackend<PerceiveResponse>("/api/perceive", {
    method: "POST",
    body: { input },
  });

  if (!result.ok) {
    return NextResponse.json(
      { embedding_dim: 0, perceived: false, memory_stored: false, error: result.error },
      { status: result.status ?? 503 }
    );
  }

  return NextResponse.json(result.data);
}
