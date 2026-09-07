import { NextResponse } from "next/server";
import { callBackend } from "@/lib/agi/backend";
import type { TrainResponse } from "@/lib/agi/types";

export async function POST(request: Request) {
  let body: { text?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ loss: -1, error: "Invalid JSON body" }, { status: 400 });
  }

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
