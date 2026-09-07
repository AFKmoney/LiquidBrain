import { NextResponse } from "next/server";
import { guard } from "@/lib/server/guard";
import { callBackend } from "@/lib/agi/backend";
import type { TrainResponse } from "@/lib/agi/types";

export async function POST(request: Request) {
  const guarded = await guard(request, { scope: "engine" });
  if (!guarded.ok) return guarded.response;
  const body = guarded.body as { text?: string };

  const text = (body.text ?? "").toString();
  if (text.trim().length === 0) {
    return NextResponse.json({ loss: -1, error: "Training text is required" }, { status: 400 });
  }

  const result = await callBackend<TrainResponse>("/api/train", {
    method: "POST",
    body: { text },
  });

  if (!result.ok) {
    return NextResponse.json(
      { loss: -1, error: result.error },
      { status: result.status ?? 503 }
    );
  }

  return NextResponse.json(result.data);
}
