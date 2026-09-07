import { NextResponse } from "next/server";
import { callBackend } from "@/lib/agi/backend";
import type { PerceiveResponse } from "@/lib/agi/types";

export async function POST(request: Request) {
  let body: { input?: string; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { embedding_dim: 0, perceived: false, memory_stored: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

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
